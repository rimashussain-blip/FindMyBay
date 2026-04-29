package ae.findmybay.core.payment

import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow

/**
 * Carries the `findmybay://payment/return` deep link payload from MainActivity
 * (which receives the redirect from the Chrome Custom Tab) into whatever
 * ReviewPayViewModel happens to be on screen.
 *
 * A single global SharedFlow is sufficient: only one payment can be in flight
 * at a time (the user just kicked off the Custom Tab), and we replay the most
 * recent value in case the Activity was destroyed and restored mid-flow.
 */
object PaymentReturnBus {
    data class Result(val paymentRef: String, val status: String)

    private val _events = MutableSharedFlow<Result>(replay = 1, extraBufferCapacity = 1)
    val events: SharedFlow<Result> = _events.asSharedFlow()

    fun emit(result: Result) {
        _events.tryEmit(result)
    }
}
