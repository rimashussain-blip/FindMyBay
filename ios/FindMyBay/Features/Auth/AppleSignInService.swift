// AppleSignInService.swift
//
// Thin async/await wrapper around `ASAuthorizationController`. Returns an
// identity token (a signed JWT) that the iOS app POSTs to `/auth/apple`,
// where the backend validates it against Apple's JWKS and trades it for
// our own access + refresh pair.
//
// Required setup (see `FindMyBay.entitlements` + `project.yml`):
//   1. `com.apple.developer.applesignin = ["Default"]` entitlement.
//   2. "Sign in with Apple" capability enabled on the bundle id on Apple
//      Developer / App Store Connect. Provisioning must be regenerated.
//
// Nonce strategy
// --------------
// We generate a 32-byte cryptographically-random raw nonce, hand its
// SHA-256 hex to ASAuthorizationAppleIDRequest, and forward the **raw**
// nonce to the backend. The backend re-hashes it and matches against the
// `nonce` claim Apple signed into the identity token — replay-resistant
// without any per-user state on the server.
//
// Name handling
// -------------
// Apple only returns the user's full name on the FIRST sign-in. Repeat
// sign-ins return only `sub` + `email`. The wrapper surfaces whatever it
// got; the caller forwards it so the backend can persist it as the new
// user's `fullName` (no-op if we already had one).

import AuthenticationServices
import CryptoKit
import Foundation
import UIKit

enum AppleSignInError: Error, LocalizedError {
    /// User dismissed the system sheet.
    case userCancelled
    /// `ASAuthorizationAppleIDCredential` came back with no identity token.
    /// Should never happen in practice — Apple guarantees this field.
    case noIdentityToken
    /// Token bytes weren't valid UTF-8. Defensive — JWTs are ASCII by spec.
    case malformedToken
    /// No window / presentation anchor available.
    case noPresenter
    /// Generic underlying failure (network down between device + Apple, etc.).
    case other(Error)

    var errorDescription: String? {
        switch self {
        case .userCancelled:    return "Sign-in cancelled."
        case .noIdentityToken:  return "Apple did not return an identity token."
        case .malformedToken:   return "Apple returned a malformed identity token."
        case .noPresenter:      return "No window available to present Apple Sign-In."
        case .other(let e):     return e.localizedDescription
        }
    }
}

/// What we hand back to `AuthViewModel` after a successful sign-in.
struct AppleSignInResult {
    /// JWT identity token signed by Apple. POST this to `/auth/apple` as
    /// `idToken`. ~800–1500 ASCII chars.
    let idToken: String
    /// Raw nonce we generated. POST this to `/auth/apple` as `nonce`.
    /// The backend re-hashes it and matches against the `nonce` claim.
    let nonce: String
    /// Full name as returned by Apple ON THE FIRST SIGN-IN ONLY. nil on
    /// every subsequent sign-in — that's a feature of the API, not a bug.
    let fullName: String?
    /// Email as returned by Apple. May be a real address or a `@privaterelay`
    /// proxy that routes mail back to the user.
    let email: String?
}

@MainActor
final class AppleSignInService: NSObject {

    /// One-shot sign-in. Presents the system sheet and resumes the
    /// continuation when the user finishes (or cancels).
    static func signIn() async throws -> AppleSignInResult {
        let coordinator = Coordinator()
        return try await coordinator.run()
    }
}

// MARK: - Coordinator
//
// `ASAuthorizationController` is delegate-based, not async. We keep a
// per-call coordinator alive for the duration of the request — held by
// the in-flight Task continuation — so its delegate methods stay reachable
// until the system sheet returns.

