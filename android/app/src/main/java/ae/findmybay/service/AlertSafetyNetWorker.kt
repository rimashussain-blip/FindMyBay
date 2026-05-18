package ae.findmybay.service

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import ae.findmybay.MainActivity
import ae.findmybay.R
import ae.findmybay.data.repo.BookingRepository
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject

/**
 * Belt-and-braces safety net for the smart-leave alert.
 *
 * Scheduled at booking-confirmation for `slot_start − 5 min`. When it fires,
 * we hit `/bookings/me` and check whether the alert ever made it to the user
 * (status would have moved past `confirmed` / `alert_scheduled` to `alerted`
 * via the FCM push). If FCM was throttled by an aggressive UAE OEM (Xiaomi,
 * Oppo, Vivo) and the alert never landed, we post a local notification so
 * the customer at least knows their slot is imminent.
 *
 * WorkManager is the right tool here because:
 *   - Survives the app being killed
 *   - Survives device reboot (with a small delay) once enqueued
 *   - Has its own constraints engine independent of FCM
 *
 * Spec §10.5 + §14 ("FCM throttled" risk row).
 */
@HiltWorker
class AlertSafetyNetWorker @AssistedInject constructor(
    @Assisted appContext: Context,
    @Assisted params: WorkerParameters,
    private val bookings: BookingRepository,
) : CoroutineWorker(appContext, params) {

    override suspend fun doWork(): Result {
        val bookingId = inputData.getString(KEY_BOOKING_ID)
            ?: return Result.success() // No id = nothing to do.

        val booking = runCatching { bookings.mine() }
            .getOrNull()
            ?.firstOrNull { it.id == bookingId }
            ?: run {
                Log.w(TAG, "booking $bookingId not found — likely cancelled or signed-out")
                return Result.success()
            }

        // If the alert engine already fired (status moved past confirmed/
        // alert_scheduled), or the booking is no longer active, don't double-
        // notify the customer.
        val status = booking.status.lowercase()
        val needsNotify = status in setOf("confirmed", "alert_scheduled")
        if (!needsNotify) {
            Log.i(
                TAG,
                "booking $bookingId is $status — skipping safety-net (already handled or terminal)",
            )
            return Result.success()
        }

        Log.w(
            TAG,
            "booking $bookingId still $status at slot−5min — FCM likely throttled, posting local notification",
        )
        postLocalNotification(
            context = applicationContext,
            bookingId = booking.id,
            vendorName = booking.vendor.brandName,
        )
        return Result.success()
    }

    companion object {
        const val TAG = "FmbSafetyNetWorker"
        const val KEY_BOOKING_ID = "bookingId"
        const val CHANNEL_ID = "fmb_alerts"
    }
}

/** Post a "you should leave by now" notification when FCM didn't deliver. */
private fun postLocalNotification(
    context: Context,
    bookingId: String,
    vendorName: String,
) {
    val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        if (nm.getNotificationChannel(AlertSafetyNetWorker.CHANNEL_ID) == null) {
            val ch = NotificationChannel(
                AlertSafetyNetWorker.CHANNEL_ID,
                "Smart-leave alerts",
                NotificationManager.IMPORTANCE_HIGH,
            ).apply {
                description = "Tells you when to leave for your wash so you arrive on time."
            }
            nm.createNotificationChannel(ch)
        }
    }

    // Open MainActivity → routed to LeaveNow via the same extras the FCM
    // service uses, so the UX matches the push-driven path.
    val intent = Intent(context, MainActivity::class.java).apply {
        addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
        putExtra("alert.kind", "leave_now")
        putExtra("alert.vendorName", vendorName)
        putExtra("alert.etaMin", "0") // unknown — safety net fires regardless of ETA
        putExtra("alert.slotTime", "")
        putExtra("alert.bookingId", bookingId)
    }
    val pi = PendingIntent.getActivity(
        context,
        bookingId.hashCode(),
        intent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    val notif = NotificationCompat.Builder(context, AlertSafetyNetWorker.CHANNEL_ID)
        .setSmallIcon(R.mipmap.ic_launcher)
        .setContentTitle("Time to leave for $vendorName")
        .setContentText("Your slot is in a few minutes. Tap to see directions.")
        .setStyle(
            NotificationCompat.BigTextStyle().bigText(
                "Your wash slot at $vendorName is starting soon. Tap to open Find My Bay.",
            ),
        )
        .setPriority(NotificationCompat.PRIORITY_HIGH)
        .setCategory(NotificationCompat.CATEGORY_REMINDER)
        .setAutoCancel(true)
        .setContentIntent(pi)
        // Match the FCM path's full-screen takeover so a delayed safety-net
        // fire still grabs the customer's attention. Android shows it like
        // an incoming-call screen when the device is locked, and as a
        // heads-up notification otherwise.
        .setFullScreenIntent(pi, true)
        .build()

    nm.notify(bookingId.hashCode(), notif)
}
