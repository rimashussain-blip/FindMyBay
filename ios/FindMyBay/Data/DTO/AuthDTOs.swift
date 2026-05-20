// AuthDTOs.swift
//
// Wire-format types for the auth/* endpoints. Source: data/api/dto/AuthDtos.kt.
// Codable mirrors `@Serializable` on the Kotlin side.

import Foundation

struct OtpRequestBody: Codable {
    let phone: String
}

struct OtpRequestResponse: Codable {
    let challengeId: String
    let resendInSec: Int
}

struct OtpVerifyBody: Codable {
    let phone: String
    let challengeId: String
    let code: String
}

struct AuthResponse: Codable {
    let accessToken: String
    let refreshToken: String
    let user: UserDTO
}

struct UserDTO: Codable {
    let id: String
    let phone: String?
    let email: String?
    let fullName: String?
    let role: String
    // Car profile — present on /auth/google response so client can route to
    // onboarding when profileComplete=false.
    let carMake: String?
    let carType: String?
    let carColor: String?
    let carPlate: String?
    let profileComplete: Bool?

    enum CodingKeys: String, CodingKey {
        case id, phone, email, fullName, role
        case carMake, carType, carColor, carPlate, profileComplete
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id              = try c.decode(String.self, forKey: .id)
        phone           = try c.decodeIfPresent(String.self, forKey: .phone)
        email           = try c.decodeIfPresent(String.self, forKey: .email)
        fullName        = try c.decodeIfPresent(String.self, forKey: .fullName)
        role            = try c.decodeIfPresent(String.self, forKey: .role) ?? "customer"
        carMake         = try c.decodeIfPresent(String.self, forKey: .carMake)
        carType         = try c.decodeIfPresent(String.self, forKey: .carType)
        carColor        = try c.decodeIfPresent(String.self, forKey: .carColor)
        carPlate        = try c.decodeIfPresent(String.self, forKey: .carPlate)
        profileComplete = try c.decodeIfPresent(Bool.self, forKey: .profileComplete)
    }
}

struct MeDTO: Codable {
    let id: String
    let phone: String?
    let email: String?
    let fullName: String?
    let role: String
    let createdAt: String?
    let carMake: String?
    let carType: String?
    let carColor: String?
    let carPlate: String?
    let profileComplete: Bool?
    /// ISO-8601 timestamp the user confirmed their email, or nil if still
    /// unverified. Not currently surfaced in the customer UI — kept on the
    /// model so an "Verify your email" banner can be added later without a
    /// network shape change.
    let emailVerifiedAt: String?

    enum CodingKeys: String, CodingKey {
        case id, phone, email, fullName, role, createdAt
        case carMake, carType, carColor, carPlate, profileComplete
        case emailVerifiedAt
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id              = try c.decode(String.self, forKey: .id)
        phone           = try c.decodeIfPresent(String.self, forKey: .phone)
        email           = try c.decodeIfPresent(String.self, forKey: .email)
        fullName        = try c.decodeIfPresent(String.self, forKey: .fullName)
        role            = try c.decodeIfPresent(String.self, forKey: .role) ?? "customer"
        createdAt       = try c.decodeIfPresent(String.self, forKey: .createdAt)
        carMake         = try c.decodeIfPresent(String.self, forKey: .carMake)
        carType         = try c.decodeIfPresent(String.self, forKey: .carType)
        carColor        = try c.decodeIfPresent(String.self, forKey: .carColor)
        carPlate        = try c.decodeIfPresent(String.self, forKey: .carPlate)
        profileComplete = try c.decodeIfPresent(Bool.self, forKey: .profileComplete)
        emailVerifiedAt = try c.decodeIfPresent(String.self, forKey: .emailVerifiedAt)
    }
}

/// Body for `PATCH /auth/me/profile` — first-run onboarding.
struct UpdateCarProfileBody: Codable {
    var phone: String?
    var carMake: String?
    var carType: String?
    var carColor: String?
    var carPlate: String?
}

/// Body for `POST /auth/refresh` — exchanges a still-valid refresh token for
/// a fresh access + refresh pair. The presented token is single-use.
struct RefreshBody: Codable {
    let refreshToken: String
}

/// Response shape from `/auth/refresh` — same fields as the access portion of
/// `AuthResponse` but no `user` (the client already has it on disk).
struct RefreshResponse: Codable {
    let accessToken: String
    let refreshToken: String
}

struct UpdateMeBody: Codable {
    var fullName: String?
    var email: String?
}

// MARK: - Social sign-in

/// Body for `POST /auth/google`. Backend pattern A — receives the ID token
/// from GoogleSignIn-iOS and validates it server-side against Google's JWKS.
struct GoogleSignInBody: Codable {
    let idToken: String
}

/// Body for `POST /auth/apple`. Same shape as the Google one — backend
/// validates the JWT against Apple's JWKS.
struct AppleSignInBody: Codable {
    let idToken: String
    let nonce: String?
    let fullName: String?
}
