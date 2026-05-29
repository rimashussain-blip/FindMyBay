package ae.findmybay.attendant.ui.screens

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import ae.findmybay.attendant.data.AttendantRepository
import ae.findmybay.attendant.data.BookingRow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class BookingDetailUiState(
    val row: BookingRow? = null,
    val working: Boolean = false,
    val error: String? = null,
    val done: Boolean = false, // close the sheet after a successful action
)

class BookingDetailViewModel(
    private val repo: AttendantRepository,
    bookingId: String,
) : ViewModel() {
    private val _state = MutableStateFlow(BookingDetailUiState(row = repo.bookingById(bookingId)))
    val state: StateFlow<BookingDetailUiState> = _state.asStateFlow()

    private fun act(status: String) {
        val row = _state.value.row ?: return
        if (_state.value.working) return
        _state.update { it.copy(working = true, error = null) }
        viewModelScope.launch {
            runCatching { repo.setStatus(row.id, status) }
                .onSuccess { _state.update { it.copy(working = false, done = true) } }
                .onFailure { e -> _state.update { it.copy(working = false, error = e.message ?: "Action failed") } }
        }
    }

    fun checkIn() = act("in_progress")
    fun markComplete() = act("completed")
    fun cancel() = act("cancelled")
    fun noShow() = act("no_show")
}
