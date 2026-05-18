package ae.findmybay.data.api.dto

import kotlinx.serialization.Serializable

@Serializable
data class CreateBookingBody(
    val vendorId: String,
    val serviceId: String,
    val slotStart: String, // ISO 8601
)

@Serializable
data class BookingDto(
    val id: String,
    val status: String,
    val vendor: BookingVendorDto,
    val service: BookingServiceDto,
    val bay: BookingBayDto,
    val slotStart: String,
    val slotEnd: String,
    val totalAed: Int,
    val vatAed: Int = 0,
    val invoiceNumber: String? = null,
    val createdAt: String,
)

@Serializable
data class BookingListResponse(val items: List<BookingDto>)

@Serializable
data class BookingVendorDto(
    val id: String,
    val brandName: String,
    val city: String,
    val emirate: String,
    val logoUrl: String? = null,
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

@Serializable
data class BookingQrDto(
    val qr: String,
    val bookingId: String,
    val slotStart: String,
    val status: String,
    val vendorName: String? = null,
    val vendorLogoUrl: String? = null,
    val bayName: String? = null,
    /** FTA-compliant tax invoice number, null while pending payment. */
    val invoiceNumber: String? = null,
    val vatAed: Int = 0,
    val totalAed: Int = 0,
    // Customer car details — shown on the QR screen so the attendant
    // immediately sees which car they should expect at the bay.
    val carMake: String? = null,
    val carType: String? = null,
    val carColor: String? = null,
    val carPlate: String? = null,
)

@Serializable
data class CancelBookingResponse(
    val id: String,
    val status: String,
    /** "free" if cancelled >30 min before slot, otherwise "late_fee_aed_10" */
    val refundPolicy: String,
    val minsToSlot: Int,
)

@Serializable
data class ReviewBody(val rating: Int, val note: String? = null)

@Serializable
data class ReviewDto(
    val id: String,
    val bookingId: String,
    val rating: Int,
    val note: String? = null,
    val createdAt: String,
)
