package ae.findmybay.feature.bookings

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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.outlined.StarBorder
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import ae.findmybay.core.theme.primaryCtaGradient

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RateBookingScreen(
    onBack: () -> Unit,
    onSubmitted: () -> Unit,
    vm: RateBookingViewModel = hiltViewModel(),
) {
    val state by vm.state.collectAsStateWithLifecycle()
    val cs = MaterialTheme.colorScheme

    if (state.submitted) {
        // Auto-pop one tick after success so the user sees the checkmark.
        androidx.compose.runtime.LaunchedEffect(Unit) {
            kotlinx.coroutines.delay(1200)
            onSubmitted()
        }
    }

    Scaffold(
        containerColor = cs.background,
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        "Rate your wash",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.SemiBold,
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back", tint = cs.primary)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = cs.background),
            )
        },
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            if (state.submitted) {
                ThankYouCard()
                return@Scaffold
            }

            Spacer(Modifier.height(24.dp))

            Text(
                "How was it?",
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
                color = cs.onBackground,
            )
            Spacer(Modifier.height(8.dp))
            Text(
                "Your rating helps other drivers pick the right wash.",
                style = MaterialTheme.typography.bodyMedium,
                color = cs.onSurfaceVariant,
                textAlign = TextAlign.Center,
            )

            Spacer(Modifier.height(28.dp))

            StarRow(rating = state.rating, onRate = vm::setRating)

            Spacer(Modifier.height(28.dp))

            OutlinedTextField(
                value = state.note,
                onValueChange = vm::setNote,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(140.dp),
                placeholder = { Text("Any details? (optional)", color = cs.onSurfaceVariant) },
                shape = RoundedCornerShape(16.dp),
            )

            state.error?.let {
                Spacer(Modifier.height(12.dp))
                Text(it, color = cs.error, style = MaterialTheme.typography.bodySmall)
            }

            Spacer(Modifier.weight(1f))

            // Submit CTA
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(if (state.rating >= 1) primaryCtaGradient() else androidx.compose.ui.graphics.SolidColor(cs.surfaceVariant))
                    .clickable(enabled = state.rating >= 1 && !state.submitting) { vm.submit() }
                    .padding(vertical = 16.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    if (state.submitting) "Submitting…" else "Submit rating",
                    style = MaterialTheme.typography.labelLarge,
                    fontWeight = FontWeight.SemiBold,
                    color = if (state.rating >= 1) cs.onPrimary else cs.onSurfaceVariant,
                )
            }

            Spacer(Modifier.height(20.dp))
        }
    }
}

@Composable
private fun StarRow(rating: Int, onRate: (Int) -> Unit) {
    val cs = MaterialTheme.colorScheme
    Row(
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        for (i in 1..5) {
            val filled = i <= rating
            Box(
                modifier = Modifier
                    .size(56.dp)
                    .clip(CircleShape)
                    .background(if (filled) cs.primaryContainer else cs.surface)
                    .border(1.dp, cs.outlineVariant, CircleShape)
                    .clickable { onRate(i) },
                contentAlignment = Alignment.Center,
            ) {
                if (filled) {
                    Icon(Icons.Filled.Star, null, tint = cs.primary, modifier = Modifier.size(28.dp))
                } else {
                    Icon(Icons.Outlined.StarBorder, null, tint = cs.onSurfaceVariant, modifier = Modifier.size(28.dp))
                }
            }
        }
    }
}

@Composable
private fun ThankYouCard() {
    val cs = MaterialTheme.colorScheme
    Column(
        modifier = Modifier.fillMaxWidth().padding(top = 96.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            modifier = Modifier
                .size(96.dp)
                .clip(CircleShape)
                .background(cs.primaryContainer),
            contentAlignment = Alignment.Center,
        ) {
            Icon(Icons.Filled.CheckCircle, null, tint = cs.primary, modifier = Modifier.size(56.dp))
        }
        Spacer(Modifier.height(20.dp))
        Text("Thanks for the feedback!", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold, color = cs.onBackground)
        Spacer(Modifier.height(8.dp))
        Text("We've shared your rating with the wash.", style = MaterialTheme.typography.bodyMedium, color = cs.onSurfaceVariant, textAlign = TextAlign.Center)
    }
}
