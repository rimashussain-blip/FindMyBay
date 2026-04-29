package ae.findmybay.feature.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import ae.findmybay.data.repo.AuthRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class AuthUiState(
    val phone: String = "",
    val code: String = "",
    val challengeId: String? = null,
    val resendInSec: Int = 0,
    val loading: Boolean = false,
    val error: String? = null,
    val otpSent: Boolean = false,
    val verified: Boolean = false,
)

@HiltViewModel
class AuthViewModel @Inject constructor(
    private val auth: AuthRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(AuthUiState())
    val state: StateFlow<AuthUiState> = _state.asStateFlow()

    fun onPhoneChange(s: String) =
        _state.update { it.copy(phone = sanitizePhone(s), error = null) }

    fun onCodeChange(s: String) =
        _state.update { it.copy(code = s.filter(Char::isDigit).take(6), error = null) }

    /** Validates a UAE-style phone number, then requests an OTP. */
    fun requestOtp(onSent: (String) -> Unit) {
        val phone = _state.value.phone
        if (!isLikelyUaePhone(phone)) {
            _state.update { it.copy(error = "Enter a valid UAE phone in international format, e.g. +971501234567") }
            return
        }
        _state.update { it.copy(loading = true, error = null) }
        viewModelScope.launch {
            runCatching { auth.requestOtp(phone) }
                .onSuccess { challengeId ->
                    _state.update {
                        it.copy(
                            loading = false,
                            otpSent = true,
                            challengeId = challengeId,
                            resendInSec = 30,
                        )
                    }
                    onSent(phone)
                }
                .onFailure { e ->
                    _state.update { it.copy(loading = false, error = friendly(e)) }
                }
        }
    }

    fun verifyOtp(onVerified: () -> Unit) {
        val s = _state.value
        val challengeId = s.challengeId ?: return
        if (s.code.length != 6) {
            _state.update { it.copy(error = "Enter the 6-digit code") }
            return
        }
        _state.update { it.copy(loading = true, error = null) }
        viewModelScope.launch {
            runCatching { auth.verifyOtp(s.phone, challengeId, s.code) }
                .onSuccess {
                    _state.update { it.copy(loading = false, verified = true) }
                    onVerified()
                }
                .onFailure { e ->
                    _state.update { it.copy(loading = false, error = friendly(e)) }
                }
        }
    }

    private fun friendly(e: Throwable): String =
        e.message?.takeIf { it.isNotBlank() } ?: "Something went wrong, please try again."

    /** Strips spaces/dashes; ensures leading '+'. */
    private fun sanitizePhone(s: String): String {
        val cleaned = s.trim().replace(Regex("[\\s\\-()]+"), "")
        return when {
            cleaned.startsWith("+") -> cleaned
            cleaned.startsWith("00") -> "+" + cleaned.drop(2)
            cleaned.startsWith("0") -> "+971" + cleaned.drop(1)   // local UAE format
            cleaned.startsWith("971") -> "+$cleaned"
            cleaned.isEmpty() -> ""
            else -> "+$cleaned"
        }
    }

    private fun isLikelyUaePhone(s: String): Boolean {
        // Permissive: +<country><digits> with at least 9 digits after +. Real validation lives server-side.
        return Regex("^\\+\\d{9,15}$").matches(s)
    }
}
