// GoogleSignInService.swift
//
// Thin wrapper around Google's iOS Sign-In SDK. The view-model only cares
// about "give me an ID token I can POST to /auth/google" — this hides the
// presenting-view-controller / config / token-extraction details.
//
// Required setup before calling `signIn`:
// 1. iOS OAuth Client ID set as `GIDClientID` in Info.plist (or passed in).
// 2. URL scheme = the reversed client ID, registered in Info.plist
//    `CFBundleURLTypes`. Without this the OAuth callback never fires and
//    the SDK silently hangs.

import Foundation
import UIKit
import GoogleSignIn

enum GoogleSignInError: Error, LocalizedError {
    case notConfigured(String)
    case noPresenter
    case noIDToken
    case userCancelled
    case other(Error)

    var errorDescription: String? {
        switch self {
        case .notConfigured(let why): return "Google Sign-In not configured: \(why)"
        case .noPresenter:            return "No view controller available to present Google Sign-In."
        case .noIDToken:              return "Google did not return an ID token."
        case .userCancelled:          return "Sign-in cancelled."
        case .other(let e):           return e.localizedDescription
        }
    }
}

struct GoogleSignInResult {
    /// The JWT we POST to `/auth/google`.
    let idToken: String
    /// Optional metadata — useful for display while the backend validates.
    let email: String?
    let fullName: String?
}

@MainActor
struct GoogleSignInService {

    /// Reads `GIDClientID` (and optional `GIDServerClientID`) from Info.plist
    /// and primes the shared instance once. Safe to call multiple times.
    ///
    /// When `GIDServerClientID` is set, the SDK issues an ID token whose
    /// `aud` claim is the **server** client ID rather than the iOS one.
    /// This is the standard pattern when the backend's Google verifier is
    /// configured against a single Web Client ID across all platforms.
    ///
    /// Returns `false` (with logs) if the app was built without a real
    /// iOS Client ID — callers should disable the Google button in that case.
    @discardableResult
    static func configureFromInfoPlist() -> Bool {
        guard
            let clientId = Bundle.main.object(forInfoDictionaryKey: "GIDClientID") as? String,
            !clientId.isEmpty,
            !clientId.contains("REPLACE_WITH")
        else {
            print("⚠️ GoogleSignIn: GIDClientID is missing or still a placeholder. " +
                  "Set the iOS OAuth Client ID in project.yml and regenerate.")
            return false
        }

        let serverClientId = (Bundle.main.object(forInfoDictionaryKey: "GIDServerClientID") as? String)
            .flatMap { $0.isEmpty || $0.contains("REPLACE_WITH") ? nil : $0 }

        if let serverClientId {
            GIDSignIn.sharedInstance.configuration = GIDConfiguration(
                clientID: clientId,
                serverClientID: serverClientId
            )
        } else {
            GIDSignIn.sharedInstance.configuration = GIDConfiguration(clientID: clientId)
        }
        return true
    }

    static var isConfigured: Bool {
        guard let id = Bundle.main.object(forInfoDictionaryKey: "GIDClientID") as? String else {
            return false
        }
        return !id.isEmpty && !id.contains("REPLACE_WITH")
    }

    /// Drives the Google OAuth flow via the SDK and returns an ID token.
    static func signIn() async throws -> GoogleSignInResult {
        guard isConfigured else {
            throw GoogleSignInError.notConfigured(
                "GIDClientID missing or placeholder — set it in project.yml and regenerate."
            )
        }
        if GIDSignIn.sharedInstance.configuration == nil {
            _ = configureFromInfoPlist()
        }

        guard let presenter = topViewController() else {
            throw GoogleSignInError.noPresenter
        }

        do {
            let signInResult = try await GIDSignIn.sharedInstance.signIn(
                withPresenting: presenter
            )
            let user = signInResult.user
            guard let idToken = user.idToken?.tokenString else {
                throw GoogleSignInError.noIDToken
            }
            return GoogleSignInResult(
                idToken: idToken,
                email: user.profile?.email,
                fullName: user.profile?.name
            )
        } catch let error as NSError where error.code == GIDSignInError.canceled.rawValue {
            throw GoogleSignInError.userCancelled
        } catch {
            throw GoogleSignInError.other(error)
        }
    }

    static func signOut() {
        GIDSignIn.sharedInstance.signOut()
    }

    // MARK: - Presenter resolution

    /// Walks the active scene's window hierarchy to find the topmost VC
    /// that we can hand to the Google SDK.
    private static func topViewController() -> UIViewController? {
        let scenes = UIApplication.shared.connectedScenes
        guard let windowScene = scenes
                .compactMap({ $0 as? UIWindowScene })
                .first(where: { $0.activationState == .foregroundActive })
                ?? scenes.compactMap({ $0 as? UIWindowScene }).first
        else { return nil }

        guard let root = windowScene.windows.first(where: \.isKeyWindow)?.rootViewController
                ?? windowScene.windows.first?.rootViewController
        else { return nil }

        var top = root
        while let presented = top.presentedViewController { top = presented }
        return top
    }
}
