package ae.findmybay.data.repo

import ae.findmybay.data.api.DeviceApi
import ae.findmybay.data.api.LocationBody
import ae.findmybay.data.api.RegisterDeviceBody
import android.util.Log
import com.google.firebase.messaging.FirebaseMessaging
import kotlinx.coroutines.tasks.await
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class DeviceRepository @Inject constructor(
    private val api: DeviceApi,
) {
    suspend fun register(fcmToken: String): Boolean =
        api.register(RegisterDeviceBody(fcmToken)).ok

    /**
     * Fetch the current FCM token from Firebase and register it with the
     * backend. Safe to call any number of times (the backend upserts on
     * fcmToken). Use this after successful login so the device token gets
     * persisted even when [FmbFcmService.onNewToken] fired before the user
     * was signed in.
     */
    suspend fun fetchAndRegister(): Boolean {
        return try {
            val token = FirebaseMessaging.getInstance().token.await()
            Log.i("FmbDevice", "fetchAndRegister: posting token=${token.take(16)}…")
            api.register(RegisterDeviceBody(token)).ok
        } catch (t: Throwable) {
            Log.w("FmbDevice", "fetchAndRegister failed: ${t.message}")
            false
        }
    }

    /** Best-effort POST of the customer's location. Swallows network errors. */
    suspend fun reportLocation(lat: Double, lng: Double, accuracyM: Float? = null): Boolean {
        return try {
            api.reportLocation(LocationBody(lat = lat, lng = lng, accuracyM = accuracyM)).ok
        } catch (t: Throwable) {
            Log.w("FmbDevice", "reportLocation failed: ${t.message}")
            false
        }
    }
}
