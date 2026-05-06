package ae.findmybay.feature.splash

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import ae.findmybay.core.storage.TokenStore
import ae.findmybay.data.repo.AuthRepository

/**
 * Decides where the cold-start app should land.
 *
 * The decision tree is intentionally narrow — we make at most one network
 * call (`/auth/me`) and only when we already have a token. If the network
 * is unreachable but we have a token, we optimistically treat the user as
 * signed in (NEARBY); the screen they land on will refetch and either
 * recover or send them back to login if the token's truly invalid.
 */
@HiltViewModel
class SplashViewModel @Inject constructor(
    private val tokens: TokenStore,
    private val auth: AuthRepository,
) : ViewModel() {

    enum class Outcome { Pending, NeedsLogin, NeedsOnboarding, SignedIn }

    private val _outcome = MutableStateFlow(Outcome.Pending)
    val outcome = _outcome.asStateFlow()

    fun decide() {
        viewModelScope.launch {
            val token = tokens.accessToken()
            if (token.isNullOrBlank()) {
                _outcome.value = Outcome.NeedsLogin
                return@launch
            }
            // We have a token — try to fetch the profile to determine whether
            // onboarding is still needed. Network failures fall through to
            // SignedIn (the map can re-auth or surface the error).
            runCatching { auth.me() }
                .onSuccess { profile ->
                    _outcome.value =
                        if (profile.profileComplete) Outcome.SignedIn else Outcome.NeedsOnboarding
                }
                .onFailure { e ->
                    val msg = e.message.orEmpty()
                    // 401 → token's bad. Clear and bounce to login.
                    if (msg.contains("401") || msg.contains("Unauthorized")) {
                        runCatching { tokens.clear() }
                        _outcome.value = Outcome.NeedsLogin
                    } else {
                        _outcome.value = Outcome.SignedIn
                    }
                }
        }
    }
}
