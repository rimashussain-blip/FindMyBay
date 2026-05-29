package ae.findmybay.attendant.data

import ae.findmybay.attendant.ui.components.Tier
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import kotlin.math.roundToInt

// ─── Domain models the UI consumes ──────────────────────────────────────────
data class BayView(
    val name: String,
    val state: String, // free | busy | closed
    val customer: String? = null,
    val service: String? = null,
    val remainMin: Int = 0,
    val pct: Float = 0f,
)

data class UpNextView(
    val bookingId: String,
    val time: String,
    val name: String,
    val tier: Tier,
    val service: String,
    val bay: String,
)

data class BayBoardData(
    val brandName: String,
    val vendorStatus: String,
    val bays: List<BayView>,
    val upNext: List<UpNextView>,
    val freeCount: Int,
    val busyCount: Int,
    val closedCount: Int,
)

class AttendantRepository(
    private val tokenStore: TokenStore,
    private val apiProvider: () -> AttendantApi,
) {
    private val api get() = apiProvider()

    suspend fun login(email: String, password: String) {
        val res = api.login(LoginBody(email.trim().lowercase(), password))
        tokenStore.save(res.accessToken, res.refreshToken, res.user.role)
    }

    suspend fun signOut() = tokenStore.clear()

    suspend fun isSignedIn(): Boolean = tokenStore.isSignedIn()

    /** Pull /admin/me + /admin/bookings/today and assemble the bay board. */
    suspend fun loadBayBoard(): BayBoardData {
        val me = api.me()
        val bookings = api.bookingsToday().items
        tokenStore.saveBrand(me.vendor.brandName)

        val now = OffsetDateTime.now()

        // Index in-progress bookings by bay so busy tiles can show the customer.
        val activeByBay = bookings
            .filter { it.status == "in_progress" }
            .associateBy { it.bay.id }

        val bays = me.vendor.bays.map { bay ->
            if (bay.status == "busy") {
                val b = activeByBay[bay.id]
                if (b != null) {
                    val remain = minutesUntil(b.slotEnd, now)
                    val pct = elapsedPct(b.slotStart, b.slotEnd, now)
                    BayView(bay.name, "busy", b.customer.fullName ?: b.customer.phone ?: "In progress", b.service.name, remain, pct)
                } else {
                    BayView(bay.name, "busy", "In progress", null, 0, 0f)
                }
            } else {
                BayView(bay.name, bay.status)
            }
        }

        // Up next = confirmed / alerted, soonest first.
        val upNext = bookings
            .filter { it.status in setOf("confirmed", "alert_scheduled", "alerted") }
            .sortedBy { it.slotStart }
            .take(3)
            .map {
                UpNextView(
                    bookingId = it.id,
                    time = formatTime(it.slotStart),
                    name = it.customer.fullName ?: it.customer.phone ?: "Walk-in",
                    tier = tierOf(it.customer.loyalty?.tier),
                    service = it.service.name,
                    bay = it.bay.name,
                )
            }

        return BayBoardData(
            brandName = me.vendor.brandName,
            vendorStatus = me.vendor.status.replaceFirstChar { it.uppercase() },
            bays = bays,
            upNext = upNext,
            freeCount = bays.count { it.state == "free" },
            busyCount = bays.count { it.state == "busy" },
            closedCount = bays.count { it.state == "closed" },
        )
    }

    // ─── helpers ──────────────────────────────────────────────────────────
    private fun tierOf(raw: String?): Tier = when (raw?.lowercase()) {
        "platinum" -> Tier.Platinum
        "gold" -> Tier.Gold
        "silver" -> Tier.Silver
        else -> Tier.Bronze
    }

    private fun formatTime(iso: String): String = try {
        OffsetDateTime.parse(iso)
            .atZoneSameInstant(ZoneId.systemDefault())
            .format(DateTimeFormatter.ofPattern("HH:mm"))
    } catch (e: Exception) { "--:--" }

    private fun minutesUntil(isoEnd: String, now: OffsetDateTime): Int = try {
        val end = OffsetDateTime.parse(isoEnd)
        val mins = java.time.Duration.between(now, end).toMinutes()
        mins.coerceAtLeast(0).toInt()
    } catch (e: Exception) { 0 }

    private fun elapsedPct(isoStart: String, isoEnd: String, now: OffsetDateTime): Float = try {
        val start = OffsetDateTime.parse(isoStart)
        val end = OffsetDateTime.parse(isoEnd)
        val total = java.time.Duration.between(start, end).toMinutes().toFloat()
        val elapsed = java.time.Duration.between(start, now).toMinutes().toFloat()
        if (total <= 0f) 0f else (elapsed / total).coerceIn(0f, 1f)
    } catch (e: Exception) { 0f }
}
