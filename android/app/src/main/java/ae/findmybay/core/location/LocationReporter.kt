package ae.findmybay.core.location

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.os.Looper
import android.util.Log
import androidx.core.content.ContextCompat
import ae.findmybay.core.storage.TokenStore
import ae.findmybay.data.repo.DeviceRepository
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.concurrent.atomic.AtomicBoolean
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Pushes the customer's GPS reading to /devices/location while the app is in
 * the foreground and the user is signed in. Used by the smart-alert worker
 * to compute a real ETA instead of falling back to a stub Dubai coordinate.
 *
 * Foreground only. Background reporting needs ACCESS_BACKGROUND_LOCATION
 * which has its own permission flow + battery rules — that's a separate
 * piece tracked in spec §8.3.
 *
 * Lifecycle: MainActivity calls [start] from `lifecycleScope.launch` in
 * `onResume`, [stop] in `onPause`. [start] is `suspend` and dispatches the
 * Play-services interaction to `Dispatchers.IO` so a slow Play-services
 * initialisation can never block the UI thread on cold launch.
 *
 * Throttling:
 *   - FusedLocation gives us at most one update every UPDATE_INTERVAL_MS.
 *   - We additionally drop updates that are < MIN_DISTANCE_M from the last
 *     posted point AND newer than MIN_INTERVAL_MS — to keep API traffic
 *     and battery sane.
 */
@Singleton
class LocationReporter @Inject constructor(
    @ApplicationContext private val context: Context,
    private val deviceRepo: DeviceRepository,
    private val tokenStore: TokenStore,
) {

    // Lazy + nullable so a Play-services failure never throws at construction.
    @Volatile private var fused: FusedLocationProviderClient? = null
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var inFlight: Job? = null
    private var lastPostedAtMs: Long = 0L
    private var lastPostedLat: Double = 0.0
    private var lastPostedLng: Double = 0.0
    private val started = AtomicBoolean(false)

    private val callback = object : LocationCallback() {
        override fun onLocationResult(result: LocationResult) {
            val loc = result.lastLocation ?: return
            maybePost(loc)
        }
    }

    /**
     * Begin location updates. Idempotent. Suspending so Play-services init
     * happens off the main thread. No-op if location permission isn't yet
     * granted — caller can re-invoke after the user grants.
     */
    suspend fun start() = withContext(Dispatchers.IO) {
        if (!started.compareAndSet(false, true)) return@withContext
        if (!hasLocationPermission()) {
            Log.d(TAG, "start: location permission not granted, deferring")
            started.set(false)
            return@withContext
        }
        try {
            val client = fused ?: LocationServices.getFusedLocationProviderClient(context).also {
                fused = it
            }
            @SuppressLint("MissingPermission") // hasLocationPermission() above
            val req = LocationRequest.Builder(Priority.PRIORITY_BALANCED_POWER_ACCURACY, UPDATE_INTERVAL_MS)
                .setMinUpdateDistanceMeters(MIN_DISTANCE_M.toFloat())
                .setMinUpdateIntervalMillis(UPDATE_INTERVAL_MS)
                .build()
            client.requestLocationUpdates(req, callback, Looper.getMainLooper())
            Log.i(TAG, "start: location updates registered")
        } catch (t: Throwable) {
            Log.w(TAG, "start: failed (${t.javaClass.simpleName}) ${t.message}", t)
            started.set(false) // allow a retry on next onResume
        }
    }

    /** Stop location updates. Idempotent. Safe to call from the main thread. */
    fun stop() {
        if (!started.compareAndSet(true, false)) return
        try {
            fused?.removeLocationUpdates(callback)
        } catch (t: Throwable) {
            Log.w(TAG, "stop: removeLocationUpdates failed", t)
        }
        inFlight?.cancel()
        inFlight = null
        Log.i(TAG, "stop: location updates unregistered")
    }

    private fun maybePost(loc: Location) {
        // Skip if signed out — backend would 401 anyway and the response would
        // also nuke our session via the OkHttp interceptor.
        scope.launch {
            val token = tokenStore.accessToken()
            if (token.isNullOrBlank()) return@launch

            val now = System.currentTimeMillis()
            val sinceLast = now - lastPostedAtMs
            val movedM = if (lastPostedAtMs == 0L) Double.MAX_VALUE
                         else haversine(lastPostedLat, lastPostedLng, loc.latitude, loc.longitude)
            // Either it's been a while OR we've moved meaningfully.
            if (sinceLast < MIN_INTERVAL_MS && movedM < MIN_DISTANCE_M) return@launch

            // Coalesce concurrent posts.
            if (inFlight?.isActive == true) return@launch
            inFlight = scope.launch {
                val ok = deviceRepo.reportLocation(loc.latitude, loc.longitude, loc.accuracy)
                if (ok) {
                    lastPostedAtMs = now
                    lastPostedLat = loc.latitude
                    lastPostedLng = loc.longitude
                    Log.d(TAG, "posted lat=${loc.latitude} lng=${loc.longitude} acc=${loc.accuracy}")
                }
            }
        }
    }

    private fun hasLocationPermission(): Boolean {
        val fine = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION)
        val coarse = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION)
        return fine == PackageManager.PERMISSION_GRANTED || coarse == PackageManager.PERMISSION_GRANTED
    }

    private fun haversine(lat1: Double, lng1: Double, lat2: Double, lng2: Double): Double {
        val r = 6_371_000.0 // earth radius in metres
        val dLat = Math.toRadians(lat2 - lat1)
        val dLng = Math.toRadians(lng2 - lng1)
        val a = Math.sin(dLat / 2).let { it * it } +
            Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) *
            Math.sin(dLng / 2).let { it * it }
        return r * 2 * Math.asin(Math.min(1.0, Math.sqrt(a)))
    }

    private companion object {
        const val TAG = "FmbLocationReporter"
        const val UPDATE_INTERVAL_MS = 90_000L // 90 s — fine-grained enough for the alert engine
        const val MIN_INTERVAL_MS = 60_000L    // never POST more than once per minute
        const val MIN_DISTANCE_M = 100         // … unless the customer has moved > 100 m
    }
}
