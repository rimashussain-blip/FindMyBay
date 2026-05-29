// AuthAPI.swift
//
// Auth endpoints — parity with `data/api/AuthApi.kt` (Retrofit interface).

import Foundation

protocol AuthAPI {
    func requestOtp(_ body: OtpRequestBody) async throws -> OtpRequestResponse
    func verifyOtp(_ body: OtpVerifyBody) async throws -> AuthResponse
    func signInWithGoogle(_ body: GoogleSignInBody) async throws -> AuthResponse
    func signInWithApple(_ body: AppleSignInBody) async throws -> AuthResponse
    func refresh(_ body: RefreshBody) async throws -> RefreshResponse
    func me() async throws -> MeDTO
    func updateMe(_ body: UpdateMeBody) async throws -> MeDTO
    func updateCarProfile(_ body: UpdateCarProfileBody) async throws -> MeDTO
}

struct AuthAPIImpl: AuthAPI {
    let client: APIClient

    func requestOtp(_ body: OtpRequestBody) async throws -> OtpRequestResponse {
        try await client.request(
            .POST, path: "auth/otp/request", body: body,
            headers: [kNoAuthHeader: "true"]
        )
    }

    func verifyOtp(_ body: OtpVerifyBody) async throws -> AuthResponse {
        try await client.request(
            .POST, path: "auth/otp/verify", body: body,
            headers: [kNoAuthHeader: "true"]
        )
    }

    func signInWithGoogle(_ body: GoogleSignInBody) async throws -> AuthResponse {
        try await client.request(
            .POST, path: "auth/google", body: body,
            headers: [kNoAuthHeader: "true"]
        )
    }

    func signInWithApple(_ body: AppleSignInBody) async throws -> AuthResponse {
        try await client.request(
            .POST, path: "auth/apple", body: body,
            headers: [kNoAuthHeader: "true"]
        )
    }

    func refresh(_ body: RefreshBody) async throws -> RefreshResponse {
        // No-Auth: we're explicitly trading the refresh token for a new pair,
        // and any stale access token in the keychain would leak into the
        // header otherwise.
        try await client.request(
            .POST, path: "auth/refresh", body: body,
            headers: [kNoAuthHeader: "true"]
        )
    }

    func me() async throws -> MeDTO {
        try await client.request(.GET, path: "auth/me")
    }

    func updateMe(_ body: UpdateMeBody) async throws -> MeDTO {
        try await client.request(.PATCH, path: "auth/me", body: body)
    }

    func updateCarProfile(_ body: UpdateCarProfileBody) async throws -> MeDTO {
        try await client.request(.PATCH, path: "auth/me/profile", body: body)
    }
}
