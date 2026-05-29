package ae.findmybay.attendant

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import ae.findmybay.attendant.data.ServiceGraph
import ae.findmybay.attendant.nav.AttendantNav
import ae.findmybay.attendant.nav.Routes
import ae.findmybay.attendant.ui.theme.FmbAttendantTheme
import ae.findmybay.attendant.ui.theme.FmbCream
import ae.findmybay.attendant.ui.theme.FmbPrimary

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        ServiceGraph.init(applicationContext)
        enableEdgeToEdge()
        setContent {
            FmbAttendantTheme {
                Surface(
                    modifier = Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing),
                    color = FmbCream,
                ) {
                    // Resolve the start route once from the persisted token.
                    var start by remember { mutableStateOf<String?>(null) }
                    LaunchedEffect(Unit) {
                        start = if (ServiceGraph.tokenStore.isSignedIn()) Routes.BAY_BOARD else Routes.LOGIN
                    }
                    when (val s = start) {
                        null -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            CircularProgressIndicator(color = FmbPrimary)
                        }
                        else -> AttendantNav(startDestination = s)
                    }
                }
            }
        }
    }
}
