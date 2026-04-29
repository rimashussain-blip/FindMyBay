package ae.findmybay.data.api

import kotlinx.serialization.Serializable
import retrofit2.http.Body
import retrofit2.http.POST

@Serializable
data class RegisterDeviceBody(
    val fcmToken: String,
    val platform: String = "android",
)

@Serializable
data class LocationBody(
    val lat: Double,
    val lng: Double,
    val accuracyM: Float? = null,
)

@Serializable
data class OkResponse(val ok: Boolean)

interface DeviceApi {
    @POST("devices/register")
    suspend fun register(@Body body: RegisterDeviceBody): OkResponse

    /** Push the customer's last-known location for the smart-alert worker. */
    @POST("devices/location")
    suspend fun reportLocation(@Body body: LocationBody): OkResponse
}
