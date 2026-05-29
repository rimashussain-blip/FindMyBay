package ae.findmybay.attendant.ui.screens

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import ae.findmybay.attendant.data.AttendantRepository
import ae.findmybay.attendant.data.CheckinResult
import ae.findmybay.attendant.data.apiMessage
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class ScannerUiState(
    val working: Boolean = false,
    val result: CheckinResult? = null,   // non-null = success, screen auto-closes
    val error: String? = null,
    val showCodeEntry: Boolean = false,
    val codeInput: String = "",
)

class ScannerViewModel(private val repo: AttendantRepository) : ViewModel() {
    private val _state = MutableStateFlow(ScannerUiState())
    val state: StateFlow<ScannerUiState> = _state.asStateFlow()

    // The camera analyzer fires many frames per second; latch so a single QR
    // only triggers one network call. Reset on error so the operator can retry.
    @Volatile
    private var handled = false

    fun onQrDetected(raw: String) {
        if (handled || _state.value.working || raw.isBlank()) return
        handled = true
        checkIn { repo.checkInByQr(raw) }
    }

    fun submitCode() {
        val code = _state.value.codeInput.trim()
        if (code.length < 4 || _state.value.working) return
        checkIn { repo.checkInByCode(code) }
    }

    private fun checkIn(call: suspend () -> CheckinResult) {
        _state.update { it.copy(working = true, error = null) }
        viewModelScope.launch {
            runCatching { call() }
                .onSuccess { r -> _state.update { it.copy(working = false, result = r, showCodeEntry = false) } }
                .onFailure { e ->
                    handled = false
                    _state.update { it.copy(working = false, error = e.apiMessage("Check-in failed")) }
                }
        }
    }

    fun openCodeEntry() = _state.update { it.copy(showCodeEntry = true, error = null) }
    fun closeCodeEntry() = _state.update { it.copy(showCodeEntry = false) }
    fun setCode(v: String) = _state.update { it.copy(codeInput = v.uppercase()) }

    fun dismissError() {
        handled = false
        _state.update { it.copy(error = null) }
    }
}
