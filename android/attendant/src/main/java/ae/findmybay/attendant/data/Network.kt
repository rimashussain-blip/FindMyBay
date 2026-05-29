package ae.findmybay.attendant.data

import ae.findmybay.attendant.BuildConfig
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import okhttp3.Authenticator
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.Route
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

        // Bare client used *only* for the token-refresh call. It has neither the
        // auth interceptor nor the authenticator, so a 401 here can't recurse.
        val refreshApi = Retrofit.Builder()
            .baseUrl(BuildConfig.API_BASE_URL)
            .client(OkHttpClient.Builder().addInterceptor(log).build())
            .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
            .build()
            .create(AttendantApi::class.java)

        val client = OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(20, TimeUnit.SECONDS)
            .addInterceptor(auth)
            .addInterceptor(log)
            .authenticator(TokenAuthenticator(tokenStore, refreshApi))
            .build()

        return Retrofit.Builder()
            .baseUrl(BuildConfig.API_BASE_URL)
            .client(client)
            .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
            .build()
            .create(AttendantApi::class.java)
    }
}

/**
 * Recovers from an expired (15-min) access token. When the server returns 401,
 * OkHttp calls this to produce a retry request: we swap the stored refresh
 * token for a fresh access/refresh pair and re-issue the original call with the
 * new bearer — all transparently, so screens never hit the 401 dead-end.
 *
 * If the refresh token itself is rejected (expired/revoked) we clear the store
 * so the next launch lands on the login screen.
 */
private class TokenAuthenticator(
    private val tokenStore: TokenStore,
    private val refreshApi: AttendantApi,
) : Authenticator {
    private val lock = Any()

    override fun authenticate(route: Route?, response: Response): Request? {
        val path = response.request.url.encodedPath
        // Never try to refresh the auth calls themselves.
        if (path.endsWith("/auth/login") || path.endsWith("/auth/refresh")) return null
        // One retry only — bail if we've already attached a fresh token once.
        if (responseCount(response) >= 2) return null

        val failedToken = response.request.header("Authorization")?.removePrefix("Bearer ")

        synchronized(lock) {
            // Another in-flight request may have already refreshed the token.
            val current = runBlocking { tokenStore.accessToken() }
            if (current != null && current != failedToken) {
                return response.request.newBuilder()
                    .header("Authorization", "Bearer $current")
                    .build()
            }

            val refresh = runBlocking { tokenStore.refreshToken() } ?: return null
            val fresh = try {
                runBlocking { refreshApi.refresh(RefreshBody(refresh)) }
            } catch (e: Exception) {
                // Refresh token expired/revoked — force a fresh sign-in and
                // signal the nav layer to route back to login.
                runBlocking { tokenStore.clear() }
                SessionManager.markExpired()
                return null
            }

            runBlocking { tokenStore.updateTokens(fresh.accessToken, fresh.refreshToken) }
            return response.request.newBuilder()
                .header("Authorization", "Bearer ${fresh.accessToken}")
                .build()
        }
    }

    private fun responseCount(response: Response): Int {
        var prior = response.priorResponse
        var count = 1
        while (prior != null) {
            count++
            prior = prior.priorResponse
        }
        return count
    }
}
