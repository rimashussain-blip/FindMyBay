package ae.findmybay.core.net

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import retrofit2.HttpException

/**
 * Map a thrown error from a Retrofit call into a human-friendly message.
 *
 * The backend (Express + HttpError) returns errors in the canonical shape
 *   { "error": { "code": "promo_expired", "message": "Promo can't be applied: expired" } }
 * Retrofit, by default, only stringifies HttpException to "HTTP 409 …" — we
 * want the inner `message`. This helper safely parses the response body
 * and falls back to the raw exception message if the body is malformed or
 * empty (network errors, processor timeouts, etc.).
 */
fun apiErrorMessage(t: Throwable, fallback: String = "Request failed"): String {
    if (t is HttpException) {
        val body = runCatching { t.response()?.errorBody()?.string() }.getOrNull()
        if (!body.isNullOrBlank()) {
            val parsed = runCatching {
                lenientJson.decodeFromString<ErrorEnvelope>(body)
            }.getOrNull()
            val msg = parsed?.error?.message
            if (!msg.isNullOrBlank()) return msg
        }
        // No body / unparseable — give the status code so devs can grep
        // for it, but keep it short.
        return "Request failed (HTTP ${t.code()})"
    }
    return t.message ?: fallback
}

@Serializable
private data class ErrorEnvelope(@SerialName("error") val error: ErrorPayload? = null)

@Serializable
private data class ErrorPayload(
    @SerialName("code") val code: String? = null,
    @SerialName("message") val message: String? = null,
)

private val lenientJson = Json {
    ignoreUnknownKeys = true
    isLenient = true
}