@MainActor
private final class Coordinator: NSObject,
    ASAuthorizationControllerDelegate,
    ASAuthorizationControllerPresentationContextProviding
{
    // Strong self-reference while the request is in flight. Cleared in
    // `finish(...)` so we don't leak.
    private var retained: Coordinator?
    private var continuation: CheckedContinuation<AppleSignInResult, Error>?
    private var rawNonce: String = ""

    func run() async throws -> AppleSignInResult {
        try await withCheckedThrowingContinuation { cont in
            self.continuation = cont
            self.retained = self

            let raw = Self.randomNonceString()
            self.rawNonce = raw

            let request = ASAuthorizationAppleIDProvider().createRequest()
            request.requestedScopes = [.fullName, .email]
            // Apple signs SHA-256(nonce) into the token's `nonce` claim.
            request.nonce = Self.sha256Hex(raw)

            let controller = ASAuthorizationController(authorizationRequests: [request])
            controller.delegate = self
            controller.presentationContextProvider = self
            controller.performRequests()
        }
    }

    // MARK: - Delegate

    func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithAuthorization authorization: ASAuthorization
    ) {
        guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential else {
            finish(.failure(AppleSignInError.noIdentityToken))
            return
        }
        guard let tokenData = credential.identityToken else {
            finish(.failure(AppleSignInError.noIdentityToken))
            return
        }
        guard let idToken = String(data: tokenData, encoding: .utf8) else {
            finish(.failure(AppleSignInError.malformedToken))
            return
        }

        // Apple only ships the name on the FIRST sign-in. Repeat sign-ins
        // leave `givenName` / `familyName` as nil. We flatten to a single
        // display string so the call site stays trivial.
        let fullName: String? = {
            let parts = [credential.fullName?.givenName, credential.fullName?.familyName]
                .compactMap { $0?.trimmingCharacters(in: .whitespaces) }
                .filter { !$0.isEmpty }
            return parts.isEmpty ? nil : parts.joined(separator: " ")
        }()

        finish(.success(AppleSignInResult(
            idToken: idToken,
            nonce: rawNonce,
            fullName: fullName,
            email: credential.email
        )))
    }

    func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithError error: Error
    ) {
        // ASAuthorizationError.canceled is the user dismissing the sheet —
        // don't surface that as a hard error.
        if let asError = error as? ASAuthorizationError, asError.code == .canceled {
            finish(.failure(AppleSignInError.userCancelled))
        } else {
            finish(.failure(AppleSignInError.other(error)))
        }
    }

    // MARK: - Presentation anchor

    func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        if let anchor = Self.topWindow() {
            return anchor
        }
        // Defensive fallback — should never hit; if there's no window at
        // all the OS would have rejected the request before reaching us.
        return ASPresentationAnchor()
    }

    private static func topWindow() -> UIWindow? {
        let scenes = UIApplication.shared.connectedScenes
        let windowScene = scenes
            .compactMap { $0 as? UIWindowScene }
            .first(where: { $0.activationState == .foregroundActive })
            ?? scenes.compactMap({ $0 as? UIWindowScene }).first
        return windowScene?.windows.first(where: \.isKeyWindow)
            ?? windowScene?.windows.first
    }

    // MARK: - Lifecycle

    private func finish(_ result: Result<AppleSignInResult, Error>) {
        continuation?.resume(with: result)
        continuation = nil
        retained = nil
    }

    // MARK: - Crypto helpers

    /// 32-byte URL-safe ASCII nonce. Same character set Apple's sample uses.
    private static func randomNonceString(length: Int = 32) -> String {
        precondition(length > 0)
        let chars: [Character] = Array(
            "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-._"
        )
        var result = ""
        var remaining = length
        while remaining > 0 {
            var bytes = [UInt8](repeating: 0, count: 16)
            let status = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
            if status != errSecSuccess {
                fatalError("SecRandomCopyBytes failed: \(status)")
            }
            for b in bytes where remaining > 0 {
                if b < chars.count {
                    result.append(chars[Int(b)])
                    remaining -= 1
                }
            }
        }
        return result
    }

    private static func sha256Hex(_ input: String) -> String {
        let data = Data(input.utf8)
        let digest = SHA256.hash(data: data)
        return digest.map { String(format: "%02x", $0) }.joined()
    }
}
