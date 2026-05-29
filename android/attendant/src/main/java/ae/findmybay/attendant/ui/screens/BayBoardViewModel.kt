package ae.findmybay.attendant.ui.screens

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import ae.findmybay.attendant.data.AttendantRepository
import ae.findmybay.attendant.data.BayBoardData
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class BayBoardUiState(
    val loading: Boolean = true,
    val refreshing: Boolean = false,
    val data: BayBoardData? = null,
    val error: String? = null,
    val signedOut: Boolean = false,
)

class BayBoardViewModel(private val repo: AttendantRepository) : ViewModel() {
    private val _state = MutableStateFlow(BayBoardUiState())
    val state: StateFlow<BayBoardUiState> = _state.asStateFlow()

    init { load(initial = true) }

    fun load(initial: Boolean = false) {
        _state.update { it.copy(loading = initial && it.data == null, refreshing = !initial, error = null) }
        viewModelScope.launch {
            runCatching { repo.loadBayBoard() }
                .onSuccess { d -> _state.update { it.copy(loading = false, refreshing = false, data = d) } }
                .onFailure { e -> _state.update { it.copy(loading = false, refreshing = false, error = e.message ?: "Couldn't load the bay board") } }
        }
    }

    fun signOut() {
        viewModelScope.launch {
            repo.signOut()
            _state.update { it.copy(signedOut = true) }
        }
    }
}
