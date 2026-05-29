package ae.findmybay.attendant.data

import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Path

interface AttendantApi {
    // Login is unauthenticated; tag it so the auth interceptor skips it.
    @POST("auth/login")
    suspend fun login(
        @Body body: LoginBody,
        @Header("No-Auth") noAuth: String = "1",
    ): LoginResponse

    @GET("admin/me")
    suspend fun me(): MeResponse

    @GET("admin/bookings/today")
    suspend fun bookingsToday(): BookingsResponse

    @PATCH("admin/bookings/{id}/status")
    suspend fun setBookingStatus(
        @Path("id") id: String,
        @Body body: StatusBody,
    ): StatusResponse

    @POST("admin/walk-in")
    suspend fun createWalkIn(@Body body: WalkInBody): BookingDto

    @POST("admin/checkin/code")
    suspend fun checkinByCode(@Body body: CheckinCodeBody): CheckinResponse
}
