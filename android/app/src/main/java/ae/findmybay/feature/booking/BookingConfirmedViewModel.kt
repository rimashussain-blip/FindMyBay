package ae.findmybay.feature.booking

import android.content.Context
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import ae.findmybay.data.repo.BookingRepository
import ae.findmybay.domain.model.Booking
import ae.findmybay.service.AlertSafetyNet
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class BookingConfirmedUiState(
    val loading: Boolean = true,
    val booking: Booking? = null,
    val error: String? = null,
)

@HiltViewModel
class BookingConfirmedViewModel @Inject constructor(
    @ApplicationContext private val context: Context,
    savedStateHandle: SavedStateHandle,
    private val bookings: BookingRepository,
) : ViewModel() {

    val bookingId: String = checkNotNull(savedStateHandle["bookingId"])

    private val _state = MutableStateFlow(BookingConfirmedUiState())
    val state: StateFlow<BookingConfirmedUiState> = _state.asStateFlow()

    init { load() }

    private fun load() {
        viewModelScope.launch {
            // The list endpoint already returns the full booking — find ours.
            runCatching { bookings.mine() }
                .onSuccess { list ->
                    val match = list.firstOrNull { it.id == bookingId }
                    if (match != null) {
                        _state.update { it.copy(loading = false, booking = match) }
                        // Schedule the FCM-throttle safety net once we know the
                        // slot start time. Idempotent: replaces any prior
                        // scheduling for this booking.
                        AlertSafetyNet.schedule(context, match.id, match.slotStart)
                    } else {
                        _state.update { it.copy(loading = false, error = "Booking not found") }
                    }
                }
                .onFailure { e ->
                    _state.update { it.copy(loading = false, error = e.message ?: "Couldn't load booking") }
                }
        }
    }
}
