package ae.findmybay.core.realtime

import ae.findmybay.BuildConfig
import ae.findmybay.core.storage.TokenStore
import android.util.Log
import io.socket.client.IO
import io.socket.client.Socket
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.launch
import org.json.JSONObject
import javax.inject.Inject
import javax.inject.Singleton

private const val TAG = "FmbRealtime"

/**
 * Singleton Socket.io client. Connects once at app start to the backend's
 * realtime channel and re-subscribes to the customer room any time the
 * stored userId changes (login, logout, account switch).
 *
 * Exposes events as Kotlin Flows so feature ViewModels can `collect` them
 * without dealing with Socket.io callbacks directly.
 */
@Singleton
class RealtimeClient @Inject constructor(
    private val tokens: TokenStore,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private val _bookingStatus = MutableSharedFlow<BookingStatusEvent>(extraBufferCapacity = 4)
    val bookingStatus: SharedFlow<BookingStatusEvent> = _bookingStatus.asSharedFlow()

    private var socket: Socket? = null
    private var subscribedUserId: String? = null

    fun start() {
        if (socket != null) return
        // Strip "/" off the API_BASE_URL — Socket.io expects an origin only.
        val origin = BuildConfig.API_BASE_URL.trimEnd('/')
        Log.i(TAG, "connecting to $origin")
        // Don't pin the transport — let Socket.io negotiate (polling first, then upgrade).
        val opts = IO.Options.builder()
            .setReconnection(true)
            .build()
        val s = IO.socket(origin, opts)
        s.on(Socket.EVENT_CONNECT) {
            Log.i(TAG, "connected (id=${s.id()})")
            // Resubscribe on every reconnect so reconnection from sleep works.
            scope.launch { ensureSubscribed(force = true) }
        }
        s.on(Socket.EVENT_DISCONNECT) { args ->
            Log.i(TAG, "disconnected: ${args.firstOrNull()}")
        }
        s.on(Socket.EVENT_CONNECT_ERROR) { args ->
            Log.w(TAG, "connect error: ${args.firstOrNull()}")
        }
        s.on("booking:status") { args ->
            val obj = args.firstOrNull() as? JSONObject ?: return@on
            val bookingId = obj.optString("bookingId").ifBlank { return@on }
            val status = obj.optString("status").ifBlank { return@on }
            Log.i(TAG, "booking:status received bookingId=$bookingId status=$status")
            _bookingStatus.tryEmit(BookingStatusEvent(bookingId, status))
        }
        s.connect()
        socket = s

        // Subscribe whenever userId changes (login completes after start()).
        scope.launch { ensureSubscribed() }
    }

    private suspend fun ensureSubscribed(force: Boolean = false) {
        val userId = tokens.userId()
        if (userId == null) {
            Log.w(TAG, "ensureSubscribed: no userId in TokenStore — sign out + back in")
            return
        }
        if (!force && userId == subscribedUserId) return
        socket?.emit("subscribe:customer", userId)
        subscribedUserId = userId
        Log.i(TAG, "subscribed as customer:$userId")
    }

    /** Re-subscribe after a fresh login, since userId may have changed. */
    fun onLoginChanged() {
        scope.launch { ensureSubscribed(force = true) }
    }
}

data class BookingStatusEvent(val bookingId: String, val status: String)
