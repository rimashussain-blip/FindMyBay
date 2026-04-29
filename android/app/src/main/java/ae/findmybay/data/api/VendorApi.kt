package ae.findmybay.data.api

import ae.findmybay.data.api.dto.AvailabilityResponseDto
import ae.findmybay.data.api.dto.VendorDetailDto
import ae.findmybay.data.api.dto.VendorListResponse
import retrofit2.http.GET
import retrofit2.http.Path
import retrofit2.http.Query

interface VendorApi {

    @GET("vendors/nearby")
    suspend fun nearby(
        @Query("lat") lat: Double,
        @Query("lng") lng: Double,
        @Query("radius") radiusMeters: Int = 15_000,
        @Query("serviceId") serviceId: String? = null,
    ): VendorListResponse

    @GET("vendors/{id}")
    suspend fun detail(@Path("id") id: String): VendorDetailDto

    @GET("vendors/{id}/availability")
    suspend fun availability(
        @Path("id") id: String,
        @Query("serviceId") serviceId: String,
        @Query("date") date: String, // YYYY-MM-DD
    ): AvailabilityResponseDto
}
