package ae.findmybay.feature.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.wrapContentSize
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import ae.findmybay.core.components.FmbPrimaryButton
import ae.findmybay.core.components.LogoMark
import ae.findmybay.core.components.SandHalo

@Composable
fun PhoneOtpScreen(
    vm: AuthViewModel,
    onOtpSent: (phone: String) -> Unit,
) {
    val state by vm.state.collectAsStateWithLifecycle()
    val cs = MaterialTheme.colorScheme

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

            // Material 3 outlined text field with floating label notch
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

            if (state.error != null) {
                Spacer(Modifier.height(8.dp))
                Text(
                    state.error!!,
                    color = cs.error,
                    style = MaterialTheme.typography.labelSmall,
                    modifier = Modifier.fillMaxWidth().padding(start = 14.dp),
                )
            }

            Spacer(Modifier.height(16.dp))

            // Gradient brand pill — 48dp tall, fully rounded per handoff.
            FmbPrimaryButton(
                text = "Send code",
                onClick = { vm.requestOtp(onSent = onOtpSent) },
                enabled = state.phone.length >= 11,
                loading = state.loading,
                height = 48.dp,
                cornerRadius = 24.dp,
            )

            Spacer(Modifier.weight(1f))

            // Terms footer
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.padding(bottom = 32.dp),
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
            }
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
