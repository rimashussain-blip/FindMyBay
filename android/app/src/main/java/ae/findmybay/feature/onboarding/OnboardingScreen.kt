package ae.findmybay.feature.onboarding

import androidx.activity.compose.BackHandler
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import ae.findmybay.core.components.FmbPrimaryButton
import ae.findmybay.core.theme.FmbBlue700
import ae.findmybay.core.theme.FmbBlue900
import ae.findmybay.core.theme.FmbCream
import ae.findmybay.core.theme.FmbMintEdge
import ae.findmybay.core.theme.FmbNeutral700
import ae.findmybay.domain.model.CarType

/**
 * First-run onboarding shown right after Google sign-in for fresh customer
 * accounts. Two visual steps:
 *   Step 1 — mobile number + car make + type + colour
 *   Step 2 — car plate number (own screen so the user can see it large
 *            while typing)
 *
 * Submitting saves the full profile in one PATCH /auth/me/profile call, then
 * navigates to the map.
 */
@Composable
fun OnboardingScreen(
    onComplete: () -> Unit,
    vm: OnboardingViewModel = hiltViewModel(),
) {
    val state by vm.state.collectAsStateWithLifecycle()

    // Catch back-press in step 2 → return to step 1, instead of leaving the
    // onboarding flow entirely (which would strand the user signed in but
    // unable to use the app).
    BackHandler(enabled = state.step == OnboardingViewModel.Step.Plate) {
        vm.goBackToDetails()
    }

    Scaffold(containerColor = MaterialTheme.colorScheme.background) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 24.dp)
                .verticalScroll(rememberScrollState()),
        ) {
            Spacer(Modifier.height(20.dp))

            // Progress dots — gives the user a sense of how far they are.
            ProgressDots(step = state.step)

            Spacer(Modifier.height(24.dp))

            when (state.step) {
                OnboardingViewModel.Step.CarDetails -> CarDetailsStep(state, vm)
                OnboardingViewModel.Step.Plate -> PlateStep(state, vm, onComplete)
            }

            Spacer(Modifier.height(24.dp))
        }
    }
}

@Composable
private fun ProgressDots(step: OnboardingViewModel.Step) {
    val cs = MaterialTheme.colorScheme
    Row(verticalAlignment = Alignment.CenterVertically) {
        Dot(active = true) // step 1 always reached
        Spacer(Modifier.width(6.dp))
        Box(
            modifier = Modifier
                .height(2.dp)
                .width(28.dp)
                .background(if (step == OnboardingViewModel.Step.Plate) cs.primary else FmbMintEdge),
        )
        Spacer(Modifier.width(6.dp))
        Dot(active = step == OnboardingViewModel.Step.Plate)
    }
}

@Composable
private fun Dot(active: Boolean) {
    val cs = MaterialTheme.colorScheme
    Box(
        modifier = Modifier
            .size(if (active) 10.dp else 8.dp)
            .clip(CircleShape)
            .background(if (active) cs.primary else FmbMintEdge),
    )
}

// ────────────────────────────────────────────────────────────────────────
// Step 1 — mobile + car details
// ────────────────────────────────────────────────────────────────────────

@Composable
private fun CarDetailsStep(
    state: OnboardingViewModel.State,
    vm: OnboardingViewModel,
) {
    Text(
        "Welcome to Find My Bay!",
        fontSize = 22.sp,
        fontWeight = FontWeight.Bold,
        letterSpacing = (-0.4).sp,
        color = FmbBlue900,
    )
    Spacer(Modifier.height(6.dp))
    Text(
        "Tell us about your car so we can show the right washes for it.",
        fontSize = 13.sp,
        color = FmbNeutral700,
        lineHeight = 18.sp,
    )

    Spacer(Modifier.height(24.dp))

    Eyebrow("Mobile number")
    Spacer(Modifier.height(6.dp))
    LabelledTextField(
        value = state.phone,
        onValueChange = vm::setPhone,
        placeholder = "+971 50 123 4567",
        keyboardType = KeyboardType.Phone,
    )

    Spacer(Modifier.height(20.dp))

    Eyebrow("Car make")
    Spacer(Modifier.height(6.dp))
    LabelledTextField(
        value = state.carMake,
        onValueChange = vm::setCarMake,
        placeholder = "Toyota, Nissan, BMW…",
    )

    Spacer(Modifier.height(20.dp))

    Eyebrow("Car type")
    Spacer(Modifier.height(8.dp))
    CarTypeChips(selected = state.carType, onSelect = vm::setCarType)

    Spacer(Modifier.height(20.dp))

    Eyebrow("Colour")
    Spacer(Modifier.height(6.dp))
    LabelledTextField(
        value = state.carColor,
        onValueChange = vm::setCarColor,
        placeholder = "Black, white, silver…",
    )

    state.error?.let {
        Spacer(Modifier.height(12.dp))
        Text(it, color = MaterialTheme.colorScheme.error, fontSize = 12.sp)
    }

    Spacer(Modifier.height(28.dp))

    FmbPrimaryButton(
        text = "Continue",
        onClick = { vm.goToPlateStep() },
        enabled = state.step1Valid,
    )
}

