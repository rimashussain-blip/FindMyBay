package ae.findmybay.attendant.data

import io.socket.client.IO
import io.socket.client.Socket
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow

/** A realtime nudge telling the UI to refetch. */
enum class RealtimeEvent { BayUpdate, BookingChanged }

/**
 * Thin Socket.IO client for live updates. Connects to the backend, joins this
 * vendor's room (`subscribe:vendor`), and republishes the server's
 * `bay:update` / `booking:changed` events as a [SharedFlow] the ViewModels
 * collect to auto-refresh — so a walk-in started on one device, or a status
 * change from the vendor admin, lands on the board within a second without a
 * manual reload.
 *
 * Connection is idempotent and process-wide; socket.io handles reconnection and
 * re-subscribes on every reconnect.
 */
class RealtimeClient(private val baseUrl: String) {
    private val _events = MutableSharedFlow<RealtimeEvent>(extraBufferCapacity = 32)
    val events: SharedFlow<RealtimeEvent> = _events

    @Volatile private var socket: Socket? = null
    @Volatile private var vendorId: String? = null

    @Synchronized
    fun connect(vendorId: String) {
        // Already wired to this vendor — nothing to do.
        if (socket != null && this.vendorId == vendorId) return
        disconnect()
        this.vendorId = vendorId

        val opts = IO.Options().apply {
            transports = arrayOf("websocket", "polling")
            reconnection = true
        }
        val s = IO.socket(baseUrl, opts)
        s.on(Socket.EVENT_CONNECT) { s.emit("subscribe:vendor", vendorId) }
        s.on("bay:update") { _events.tryEmit(RealtimeEvent.BayUpdate) }
        s.on("booking:changed") { _events.tryEmit(RealtimeEvent.BookingChanged) }
        socket = s
        s.connect()
    }

    @Synchronized
    fun disconnect() {
        socket?.let {
            it.off()
            it.disconnect()
        }
        socket = null
        vendorId = null
    }
}
