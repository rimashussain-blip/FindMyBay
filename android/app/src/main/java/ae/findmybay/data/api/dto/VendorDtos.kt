package ae.findmybay.data.api.dto

import kotlinx.serialization.Serializable

@Serializable
data class VendorListResponse(val items: List<VendorDto>)

@Serializable
data class VendorDto(
    val id: String,
    val brandName: String,
    val city: String,
    val emirate: String,
    val lat: Double,
    val lng: Double,
    val distanceMeters: Double,
    val freeBays: Int,
    val rating: Double? = null,
    val priceFromAed: Int? = null,
    val logoUrl: String? = null,
)
