package ae.findmybay.domain.model

/** Domain models — pure Kotlin, no framework deps so they're easy to test. */

data class Vendor(
    val id: String,
    val brandName: String,
    val city: String,
    val emirate: String,
    val lat: Double,
    val lng: Double,
    val distanceMeters: Double,
    val freeBays: Int,
    val rating: Double?,
    val priceFromAed: Int?,
    val logoUrl: String?,
)

data class VendorDetail(
    val id: String,
    val brandName: String,
    val city: String,
    val emirate: String,
    val addressLine: String?,
    val lat: Double,
    val lng: Double,
    val rating: Double?,
    val priceFromAed: Int?,
    val logoUrl: String?,
    val services: List<Service>,
    val bays: List<Bay>,
)

data class Service(
    val id: String,
    val name: String,
    val durationMin: Int,
    val priceAed: Int,
    val vatInclusive: Boolean,
)

data class Bay(
    val id: String,
    val name: String,
    val bayType: String,
    val status: String, // free | busy | closed
)

data class Slot(
    val startsAt: String, // ISO 8601
    val endsAt: String,
    val available: Boolean,
)

data class AvailabilityResponse(
    val serviceId: String,
    val serviceName: String,
    val durationMin: Int,
    val date: String,
    val slots: List<Slot>,
)

data class BookingQr(
    val qr: String,
    val bookingId: String,
    val slotStart: String,
    val status: String,
    val vendorName: String? = null,
    val bayName: String? = null,
)

data class Review(
    val id: String,
    val bookingId: String,
    val rating: Int,
    val note: String?,
    val createdAt: String,
)

data class Booking(
    val id: String,
    val status: String,
    val vendor: BookingVendor,
    val service: BookingService,
    val bay: BookingBay,
    val slotStart: String,
    val slotEnd: String,
    val totalAed: Int,
    val createdAt: String,
)

data class BookingVendor(val id: String, val brandName: String, val city: String, val emirate: String)
data class BookingService(val id: String, val name: String, val durationMin: Int, val priceAed: Int)
data class BookingBay(val id: String, val name: String)

data class AuthSession(
    val accessToken: String,
    val refreshToken: String,
    val userId: String,
    val phone: String,
    val fullName: String?,
)

data class UserProfile(
    val id: String,
    val phone: String?,
    val email: String?,
    val fullName: String?,
    val role: String,
) {
    val initials: String get() {
        val source = fullName?.takeIf { it.isNotBlank() } ?: phone ?: email ?: "?"
        return source
            .split(" ", "@", "+", ".")
            .filter { it.isNotBlank() }
            .take(2)
            .map { it.first().uppercaseChar() }
            .joinToString("")
            .ifEmpty { "?" }
    }
}
