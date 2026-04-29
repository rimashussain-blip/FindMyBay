package ae.findmybay.feature.payment

import android.content.Context
import android.net.Uri
import androidx.browser.customtabs.CustomTabsIntent
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import ae.findmybay.core.payment.PaymentReturnBus
import ae.findmybay.data.repo.BookingRepository
import ae.findmybay.data.repo.PaymentRepository
import ae.findmybay.domain.model.Booking
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class ReviewPayUiState(
    val loading: Boolean = true,
    val booking: Booking? = null,
    val paymentRef: String? = null,
    val launching: Boolean = false,
    val polling: Boolean = false,
    val confirmed: Boolean = false,
    val failureReason: String? = null,
    val error: String? = null,
)

@HiltViewModel
class ReviewPayViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val bookings: BookingRepository,
    private val payments: PaymentRepository,
) : ViewModel() {

    val bookingId: String = checkNotNull(savedStateHandle["bookingId"])

    private val _state = MutableStateFlow(ReviewPayUiState())
    val state: StateFlow<ReviewPayUiState> = _state.asStateFlow()

    init {
        loadBooking()
        observeReturnBus()
    }

    private fun loadBooking() {
        viewModelScope.launch {
            runCatching { bookings.mine() }
                .onSuccess { list ->
                    val match = list.firstOrNull { it.id == bookingId }
                    if (match == null) {
                        _state.update { it.copy(loading = false, error = "Booking not found") }
                        return@onSuccess
                    }
                    if (match.status == "confirmed" ||
                        match.status == "alert_scheduled" ||
                        match.status == "alerted" ||
                        match.status == "in_progress"
                    ) {
                        // Already paid (e.g. user backgrounded mid-flow and came back).
                        _state.update { it.copy(loading = false, booking = match, confirmed = true) }
                    } else {
                        _state.update { it.copy(loading = false, booking = match) }
                    }
                }
                .onFailure { e ->
                    _state.update { it.copy(loading = false, error = e.message ?: "Couldn't load booking") }
                }
        }
    }

    /**
     * Click handler for "Pay AED X". Creates the intent on the backend then
     * opens its hostedPageUrl in a Chrome Custom Tab. The result lands back
     * via PaymentReturnBus when the deep link fires.
     */
    fun pay(context: Context) {
        if (_state.value.launching) return
        _state.update { it.copy(launching = true, error = null, failureReason = null) }
        viewModelScope.launch {
            runCatching { payments.createIntent(bookingId) }
                .onSuccess { intent ->
                    _state.update { it.copy(paymentRef = intent.paymentRef, launching = false) }
                    val tab = CustomTabsIntent.Builder()
                        .setShowTitle(true)
                        .setUrlBarHidingEnabled(false)
                        .build()
                    tab.launchUrl(context, Uri.parse(intent.hostedPageUrl))
                }
                .onFailure { e ->
                    _state.update {
                        it.copy(launching = false, error = e.message ?: "Couldn't start payment")
                    }
                }
        }
    }

    private fun observeReturnBus() {
        viewModelScope.launch {
            PaymentReturnBus.events.collect { result ->
                val ref = _state.value.paymentRef ?: return@collect
                if (result.paymentRef != ref) return@collect
                if (result.status == "succeeded") {
                    pollUntilConfirmed(ref)
                } else {
                    _state.update {
                        it.copy(
                            failureReason = "Payment didn't go through. Please try again.",
                        )
                    }
                }
            }
        }
    }

    /**
     * After a `succeeded` deep link, the webhook may not have hit our backend
     * yet (or it may have raced ahead). Poll for up to ~10 s before giving up
     * and surfacing a "still processing" message.
     */
    private fun pollUntilConfirmed(ref: String) {
        viewModelScope.launch {
            _state.update { it.copy(polling = true) }
            repeat(10) { attempt ->
                runCatching { payments.status(ref) }.onSuccess { s ->
                    if (s.status == "succeeded" &&
                        (s.bookingStatus == "confirmed" ||
                            s.bookingStatus == "alert_scheduled" ||
                            s.bookingStatus == "alerted" ||
                            s.bookingStatus == "in_progress")
                    ) {
                        _state.update { it.copy(polling = false, confirmed = true) }
                        return@launch
                    }
                    if (s.status == "failed" || s.status == "cancelled") {
                        _state.update {
                            it.copy(polling = false, failureReason = "Payment was declined.")
                        }
                        return@launch
                    }
                }
                delay(if (attempt < 3) 600L else 1500L)
            }
            _state.update {
                it.copy(
                    polling = false,
                    failureReason = "We're still confirming your payment. Check My Bookings shortly.",
                )
            }
        }
    }
}
