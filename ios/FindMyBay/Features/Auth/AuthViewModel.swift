// AuthViewModel.swift
//
// Phone-OTP screen state machine. Mirrors `feature/auth/AuthViewModel.kt`
// — phone sanitization, UAE-style validation, request/verify side-effects.
//
// Uses Swift's @Observable so the view re-renders without needing to wrap
// state in @Published. Equivalent of Compose's `collectAsStateWithLifecycle`.

import Foundation
import Observation

@Observable @MainActor
final class AuthViewModel {

    // MARK: - UI state (matches Kotlin's AuthUiState)
    var phone: String = ""
    var code: String = ""
    var challengeId: String? = nil
    var resendInSec: Int = 0
    var loading: Bool = false
    var error: String? = nil
    var otpSent: Bool = false
    var verified: Bool = false

    // MARK: - Deps
    private let auth: AuthRepository

    init(auth: AuthRepository) {
        self.auth = auth
    }

    // MARK: - Input

    func onPhoneChange(_ s: String) {
        phone = Self.sanitizePhone(s)
        error = nil
    }

    func onCodeChange(_ s: String) {
        code = String(s.filter(\.isNumber).prefix(6))
        error = nil
    }

    // MARK: - Actions

    /// Validates the phone, requests an OTP. Calls `onSent(phone)` on success.
    func requestOtp(onSent: @escaping (String) -> Void) {
        guard Self.isLikelyUaePhone(phone) else {
            error = "Enter a valid UAE phone in international format, e.g. +971501234567"
            return
        }
        loading = true
        error = nil
        Task {
            do {
                let challengeId = try await auth.requestOtp(phone: phone)
                self.loading = false
                self.otpSent = true
                self.challengeId = challengeId
                self.resendInSec = 30
                onSent(self.phone)
            } catch {
                self.loading = false
                self.error = Self.friendly(error)
            }
        }
    }

    /// Drives the Google Sign-In flow then POSTs the ID token to the backend.
    /// Calls `onVerified()` on success — same exit point as OTP verify so
    /// the host's navigation logic doesn't need to differentiate.
    func signInWithGoogle(onVerified: @escaping () -> Void) {
        loading = true
        error = nil
        Task {
            NSLog("FmbAuthDebug GoogleSignIn step=start")
            do {
                let google = try await GoogleSignInService.signIn()
                NSLog("FmbAuthDebug GoogleSignIn step=sdk_returned email=%@ idTokenLen=%d",
                      google.email ?? "nil", google.idToken.count)
                _ = try await auth.signInWithGoogle(idToken: google.idToken)
                NSLog("FmbAuthDebug GoogleSignIn step=backend_ok")
                self.loading = false
                self.verified = true
                onVerified()
            } catch GoogleSignInError.userCancelled {
                NSLog("FmbAuthDebug GoogleSignIn step=cancelled")
                self.loading = false
            } catch let GoogleSignInError.notConfigured(why) {
                NSLog("FmbAuthDebug GoogleSignIn step=not_configured reason=%@", why)
                self.loading = false
                self.error = "Google Sign-In not configured: \(why)"
            } catch let GoogleSignInError.noPresenter {
                NSLog("FmbAuthDebug GoogleSignIn step=no_presenter")
                self.loading = false
                self.error = "Could not present Google Sign-In."
            } catch let GoogleSignInError.noIDToken {
                NSLog("FmbAuthDebug GoogleSignIn step=no_idtoken")
                self.loading = false
                self.error = "Google did not return an ID token."
            } catch let GoogleSignInError.other(inner) {
                NSLog("FmbAuthDebug GoogleSignIn step=sdk_failed err=%@", inner.localizedDescription)
                self.loading = false
                self.error = inner.localizedDescription
            } catch {
                NSLog("FmbAuthDebug GoogleSignIn step=other_failed err=%@", error.localizedDescription)
                self.loading = false
                self.error = Self.friendly(error)
            }
        }
    }

    /// Drives the Sign in with Apple flow then POSTs the identity token to
    /// the backend. Same exit-point contract as the Google + OTP flows so
    /// the host's navigation logic stays uniform.
    func signInWithApple(onVerified: @escaping () -> Void) {
        loading = true
        error = nil
        Task {
            NSLog("FmbAuthDebug AppleSignIn step=start")
            do {
                let apple = try await AppleSignInService.signIn()
                NSLog("FmbAuthDebug AppleSignIn step=sdk_returned email=%@ idTokenLen=%d hasName=%@",
                      apple.email ?? "nil", apple.idToken.count,
                      apple.fullName == nil ? "no" : "yes")
                _ = try await auth.signInWithApple(
                    idToken: apple.idToken,
                    nonce: apple.nonce,
                    fullName: apple.fullName
                )
                NSLog("FmbAuthDebug AppleSignIn step=backend_ok")
                self.loading = false
                self.verified = true
                onVerified()
            } catch AppleSignInError.userCancelled {
                NSLog("FmbAuthDebug AppleSignIn step=cancelled")
                self.loading = false
            } catch let AppleSignInError.other(inner) {
                NSLog("FmbAuthDebug AppleSignIn step=sdk_failed err=%@", inner.localizedDescription)
                self.loading = false
                self.error = inner.localizedDescription
            } catch {
                NSLog("FmbAuthDebug AppleSignIn step=other_failed err=%@", error.localizedDescription)
                self.loading = false
                self.error = Self.friendly(error)
            }
        }
    }

    /// Verifies the entered code. Calls `onVerified()` on success.
    func verifyOtp(onVerified: @escaping () -> Void) {
        guard let challengeId else { return }
        guard code.count == 6 else {
            error = "Enter the 6-digit code"
            return
        }
        loading = true
        error = nil
        Task {
            do {
                _ = try await auth.verifyOtp(phone: phone, challengeId: challengeId, code: code)
                self.loading = false
                self.verified = true
                onVerified()
            } catch {
                self.loading = false
                self.error = Self.friendly(error)
            }
        }
    }

    // MARK: - Static helpers (parity with the Kotlin private fns)

    /// Strips spaces / dashes / parens; ensures a leading `+`. Mirrors
    /// `sanitizePhone` in the Kotlin VM exactly.
    static func sanitizePhone(_ s: String) -> String {
        let cleaned = s
            .trimmingCharacters(in: .whitespaces)
            .replacingOccurrences(of: "[\\s\\-()]+", with: "", options: .regularExpression)

        if cleaned.isEmpty                     { return "" }
        if cleaned.hasPrefix("+")              { return cleaned }
        if cleaned.hasPrefix("00")             { return "+" + cleaned.dropFirst(2) }
        if cleaned.hasPrefix("0")              { return "+971" + cleaned.dropFirst() }
        if cleaned.hasPrefix("971")            { return "+" + cleaned }
        return "+" + cleaned
    }

    /// Permissive sanity check — `+<country><digits>` with 9–15 digits after the
    /// `+`. Real validation happens server-side. Mirrors `isLikelyUaePhone`.
    static func isLikelyUaePhone(_ s: String) -> Bool {
        s.range(of: #"^\+\d{9,15}$"#, options: .regularExpression) != nil
    }

    static func friendly(_ e: Error) -> String {
        let msg = (e as? LocalizedError)?.errorDescription ?? e.localizedDescription
        return msg.isEmpty ? "Something went wrong, please try again." : msg
    }
}
