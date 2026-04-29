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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.QrCode
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import ae.findmybay.core.theme.FmbBlue100
import ae.findmybay.core.theme.FmbBlue500
import ae.findmybay.core.theme.FmbBlue700
import ae.findmybay.core.theme.FmbBlue900
import ae.findmybay.core.theme.FmbCoralSoft
import ae.findmybay.core.theme.FmbCream
import ae.findmybay.core.theme.FmbMintEdge
import ae.findmybay.core.theme.FmbNeutral700
import ae.findmybay.core.theme.FmbRed500
import ae.findmybay.core.theme.FmbSand
import ae.findmybay.domain.model.Booking
import java.time.Duration
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter

@Composable
fun MyBookingsScreen(
    onAddBooking: () -> Unit,
    onShowQr: (bookingId: String) -> Unit = {},
    onRate: (bookingId: String) -> Unit = {},
    vm: MyBookingsViewModel = hiltViewModel(),
) {
    val state by vm.state.collectAsStateWithLifecycle()
    var tab by remember { mutableStateOf(BookingTab.Upcoming) }
    val snackbarHostState = remember { SnackbarHostState() }

    // One-shot toast after a successful cancellation.
    LaunchedEffect(state.lastCancelMessage) {
        val msg = state.lastCancelMessage ?: return@LaunchedEffect
        snackbarHostState.showSnackbar(msg)
        vm.consumeCancelMessage()
    }

    state.cancelDialog?.let { dialog ->
        CancelConfirmDialog(
            dialog = dialog,
            onConfirm = vm::confirmCancel,
            onDismiss = vm::dismissCancelDialog,
        )
    }

    Scaffold(
        containerColor = FmbCream,
        snackbarHost = { SnackbarHost(snackbarHostState) },
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding)) {

            // Title row
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 22.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    "My bookings",
                    fontSize = 22.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = (-0.4).sp,
                    color = FmbBlue900,
                    modifier = Modifier.weight(1f),
                )
                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(FmbBlue100)
                        .clickable(onClick = onAddBooking),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(Icons.Filled.Add, "Book wash", tint = FmbBlue700, modifier = Modifier.size(16.dp))
                }
            }

            // Segmented control
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(MaterialTheme.colorScheme.surface)
                    .border(1.dp, FmbMintEdge, RoundedCornerShape(12.dp))
                    .padding(4.dp),
            ) {
                Segment(
                    label = "Upcoming",
                    selected = tab == BookingTab.Upcoming,
                    onClick = { tab = BookingTab.Upcoming },
                    modifier = Modifier.weight(1f),
                )
                Segment(
                    label = "Past",
                    selected = tab == BookingTab.Past,
                    onClick = { tab = BookingTab.Past },
                    modifier = Modifier.weight(1f),
                )
            }

            Spacer(Modifier.height(16.dp))

            // List
            // Past = the slot is over OR the booking has reached a terminal status
            // (completed / cancelled / no_show). That way you can mark a future
            // booking as Completed and it moves straight to history.
            val now = OffsetDateTime.now()
            val terminal = setOf("completed", "cancelled", "no_show")
            val all = state.bookings
            val items = when (tab) {
                BookingTab.Upcoming -> all.filter {
                    val slotInFuture = OffsetDateTime.parse(it.slotStart).isAfter(now)
                    slotInFuture && it.status.lowercase() !in terminal
                }
                BookingTab.Past -> all.filter {
                    val slotInPast = !OffsetDateTime.parse(it.slotStart).isAfter(now)
                    slotInPast || it.status.lowercase() in terminal
                }
            }

            Box(modifier = Modifier.weight(1f).fillMaxWidth()) {
                when {
                    state.loading -> CircularProgressIndicator(modifier = Modifier.align(Alignment.Center))
                    state.error != null -> Text(
                        state.error!!,
                        color = MaterialTheme.colorScheme.error,
                        modifier = Modifier.align(Alignment.Center).padding(24.dp),
                    )
                    items.isEmpty() -> Text(
                        if (tab == BookingTab.Upcoming) "No upcoming bookings yet" else "Nothing in your history yet",
                        color = FmbNeutral700,
                        fontSize = 13.sp,
                        modifier = Modifier.align(Alignment.Center),
                    )
                    else -> LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        // Active card = first upcoming
                        if (tab == BookingTab.Upcoming) {
                            items.firstOrNull()?.let { active ->
                                item {
                                    ActiveBookingCard(
                                        active,
                                        onShowQr = { onShowQr(active.id) },
                                        onCancel = { vm.askCancel(active) },
                                    )
                                }
                            }
                            items.drop(1).forEach { future ->
                                item {
                                    FutureBookingCard(
                                        future,
                                        onCancel = { vm.askCancel(future) },
                                    )
                                }
                            }
                            item { Spacer(Modifier.height(4.dp)) }
                            item { LoyaltyTeaser(progress = 0.6f) }
                        } else {
                            items.forEach { past ->
                                item { FutureBookingCard(past, scheduledLabel = false, onRate = { onRate(past.id) }) }
                            }
                        }
                    }
                }
            }
        }
    }
}