// ────────────────────────────────────────────────────────────────────────
// Step 2 — plate number
// ────────────────────────────────────────────────────────────────────────

@Composable
private fun PlateStep(
    state: OnboardingViewModel.State,
    vm: OnboardingViewModel,
    onComplete: () -> Unit,
) {
    Text(
        "Last thing — your plate",
        fontSize = 22.sp,
        fontWeight = FontWeight.Bold,
        letterSpacing = (-0.4).sp,
        color = FmbBlue900,
    )
    Spacer(Modifier.height(6.dp))
    Text(
        "We use this only on your booking confirmation so the attendant knows which car to wash.",
        fontSize = 13.sp,
        color = FmbNeutral700,
        lineHeight = 18.sp,
    )

    Spacer(Modifier.height(28.dp))

    Eyebrow("Plate number")
    Spacer(Modifier.height(6.dp))
    LabelledTextField(
        value = state.carPlate,
        onValueChange = vm::setCarPlate,
        placeholder = "DUBAI A 12345",
        textStyle = TextStyle(
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold,
            color = FmbBlue900,
        ),
    )
    Spacer(Modifier.height(8.dp))
    Text(
        "Looks like: ${state.carColor.ifBlank { "—" }} ${state.carMake.ifBlank { "—" }}, ${state.carType?.display ?: "—"} · ${state.carPlate.ifBlank { "—" }}",
        fontSize = 11.sp,
        color = FmbNeutral700,
    )

    state.error?.let {
        Spacer(Modifier.height(12.dp))
        Text(it, color = MaterialTheme.colorScheme.error, fontSize = 12.sp)
    }

    Spacer(Modifier.height(28.dp))

    FmbPrimaryButton(
        text = if (state.saving) "Saving…" else "Finish",
        onClick = { vm.submit(onComplete) },
        enabled = state.step2Valid && !state.saving,
        loading = state.saving,
    )

    Spacer(Modifier.height(10.dp))

    // Subtle "Back" link to return to step 1.
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(enabled = !state.saving) { vm.goBackToDetails() }
            .padding(vertical = 8.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            "Back",
            fontSize = 12.sp,
            fontWeight = FontWeight.Medium,
            color = FmbBlue700,
        )
    }
}

// ────────────────────────────────────────────────────────────────────────
// Reusable form bits
// ────────────────────────────────────────────────────────────────────────

@Composable
private fun Eyebrow(text: String) {
    Text(
        text.uppercase(),
        fontSize = 10.sp,
        fontWeight = FontWeight.Bold,
        letterSpacing = 0.6.sp,
        color = FmbBlue700,
    )
}

@Composable
private fun LabelledTextField(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    keyboardType: KeyboardType = KeyboardType.Text,
    textStyle: TextStyle = TextStyle(fontSize = 15.sp, color = FmbBlue900),
) {
    val cs = MaterialTheme.colorScheme
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(cs.surface)
            .border(1.dp, FmbMintEdge, RoundedCornerShape(14.dp))
            .padding(horizontal = 14.dp, vertical = 12.dp),
    ) {
        BasicTextField(
            value = value,
            onValueChange = onValueChange,
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
            textStyle = textStyle,
            cursorBrush = SolidColor(cs.primary),
            modifier = Modifier.fillMaxWidth(),
            decorationBox = { inner ->
                if (value.isEmpty()) {
                    Text(
                        placeholder,
                        fontSize = textStyle.fontSize,
                        color = FmbNeutral700,
                    )
                }
                inner()
            },
        )
    }
}

@Composable
private fun CarTypeChips(selected: CarType?, onSelect: (CarType) -> Unit) {
    LazyRow(
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        items(CarType.entries) { type ->
            Chip(label = type.display, active = selected == type) { onSelect(type) }
        }
    }
}

@Composable
private fun Chip(label: String, active: Boolean, onClick: () -> Unit) {
    val cs = MaterialTheme.colorScheme
    val bg = if (active) cs.primaryContainer else cs.surface
    val border = if (active) cs.primary else FmbMintEdge
    val fg = if (active) FmbBlue700 else FmbBlue900
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(10.dp))
            .background(bg)
            .border(1.dp, border, RoundedCornerShape(10.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 8.dp),
    ) {
        Text(label, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = fg)
    }
}

