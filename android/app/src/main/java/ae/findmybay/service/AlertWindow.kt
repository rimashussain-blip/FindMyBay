package ae.findmybay.service

import android.content.Context
import android.util.Log
import androidx.work.Constraints
import androidx.work.Data
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.OutOfQuotaPolicy
import androidx.work.WorkManager
import java.time.Duration
import java.time.OffsetDateTime
import java.util.concurrent.TimeUnit

/**
 * Helpers for scheduling/cancelling [AlertWindowWorker]. Pairs with
 * [AlertSafetyNet] — the window worker covers T-90min → T-0 (live foreground
 * tracking), the safety net fires once at T-5min as a last-resort local
 * notification if FCM never landed.
 */
object AlertWindow {

    private const val TAG = "FmbAlertWindow"

    /** Open the alert window 90 min before slot start, per spec §10.2. */
    private const val WINDOW_OPENS_MIN = 90L

    /**
     * Schedule the foreground worker to start at slot − 90 min. If the slot
     * is already inside the window or in the past, start immediately. If the
     * slot is in the past entirely, no-op.
     */
    fun schedule(context: Context, bookingId: String, slotStartIso: String) {
        val slot = runCatching { OffsetDateTime.parse(slotStartIso) }.getOrNull() ?: return
        if (slot.isBefore(OffsetDateTime.now())) {
            Log.d(TAG, "schedule: slot for $bookingId is in the past, skipping window worker")
            return
        }
        val windowOpens = slot.minusMinutes(WINDOW_OPENS_MIN)
        val delay = Duration.between(OffsetDateTime.now(), windowOpens)
        // If the window is already open, start now.
        val initialDelayMs = if (delay.isNegative) 0L else delay.toMillis()

        val req = OneTimeWorkRequestBuilder<AlertWindowWorker>()
            .setInitialDelay(initialDelayMs, TimeUnit.MILLISECONDS)
            .setConstraints(
                Constraints.Builder()
                    .setRequiredNetworkType(NetworkType.CONNECTED)
                    .build(),
            )
            .setExpedited(OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST)
            .setInputData(
                Data.Builder().putString(AlertWindowWorker.KEY_BOOKING_ID, bookingId).build(),
            )
            .addTag(workName(bookingId))
            .build()

        WorkManager.getInstance(context).enqueueUniqueWork(
            workName(bookingId),
            ExistingWorkPolicy.REPLACE,
            req,
        )
        Log.i(
            TAG,
            "scheduled alert window for $bookingId — opens at $windowOpens (in ${delay.toMinutes()} min)",
        )
    }

    /** Cancel the worker for [bookingId]. Idempotent. */
    fun cancel(context: Context, bookingId: String) {
        WorkManager.getInstance(context).cancelUniqueWork(workName(bookingId))
        Log.i(TAG, "cancelled alert window for $bookingId")
    }

    private fun workName(bookingId: String) = "fmb-alert-window-$bookingId"
}