private enum class BookingTab { Upcoming, Past }

@Composable
private fun Segment(label: String, selected: Boolean, onClick: () -> Unit, modifier: Modifier = Modifier) {
    val bg = if (selected) FmbBlue500 else Color.Transparent
    val fg = if (selected) Color.White else FmbBlue900
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(9.dp))
            .background(bg)
            .clickable(onClick = onClick)
            .padding(vertical = 8.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(label, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = fg)
    }
}

@Composable
private fun ActiveBookingCard(b: Booking, onShowQr: () -> Unit = {}, onCancel: () -> Unit = {}) {
    val now = OffsetDateTime.now()
    val slot = runCatching { OffsetDateTime.parse(b.slotStart) }.getOrNull()
    val countdown = slot?.let {
        val d = Duration.between(now, it)
        if (d.isNegative) "starting now"
        else "in ${d.toHours()}h ${d.toMinutesPart()}m"
    } ?: ""

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .background(MaterialTheme.colorScheme.surface)
            .border(1.5.dp, FmbBlue500, RoundedCornerShape(18.dp)),
    ) {
        Column {
            // Mint-to-sand header strip
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(
                        Brush.linearGradient(
                            colors = listOf(FmbBlue100, FmbSand),
                            start = Offset(0f, 0f),
                            end = Offset(Float.POSITIVE_INFINITY, 0f),
                        )
                    )
                    .padding(horizontal = 14.dp, vertical = 8.dp),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        formatHeader(b.slotStart).uppercase(),
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 0.3.sp,
                        color = FmbBlue700,
                        modifier = Modifier.weight(1f),
                    )
                    Text(countdown, fontSize = 10.sp, fontWeight = FontWeight.Bold, color = FmbBlue700)
                }
            }

            // Body
            Row(
                modifier = Modifier.fillMaxWidth().padding(14.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
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
                Spacer(Modifier.width(12.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(b.vendor.brandName, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = FmbBlue900)
                    Text(
                        "${b.service.name} · ${b.bay.name}",
                        fontSize = 11.sp,
                        color = FmbNeutral700,
                    )
                }
                Text("AED ${b.totalAed}", fontSize = 14.sp, fontWeight = FontWeight.ExtraBold, color = FmbBlue700)
            }

            // Action row
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 14.dp, vertical = 10.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                // Show QR
                Row(
                    modifier = Modifier
                        .clip(RoundedCornerShape(10.dp))
                        .background(FmbBlue700)
                        .clickable(onClick = onShowQr)
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(Icons.Filled.QrCode, null, tint = Color.White, modifier = Modifier.size(13.dp))
                    Spacer(Modifier.width(6.dp))
                    Text("Show QR", fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = Color.White)
                }
                // Reschedule
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(10.dp))
                        .background(MaterialTheme.colorScheme.surface)
                        .border(1.dp, FmbMintEdge, RoundedCornerShape(10.dp))
                        .clickable { /* TODO reschedule */ }
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                ) {
                    Text("Reschedule", fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = FmbBlue900)
                }
                Spacer(Modifier.weight(1f))
                // Cancel
                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .clip(RoundedCornerShape(10.dp))
                        .background(MaterialTheme.colorScheme.surface)
                        .border(1.dp, FmbMintEdge, RoundedCornerShape(10.dp))
                        .clickable(onClick = onCancel),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(Icons.Filled.Close, "Cancel", tint = FmbRed500, modifier = Modifier.size(14.dp))
                }
            }
        }
    }
}

