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

enum class BookingsTab { Today, Upcoming, Completed }

private val ACTIVE = setOf("confirmed", "alert_scheduled", "alerted", "in_progress", "pending_payment")

data class BookingsUiState(
    val loading: Boolean = true,
    val all: List<BookingRow> = emptyList(),
    val tab: BookingsTab = BookingsTab.Today,
    val error: String? = null,
    val actioningId: String? = null,
) {
    val visible: List<BookingRow>
        get() = when (tab) {
            BookingsTab.Today -> all.filter { it.status in ACTIVE && !it.isFuture }
            BookingsTab.Upcoming -> all.filter { it.status in ACTIVE && it.isFuture }
            BookingsTab.Completed -> all.filter { it.status == "completed" }
        }

    fun count(t: BookingsTab): Int = when (t) {
        BookingsTab.Today -> all.count { it.status in ACTIVE && !it.isFuture }
        BookingsTab.Upcoming -> all.count { it.status in ACTIVE && it.isFuture }
        BookingsTab.Completed -> all.count { it.status == "completed" }
    }
}

class BookingsViewModel(private val repo: AttendantRepository) : ViewModel() {
    private val _state = MutableStateFlow(BookingsUiState())
    val state: StateFlow<BookingsUiState> = _state.asStateFlow()

    init { load() }

    fun load() {
        _state.update { it.copy(loading = it.all.isEmpty(), error = null) }
        viewModelScope.launch {
            runCatching { repo.loadBookings() }
                .onSuccess { rows -> _state.update { it.copy(loading = false, all = rows) } }
                .onFailure { e -> _state.update { it.copy(loading = false, error = e.message ?: "Couldn't load bookings") } }
        }
    }

    fun selectTab(t: BookingsTab) = _state.update { it.copy(tab = t) }

    /** Swipe-to-check-in: advance a confirmed/alerted booking to in_progress. */
    fun checkIn(row: BookingRow) {
        if (_state.value.actioningId != null) return
        _state.update { it.copy(actioningId = row.id) }
        viewModelScope.launch {
            runCatching { repo.setStatus(row.id, "in_progress") }
                .onSuccess { load() }
                .onFailure { e -> _state.update { it.copy(actioningId = null, error = e.message) } }
                .also { _state.update { it.copy(actioningId = null) } }
        }
    }
}
