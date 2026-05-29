package ae.findmybay.attendant.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import ae.findmybay.attendant.data.ServiceGraph
import ae.findmybay.attendant.ui.components.Eyebrow
import ae.findmybay.attendant.ui.theme.*

@Composable
fun ChangePasswordScreen(onDone: () -> Unit) {
    val vm: ChangePasswordViewModel = viewModel(
        factory = viewModelFactory { initializer { ChangePasswordViewModel(ServiceGraph.repository) } }
    )
    val state by vm.state.collectAsStateWithLifecycle()
    LaunchedEffect(state.done) { if (state.done) onDone() }

    Box(Modifier.fillMaxSize().background(FmbCream).padding(24.dp), contentAlignment = Alignment.Center) {
        Column(Modifier.fillMaxWidth()) {
            Eyebrow("First sign-in")
            Text(
                "Set a new password",
                fontSize = 24.sp, fontWeight = FontWeight.ExtraBold, color = FmbInk,
                letterSpacing = (-0.5).sp, modifier = Modifier.padding(top = 4.dp),
            )
            Text(
                "Your account was created with a temporary password. Choose your own to continue.",
                fontSize = 14.sp, color = FmbInkSoft, fontWeight = FontWeight.Medium,
                modifier = Modifier.padding(top = 6.dp, bottom = 20.dp),
            )

            Eyebrow("New password", modifier = Modifier.padding(bottom = 6.dp))
            OutlinedTextField(
                value = state.password,
                onValueChange = vm::setPassword,
                singleLine = true,
                visualTransformation = PasswordVisualTransformation(),
                placeholder = { Text("At least 8 characters") },
                modifier = Modifier.fillMaxWidth(),
                colors = pwFieldColors(),
            )

            Eyebrow("Confirm password", modifier = Modifier.padding(top = 14.dp, bottom = 6.dp))
            OutlinedTextField(
                value = state.confirm,
                onValueChange = vm::setConfirm,
                singleLine = true,
                visualTransformation = PasswordVisualTransformation(),
                placeholder = { Text("Re-enter password") },
                modifier = Modifier.fillMaxWidth(),
                colors = pwFieldColors(),
            )

            state.error?.let {
                Box(Modifier.fillMaxWidth().padding(top = 14.dp).clip(RoundedCornerShape(10.dp)).background(FmbCoralSoft).padding(horizontal = 12.dp, vertical = 10.dp)) {
                    Text(it, color = FmbCoral, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                }
            }

            Box(
                Modifier.fillMaxWidth().padding(top = 22.dp).height(58.dp).clip(RoundedCornerShape(16.dp))
                    .background(FmbPrimary)
                    .clickable(enabled = !state.loading) { vm.submit() },
                contentAlignment = Alignment.Center,
            ) {
                if (state.loading) {
                    CircularProgressIndicator(color = FmbWhite, strokeWidth = 2.dp, modifier = Modifier.size(22.dp))
                } else {
                    Text("Save and continue", color = FmbWhite, fontSize = 16.sp, fontWeight = FontWeight.ExtraBold)
                }
            }
        }
    }
}

@Composable
private fun pwFieldColors() = OutlinedTextFieldDefaults.colors(
    focusedBorderColor = FmbPrimary,
    unfocusedBorderColor = FmbMintEdge,
    focusedContainerColor = FmbWhite,
    unfocusedContainerColor = FmbWhite,
    cursorColor = FmbPrimary,
)
