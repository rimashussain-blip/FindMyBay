package ae.findmybay.attendant.data

import ae.findmybay.attendant.ui.components.Tier
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter

// ─── Domain models the UI consumes ──────────────────────────────────────────
data class BayView(
    val name: String,
    val state: String, // free | busy | closed
    val customer: String? = null,
    val service: String? = null,
    val remainMin: Int = 0,
    val pct: Float = 0f,
)

// A booking row for the Bookings list + the detail sheet.
data class BookingRow(
    val id: String,
    val time: String,
    val name: String,
    val phone: String?,
    val tier: Tier,
    val service: String,
    val durationMin: Int,
    val bay: String,
    val status: String, // raw backend status
    val totalAed: Int,
    val isWalkIn: Boolean,
    val isFuture: Boolean, // slotStart is on a later calendar day than today
)

data class BayOption(val id: String, val name: String, val bayType: String, val status: String)
data class ServiceOption(val id: String, val name: String, val durationMin: Int, val priceAed: Int)
data class WalkInOptions(val bays: List<BayOption>, val services: List<ServiceOption>)

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

    // Last-loaded bookings, kept so the detail sheet can render a tapped row
    // without a dedicated single-booking endpoint.
    @Volatile
    var cachedBookings: List<BookingRow> = emptyList()
        private set

    fun bookingById(id: String): BookingRow? = cachedBookings.firstOrNull { it.id == id }

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
        cachedBookings = bookings.map { it.toRow() }
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

    /** Full booking list for the Bookings screen + the detail sheet. */
    suspend fun loadBookings(): List<BookingRow> =
        api.bookingsToday().items.map { it.toRow() }.also { cachedBookings = it }

    /** Bays + services for the walk-in pickers. */
    suspend fun loadWalkInOptions(): WalkInOptions {
        val me = api.me()
        return WalkInOptions(
            bays = me.vendor.bays.map { BayOption(it.id, it.name, it.bayType, it.status) },
            services = me.vendor.services.map { ServiceOption(it.id, it.name, it.durationMin, it.priceAed) },
        )
    }

    suspend fun setStatus(id: String, status: String) {
        api.setBookingStatus(id, StatusBody(status))
    }

    suspend fun createWalkIn(bayId: String, serviceId: String, name: String?, phone: String?) {
        api.createWalkIn(
            WalkInBody(
                bayId = bayId,
                serviceId = serviceId,
                walkInName = name?.trim()?.ifBlank { null },
                walkInPhone = phone?.trim()?.ifBlank { null },
            )
        )
    }

    private fun BookingDto.toRow(): BookingRow {
        return BookingRow(
            id = id,
            time = formatTime(slotStart),
            name = customer.fullName ?: customer.phone ?: "Walk-in",
            phone = customer.phone,
            tier = tierOf(customer.loyalty?.tier),
            service = service.name,
            durationMin = service.durationMin,
            bay = bay.name,
            status = status,
            totalAed = totalAed,
            isWalkIn = isWalkIn,
            isFuture = isFutureDay(slotStart),
        )
    }

    private fun isFutureDay(iso: String): Boolean = try {
        val d = OffsetDateTime.parse(iso).atZoneSameInstant(ZoneId.systemDefault()).toLocalDate()
        d.isAfter(LocalDate.now())
    } catch (e: Exception) { false }

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
