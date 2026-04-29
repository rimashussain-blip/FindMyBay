package ae.findmybay.data.api

import ae.findmybay.data.api.dto.AuthResponse
import ae.findmybay.data.api.dto.MeDto
import ae.findmybay.data.api.dto.OtpRequestBody
import ae.findmybay.data.api.dto.OtpRequestResponse
import ae.findmybay.data.api.dto.OtpVerifyBody
import ae.findmybay.data.api.dto.UpdateMeBody
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Headers
import retrofit2.http.PATCH
import retrofit2.http.POST

interface AuthApi {

    /** Request an OTP for the given UAE phone number. No auth required. */
    @Headers("No-Auth: true")
    @POST("auth/otp/request")
    suspend fun requestOtp(@Body body: OtpRequestBody): OtpRequestResponse

    /** Verify the OTP and get back JWT tokens. No auth required. */
    @Headers("No-Auth: true")
    @POST("auth/otp/verify")
    suspend fun verifyOtp(@Body body: OtpVerifyBody): AuthResponse

    /** Returns the current user's profile. */
    @GET("auth/me")
    suspend fun me(): MeDto

    /** Patches editable profile fields. */
    @PATCH("auth/me")
    suspend fun updateMe(@Body body: UpdateMeBody): MeDto
}
