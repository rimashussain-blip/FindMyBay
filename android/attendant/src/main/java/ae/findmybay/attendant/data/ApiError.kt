package ae.findmybay.attendant.data

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import retrofit2.HttpException

private val errJson = Json { ignoreUnknownKeys = true }

/**
 * Pulls the human-readable message out of the backend's `{ error: { message } }`
 * error envelope, falling back to a caller-supplied default. Use for surfacing
 * actionable failures (e.g. "No active booking found for that code") instead of
 * a bare "HTTP 404".
 */
fun Throwable.apiMessage(fallback: String): String {
    if (this is HttpException) {
        val body = try {
            response()?.errorBody()?.string()
        } catch (e: Exception) {
            null
        }
        if (!body.isNullOrBlank()) {
            try {
                val msg = errJson.parseToJsonElement(body)
                    .jsonObject["error"]?.jsonObject?.get("message")?.jsonPrimitive?.content
                if (!msg.isNullOrBlank()) return msg
            } catch (_: Exception) {
                // fall through to the generic message
            }
        }
        return "$fallback (HTTP ${code()})"
    }
    return message ?: fallback
}
