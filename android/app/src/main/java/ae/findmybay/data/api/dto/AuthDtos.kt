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
)

@Serializable
data class MeDto(
    val id: String,
    val phone: String? = null,
    val email: String? = null,
    val fullName: String? = null,
    val role: String = "customer",
    val createdAt: String? = null,
)

@Serializable
data class UpdateMeBody(
    val fullName: String? = null,
    val email: String? = null,
)
