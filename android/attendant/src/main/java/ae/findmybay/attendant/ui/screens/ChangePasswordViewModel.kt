package ae.findmybay.attendant.ui.screens

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import ae.findmybay.attendant.data.AttendantRepository
import ae.findmybay.attendant.data.apiMessage
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class ChangePasswordUiState(
    val password: String = "",
    val confirm: String = "",
    val loading: Boolean = false,
    val error: String? = null,
    val done: Boolean = false,
)

class ChangePasswordViewModel(private val repo: AttendantRepository) : ViewModel() {
    private val _state = MutableStateFlow(ChangePasswordUiState())
    val state: StateFlow<ChangePasswordUiState> = _state.asStateFlow()

    fun setPassword(v: String) = _state.update { it.copy(password = v, error = null) }
    fun setConfirm(v: String) = _state.update { it.copy(confirm = v, error = null) }

    fun submit() {
        val s = _state.value
        if (s.loading) return
        if (s.password.length < 8) {
            _state.update { it.copy(error = "Use at least 8 characters.") }
            return
        }
        if (s.password != s.confirm) {
            _state.update { it.copy(error = "Passwords don't match.") }
            return
        }
        _state.update { it.copy(loading = true, error = null) }
        viewModelScope.launch {
            runCatching { repo.changePassword(s.password) }
                .onSuccess { _state.update { it.copy(loading = false, done = true) } }
                .onFailure { e -> _state.update { it.copy(loading = false, error = e.apiMessage("Couldn't update password")) } }
        }
    }
}