@Composable
private fun FutureBookingCard(
    b: Booking,
    scheduledLabel: Boolean = true,
    onRate: () -> Unit = {},
    onCancel: (() -> Unit)? = null,
) {
    val canRate = b.status.equals("completed", ignoreCase = true) || b.status.equals("in_progress", ignoreCase = true)
    val canCancel = onCancel != null && b.status.lowercase() in setOf("pending_payment", "confirmed", "alert_scheduled", "alerted")
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .background(MaterialTheme.colorScheme.surface)
            .border(1.dp, FmbMintEdge, RoundedCornerShape(18.dp))
            .clickable(enabled = canRate, onClick = onRate)
            .padding(14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
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
        Spacer(Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    formatHeader(b.slotStart),
                    fontSize = 10.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = FmbNeutral700,
                    modifier = Modifier.weight(1f),
                )
                if (scheduledLabel) {
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(8.dp))
                            .background(FmbBlue100)
                            .padding(horizontal = 8.dp, vertical = 2.dp),
                    ) {
                        Text("SCHEDULED", fontSize = 9.sp, fontWeight = FontWeight.Bold, color = FmbBlue700)
                    }
                }
            }
            Spacer(Modifier.height(4.dp))
            Text(b.vendor.brandName, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = FmbBlue900)
            Text(
                "${b.service.name} · ${b.bay.name}",
                fontSize = 11.sp,
                color = FmbNeutral700,
            )
            if (canRate) {
                Spacer(Modifier.height(4.dp))
                Text(
                    "Tap to rate ★",
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    color = FmbBlue700,
                )
            }
        }
        Column(horizontalAlignment = Alignment.End) {
            Text("AED ${b.totalAed}", fontSize = 13.sp, fontWeight = FontWeight.ExtraBold, color = FmbBlue700)
            if (canCancel) {
                Spacer(Modifier.height(6.dp))
                Text(
                    "Cancel",
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    color = FmbRed500,
                    modifier = Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .clickable { onCancel?.invoke() }
                        .padding(horizontal = 6.dp, vertical = 3.dp),
                )
            }
        }
    }
}

// ── Cancel-confirm dialog ────────────────────────────────────────────────
//
// Custom-themed Dialog rather than Material's AlertDialog so the cream
// background, mint border and blue ink match the rest of the app.

