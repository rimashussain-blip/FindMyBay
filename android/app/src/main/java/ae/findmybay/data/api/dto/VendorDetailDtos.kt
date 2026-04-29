package ae.findmybay.data.api.dto

import kotlinx.serialization.Serializable

@Serializable
data class VendorDetailDto(
    val id: String,
    val brandName: String,
    val city: String,
    val emirate: String,
    val addressLine: String? = null,
    val lat: Double,
    val lng: Double,
    val rating: Double? = null,
    val priceFromAed: Int? = null,
    val logoUrl: String? = null,
    val services: List<ServiceDto>,
    val bays: List<BayDto>,
)

@Serializable
data class ServiceDto(
    val id: String,
    val name: String,
    val durationMin: Int,
    val priceAed: Int,
    val vatInclusive: Boolean = true,
)

@Serializable
data class BayDto(
    val id: String,
    val name: String,
    val bayType: String,
    val status: String,
)

@Serializable
data class AvailabilityResponseDto(
    val serviceId: String,
    val serviceName: String,
    val durationMin: Int,
    val date: String,
    val slots: List<SlotDto>,
)

@Serializable
data class SlotDto(
    val startsAt: String,
    val endsAt: String,
    val available: Boolean,
)
