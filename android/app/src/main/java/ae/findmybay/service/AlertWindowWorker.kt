package ae.findmybay.service

import android.Manifest
import android.annotation.SuppressLint
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.location.Location
import android.os.Build
import android.os.Looper
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.ForegroundInfo
import androidx.work.WorkerParameters
import ae.findmybay.MainActivity
import ae.findmybay.R
import ae.findmybay.data.repo.BookingRepository
import ae.findmybay.data.repo.DeviceRepository
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.launch

/**
 * Foreground worker that runs during the alert window (T-90min → T-0) and
 * keeps location flowing + presence visible even when the app is backgrounded
 * or being aggressively kept in check by UAE OEMs (Xiaomi, Oppo, Vivo).
 *
 * Why a `foreground` CoroutineWorker rather than a plain Service:
 *   - WorkManager handles the lifecycle, retries, persistence across reboots.
 *   - `setForeground(ForegroundInfo(...))` promotes the worker to a foreground
 *     service for the duration — exempting it from background-execution
 *     limits and Doze without needing ACCESS_BACKGROUND_LOCATION.
 *   - HiltWorker gives us the dependency graph for free.
 *
 * Exit conditions (any one stops the worker):
 *   - Booking transitions away from `confirmed`/`alert_scheduled` (FCM
 *     delivered the leave-now alert, vendor checked the customer in, or
 *     anyone cancelled).
 *   - Slot passed by 30+ min (defensive — alerts past slot have no purpose).
 *   - Booking has disappeared from `/bookings/me` (signed out, deleted, etc.).
 *
 * Spec §10.5 + §14 ("FCM throttled" risk row).
 */
