package ae.findmybay.attendant.data

import kotlinx.serialization.Serializable

// ─── Auth ─────────────────────────────────────────────────────────────────
@Serializable
data class LoginBody(val email: String, val password: String)

@Serializable
data class LoginResponse(
    val accessToken: String,
    val refreshToken: String,
    val user: LoginUser,
)

@Serializable
data class LoginUser(
    val id: String,
    val role: String,
    val email: String? = null,
    val fullName: String? = null,
)

// POST /auth/refresh — swap a still-valid refresh token for a fresh pair.
// The server rotates the refresh token (single-use), so we persist both.
@Serializable
data class RefreshBody(val refreshToken: String)

@Serializable
data class RefreshResponse(val accessToken: String, val refreshToken: String)

// ─── /admin/me ──────────────────────────────────────────────────────────────
@Serializable
data class MeResponse(
    val vendor: VendorDto,
    val role: String,
    val mustChangePassword: Boolean = false,
)

// POST /auth/password/change
@Serializable
data class ChangePasswordBody(val newPassword: String)

@Serializable
data class OkResponse(val ok: Boolean = false)

@Serializable
data class VendorDto(
    val id: String,
    val brandName: String,
    val status: String,
    val city: String,
    val emirate: String,
    val bays: List<BayDto> = emptyList(),
    val services: List<ServiceDto> = emptyList(),
)

@Serializable
data class BayDto(
    val id: String,
    val name: String,
    val bayType: String,
    val status: String, // free | busy | closed
)

@Serializable
data class ServiceDto(
    val id: String,
    val name: String,
    val durationMin: Int,
    val priceAed: Int,
    val vatInclusive: Boolean = true,
)

// ─── /admin/bookings/today ───────────────────────────────────────────────────
@Serializable
data class BookingsResponse(val items: List<BookingDto> = emptyList())

@Serializable
data class BookingDto(
    val id: String,
    val status: String,
    val slotStart: String,
    val slotEnd: String,
    val totalAed: Int,
    val vatAed: Int = 0,
    val invoiceNumber: String? = null,
    val isWalkIn: Boolean = false,
    val customer: BookingCustomerDto,
    val service: BookingServiceDto,
    val bay: BookingBayDto,
)

@Serializable
data class BookingCustomerDto(
    val id: String? = null,
    val phone: String? = null,
    val fullName: String? = null,
    val loyalty: LoyaltyDto? = null,
)

@Serializable
data class LoyaltyDto(
    val tier: String,
    val lifetimeBookings: Int = 0,
    val lifetimeSpendAed: Int = 0,
    val bookingsAtVendor: Int? = null,
)

@Serializable
data class BookingServiceDto(
    val id: String,
    val name: String,
    val durationMin: Int,
    val priceAed: Int,
)

@Serializable
data class BookingBayDto(val id: String, val name: String)

// ─── Actions ──────────────────────────────────────────────────────────────
@Serializable
data class StatusBody(val status: String) // confirmed|in_progress|completed|cancelled|no_show

@Serializable
data class StatusResponse(val id: String, val status: String)

@Serializable
data class WalkInBody(
    val bayId: String,
    val serviceId: String,
    val walkInName: String? = null,
    val walkInPhone: String? = null,
)

// POST /admin/checkin — scan the customer's signed QR string.
@Serializable
data class CheckinQrBody(val qr: String)

// POST /admin/checkin/code — manual FMB-XXXX short-code fallback.
@Serializable
data class CheckinCodeBody(val code: String)

@Serializable
data class CheckinResponse(
    val ok: Boolean = false,
    val alreadyCheckedIn: Boolean = false,
    val booking: CheckinBookingDto? = null,
)

@Serializable
data class CheckinBookingDto(
    val id: String,
    val status: String? = null,
    val customer: BookingCustomerDto? = null,
    val service: CheckinServiceDto? = null,
    val bay: BookingBayDto? = null,
)

@Serializable
data class CheckinServiceDto(val name: String, val durationMin: Int = 0)
