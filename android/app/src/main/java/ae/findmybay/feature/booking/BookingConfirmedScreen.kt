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
import androidx.compose.foundation.shape.GenericShape
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
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import ae.findmybay.core.components.FmbPrimaryButton
import ae.findmybay.core.components.VendorLogo
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
    // Position of the tear-line notches measured from the top of the card.
    // Sits just below the vendor header so the receipt reads as
    // "stub (vendor) ┄ tear ┄ details (services & total)".
    val notchY = 78.dp
    val notchRadius = 11.dp
    val cornerRadius = 20.dp
    val shape = rememberNotchedShape(
        notchY = notchY,
        notchRadius = notchRadius,
        cornerRadius = cornerRadius,
    )

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(MaterialTheme.colorScheme.surface)
            .border(1.dp, FmbMintEdge, shape)
            .padding(horizontal = 18.dp, vertical = 14.dp),
    ) {
        Column {
            // ── Stub: vendor header ─────────────────────────────────────────
            Row(verticalAlignment = Alignment.CenterVertically) {
                VendorLogo(
                    logoUrl = b.vendor.logoUrl,
                    brandName = b.vendor.brandName,
                    size = 40.dp,
                    shape = RoundedCornerShape(12.dp),
                )
                Spacer(Modifier.width(12.dp))
                Column {
                    Text(
                        b.vendor.brandName,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = (-0.2).sp,
                        color = FmbBlue900,
                    )
                    Text(
                        "${b.vendor.city}, ${b.vendor.emirate}",
                        fontSize = 11.sp,
                        color = FmbNeutral700,
                    )
                }
            }

            // Spacer pushes content past the notch row so the dashed tear-line
            // visually sits between the stub and the details.
            Spacer(Modifier.height(20.dp))

            // ── Tear line — hairline of dashes matching the notch position ──
            DashedHairline()

            Spacer(Modifier.height(14.dp))

            // ── Details ─────────────────────────────────────────────────────
            ReceiptRow("Service", b.service.name)
            ReceiptRow("Bay", b.bay.name)
            ReceiptRow("Time", formatLocalDateTime(b.slotStart))
            ReceiptRow("Duration", "${b.service.durationMin} min")

            Spacer(Modifier.height(10.dp))
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(1.dp)
                    .background(FmbBlue900.copy(alpha = 0.08f)),
            )
            Spacer(Modifier.height(10.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    "Total",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    color = FmbBlue900,
                    modifier = Modifier.weight(1f),
                )
                Text(
                    "AED ${b.totalAed}",
                    fontSize = 20.sp,
                    fontWeight = FontWeight.ExtraBold,
                    letterSpacing = (-0.3).sp,
                    color = FmbBlue700,
                )
            }
        }
    }
}

/**
 * Hairline of evenly-spaced dashes — visually pairs with the side notches to
 * read as a tear line on a receipt stub.
 */
@Composable
private fun DashedHairline() {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        repeat(28) {
            Box(
                modifier = Modifier
                    .height(1.dp)
                    .width(6.dp)
                    .background(FmbBlue900.copy(alpha = 0.12f)),
            )
        }
    }
}

/**
 * Custom shape: a rounded-corner card with two semicircular notches cut into
 * its left and right edges at [notchY] (measured from the top). Matches the
 * "movie-ticket / receipt stub" silhouette on the Booking Confirmed screen.
 */
@Composable
private fun rememberNotchedShape(
    notchY: Dp,
    notchRadius: Dp,
    cornerRadius: Dp,
) = with(LocalDensity.current) {
    val notchYPx = notchY.toPx()
    val notchRPx = notchRadius.toPx()
    val cornerPx = cornerRadius.toPx()
    remember(notchYPx, notchRPx, cornerPx) {
        GenericShape { size, _ ->
            val w = size.width
            val h = size.height

            // Top-left corner
            moveTo(cornerPx, 0f)
            // Top edge
            lineTo(w - cornerPx, 0f)
            // Top-right corner arc
            arcTo(
                rect = Rect(w - 2 * cornerPx, 0f, w, 2 * cornerPx),
                startAngleDegrees = -90f,
                sweepAngleDegrees = 90f,
                forceMoveTo = false,
            )
            // Right edge down to top of notch
            lineTo(w, notchYPx - notchRPx)
            // Right notch (semicircle bulging into the card)
            arcTo(
                rect = Rect(w - notchRPx, notchYPx - notchRPx, w + notchRPx, notchYPx + notchRPx),
                startAngleDegrees = -90f,
                sweepAngleDegrees = -180f,
                forceMoveTo = false,
            )
            // Right edge to bottom-right corner
            lineTo(w, h - cornerPx)
            // Bottom-right corner arc
            arcTo(
                rect = Rect(w - 2 * cornerPx, h - 2 * cornerPx, w, h),
                startAngleDegrees = 0f,
                sweepAngleDegrees = 90f,
                forceMoveTo = false,
            )
            // Bottom edge
            lineTo(cornerPx, h)
            // Bottom-left corner arc
            arcTo(
                rect = Rect(0f, h - 2 * cornerPx, 2 * cornerPx, h),
                startAngleDegrees = 90f,
                sweepAngleDegrees = 90f,
                forceMoveTo = false,
            )
            // Left edge up to bottom of notch
            lineTo(0f, notchYPx + notchRPx)
            // Left notch
            arcTo(
                rect = Rect(-notchRPx, notchYPx - notchRPx, notchRPx, notchYPx + notchRPx),
                startAngleDegrees = 90f,
                sweepAngleDegrees = -180f,
                forceMoveTo = false,
            )
            // Left edge up to top-left corner
            lineTo(0f, cornerPx)
            // Top-left corner arc
            arcTo(
                rect = Rect(0f, 0f, 2 * cornerPx, 2 * cornerPx),
                startAngleDegrees = 180f,
                sweepAngleDegrees = 90f,
                forceMoveTo = false,
            )
            close()
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