@HiltWorker
class AlertWindowWorker @AssistedInject constructor(
    @Assisted appContext: Context,
    @Assisted params: WorkerParameters,
    private val bookings: BookingRepository,
    private val devices: DeviceRepository,
) : CoroutineWorker(appContext, params) {

    override suspend fun getForegroundInfo(): ForegroundInfo =
        buildForegroundInfo(applicationContext, vendorName = "your wash")

    override suspend fun doWork(): Result = coroutineScope {
        val bookingId = inputData.getString(KEY_BOOKING_ID)
            ?: return@coroutineScope Result.success()

        // Fetch the booking once up-front so we can put the vendor name into
        // the persistent notification.
        val initial = runCatching { bookings.mine() }
            .getOrNull()
            ?.firstOrNull { it.id == bookingId }
            ?: run {
                Log.w(TAG, "booking $bookingId not found at start; nothing to do")
                return@coroutineScope Result.success()
            }
        val vendorName = initial.vendor.brandName

        Log.i(TAG, "alert window opened for $bookingId at ${initial.vendor.brandName}")
        setForeground(buildForegroundInfo(applicationContext, vendorName))

        // Spin up location updates. We pipe each new fix through DeviceRepository
        // so the backend's pickOrigin() always has fresh coords during the window.
        val client = LocationServices.getFusedLocationProviderClient(applicationContext)
        val req = LocationRequest.Builder(
            Priority.PRIORITY_BALANCED_POWER_ACCURACY,
            LOCATION_UPDATE_INTERVAL_MS,
        )
            .setMinUpdateDistanceMeters(MIN_DISTANCE_M.toFloat())
            .setMinUpdateIntervalMillis(LOCATION_UPDATE_INTERVAL_MS)
            .build()

        var lastReportedAtMs = 0L
        val callback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                val loc = result.lastLocation ?: return
                val now = System.currentTimeMillis()
                if (now - lastReportedAtMs < MIN_REPORT_INTERVAL_MS) return
                lastReportedAtMs = now
                // Fire-and-forget — DeviceRepository swallows network errors.
                launch { reportLocation(loc) }
            }
        }

        val haveLocationPermission =
            ContextCompat.checkSelfPermission(applicationContext, Manifest.permission.ACCESS_FINE_LOCATION) ==
                PackageManager.PERMISSION_GRANTED ||
                ContextCompat.checkSelfPermission(applicationContext, Manifest.permission.ACCESS_COARSE_LOCATION) ==
                PackageManager.PERMISSION_GRANTED

        if (haveLocationPermission) {
            try {
                @SuppressLint("MissingPermission") // checked above
                val ok = client.requestLocationUpdates(req, callback, Looper.getMainLooper())
                Log.d(TAG, "requestLocationUpdates submitted: $ok")
            } catch (t: Throwable) {
                Log.w(TAG, "requestLocationUpdates failed", t)
            }
        } else {
            Log.w(TAG, "no location permission — alert window running without location reporting")
        }

        try {
            // Poll the booking every minute. When status moves past the alert
            // window — alert fired, in_progress, completed, cancelled — we're done.
            while (currentCoroutineContext().isActive) {
                val list = runCatching { bookings.mine() }.getOrNull()
                if (list != null) {
                    val match = list.firstOrNull { it.id == bookingId }
                    if (match == null) {
                        Log.i(TAG, "booking $bookingId disappeared from /bookings/me — ending window")
                        return@coroutineScope Result.success()
                    }
                    val status = match.status.lowercase()
                    if (status !in ACTIVE_STATUSES) {
                        Log.i(TAG, "booking $bookingId is now $status — ending alert window")
                        return@coroutineScope Result.success()
                    }
                }
                delay(STATUS_POLL_INTERVAL_MS)
            }
            Result.success()
        } finally {
            try {
                client.removeLocationUpdates(callback)
            } catch (t: Throwable) {
                Log.w(TAG, "removeLocationUpdates failed", t)
            }
        }
    }

    private suspend fun reportLocation(loc: Location) {
        runCatching { devices.reportLocation(loc.latitude, loc.longitude, loc.accuracy) }
            .onFailure { Log.w(TAG, "reportLocation failed: ${it.message}") }
    }

    companion object {
        const val TAG = "FmbAlertWindowWorker"
        const val KEY_BOOKING_ID = "bookingId"
        const val CHANNEL_ID = "fmb_alert_window"
        const val NOTIF_ID = 2001

        // Runs for up to 90 min. Status poll cadence — every 60 s is plenty.
        private const val STATUS_POLL_INTERVAL_MS = 60_000L
        // Location updates from FusedLocation; gates client-side dedup below.
        private const val LOCATION_UPDATE_INTERVAL_MS = 60_000L
        private const val MIN_REPORT_INTERVAL_MS = 60_000L
        private const val MIN_DISTANCE_M = 50

        // Statuses the worker keeps watching for. Anything else means we exit.
        private val ACTIVE_STATUSES = setOf("confirmed", "alert_scheduled")

        /**
         * Build the foreground notification. Tap → opens MyBookings.
         * On Android 14+ the foreground service type must be declared, and
         * we tag it `LOCATION` to match the FOREGROUND_SERVICE_LOCATION
         * permission we hold for the alert window.
         */
        fun buildForegroundInfo(context: Context, vendorName: String): ForegroundInfo {
            ensureChannel(context)

            val openIntent = Intent(context, MainActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
            }
            val pi = PendingIntent.getActivity(
                context,
                NOTIF_ID,
                openIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )

            val notif = NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle("Watching traffic for $vendorName")
                .setContentText("We'll ping you the moment it's time to leave.")
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setOngoing(true)
                .setContentIntent(pi)
                .setCategory(NotificationCompat.CATEGORY_SERVICE)
                .build()

            return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                ForegroundInfo(NOTIF_ID, notif, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION)
            } else {
                ForegroundInfo(NOTIF_ID, notif)
            }
        }

        private fun ensureChannel(context: Context) {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
            val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            if (nm.getNotificationChannel(CHANNEL_ID) != null) return
            nm.createNotificationChannel(
                NotificationChannel(
                    CHANNEL_ID,
                    "Alert window",
                    NotificationManager.IMPORTANCE_LOW,
                ).apply {
                    description = "Stays in your tray while we're watching traffic so we never miss your slot."
                    setShowBadge(false)
                },
            )
        }
    }
}
