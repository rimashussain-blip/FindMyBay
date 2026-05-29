package ae.findmybay.attendant.ui.screens

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import ae.findmybay.attendant.data.AttendantRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import retrofit2.HttpException

data class LoginUiState(
    val email: String = "",
    val password: String = "",
    val loading: Boolean = false,
    val error: String? = null,
    val signedIn: Boolean = false,
)

class LoginViewModel(private val repo: AttendantRepository) : ViewModel() {
    private val _state = MutableStateFlow(LoginUiState())
    val state: StateFlow<LoginUiState> = _state.asStateFlow()

    fun setEmail(v: String) = _state.update { it.copy(email = v, error = null) }
    fun setPassword(v: String) = _state.update { it.copy(password = v, error = null) }

    fun submit() {
        val s = _state.value
        if (s.email.isBlank() || s.password.isBlank() || s.loading) return
        _state.update { it.copy(loading = true, error = null) }
        viewModelScope.launch {
            runCatching { repo.login(s.email, s.password) }
                .onSuccess { _state.update { it.copy(loading = false, signedIn = true) } }
                .onFailure { e ->
                    _state.update { it.copy(loading = false, error = friendlyError(e)) }
                }
        }
    }

    private fun friendlyError(e: Throwable): String = when {
        e is HttpException && e.code() == 401 -> "Wrong email or password."
        e is HttpException && e.code() == 403 -> "This account isn't registered as vendor staff."
        e is HttpException -> "Sign-in failed (HTTP ${e.code()})."
        else -> e.message ?: "Couldn't reach the server. Check your connection."
    }
}
