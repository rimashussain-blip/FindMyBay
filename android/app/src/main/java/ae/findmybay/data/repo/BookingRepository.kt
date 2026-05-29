package ae.findmybay.data.repo

import ae.findmybay.data.api.BookingApi
import ae.findmybay.data.api.dto.CreateBookingBody
import ae.findmybay.data.api.dto.ReviewBody
import ae.findmybay.domain.model.Booking
import ae.findmybay.domain.model.BookingBay
import ae.findmybay.domain.model.BookingQr
import ae.findmybay.domain.model.BookingService
import ae.findmybay.domain.model.BookingVendor
import ae.findmybay.domain.model.Review
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class BookingRepository @Inject constructor(
    private val api: BookingApi,
) {
    suspend fun create(
        vendorId: String,
        serviceId: String,
        slotStartIso: String,
        promoCode: String? = null,
    ): Booking =
        api.create(
            CreateBookingBody(
                vendorId = vendorId,
                serviceId = serviceId,
                slotStart = slotStartIso,
                promoCode = promoCode?.trim()?.uppercase().takeIf { !it.isNullOrEmpty() },
            ),
        ).toDomain()

    suspend fun mine(): List<Booking> = api.mine().items.map { it.toDomain() }

    suspend fun qr(bookingId: String): BookingQr = api.qr(bookingId).let {
        BookingQr(
            qr = it.qr,
            bookingId = it.bookingId,
            slotStart = it.slotStart,
            status = it.status,
            vendorName = it.vendorName,
            vendorLogoUrl = it.vendorLogoUrl,
            bayName = it.bayName,
            invoiceNumber = it.invoiceNumber,
            vatAed = it.vatAed,
            totalAed = it.totalAed,
            carMake = it.carMake,
            carType = it.carType,
            carColor = it.carColor,
            carPlate = it.carPlate,
        )
    }

    /** Cancel a booking. Returns the refund policy hint. */
    suspend fun cancel(bookingId: String): CancelOutcome {
        val res = api.cancel(bookingId)
        return CancelOutcome(
            status = res.status,
            refundPolicy = res.refundPolicy,
            minsToSlot = res.minsToSlot,
        )
    }

    suspend fun submitReview(bookingId: String, rating: Int, note: String?): Review =
        api.submitReview(bookingId, ReviewBody(rating = rating, note = note)).toDomain()

    suspend fun fetchReview(bookingId: String): Review? = runCatching {
        api.getReview(bookingId).toDomain()
    }.getOrNull()
}

data class CancelOutcome(
    val status: String,
    val refundPolicy: String,
    val minsToSlot: Int,
)

private fun ae.findmybay.data.api.dto.ReviewDto.toDomain() = Review(
    id = id,
    bookingId = bookingId,
    rating = rating,
    note = note,
    createdAt = createdAt,
)

private fun ae.findmybay.data.api.dto.BookingDto.toDomain() = Booking(
    id = id,
    status = status,
    vendor = BookingVendor(vendor.id, vendor.brandName, vendor.city, vendor.emirate, vendor.logoUrl),
    service = BookingService(service.id, service.name, service.durationMin, service.priceAed),
    bay = BookingBay(bay.id, bay.name),
    slotStart = slotStart,
    slotEnd = slotEnd,
    totalAed = totalAed,
    vatAed = vatAed,
    discountAed = discountAed,
    promoCode = promoCode,
    invoiceNumber = invoiceNumber,
    createdAt = createdAt,
)
