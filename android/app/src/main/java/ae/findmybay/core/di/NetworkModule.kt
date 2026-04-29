package ae.findmybay.core.di

import ae.findmybay.BuildConfig
import ae.findmybay.core.storage.TokenStore
import ae.findmybay.data.api.AuthApi
import ae.findmybay.data.api.BookingApi
import ae.findmybay.data.api.DeviceApi
import ae.findmybay.data.api.PaymentApi
import ae.findmybay.data.api.VendorApi
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory
import java.util.concurrent.TimeUnit
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {

    @Provides
    @Singleton
    fun provideJson(): Json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
        explicitNulls = false
    }

    @Provides
    @Singleton
    fun provideOkHttp(tokenStore: TokenStore): OkHttpClient {
        val log = HttpLoggingInterceptor().apply {
            level = if (BuildConfig.DEBUG) HttpLoggingInterceptor.Level.BODY
                    else HttpLoggingInterceptor.Level.NONE
        }

        // Adds Bearer token to every request when available.
        val auth = okhttp3.Interceptor { chain ->
            val req = chain.request()
            val skip = req.header("No-Auth") != null
            if (skip) {
                chain.proceed(req.newBuilder().removeHeader("No-Auth").build())
            } else {
                val token = runBlocking { tokenStore.accessToken() }
                val newReq = if (token != null)
                    req.newBuilder().addHeader("Authorization", "Bearer $token").build()
                else req
                chain.proceed(newReq)
            }
        }

        return OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(20, TimeUnit.SECONDS)
            .writeTimeout(20, TimeUnit.SECONDS)
            .addInterceptor(auth)
            .addInterceptor(log)
            .build()
    }

    @Provides
    @Singleton
    fun provideRetrofit(client: OkHttpClient, json: Json): Retrofit {
        val contentType = "application/json".toMediaType()
        return Retrofit.Builder()
            .baseUrl(BuildConfig.API_BASE_URL)
            .client(client)
            .addConverterFactory(json.asConverterFactory(contentType))
            .build()
    }

    @Provides @Singleton fun provideAuthApi(r: Retrofit): AuthApi = r.create(AuthApi::class.java)
    @Provides @Singleton fun provideVendorApi(r: Retrofit): VendorApi = r.create(VendorApi::class.java)
    @Provides @Singleton fun provideBookingApi(r: Retrofit): BookingApi = r.create(BookingApi::class.java)
    @Provides @Singleton fun provideDeviceApi(r: Retrofit): DeviceApi = r.create(DeviceApi::class.java)
    @Provides @Singleton fun providePaymentApi(r: Retrofit): PaymentApi = r.create(PaymentApi::class.java)
}
