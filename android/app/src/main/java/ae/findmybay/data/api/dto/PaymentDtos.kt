package ae.findmybay.data.api.dto

import kotlinx.serialization.Serializable

@Serializable
data class PaymentIntentDto(
    val paymentRef: String,
    val hostedPageUrl: String,
    val processor: String,
    val amountAed: Int,
    val status: String,
)

@Serializable
data class PaymentStatusDto(
    val paymentRef: String,
    val status: String, // pending | succeeded | failed | cancelled
    val bookingId: String,
    val bookingStatus: String,
)
