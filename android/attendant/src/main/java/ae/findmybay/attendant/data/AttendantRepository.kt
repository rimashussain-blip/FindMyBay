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

/** Outcome of a QR / short-code check-in, shaped for the scanner's result banner. */
data class CheckinResult(
    val alreadyCheckedIn: Boolean,
    val customerName: String,
    val bayName: String?,
    val serviceName: String?,
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
    val mustChangePassword: Boolean = false,
)

class AttendantRepository(
    private val tokenStore: TokenStore,
    private val apiProvider: () -> AttendantApi,
    private val realtime: RealtimeClient,
) {
    private val api get() = apiProvider()

    /** Live refresh nudges from Socket.IO; ViewModels collect this to refetch. */
    val realtimeEvents get() = realtime.events

    // Last-loaded bookings, kept so the detail sheet can render a tapped row
    // without a dedicated single-booking endpoint.
    @Volatile
    var cachedBookings: List<BookingRow> = emptyList()
        private set

    fun bookingById(id: String): BookingRow? = cachedBookings.firstOrNull { it.id == id }

    suspend fun login(email: String, password: String) {
        val res = api.login(LoginBody(email.trim().lowercase(), password))
        tokenStore.save(res.accessToken, res.refreshToken, res.user.role)
        // /auth/login succeeds for any account (it's shared with the customer
        // app + vendor admin). The attendant app is staff-only, so verify the
        // account is actually vendor staff before declaring success — otherwise
        // a non-staff user lands on a broken Bay Board with a raw 403. On
        // failure, drop the tokens so we don't leave a half-signed-in state and
        // rethrow so the login screen shows the friendly message.
        try {
            api.me()
        } catch (e: Exception) {
            tokenStore.clear()
            throw e
        }
    }

    suspend fun signOut() {
        realtime.disconnect()
        tokenStore.clear()
    }

    suspend fun isSignedIn(): Boolean = tokenStore.isSignedIn()

    /** Pull /admin/me + /admin/bookings/today and assemble the bay board. */
    suspend fun loadBayBoard(): BayBoardData {
        val me = api.me()
        val bookings = api.bookingsToday().items
        cachedBookings = bookings.map { it.toRow() }
        tokenStore.saveBrand(me.vendor.brandName)
        // Now we know the vendor id — open (or keep) the realtime subscription.
        realtime.connect(me.vendor.id)

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
            mustChangePassword = me.mustChangePassword,
        )
    }

    /** First-login set-new-password (clears the server's mustChangePassword). */
    suspend fun changePassword(newPassword: String) {
        api.changePassword(ChangePasswordBody(newPassword))
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

    /** Check a customer in by their scanned QR string. */
    suspend fun checkInByQr(qr: String): CheckinResult = api.checkinByQr(CheckinQrBody(qr)).toResult()

    /** Check a customer in by the typed FMB-XXXX short code. */
    suspend fun checkInByCode(code: String): CheckinResult = api.checkinByCode(CheckinCodeBody(code.trim())).toResult()

    private fun CheckinResponse.toResult(): CheckinResult {
        val b = booking
        return CheckinResult(
            alreadyCheckedIn = alreadyCheckedIn,
            customerName = b?.customer?.fullName ?: b?.customer?.phone ?: "Customer",
            bayName = b?.bay?.name,
            serviceName = b?.service?.name,
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
