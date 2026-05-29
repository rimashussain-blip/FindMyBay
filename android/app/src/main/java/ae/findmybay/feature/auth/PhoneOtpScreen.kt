package ae.findmybay.feature.auth

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.wrapContentSize
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import ae.findmybay.BuildConfig
import ae.findmybay.core.auth.GoogleSignInHelper
import ae.findmybay.core.components.FmbPrimaryButton
import ae.findmybay.core.components.LogoMark
import ae.findmybay.core.components.SandHalo

/**
 * Auth entry screen. Currently Google Sign-In is the primary (and only)
 * visible path; the phone-OTP flow stays compiled below behind
 * [SHOW_OTP_FLOW] so we can flip it back on with a one-line change.
 */
private const val SHOW_OTP_FLOW = false

@Composable
fun PhoneOtpScreen(
    vm: AuthViewModel,
    onOtpSent: (phone: String) -> Unit,
    onGoogleVerified: () -> Unit = {},
    onNeedsOnboarding: () -> Unit = onGoogleVerified,
) {
    val state by vm.state.collectAsStateWithLifecycle()
    val cs = MaterialTheme.colorScheme
    val context = LocalContext.current

    // Google Sign-In is enabled only when the Web OAuth client ID is wired
    // into BuildConfig (and a Firebase project exists). Empty in dev builds
    // until the user fills in GOOGLE_OAUTH_CLIENT_ID in local.properties.
    val googleEnabled = BuildConfig.GOOGLE_OAUTH_CLIENT_ID.isNotBlank()
    val googleClient = remember(googleEnabled) {
        if (googleEnabled) GoogleSignInHelper.build(context, BuildConfig.GOOGLE_OAUTH_CLIENT_ID)
        else null
    }

    val googleLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.StartActivityForResult(),
    ) { result ->
        GoogleSignInHelper.extractIdToken(result.data)
            .onSuccess { idToken ->
                vm.signInWithGoogle(
                    idToken = idToken,
                    onProfileComplete = onGoogleVerified,
                    onNeedsOnboarding = onNeedsOnboarding,
                )
            }
            .onFailure { e -> vm.setExternalError(e.message ?: "Google sign-in failed") }
    }

    Scaffold(containerColor = cs.background) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Spacer(Modifier.height(48.dp))

            // Sand halo behind the logo
            Box(contentAlignment = Alignment.Center) {
                SandHalo(diameter = 180.dp, intensity = 0.45f)
                LogoMark(size = 68.dp)
            }

            Spacer(Modifier.height(22.dp))
            Text(
                "Find My Bay",
                style = MaterialTheme.typography.headlineSmall,
                color = cs.onBackground,
            )
            Spacer(Modifier.height(8.dp))
            Text(
                "Book a free wash bay in seconds — across the UAE.",
                style = MaterialTheme.typography.bodyMedium,
                color = cs.onSurfaceVariant,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(horizontal = 16.dp),
            )

            Spacer(Modifier.height(32.dp))

            // ── Phone-OTP flow (dormant) ───────────────────────────────────
            // Kept in the source so we can flip SHOW_OTP_FLOW back to true
            // when phone OTP is reinstated alongside Google.
            if (SHOW_OTP_FLOW) {
                M3OutlinedPhoneField(
                    phone = state.phone,
                    onPhoneChange = vm::onPhoneChange,
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(Modifier.height(6.dp))
                Text(
                    "We'll text you a 6-digit code.",
                    style = MaterialTheme.typography.labelSmall,
                    color = cs.onSurfaceVariant,
                    modifier = Modifier.fillMaxWidth().padding(start = 14.dp),
                )
                Spacer(Modifier.height(16.dp))
                FmbPrimaryButton(
                    text = "Send code",
                    onClick = { vm.requestOtp(onSent = onOtpSent) },
                    enabled = state.phone.length >= 11,
                    loading = state.loading,
                    height = 48.dp,
                    cornerRadius = 24.dp,
                )
                Spacer(Modifier.height(20.dp))
                OrDivider()
                Spacer(Modifier.height(20.dp))
            }

            // ── Google Sign-In (primary) ───────────────────────────────────
            if (googleEnabled && googleClient != null) {
                GoogleSignInButton(
                    enabled = !state.loading,
                    loading = state.loading,
                    onClick = { googleLauncher.launch(googleClient.signInIntent) },
                )
            } else {
                // Surfaces a clear next step in dev builds before the OAuth
                // client ID has been pasted into local.properties. Stays out
                // of release builds because the value is required for ship.
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(14.dp))
                        .background(cs.surfaceVariant)
                        .padding(horizontal = 16.dp, vertical = 14.dp),
                ) {
                    Text(
                        "Sign-in is being configured. Add GOOGLE_OAUTH_CLIENT_ID to android/local.properties to enable Continue with Google.",
                        style = MaterialTheme.typography.labelSmall,
                        color = cs.onSurfaceVariant,
                    )
                }
            }

            // Errors from Google sign-in (cancelled, network, misconfig) live
            // in the same state slot as OTP errors, so the same surface works
            // for both flows.
            if (state.error != null) {
                Spacer(Modifier.height(10.dp))
                Text(
                    state.error!!,
                    color = cs.error,
                    style = MaterialTheme.typography.labelSmall,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth(),
                )
            }

            Spacer(Modifier.weight(1f))

            // Terms footer + "Made in U.A.E" brand badge
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.padding(bottom = 28.dp),
            ) {
                Text(
                    "By continuing you agree to the",
                    style = MaterialTheme.typography.labelSmall,
                    color = cs.onSurfaceVariant,
                )
                Row {
                    Text(
                        "Terms",
                        style = MaterialTheme.typography.labelSmall,
                        color = cs.primary,
                        fontWeight = FontWeight.Medium,
                    )
                    Text(" & ", style = MaterialTheme.typography.labelSmall, color = cs.onSurfaceVariant)
                    Text(
                        "Privacy Policy",
                        style = MaterialTheme.typography.labelSmall,
                        color = cs.primary,
                        fontWeight = FontWeight.Medium,
                    )
                }
                Spacer(Modifier.height(16.dp))
                MadeInUaeBadge()
            }
        }
    }
}

