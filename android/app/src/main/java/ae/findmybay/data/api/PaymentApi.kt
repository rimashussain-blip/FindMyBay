package ae.findmybay.data.api

import ae.findmybay.data.api.dto.PaymentIntentDto
import ae.findmybay.data.api.dto.PaymentStatusDto
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

interface PaymentApi {

    /** Create or fetch a payment intent for a pending_payment booking. */
    @POST("bookings/{id}/pay")
    suspend fun createIntent(@Path("id") id: String): PaymentIntentDto

    /** Poll the current state of a payment after returning from the Custom Tab. */
    @GET("payments/{ref}/status")
    suspend fun status(@Path("ref") ref: String): PaymentStatusDto
}
