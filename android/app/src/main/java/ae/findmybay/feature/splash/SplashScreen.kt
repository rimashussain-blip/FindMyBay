package ae.findmybay.feature.splash

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import ae.findmybay.core.components.LogoMark
import ae.findmybay.core.components.SandHalo
import ae.findmybay.core.theme.FmbBlue900

/**
 * Cold-start branching screen.
 *
 * Decides where the app should land based on saved auth state:
 *  • No token saved        → Routes.PHONE   (sign-in screen)
 *  • Token but profile not complete → Routes.ONBOARDING
 *  • Token + profile complete       → Routes.NEARBY  (the map)
 *
 * Renders the same logo + halo as the login page so the transition feels
 * continuous (no flash of a different background colour).
 */
@Composable
fun SplashScreen(
    onNeedsLogin: () -> Unit,
    onNeedsOnboarding: () -> Unit,
    onSignedIn: () -> Unit,
    vm: SplashViewModel = hiltViewModel(),
) {
    val outcome by vm.outcome.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) { vm.decide() }

    LaunchedEffect(outcome) {
        when (outcome) {
            SplashViewModel.Outcome.Pending -> Unit
            SplashViewModel.Outcome.NeedsLogin -> onNeedsLogin()
            SplashViewModel.Outcome.NeedsOnboarding -> onNeedsOnboarding()
            SplashViewModel.Outcome.SignedIn -> onSignedIn()
        }
    }

    Scaffold(containerColor = MaterialTheme.colorScheme.background) { padding ->
        Box(
            modifier = Modifier.fillMaxSize().padding(padding),
            contentAlignment = Alignment.Center,
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Box(contentAlignment = Alignment.Center) {
                    SandHalo(diameter = 180.dp, intensity = 0.45f)
                    LogoMark(size = 68.dp)
                }
                Spacer(Modifier.height(22.dp))
                Text(
                    "Find My Bay",
                    fontSize = 22.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = (-0.4).sp,
                    color = FmbBlue900,
                )
            }
        }
    }
}