/**
 * Brand badge from the design handoff ("Made in UAE Badge.html", compact
 * "block letters · flag on the right" variant). Black banner with a tight
 * MADE IN / U.A.E lockup on the left and the UAE flag (red bar + green/
 * white/black tri-stripe) on the right. Self-contained — looks the same
 * in light and dark mode.
 */
@Composable
private fun MadeInUaeBadge() {
    Row(
        modifier = Modifier
            .height(IntrinsicSize.Min)
            .clip(RoundedCornerShape(5.dp))
            .border(1.dp, Color.Black.copy(alpha = 0.10f), RoundedCornerShape(5.dp)),
    ) {
        // Black "MADE IN U.A.E" banner
        Column(
            modifier = Modifier
                .background(Color.Black)
                .padding(horizontal = 18.dp, vertical = 10.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(
                "MADE IN",
                fontSize = 8.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 3.5.sp,
                color = Color.White.copy(alpha = 0.6f),
            )
            Spacer(Modifier.height(3.dp))
            Text(
                "U.A.E",
                fontSize = 18.sp,
                fontWeight = FontWeight.Black,
                letterSpacing = 4.5.sp,
                lineHeight = 18.sp,
                color = Color.White,
            )
        }
        // UAE flag — left red bar + green/white/black tri-stripe.
        Row(modifier = Modifier.fillMaxHeight().width(42.dp)) {
            Box(modifier = Modifier.fillMaxHeight().width(12.dp).background(Color(0xFFCE1126)))
            Column(modifier = Modifier.fillMaxHeight().weight(1f)) {
                Box(modifier = Modifier.fillMaxWidth().weight(1f).background(Color(0xFF00732F)))
                Box(modifier = Modifier.fillMaxWidth().weight(1f).background(Color.White))
                Box(modifier = Modifier.fillMaxWidth().weight(1f).background(Color.Black))
            }
        }
    }
}

@Composable
private fun OrDivider() {
    val cs = MaterialTheme.colorScheme
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Box(modifier = Modifier.weight(1f).height(1.dp).background(cs.outline.copy(alpha = 0.4f)))
        Text(
            "  or  ",
            style = MaterialTheme.typography.labelSmall,
            color = cs.onSurfaceVariant,
            modifier = Modifier.padding(horizontal = 4.dp),
        )
        Box(modifier = Modifier.weight(1f).height(1.dp).background(cs.outline.copy(alpha = 0.4f)))
    }
}

