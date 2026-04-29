package ae.findmybay.service

import android.content.Context
import android.util.Log
import androidx.work.Constraints
import androidx.work.Data
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import java.time.Duration
import java.time.OffsetDateTime
import java.util.concurrent.TimeUnit

/**
 * Helpers around [AlertSafetyNetWorker]: schedule one when a booking is
 * confirmed, cancel it when the booking is cancelled. Idempotent — uses a
 * unique work name per booking so re-scheduling replaces the existing one.
 */
object AlertSafetyNet {

    private const val TAG = "FmbSafetyNet"
    /** Fire the safety-net at slot − this many minutes. */
    private const val FIRE_BEFORE_SLOT_MIN = 5L

    /**
     * Schedule a one-shot worker for [slotStartIso] − 5 min. If the slot is
     * already within 5 min (or in the past), no-op — the smart-alert engine
     * has either already fired or it's too late to be useful.
     */
    fun schedule(context: Context, bookingId: String, slotStartIso: String) {
        val slot = runCatching { OffsetDateTime.parse(slotStartIso) }.getOrNull() ?: return
        val fireAt = slot.minusMinutes(FIRE_BEFORE_SLOT_MIN)
        val delay = Duration.between(OffsetDateTime.now(), fireAt)
        if (delay.isNegative || delay.toMinutes() < 1) {
            Log.d(TAG, "schedule: slot for $bookingId is too soon, skipping safety net")
            return
        }

        val req = OneTimeWorkRequestBuilder<AlertSafetyNetWorker>()
            .setInitialDelay(delay.toMillis(), TimeUnit.MILLISECONDS)
            .setConstraints(
                Constraints.Builder()
                    .setRequiredNetworkType(NetworkType.CONNECTED)
                    .build(),
            )
            .setInputData(
                Data.Builder().putString(AlertSafetyNetWorker.KEY_BOOKING_ID, bookingId).build(),
            )
            .addTag(TAG_PREFIX + bookingId)
            .build()

        WorkManager.getInstance(context).enqueueUniqueWork(
            workName(bookingId),
            ExistingWorkPolicy.REPLACE,
            req,
        )
        Log.i(TAG, "scheduled safety net for $bookingId at $fireAt (in ${delay.toMinutes()} min)")
    }

    /** Cancel the safety net (called from cancel + status-changed flows). */
    fun cancel(context: Context, bookingId: String) {
        WorkManager.getInstance(context).cancelUniqueWork(workName(bookingId))
        Log.i(TAG, "cancelled safety net for $bookingId")
    }

    private const val TAG_PREFIX = "fmb-safety-net-"
    private fun workName(bookingId: String) = TAG_PREFIX + bookingId
}
