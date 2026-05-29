package ae.findmybay.attendant.data

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Process-wide signal that the session has ended and the UI should return to
 * login. Set by the token Authenticator when a refresh attempt fails (the
 * 30-day refresh token finally expired or was revoked). The nav layer observes
 * [expired] and routes to the login screen, then calls [reset].
 *
 * Kept separate from the explicit "Sign out" button flow so the two paths don't
 * race — this one is only for involuntary expiry.
 */
object SessionManager {
    private val _expired = MutableStateFlow(false)
    val expired: StateFlow<Boolean> = _expired.asStateFlow()

    /** Called from the Authenticator once the refresh token is rejected. */
    fun markExpired() { _expired.value = true }

    /** Cleared by the nav layer after it has routed to login. */
    fun reset() { _expired.value = false }
}
