package ae.findmybay.data.repo

import ae.findmybay.core.storage.TokenStore
import ae.findmybay.data.api.AuthApi
import ae.findmybay.data.api.dto.OtpRequestBody
import ae.findmybay.data.api.dto.OtpVerifyBody
import ae.findmybay.data.api.dto.UpdateMeBody
import ae.findmybay.domain.model.AuthSession
import ae.findmybay.domain.model.UserProfile
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthRepository @Inject constructor(
    private val api: AuthApi,
    private val tokens: TokenStore,
    private val devices: DeviceRepository,
) {

    /** Returns the challengeId issued by the server. */
    suspend fun requestOtp(phone: String): String =
        api.requestOtp(OtpRequestBody(phone)).challengeId

    /** Verifies OTP, persists tokens, and returns the session. */
    suspend fun verifyOtp(phone: String, challengeId: String, code: String): AuthSession {
        val resp = api.verifyOtp(OtpVerifyBody(phone, challengeId, code))
        tokens.save(resp.accessToken, resp.refreshToken, resp.user.id)
        // Push registration runs *after* the auth header is available so the
        // token POST won't 401. We fire-and-forget; failures are logged.
        runCatching { devices.fetchAndRegister() }
        return AuthSession(
            accessToken = resp.accessToken,
            refreshToken = resp.refreshToken,
            userId = resp.user.id,
            phone = resp.user.phone ?: "",
            fullName = resp.user.fullName,
        )
    }

    suspend fun logout() = tokens.clear()

    suspend fun me(): UserProfile = api.me().let {
        UserProfile(
            id = it.id,
            phone = it.phone,
            email = it.email,
            fullName = it.fullName,
            role = it.role,
        )
    }

    suspend fun updateMe(fullName: String? = null, email: String? = null): UserProfile =
        api.updateMe(UpdateMeBody(fullName = fullName, email = email)).let {
            UserProfile(
                id = it.id,
                phone = it.phone,
                email = it.email,
                fullName = it.fullName,
                role = it.role,
            )
        }
}
