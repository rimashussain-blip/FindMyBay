// AuthRepository.swift
//
// Auth use cases — sits between ViewModels and the AuthAPI. Owns the token
// persistence side-effect on a successful verify so callers don't have to.
// Mirrors `data/repo/AuthRepository.kt` from the Android module.

import Foundation

actor AuthRepository {
    private let api: AuthAPI
    private let tokens: TokenStore

    init(api: AuthAPI, tokens: TokenStore) {
        self.api = api
        self.tokens = tokens
    }

    /// Returns the `challengeId` issued by the server.
    func requestOtp(phone: String) async throws -> String {
        let resp = try await api.requestOtp(OtpRequestBody(phone: phone))
        return resp.challengeId
    }

    /// Verifies OTP, persists tokens to Keychain, and returns the session.
    @discardableResult
    func verifyOtp(phone: String, challengeId: String, code: String) async throws -> AuthSession {
        let resp = try await api.verifyOtp(
            OtpVerifyBody(phone: phone, challengeId: challengeId, code: code)
        )
        let session = AuthSession(
            accessToken: resp.accessToken,
            refreshToken: resp.refreshToken,
            userId: resp.user.id,
            phone: resp.user.phone ?? "",
            fullName: resp.user.fullName
        )
        await tokens.save(session: session)
        // Device/FCM registration runs after the auth header is available.
        // Wired in once Firebase is added to SPM. For now: no-op.
        return session
    }

    /// Sign in with a Google ID token — driven by `GoogleSignInService` in
    /// the UI layer. Server validates the JWT and returns our own session.
    @discardableResult
    func signInWithGoogle(idToken: String) async throws -> AuthSession {
        Self.debugLogJWT(idToken, label: "Google ID token before POST /auth/google")
        let resp = try await api.signInWithGoogle(GoogleSignInBody(idToken: idToken))
        return try await persist(resp)
    }

    /// Pulls the unverified payload out of a JWT so we can read claims
    /// (audience, issuer, email) in the simulator log. Strictly diagnostic —
    /// real verification happens server-side. No-op in release.
    ///
    /// Uses `NSLog` (rather than `print`) because `xcrun simctl log show`
    /// only captures the unified-log stream, not Swift's stdout.
    private static func debugLogJWT(_ jwt: String, label: String) {
        #if DEBUG
        let parts = jwt.split(separator: ".")
        guard parts.count >= 2 else {
            NSLog("FmbAuthDebug %@: malformed JWT (parts=%d)", label, parts.count)
            return
        }
        var payload = String(parts[1])
            .replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/")
        while payload.count % 4 != 0 { payload += "=" }
        guard let data = Data(base64Encoded: payload),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            NSLog("FmbAuthDebug %@: could not decode payload", label)
            return
        }
        let aud   = "\(json["aud"]   ?? "?")"
        let iss   = "\(json["iss"]   ?? "?")"
        let email = "\(json["email"] ?? "?")"
        let azp   = "\(json["azp"]   ?? "?")"
        NSLog("FmbAuthDebug %@ aud=%@ iss=%@ email=%@ azp=%@", label, aud, iss, email, azp)
        #endif
    }

    /// Sign in with an Apple ID token + optional name. The Android module
    /// doesn't have this yet — Apple is iOS-only for now.
    @discardableResult
    func signInWithApple(idToken: String, nonce: String?, fullName: String?) async throws -> AuthSession {
        let resp = try await api.signInWithApple(
            AppleSignInBody(idToken: idToken, nonce: nonce, fullName: fullName)
        )
        return try await persist(resp)
    }

    private func persist(_ resp: AuthResponse) async throws -> AuthSession {
        let session = AuthSession(
            accessToken: resp.accessToken,
            refreshToken: resp.refreshToken,
            userId: resp.user.id,
            phone: resp.user.phone ?? "",
            fullName: resp.user.fullName
        )
        await tokens.save(session: session)
        return session
    }

    func logout() async {
        await tokens.clear()
    }

    func me() async throws -> UserProfile {
        let dto = try await api.me()
        return Self.toDomain(dto)
    }

    func updateMe(fullName: String? = nil, email: String? = nil) async throws -> UserProfile {
        let dto = try await api.updateMe(UpdateMeBody(fullName: fullName, email: email))
        return Self.toDomain(dto)
    }

    /// Onboarding submit — saves phone + car details in one PATCH.
    /// Backend accepts partial bodies, so any nil field is left unchanged.
    func updateCarProfile(
        phone: String? = nil,
        carMake: String? = nil,
        carType: CarType? = nil,
        carColor: String? = nil,
        carPlate: String? = nil
    ) async throws -> UserProfile {
        let body = UpdateCarProfileBody(
            phone: phone, carMake: carMake,
            carType: carType?.rawValue,
            carColor: carColor, carPlate: carPlate
        )
        let dto = try await api.updateCarProfile(body)
        return Self.toDomain(dto)
    }

    private static func toDomain(_ d: MeDTO) -> UserProfile {
        UserProfile(
            id: d.id, phone: d.phone, email: d.email,
            fullName: d.fullName, role: d.role,
            carMake: d.carMake, carType: d.carType,
            carColor: d.carColor, carPlate: d.carPlate,
            profileComplete: d.profileComplete
                ?? ((d.phone != nil) && (d.carType != nil) && (d.carPlate != nil)),
            emailVerifiedAt: d.emailVerifiedAt
        )
    }

    /// Convenience for cold start: do we have a stored session?
    func hasSession() async -> Bool {
        await tokens.session() != nil
    }
}
