package ae.findmybay.data.api

import ae.findmybay.data.api.dto.BookingDto
import ae.findmybay.data.api.dto.BookingListResponse
import ae.findmybay.data.api.dto.BookingQrDto
import ae.findmybay.data.api.dto.CancelBookingResponse
import ae.findmybay.data.api.dto.CreateBookingBody
import ae.findmybay.data.api.dto.ReviewBody
import ae.findmybay.data.api.dto.ReviewDto
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

interface BookingApi {

    @POST("bookings")
    suspend fun create(@Body body: CreateBookingBody): BookingDto

    @GET("bookings/me")
    suspend fun mine(): BookingListResponse

    @GET("bookings/{id}/qr")
    suspend fun qr(@Path("id") id: String): BookingQrDto

    @POST("bookings/{id}/cancel")
    suspend fun cancel(@Path("id") id: String): CancelBookingResponse

    @POST("bookings/{id}/review")
    suspend fun submitReview(
        @Path("id") id: String,
        @Body body: ReviewBody,
    ): ReviewDto

    @GET("bookings/{id}/review")
    suspend fun getReview(@Path("id") id: String): ReviewDto
}
