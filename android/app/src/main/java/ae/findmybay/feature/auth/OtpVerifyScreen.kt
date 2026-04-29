package ae.findmybay.feature.auth

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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import ae.findmybay.core.components.FmbPrimaryButton
import ae.findmybay.core.theme.FmbBlue100
import ae.findmybay.core.theme.FmbBlue500
import ae.findmybay.core.theme.FmbBlue700
import ae.findmybay.core.theme.FmbBlue900
import ae.findmybay.core.theme.FmbCream
import ae.findmybay.core.theme.FmbMintEdge
import ae.findmybay.core.theme.FmbNeutral700

@Composable
fun OtpVerifyScreen(
    vm: AuthViewModel,
    phone: String,
    onVerified: () -> Unit,
    onBack: () -> Unit,
) {
    val state by vm.state.collectAsStateWithLifecycle()
    val focusRequester = remember { FocusRequester() }

    Scaffold(containerColor = FmbCream) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 28.dp),
        ) {
            Spacer(Modifier.height(8.dp))

            // Back button — 36×36 white square per handoff §2.
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(MaterialTheme.colorScheme.surface)
                    .border(1.dp, FmbMintEdge, RoundedCornerShape(12.dp))
                    .clickable(onClick = onBack),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    Icons.AutoMirrored.Filled.ArrowBack,
                    contentDescription = "Back",
                    modifier = Modifier.size(14.dp),
                    tint = FmbBlue900,
                )
            }

            Spacer(Modifier.height(20.dp))

            Text(
                text = "Enter the code\nwe just sent you",
                fontSize = 26.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = (-0.5).sp,
                lineHeight = 32.sp,
                color = FmbBlue900,
            )
            Spacer(Modifier.height(12.dp))
            Text(
                text = "A 6-digit code was sent to",
                fontSize = 13.sp,
                color = FmbNeutral700,
                lineHeight = 20.sp,
            )
            Text(
                text = phone.ifBlank { state.phone },
                fontSize = 13.sp,
                color = FmbBlue700,
                fontWeight = FontWeight.SemiBold,
                lineHeight = 20.sp,
            )

            Spacer(Modifier.height(32.dp))

            // 6 boxed cells. We render them via a hidden BasicTextField so we
            // get the system numeric keyboard, paste, and SMS auto-fill while
            // keeping our pixel-perfect cell visuals.
            Box(modifier = Modifier.fillMaxWidth()) {
                BasicTextField(
                    value = state.code,
                    onValueChange = vm::onCodeChange,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                    singleLine = true,
                    textStyle = TextStyle(color = Color.Transparent), // visually hidden
                    cursorBrush = androidx.compose.ui.graphics.SolidColor(Color.Transparent),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(52.dp)
                        .focusRequester(focusRequester),
                )

                // Visual cells overlay
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { focusRequester.requestFocus() },
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    repeat(6) { index ->
                        val char: Char? = state.code.getOrNull(index)
                        val isActive = index == state.code.length
                        val filled = char != null
                        val borderColor = when {
                            filled || isActive -> FmbBlue500
                            else -> FmbMintEdge
                        }
                        val bg = if (filled) FmbBlue100 else MaterialTheme.colorScheme.surface
                        Box(
                            modifier = Modifier
                                .size(width = 40.dp, height = 52.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .background(bg)
                                .border(1.5.dp, borderColor, RoundedCornerShape(12.dp))
                                .then(
                                    if (isActive) Modifier.border(
                                        4.dp,
                                        FmbBlue500.copy(alpha = 0.15f),
                                        RoundedCornerShape(16.dp),
                                    ) else Modifier
                                ),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(
                                text = char?.toString() ?: "",
                                fontSize = 22.sp,
                                fontWeight = FontWeight.Bold,
                                color = FmbBlue900,
                            )
                        }
                    }
                }
            }

            Spacer(Modifier.height(18.dp))

            // Resend phrase per handoff. Becomes a tap target when countdown hits 0.
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.Center,
            ) {
                Text(
                    "Didn't get it? ",
                    fontSize = 12.sp,
                    color = FmbNeutral700,
                )
                val resendActive = state.resendInSec <= 0 && !state.loading
                Text(
                    text = if (resendActive) "Resend code" else "Resend in 0:${state.resendInSec.toString().padStart(2, '0')}",
                    fontSize = 12.sp,
                    color = FmbBlue700,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier
                        .let { if (resendActive) it.clickable { vm.requestOtp(onSent = {}) } else it },
                )
            }

            if (state.error != null) {
                Spacer(Modifier.height(12.dp))
                Text(
                    text = state.error!!,
                    color = MaterialTheme.colorScheme.error,
                    fontSize = 12.sp,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth(),
                )
            }

            Spacer(Modifier.weight(1f))

            FmbPrimaryButton(
                text = "Verify & continue",
                onClick = { vm.verifyOtp(onVerified = onVerified) },
                enabled = state.code.length == 6,
                loading = state.loading,
            )

            Spacer(Modifier.height(28.dp))
        }
    }
}
