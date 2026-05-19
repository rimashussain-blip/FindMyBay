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
    val vendorLogoUrl: String? = null,
    val bayName: String? = null,
    /** FTA-compliant tax invoice number, null until payment cleared. */
    val invoiceNumber: String? = null,
    val vatAed: Int = 0,
    val totalAed: Int = 0,
    /** Customer's car make ("Toyota") — shown on the QR screen for the attendant. */
    val carMake: String? = null,
    /** Customer's car type ("suv" / "sedan" / etc.) — surface as enum on the client. */
    val carType: String? = null,
    /** Customer's car colour ("Black"). */
    val carColor: String? = null,
    /** Plate number — the most useful tag for the attendant. */
    val carPlate: String? = null,
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
    /** VAT component of [totalAed] in whole AED. 0 if VAT wasn't billed. */
    val vatAed: Int = 0,
    /** AED discount applied via a promo code at booking-create time. 0 if none. */
    val discountAed: Int = 0,
    /** Code of the promo that was applied (e.g. "WELCOME10"). Null if none. */
    val promoCode: String? = null,
    /** FTA-compliant invoice number, null while the booking is still pending payment. */
    val invoiceNumber: String? = null,
    val createdAt: String,
)

data class BookingVendor(
    val id: String,
    val brandName: String,
    val city: String,
    val emirate: String,
    val logoUrl: String? = null,
)
data class BookingService(val id: String, val name: String, val durationMin: Int, val priceAed: Int)
data class BookingBay(val id: String, val name: String)

data class AuthSession(
    val accessToken: String,
    val refreshToken: String,
    val userId: String,
    val phone: String,
    val fullName: String?,
    /**
     * `true` once the customer has filled in mobile + car details + plate
     * during the first-run onboarding flow. `false` for fresh Google sign-ins
     * that haven't completed it yet — the UI routes those to the onboarding
     * screen instead of the map.
     */
    val profileComplete: Boolean = true,
)

/**
 * Car body type — must match the backend `CarType` Postgres enum. The
 * `wireValue` is what the API serialises (lower-case identifier) and what
 * we send back when posting updates.
 */
enum class CarType(val wireValue: String, val display: String) {
    Sedan("sedan", "Sedan"),
    Hatchback("hatchback", "Hatchback"),
    Suv("suv", "SUV"),
    Pickup("pickup", "Pickup"),
    Van("van", "Van"),
    Coupe("coupe", "Coupe"),
    Other("other", "Other");

    companion object {
        fun fromWire(value: String?): CarType? = entries.firstOrNull { it.wireValue == value }
    }
}

data class UserProfile(
    val id: String,
    val phone: String?,
    val email: String?,
    val fullName: String?,
    val role: String,
    val carMake: String? = null,
    val carType: CarType? = null,
    val carColor: String? = null,
    val carPlate: String? = null,
    val profileComplete: Boolean = false,
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
