package ae.findmybay

import android.content.Intent
import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.lifecycle.lifecycleScope
import ae.findmybay.core.location.LocationReporter
import ae.findmybay.core.nav.AlertDeepLink
import ae.findmybay.core.nav.AppNav
import ae.findmybay.core.payment.PaymentReturnBus
import ae.findmybay.core.theme.FindMyBayTheme
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch
import javax.inject.Inject

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    @Inject lateinit var locationReporter: LocationReporter

    override fun onResume() {
        super.onResume()
        // Run the reporter in a coroutine so a slow Play-services init can
        // never block the UI thread on cold launch. start() is suspend +
        // dispatches its work to Dispatchers.IO internally.
        lifecycleScope.launch {
            try {
                locationReporter.start()
            } catch (t: Throwable) {
                Log.w("FmbMainActivity", "LocationReporter.start failed", t)
            }
        }
    }

    override fun onPause() {
        super.onPause()
        try {
            locationReporter.stop()
        } catch (t: Throwable) {
            Log.w("FmbMainActivity", "LocationReporter.stop failed", t)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        // The Activity may have been started by the payment Custom Tab redirect —
        // forward that to the bus before the UI composes.
        forwardPaymentReturn(intent)
        setContent {
            var deepLink by remember { mutableStateOf(parseAlertExtras(intent)) }

            // Re-parse if Activity is reused (singleTop) and a new intent arrives.
            DisposableHook { newIntent ->
                deepLink = parseAlertExtras(newIntent)
                forwardPaymentReturn(newIntent)
            }

            FindMyBayTheme {
                AppNav(initialDeepLink = deepLink)
            }
        }
    }

    private var newIntentListener: ((Intent) -> Unit)? = null

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        newIntentListener?.invoke(intent)
    }

    /**
     * Hand off a `findmybay://payment/return?ref=…&status=…` intent to the
     * payment bus so the active ReviewPayViewModel can react.
     */
    private fun forwardPaymentReturn(intent: Intent?) {
        val data = intent?.data ?: return
        if (data.scheme != "findmybay" || data.host != "payment") return
        val ref = data.getQueryParameter("ref") ?: return
        val status = data.getQueryParameter("status") ?: "unknown"
        PaymentReturnBus.emit(PaymentReturnBus.Result(paymentRef = ref, status = status))
    }

    @androidx.compose.runtime.Composable
    private fun DisposableHook(onIntent: (Intent) -> Unit) {
        androidx.compose.runtime.DisposableEffect(Unit) {
            newIntentListener = onIntent
            onDispose { newIntentListener = null }
        }
    }
}

private fun parseAlertExtras(intent: Intent?): AlertDeepLink? {
    intent ?: return null
    return when (intent.getStringExtra("alert.kind")) {
        "leave_now" -> AlertDeepLink.LeaveNow(
            vendorName = intent.getStringExtra("alert.vendorName") ?: "your wash",
            etaMin = intent.getStringExtra("alert.etaMin")?.toIntOrNull() ?: 0,
            slotTime = intent.getStringExtra("alert.slotTime") ?: "",
        )
        "wash_complete" -> {
            val bookingId = intent.getStringExtra("alert.bookingId") ?: return null
            AlertDeepLink.RateWash(bookingId)
        }
        else -> null
    }
}
