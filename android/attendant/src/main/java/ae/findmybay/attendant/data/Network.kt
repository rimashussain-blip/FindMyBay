package ae.findmybay.attendant.data

import ae.findmybay.attendant.BuildConfig
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory
import java.util.concurrent.TimeUnit

object Network {
    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
        explicitNulls = false
    }

    fun buildApi(tokenStore: TokenStore): AttendantApi {
        val log = HttpLoggingInterceptor().apply {
            level = if (BuildConfig.DEBUG) HttpLoggingInterceptor.Level.BASIC
                    else HttpLoggingInterceptor.Level.NONE
        }

        // Attach the bearer token to every request unless the call opts out
        // with a No-Auth header (login).
        val auth = okhttp3.Interceptor { chain ->
            val req = chain.request()
            if (req.header("No-Auth") != null) {
                chain.proceed(req.newBuilder().removeHeader("No-Auth").build())
            } else {
                val token = runBlocking { tokenStore.accessToken() }
                val newReq = if (token != null) {
                    req.newBuilder().addHeader("Authorization", "Bearer $token").build()
                } else req
                chain.proceed(newReq)
            }
        }

        val client = OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(20, TimeUnit.SECONDS)
            .addInterceptor(auth)
            .addInterceptor(log)
            .build()

        return Retrofit.Builder()
            .baseUrl(BuildConfig.API_BASE_URL)
            .client(client)
            .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
            .build()
            .create(AttendantApi::class.java)
    }
}
