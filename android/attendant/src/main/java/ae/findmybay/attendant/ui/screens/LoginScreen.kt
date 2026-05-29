package ae.findmybay.attendant.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
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
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import ae.findmybay.attendant.data.ServiceGraph
import ae.findmybay.attendant.ui.components.Eyebrow
import ae.findmybay.attendant.ui.components.FmbPrimaryButton
import ae.findmybay.attendant.ui.components.M1Mark
import ae.findmybay.attendant.ui.theme.*

@Composable
fun LoginScreen(onSignedIn: () -> Unit) {
    val vm: LoginViewModel = viewModel(
        factory = viewModelFactory { initializer { LoginViewModel(ServiceGraph.repository) } }
    )
    val state by vm.state.collectAsStateWithLifecycle()

    LaunchedEffect(state.signedIn) {
        if (state.signedIn) onSignedIn()
    }

    Column(
        Modifier
            .fillMaxSize()
            .background(FmbCream)
            .imePadding()
            .padding(horizontal = 24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        M1Mark(size = 64.dp)
        Spacer(Modifier.height(20.dp))
        Text("Attendant sign in", fontSize = 24.sp, fontWeight = FontWeight.ExtraBold, color = FmbInk, letterSpacing = (-0.4).sp)
        Text(
            "Sign in with your vendor staff account to manage the bay floor.",
            fontSize = 13.sp, color = FmbInkSoft, fontWeight = FontWeight.Medium,
            modifier = Modifier.padding(top = 6.dp, start = 8.dp, end = 8.dp),
        )
        Spacer(Modifier.height(28.dp))

        Column(
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(20.dp))
                .background(FmbWhite)
                .padding(20.dp),
        ) {
            Eyebrow("Email")
            Spacer(Modifier.height(6.dp))
            OutlinedTextField(
                value = state.email,
                onValueChange = vm::setEmail,
                singleLine = true,
                placeholder = { Text("owner@aquacarwash.ae", fontSize = 14.sp) },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email, imeAction = ImeAction.Next),
                modifier = Modifier.fillMaxWidth(),
                colors = fieldColors(),
            )
            Spacer(Modifier.height(16.dp))
            Eyebrow("Password")
            Spacer(Modifier.height(6.dp))
            OutlinedTextField(
                value = state.password,
                onValueChange = vm::setPassword,
                singleLine = true,
                visualTransformation = PasswordVisualTransformation(),
                placeholder = { Text("Your password", fontSize = 14.sp) },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, imeAction = ImeAction.Done),
                modifier = Modifier.fillMaxWidth(),
                colors = fieldColors(),
            )

            if (state.error != null) {
                Spacer(Modifier.height(14.dp))
                Box(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).background(FmbCoralSoft).padding(horizontal = 12.dp, vertical = 10.dp),
                ) {
                    Text(state.error!!, color = FmbCoral, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                }
            }

            Spacer(Modifier.height(20.dp))
            FmbPrimaryButton(
                text = if (state.loading) "Signing in…" else "Sign in",
                onClick = vm::submit,
            )
        }

        Spacer(Modifier.height(24.dp))
        Text(
            "Floor staff only. Customers use the Find My Bay app.",
            fontSize = 11.sp, color = FmbInkSoft, fontWeight = FontWeight.Medium,
        )
    }
}

@Composable
private fun fieldColors() = OutlinedTextFieldDefaults.colors(
    focusedBorderColor = FmbPrimary,
    unfocusedBorderColor = FmbMintEdge,
    focusedContainerColor = FmbWhite,
    unfocusedContainerColor = FmbWhite,
    cursorColor = FmbPrimary,
)
