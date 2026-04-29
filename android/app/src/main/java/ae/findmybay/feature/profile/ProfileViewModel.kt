package ae.findmybay.feature.profile

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import ae.findmybay.data.repo.AuthRepository
import ae.findmybay.domain.model.UserProfile
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class ProfileUiState(
    val loading: Boolean = true,
    val saving: Boolean = false,
    val profile: UserProfile? = null,
    val pushEnabled: Boolean = true,
    val smartAlertsEnabled: Boolean = true,
    val signedOut: Boolean = false,
    val error: String? = null,
)

@HiltViewModel
class ProfileViewModel @Inject constructor(
    private val auth: AuthRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(ProfileUiState())
    val state: StateFlow<ProfileUiState> = _state.asStateFlow()

    init { load() }

    fun load() {
        _state.update { it.copy(loading = true, error = null) }
        viewModelScope.launch {
            runCatching { auth.me() }
                .onSuccess { p -> _state.update { it.copy(loading = false, profile = p) } }
                .onFailure { e ->
                    _state.update { it.copy(loading = false, error = e.message ?: "Couldn't load profile") }
                }
        }
    }

    fun saveName(newName: String) {
        if (newName.isBlank()) return
        _state.update { it.copy(saving = true, error = null) }
        viewModelScope.launch {
            runCatching { auth.updateMe(fullName = newName.trim()) }
                .onSuccess { p -> _state.update { it.copy(saving = false, profile = p) } }
                .onFailure { e ->
                    _state.update { it.copy(saving = false, error = e.message ?: "Couldn't save") }
                }
        }
    }

    fun togglePush() = _state.update { it.copy(pushEnabled = !it.pushEnabled) }
    fun toggleSmartAlerts() = _state.update { it.copy(smartAlertsEnabled = !it.smartAlertsEnabled) }

    fun signOut() {
        viewModelScope.launch {
            auth.logout()
            _state.update { it.copy(signedOut = true) }
        }
    }
}
