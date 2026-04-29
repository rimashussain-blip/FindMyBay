package ae.findmybay.feature.bookings

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import ae.findmybay.data.repo.BookingRepository
import ae.findmybay.domain.model.BookingQr
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class ShowQrUiState(
    val loading: Boolean = true,
    val qr: BookingQr? = null,
    val error: String? = null,
)

@HiltViewModel
class ShowQrViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val bookings: BookingRepository,
) : ViewModel() {

    val bookingId: String = checkNotNull(savedStateHandle["bookingId"])

    private val _state = MutableStateFlow(ShowQrUiState())
    val state: StateFlow<ShowQrUiState> = _state.asStateFlow()

    init {
        load()
        // Poll every 30s to detect when the vendor scans (status flips to in_progress).
        viewModelScope.launch {
            while (true) {
                delay(30_000)
                if (_state.value.qr?.status != "in_progress") load(silent = true)
            }
        }
    }

    fun load(silent: Boolean = false) {
        if (!silent) _state.update { it.copy(loading = true, error = null) }
        viewModelScope.launch {
            runCatching { bookings.qr(bookingId) }
                .onSuccess { q -> _state.update { it.copy(loading = false, qr = q) } }
                .onFailure { e ->
                    if (!silent) _state.update { it.copy(loading = false, error = e.message ?: "Couldn't load QR") }
                }
        }
    }
}
