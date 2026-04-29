package ae.findmybay.feature.booking

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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Navigation
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import ae.findmybay.core.components.FmbPrimaryButton
import ae.findmybay.core.theme.FmbBlue100
import ae.findmybay.core.theme.FmbBlue300
import ae.findmybay.core.theme.FmbBlue700
import ae.findmybay.core.theme.FmbBlue900
import ae.findmybay.core.theme.FmbCream
import ae.findmybay.core.theme.FmbMintEdge
import ae.findmybay.core.theme.logoGradient
import ae.findmybay.core.theme.FmbNeutral700
import ae.findmybay.core.theme.FmbSand
import ae.findmybay.domain.model.Booking
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter

@Composable
fun BookingConfirmedScreen(
    onDone: () -> Unit,
    vm: BookingConfirmedViewModel = hiltViewModel(),
) {
    val state by vm.state.collectAsStateWithLifecycle()

    Scaffold(containerColor = FmbCream) { padding ->
        Box(modifier = Modifier.fillMaxSize().padding(padding)) {
            when {
                state.loading -> CircularProgressIndicator(modifier = Modifier.align(Alignment.Center))
                state.error != null -> Text(
                    state.error!!,
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier.align(Alignment.Center).padding(24.dp),
                )
                state.booking != null -> ConfirmedBody(state.booking!!, onDone)
            }
        }
    }
}

@Composable
private fun ConfirmedBody(b: Booking, onDone: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 22.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Spacer(Modifier.height(28.dp))

        StackedHaloCheck()

        Spacer(Modifier.height(22.dp))
        Text(
            "You're all set!",
            fontSize = 22.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = (-0.4).sp,
            color = FmbBlue900,
        )
        Spacer(Modifier.height(6.dp))
        Text(
            "We'll send a smart-leave alert so you arrive on time — even in traffic.",
            fontSize = 12.sp,
            color = FmbNeutral700,
            textAlign = TextAlign.Center,
            lineHeight = 18.sp,
            modifier = Modifier.padding(horizontal = 12.dp),
        )

        Spacer(Modifier.height(22.dp))
        ReceiptCard(b)

        Spacer(Modifier.height(16.dp))
        Row(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.fillMaxWidth(),
        ) {
            SecondaryButton(
                icon = { Icon(Icons.Filled.CalendarMonth, null, modifier = Modifier.size(14.dp), tint = FmbBlue900) },
                label = "Add to calendar",
                modifier = Modifier.weight(1f),
            )
            SecondaryButton(
                icon = { Icon(Icons.Filled.Navigation, null, modifier = Modifier.size(14.dp), tint = FmbBlue900) },
                label = "Get directions",
                modifier = Modifier.weight(1f),
            )
        }

        Spacer(Modifier.weight(1f))

        FmbPrimaryButton(text = "Done", onClick = onDone)

        Spacer(Modifier.height(28.dp))
    }
}

/**
 * Stacked-halo success mark per handoff §6: outer sand halo + middle mint disc
 * + inner gradient teal disc with white check.
 */
@Composable
private fun StackedHaloCheck() {
    Box(modifier = Modifier.size(108.dp), contentAlignment = Alignment.Center) {
        // Outer sand halo
        Box(
            modifier = Modifier
                .size(108.dp)
                .clip(CircleShape)
                .background(FmbSand.copy(alpha = 0.45f)),
        )
        // Middle mint disc
        Box(
            modifier = Modifier
                .size(84.dp)
                .clip(CircleShape)
                .background(FmbBlue100),
        )
        // Inner gradient disc with check
        Box(
            modifier = Modifier
                .size(64.dp)
                .clip(CircleShape)
                .background(logoGradient()),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                Icons.Filled.Check,
                contentDescription = null,
                modifier = Modifier.size(32.dp),
                tint = Color.White,
            )
        }
    }
}

@Composable
private fun ReceiptCard(b: Booking) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .background(MaterialTheme.colorScheme.surface)
            .border(1.dp, FmbMintEdge, RoundedCornerShape(18.dp))
            .padding(horizontal = 16.dp, vertical = 14.dp),
    ) {
        Column {
            // Header row: thumbnail + vendor
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(38.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(
                            Brush.linearGradient(
                                colors = listOf(FmbBlue100, FmbSand),
                                start = Offset(0f, 0f),
                                end = Offset(Float.POSITIVE_INFINITY, Float.POSITIVE_INFINITY),
                            )
                        ),
                    contentAlignment = Alignment.Center,
                ) {
                    Text("🚿", fontSize = 18.sp)
                }
                Spacer(Modifier.width(10.dp))
                Column {
                    Text(
                        b.vendor.brandName,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        color = FmbBlue900,
                    )
                    Text(
                        "${b.vendor.city}, ${b.vendor.emirate}",
                        fontSize = 10.sp,
                        color = FmbNeutral700,
                    )
                }
            }

            Spacer(Modifier.height(12.dp))

            // Tear line — dashed-look hairline with cream notches at the edges.
            // The notches sit on top of the divider via a Box overlay.
            Box(modifier = Modifier.fillMaxWidth()) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(1.dp)
                        .background(FmbBlue900.copy(alpha = 0.08f))
                        .align(Alignment.Center),
                )
                // Left notch
                Box(
                    modifier = Modifier
                        .size(16.dp)
                        .align(Alignment.CenterStart)
                        .clip(CircleShape)
                        .background(FmbCream)
                        .wrapContentSize(unbounded = true)
                        .size(16.dp),
                )
                // Right notch
                Box(
                    modifier = Modifier
                        .size(16.dp)
                        .align(Alignment.CenterEnd)
                        .clip(CircleShape)
                        .background(FmbCream),
                )
            }

            Spacer(Modifier.height(12.dp))

            ReceiptRow("Service", b.service.name)
            ReceiptRow("Bay", b.bay.name)
            ReceiptRow("Time", formatLocalDateTime(b.slotStart))
            ReceiptRow("Duration", "${b.service.durationMin} min")

            Spacer(Modifier.height(8.dp))
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(1.dp)
                    .background(FmbBlue900.copy(alpha = 0.08f)),
            )
            Spacer(Modifier.height(8.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    "Total",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = FmbBlue900,
                    modifier = Modifier.weight(1f),
                )
                Text(
                    "AED ${b.totalAed}",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.ExtraBold,
                    color = FmbBlue700,
                )
            }
        }
    }
}

@Composable
private fun ReceiptRow(label: String, value: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 5.dp),
    ) {
        Text(label, fontSize = 11.sp, color = FmbNeutral700, modifier = Modifier.weight(1f))
        Text(value, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = FmbBlue900)
    }
}

@Composable
private fun SecondaryButton(
    icon: @Composable () -> Unit,
    label: String,
    modifier: Modifier = Modifier,
) {
    OutlinedButton(
        onClick = { /* TODO calendar / maps intents */ },
        modifier = modifier.height(44.dp),
        shape = RoundedCornerShape(12.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, FmbMintEdge),
        colors = ButtonDefaults.outlinedButtonColors(
            containerColor = MaterialTheme.colorScheme.surface,
            contentColor = FmbBlue900,
        ),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 12.dp),
    ) {
        icon()
        Spacer(Modifier.width(6.dp))
        Text(label, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
    }
}

private val DT_FORMATTER = DateTimeFormatter.ofPattern("EEE d MMM · HH:mm")

private fun formatLocalDateTime(iso: String): String =
    runCatching {
        OffsetDateTime.parse(iso).atZoneSameInstant(ZoneId.systemDefault()).format(DT_FORMATTER)
    }.getOrDefault(iso)
