package ae.findmybay.data.repo

import ae.findmybay.data.api.PaymentApi
import ae.findmybay.data.api.dto.PaymentIntentDto
import ae.findmybay.data.api.dto.PaymentStatusDto
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class PaymentRepository @Inject constructor(
    private val api: PaymentApi,
) {
    suspend fun createIntent(bookingId: String): PaymentIntentDto = api.createIntent(bookingId)

    suspend fun status(paymentRef: String): PaymentStatusDto = api.status(paymentRef)
}