@Composable
private fun CancelConfirmDialog(
    dialog: CancelDialogState,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit,
) {
    val b = dialog.booking
    val now = OffsetDateTime.now()
    val slot = runCatching { OffsetDateTime.parse(b.slotStart) }.getOrNull()
    val mins = slot?.let { Duration.between(now, it).toMinutes() } ?: Long.MAX_VALUE
    val withinFee = mins in 0..30

    Dialog(
        onDismissRequest = { if (!dialog.submitting) onDismiss() },
        properties = DialogProperties(
            dismissOnBackPress = !dialog.submitting,
            dismissOnClickOutside = !dialog.submitting,
        ),
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp)
                .clip(RoundedCornerShape(20.dp))
                .background(FmbCream)
                .border(1.dp, FmbMintEdge, RoundedCornerShape(20.dp))
                .padding(horizontal = 22.dp, vertical = 22.dp),
        ) {
            Column(modifier = Modifier.fillMaxWidth()) {
                // Hero icon — coral-soft halo + close icon
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(40.dp)
                            .clip(CircleShape)
                            .background(FmbCoralSoft),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(
                            Icons.Filled.Close,
                            contentDescription = null,
                            tint = FmbRed500,
                            modifier = Modifier.size(18.dp),
                        )
                    }
                    Spacer(Modifier.width(12.dp))
                    Text(
                        "Cancel this booking?",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = (-0.3).sp,
                        color = FmbBlue900,
                    )
                }

                Spacer(Modifier.height(14.dp))

                // Booking summary chip
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(MaterialTheme.colorScheme.surface)
                        .border(1.dp, FmbMintEdge, RoundedCornerShape(12.dp))
                        .padding(horizontal = 12.dp, vertical = 10.dp),
                ) {
                    Column {
                        Text(
                            b.vendor.brandName,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            color = FmbBlue900,
                        )
                        Spacer(Modifier.height(2.dp))
                        Text(
                            "${b.service.name} · ${b.bay.name}",
                            fontSize = 11.sp,
                            color = FmbNeutral700,
                        )
                        Text(
                            formatHeader(b.slotStart),
                            fontSize = 11.sp,
                            color = FmbNeutral700,
                        )
                    }
                }

                Spacer(Modifier.height(12.dp))

                // Refund policy hint — sand for fee, mint for free
                if (withinFee) {
                    PolicyCallout(
                        bg = FmbCoralSoft,
                        textColor = FmbRed500,
                        title = "Late cancellation fee",
                        body = "Cancelling within 30 minutes of your slot incurs an AED 10 fee.",
                    )
                } else {
                    PolicyCallout(
                        bg = FmbBlue100,
                        textColor = FmbBlue700,
                        title = "No charge",
                        body = "Your slot is more than 30 minutes away — you won't be charged.",
                    )
                }

                if (dialog.error != null) {
                    Spacer(Modifier.height(10.dp))
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(10.dp))
                            .background(FmbCoralSoft)
                            .padding(horizontal = 12.dp, vertical = 10.dp),
                    ) {
                        Text(
                            dialog.error,
                            fontSize = 11.sp,
                            color = FmbRed500,
                        )
                    }
                }

                Spacer(Modifier.height(20.dp))

                // Actions
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .height(46.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .background(MaterialTheme.colorScheme.surface)
                            .border(1.dp, FmbMintEdge, RoundedCornerShape(12.dp))
                            .clickable(enabled = !dialog.submitting, onClick = onDismiss),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            "Keep booking",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = FmbBlue900,
                        )
                    }
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .height(46.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .background(if (dialog.submitting) FmbCoralSoft else FmbRed500)
                            .clickable(enabled = !dialog.submitting, onClick = onConfirm),
                        contentAlignment = Alignment.Center,
                    ) {
                        if (dialog.submitting) {
                            CircularProgressIndicator(
                                strokeWidth = 2.dp,
                                modifier = Modifier.size(18.dp),
                                color = FmbRed500,
                            )
                        } else {
                            Text(
                                "Yes, cancel",
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color.White,
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun PolicyCallout(
    bg: Color,
    textColor: Color,
    title: String,
    body: String,
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(bg)
            .padding(horizontal = 12.dp, vertical = 10.dp),
    ) {
        Column {
            Text(
                title,
                fontSize = 10.sp,
                fontWeight = FontWeight.ExtraBold,
                letterSpacing = 0.6.sp,
                color = textColor,
            )
            Spacer(Modifier.height(2.dp))
            Text(
                body,
                fontSize = 12.sp,
                color = textColor,
                lineHeight = 16.sp,
            )
        }
    }
}

@Composable
private fun LoyaltyTeaser(progress: Float) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .background(
                Brush.linearGradient(
                    colors = listOf(FmbSand, FmbCoralSoft),
                    start = Offset(0f, 0f),
                    end = Offset(Float.POSITIVE_INFINITY, 0f),
                )
            )
            .padding(16.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("🎁", fontSize = 28.sp)
            Spacer(Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text("One free wash on us", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = FmbBlue900)
                Spacer(Modifier.height(2.dp))
                Text(
                    "${(progress * 5).toInt()} of 5 washes complete",
                    fontSize = 11.sp,
                    color = FmbBlue700,
                )
                Spacer(Modifier.height(6.dp))
                // Progress bar
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(4.dp)
                        .clip(CircleShape)
                        .background(Color.White.copy(alpha = 0.6f)),
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth(progress)
                            .height(4.dp)
                            .clip(CircleShape)
                            .background(FmbBlue500),
                    )
                }
            }
        }
    }
}

private fun formatHeader(iso: String): String {
    val zoned = runCatching { OffsetDateTime.parse(iso).atZoneSameInstant(ZoneId.systemDefault()) }.getOrNull()
        ?: return iso
    val today = java.time.LocalDate.now()
    val date = zoned.toLocalDate()
    val time = zoned.format(DateTimeFormatter.ofPattern("HH:mm"))
    return when (date) {
        today -> "Today · $time"
        today.plusDays(1) -> "Tomorrow · $time"
        else -> "${zoned.format(DateTimeFormatter.ofPattern("EEE d MMM"))} · $time"
    }
}
