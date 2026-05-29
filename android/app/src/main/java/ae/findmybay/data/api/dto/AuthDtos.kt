package ae.findmybay.data.api.dto

import kotlinx.serialization.Serializable

@Serializable
data class OtpRequestBody(val phone: String)

@Serializable
data class OtpRequestResponse(
    val challengeId: String,
    val resendInSec: Int,
)

@Serializable
data class OtpVerifyBody(
    val phone: String,
    val challengeId: String,
    val code: String,
)

@Serializable
data class GoogleSignInBody(val idToken: String)

@Serializable
data class AuthResponse(
    val accessToken: String,
    val refreshToken: String,
    val user: UserDto,
)

@Serializable
data class UserDto(
    val id: String,
    val phone: String? = null,
    val email: String? = null,
    val fullName: String? = null,
    val role: String = "customer",
    // Customer car profile — null until onboarding is completed.
    val carMake: String? = null,
    val carType: String? = null,
    val carColor: String? = null,
    val carPlate: String? = null,
    /** True once phone + carType + carPlate are all set. Drives navigation. */
    val profileComplete: Boolean = false,
)

@Serializable
data class MeDto(
    val id: String,
    val phone: String? = null,
    val email: String? = null,
    val fullName: String? = null,
    val role: String = "customer",
    val carMake: String? = null,
    val carType: String? = null,
    val carColor: String? = null,
    val carPlate: String? = null,
    val profileComplete: Boolean = false,
    val createdAt: String? = null,
)

@Serializable
data class UpdateMeBody(
    val fullName: String? = null,
    val email: String? = null,
)

/**
 * Customer car-profile update body — used by the post-Google-sign-in
 * onboarding screen. All fields optional so the client can split the form
 * across screens (mobile + car details first, plate on a second screen).
 */
@Serializable
data class UpdateProfileBody(
    val phone: String? = null,
    val carMake: String? = null,
    val carType: String? = null,
    val carColor: String? = null,
    val carPlate: String? = null,
)
