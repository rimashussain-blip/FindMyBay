package ae.findmybay.feature.bookings

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import ae.findmybay.data.repo.BookingRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class RateBookingUiState(
    val rating: Int = 0,
    val note: String = "",
    val submitting: Boolean = false,
    val submitted: Boolean = false,
    val error: String? = null,
)

@HiltViewModel
class RateBookingViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val bookings: BookingRepository,
) : ViewModel() {

    val bookingId: String = checkNotNull(savedStateHandle["bookingId"])

    private val _state = MutableStateFlow(RateBookingUiState())
    val state: StateFlow<RateBookingUiState> = _state.asStateFlow()

    init {
        // If a review already exists, prefill it (so the user sees "edit" instead of fresh form).
        viewModelScope.launch {
            bookings.fetchReview(bookingId)?.let { existing ->
                _state.update { it.copy(rating = existing.rating, note = existing.note.orEmpty()) }
            }
        }
    }

    fun setRating(stars: Int) = _state.update { it.copy(rating = stars.coerceIn(0, 5)) }
    fun setNote(text: String) = _state.update { it.copy(note = text.take(500)) }

    fun submit() {
        val s = _state.value
        if (s.rating < 1 || s.submitting) return
        _state.update { it.copy(submitting = true, error = null) }
        viewModelScope.launch {
            runCatching { bookings.submitReview(bookingId, s.rating, s.note.ifBlank { null }) }
                .onSuccess { _state.update { it.copy(submitting = false, submitted = true) } }
                .onFailure { e ->
                    _state.update { it.copy(submitting = false, error = e.message ?: "Couldn't submit") }
                }
        }
    }
}