/**
 * White pill with a multi-coloured "G" + "Continue with Google" — the
 * primary auth CTA when phone-OTP is dormant. Approximates the official
 * Google Sign-In button per their guidelines (white background, dark text,
 * single-color "G" stand-in for the licensed multi-color glyph). Replace
 * with the licensed asset before launch.
 */
@Composable
private fun GoogleSignInButton(
    enabled: Boolean,
    loading: Boolean = false,
    onClick: () -> Unit,
) {
    val cs = MaterialTheme.colorScheme
    val canTap = enabled && !loading
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .height(54.dp)
            .clip(RoundedCornerShape(16.dp))
            .background(Color.White)
            .border(1.dp, cs.outline.copy(alpha = 0.4f), RoundedCornerShape(16.dp))
            .clickable(enabled = canTap, onClick = onClick)
            .padding(horizontal = 18.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center,
    ) {
        if (loading) {
            CircularProgressIndicator(
                strokeWidth = 2.dp,
                modifier = Modifier.size(18.dp),
                color = Color(0xFF4285F4),
            )
        } else {
            // Single-character "G" in Google blue as a no-asset stand-in for
            // the licensed multi-colour glyph.
            Text(
                "G",
                color = Color(0xFF4285F4),
                fontSize = 20.sp,
                fontWeight = FontWeight.ExtraBold,
            )
            Spacer(Modifier.width(12.dp))
            Text(
                "Continue with Google",
                color = Color(0xFF3C4043),
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
            )
        }
    }
}

/**
 * M3 outlined text field with a floating label "notch" — the label sits across
 * the top stroke of the box, with the cream background showing through to give
 * the classic Material 3 cutout effect.
 */
@Composable
private fun M3OutlinedPhoneField(
    phone: String,
    onPhoneChange: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val cs = MaterialTheme.colorScheme
    Box(modifier = modifier) {
        // The bordered box itself
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier
                .fillMaxWidth()
                .height(56.dp)
                .clip(RoundedCornerShape(4.dp))
                .border(1.5.dp, cs.primary, RoundedCornerShape(4.dp))
                .padding(horizontal = 14.dp),
        ) {
            Text(
                "🇦🇪 +971",
                style = MaterialTheme.typography.bodyLarge,
                fontWeight = FontWeight.Medium,
                color = cs.onSurface,
            )
            Spacer(Modifier.width(10.dp))
            Box(
                modifier = Modifier
                    .width(1.dp)
                    .height(20.dp)
                    .background(cs.outline),
            )
            Spacer(Modifier.width(10.dp))
            BasicTextField(
                value = phone.removePrefix("+971").removePrefix("971"),
                onValueChange = { input ->
                    val digits = input.filter(Char::isDigit).take(9)
                    onPhoneChange("+971$digits")
                },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                textStyle = MaterialTheme.typography.bodyLarge.copy(color = cs.onSurface),
                cursorBrush = SolidColor(cs.primary),
                modifier = Modifier.fillMaxWidth(),
                decorationBox = { inner ->
                    if (phone.removePrefix("+971").isEmpty()) {
                        Text(
                            "50 123 4567",
                            color = cs.onSurfaceVariant,
                            style = MaterialTheme.typography.bodyLarge,
                        )
                    }
                    inner()
                },
            )
        }
        // Floating label "notch" — sits across the top border with the
        // background color showing through.
        Box(
            modifier = Modifier
                .padding(start = 12.dp)
                .wrapContentSize()
                .background(cs.background)
                .padding(horizontal = 6.dp),
        ) {
            Text(
                "Mobile number",
                style = MaterialTheme.typography.labelSmall.copy(
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Medium,
                ),
                color = cs.primary,
            )
        }
    }
}
