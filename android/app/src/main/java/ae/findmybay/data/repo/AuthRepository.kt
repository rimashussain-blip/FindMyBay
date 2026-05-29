package ae.findmybay.data.repo

import ae.findmybay.core.storage.TokenStore
import ae.findmybay.data.api.AuthApi
import ae.findmybay.data.api.dto.GoogleSignInBody
import ae.findmybay.data.api.dto.OtpRequestBody
import ae.findmybay.data.api.dto.OtpVerifyBody
import ae.findmybay.data.api.dto.UpdateMeBody
import ae.findmybay.data.api.dto.UpdateProfileBody
import ae.findmybay.domain.model.AuthSession
import ae.findmybay.domain.model.CarType
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
            profileComplete = resp.user.profileComplete,
        )
    }

    /**
     * Exchange a Google ID token (from GoogleSignInClient) for our JWT pair.
     * Same downstream effects as [verifyOtp] — persist session + register
     * the FCM token. The returned [AuthSession.profileComplete] tells the
     * UI whether to send the user to the onboarding flow or straight to
     * the map.
     */
    suspend fun signInWithGoogle(idToken: String): AuthSession {
        val resp = api.signInWithGoogle(GoogleSignInBody(idToken))
        tokens.save(resp.accessToken, resp.refreshToken, resp.user.id)
        runCatching { devices.fetchAndRegister() }
        return AuthSession(
            accessToken = resp.accessToken,
            refreshToken = resp.refreshToken,
            userId = resp.user.id,
            phone = resp.user.phone ?: "",
            fullName = resp.user.fullName,
            profileComplete = resp.user.profileComplete,
        )
    }

    /**
     * Saves the customer's car profile from the first-run onboarding
     * (mobile + car make + type + colour + plate). Partial updates are
     * accepted — the screen splits the form across two pages.
     */
    suspend fun updateCarProfile(
        phone: String? = null,
        carMake: String? = null,
        carType: CarType? = null,
        carColor: String? = null,
        carPlate: String? = null,
    ): UserProfile = api.updateCarProfile(
        UpdateProfileBody(
            phone = phone,
            carMake = carMake,
            carType = carType?.wireValue,
            carColor = carColor,
            carPlate = carPlate,
        ),
    ).toDomain()

    suspend fun logout() = tokens.clear()

    suspend fun me(): UserProfile = api.me().toDomain()

    suspend fun updateMe(fullName: String? = null, email: String? = null): UserProfile =
        api.updateMe(UpdateMeBody(fullName = fullName, email = email)).toDomain()
}

private fun ae.findmybay.data.api.dto.MeDto.toDomain() = UserProfile(
    id = id,
    phone = phone,
    email = email,
    fullName = fullName,
    role = role,
    carMake = carMake,
    carType = CarType.fromWire(carType),
    carColor = carColor,
    carPlate = carPlate,
    profileComplete = profileComplete,
)
