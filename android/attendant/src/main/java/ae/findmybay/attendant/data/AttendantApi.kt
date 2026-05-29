package ae.findmybay.attendant.data

import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.POST

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
}
