package ae.findmybay.service

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import ae.findmybay.MainActivity
import ae.findmybay.R
import ae.findmybay.data.repo.DeviceRepository
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import javax.inject.Inject

@AndroidEntryPoint
class FmbFcmService : FirebaseMessagingService() {

    @Inject lateinit var deviceRepository: DeviceRepository

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    /** Called by FCM whenever the device's token rotates. */
    override fun onNewToken(token: String) {
        super.onNewToken(token)
        // Best-effort registration. If the user isn't logged in yet, the
        // server interceptor will skip the auth header and the call will 401;
        // we'll re-register after login from MainActivity.
        scope.launch {
            runCatching { deviceRepository.register(token) }
        }
    }

    /** Called when a push arrives. */
    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
        val data = message.data
        val kind = data["kind"] ?: return
        when (kind) {
            "leave_now" -> {
                val bookingId = data["bookingId"]
                val vendorId = data["vendorId"]
                val etaMin = data["etaMin"]
                val title = message.notification?.title ?: "Time to leave for your wash"
                val body = message.notification?.body ?: "Your booking is approaching"
                showLeaveNowNotification(title, body, bookingId, vendorId, etaMin)
                // FCM made it through. Tear down both alert helpers so we
                // don't keep watching traffic or fire a duplicate local
                // notification at slot − 5 min.
                bookingId?.let {
                    AlertWindow.cancel(applicationContext, it)
                    AlertSafetyNet.cancel(applicationContext, it)
                }
            }
            "wash_complete" -> {
                val bookingId = data["bookingId"] ?: return
                val title = message.notification?.title ?: "✨ Your car is fresh & ready"
                val body = message.notification?.body
                    ?: "Your wash is done. Pick up whenever you're ready."
                showWashCompleteNotification(title, body, bookingId)
                // Wash is done — both alert helpers are moot.
                AlertWindow.cancel(applicationContext, bookingId)
                AlertSafetyNet.cancel(applicationContext, bookingId)
            }
        }
    }

    private fun showWashCompleteNotification(title: String, body: String, bookingId: String) {
        ensureChannel()

        // Tap → open the rate screen for this booking.
        val rateIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("alert.kind", "wash_complete")
            putExtra("alert.bookingId", bookingId)
        }
        val ratePi = PendingIntent.getActivity(
            this, 1, rateIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val notif = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_menu_send)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setCategory(NotificationCompat.CATEGORY_STATUS)
            .setAutoCancel(true)
            .setContentIntent(ratePi)
            .addAction(
                android.R.drawable.btn_star,
                "Rate wash",
                ratePi,
            )
            .build()

        val nm = NotificationManagerCompat.from(this)
        if (nm.areNotificationsEnabled()) {
            nm.notify(NOTIF_WASH_COMPLETE_ID, notif)
        }
    }

    private fun showLeaveNowNotification(
        title: String,
        body: String,
        bookingId: String?,
        vendorId: String?,
        etaMin: String?,
    ) {
        ensureChannel()

        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("alert.kind", "leave_now")
            bookingId?.let { putExtra("alert.bookingId", it) }
            vendorId?.let { putExtra("alert.vendorId", it) }
            etaMin?.let { putExtra("alert.etaMin", it) }
        }
        val pi = PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val notif = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setAutoCancel(true)
            .setContentIntent(pi)
            .setFullScreenIntent(pi, true)
            .build()

        val nm = NotificationManagerCompat.from(this)
        if (nm.areNotificationsEnabled()) {
            nm.notify(NOTIF_ID, notif)
        }
    }

    private fun ensureChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        if (nm.getNotificationChannel(CHANNEL_ID) == null) {
            nm.createNotificationChannel(
                NotificationChannel(
                    CHANNEL_ID,
                    "Smart alerts",
                    NotificationManager.IMPORTANCE_HIGH,
                ).apply {
                    description = "Reminds you when it's time to leave for your wash."
                    enableLights(true)
                    enableVibration(true)
                },
            )
        }
    }

    companion object {
        const val CHANNEL_ID = "fmb_alerts"
        private const val NOTIF_ID = 1001
        private const val NOTIF_WASH_COMPLETE_ID = 1002
    }
}
