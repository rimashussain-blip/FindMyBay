package ae.findmybay.feature.bookings

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import ae.findmybay.core.realtime.RealtimeClient
import ae.findmybay.data.repo.BookingRepository
import ae.findmybay.domain.model.Booking
import ae.findmybay.service.AlertSafetyNet
import ae.findmybay.service.AlertWindow
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class CancelDialogState(
    val booking: Booking,
    val submitting: Boolean = false,
    val error: String? = null,
)

data class MyBookingsUiState(
    val loading: Boolean = true,
    val bookings: List<Booking> = emptyList(),
    val error: String? = null,
    val cancelDialog: CancelDialogState? = null,
    /** Last refund policy outcome — kept around for a one-shot toast/snackbar. */
    val lastCancelMessage: String? = null,
)

@HiltViewModel
class MyBookingsViewModel @Inject constructor(
    @ApplicationContext private val context: Context,
    private val bookings: BookingRepository,
    private val realtime: RealtimeClient,
) : ViewModel() {

    private val _state = MutableStateFlow(MyBookingsUiState())
    val state: StateFlow<MyBookingsUiState> = _state.asStateFlow()

    init {
        load()
        // Refresh whenever the backend tells us *any* of our bookings changed
        // status (vendor checked in, marked completed/cancelled, etc.).
        viewModelScope.launch {
            realtime.bookingStatus.collect { _ -> load(silent = true) }
        }
    }

    fun load(silent: Boolean = false) {
        if (!silent) _state.update { it.copy(loading = true, error = null) }
        viewModelScope.launch {
            runCatching { bookings.mine() }
                .onSuccess { list -> _state.update { it.copy(loading = false, bookings = list) } }
                .onFailure { e -> _state.update { it.copy(loading = false, error = e.message ?: "Couldn't load bookings") } }
        }
    }

    /** Show the confirm-cancel dialog for [booking]. */
    fun askCancel(booking: Booking) {
        _state.update { it.copy(cancelDialog = CancelDialogState(booking = booking)) }
    }

    fun dismissCancelDialog() {
        _state.update { it.copy(cancelDialog = null) }
    }

    fun consumeCancelMessage() {
        _state.update { it.copy(lastCancelMessage = null) }
    }

    /** Confirm: actually call the backend. */
    fun confirmCancel() {
        val current = _state.value.cancelDialog ?: return
        if (current.submitting) return
        _state.update { it.copy(cancelDialog = current.copy(submitting = true, error = null)) }
        viewModelScope.launch {
            runCatching { bookings.cancel(current.booking.id) }
                .onSuccess { outcome ->
                    val msg = if (outcome.refundPolicy == "free")
                        "Cancelled. You won't be charged."
                    else
                        "Cancelled. AED 10 fee applies (within 30 minutes of slot)."
                    _state.update {
                        it.copy(
                            cancelDialog = null,
                            lastCancelMessage = msg,
                            // Optimistically flip status locally so UI updates without
                            // waiting for the realtime push or a refetch.
                            bookings = it.bookings.map { b ->
                                if (b.id == current.booking.id) b.copy(status = "cancelled") else b
                            },
                        )
                    }
                    // Tear down both alert helpers so we don't keep a
                    // foreground worker running or fire a local notification
                    // for a booking that's been cancelled.
                    AlertWindow.cancel(context, current.booking.id)
                    AlertSafetyNet.cancel(context, current.booking.id)
                    // Refetch in the background to reconcile.
                    load(silent = true)
                }
                .onFailure { e ->
                    _state.update {
                        it.copy(
                            cancelDialog = current.copy(
                                submitting = false,
                                error = e.message ?: "Couldn't cancel booking",
                            ),
                        )
                    }
                }
        }
    }
}
