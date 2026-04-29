package ae.findmybay.feature.booking

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
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import ae.findmybay.core.components.Eyebrow
import ae.findmybay.core.components.FmbPrimaryButton
import ae.findmybay.core.theme.FmbBlue100
import ae.findmybay.core.theme.FmbBlue500
import ae.findmybay.core.theme.FmbBlue700
import ae.findmybay.core.theme.FmbBlue900
import ae.findmybay.core.theme.FmbCream
import ae.findmybay.core.theme.FmbMintEdge
import ae.findmybay.core.theme.FmbNeutral700
import ae.findmybay.core.theme.FmbSand
import ae.findmybay.domain.model.Service
import ae.findmybay.domain.model.Slot
import androidx.compose.ui.graphics.Color
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter

@Composable
fun SlotPickerScreen(
    onBack: () -> Unit,
    onConfirmed: (bookingId: String) -> Unit,
    vm: SlotPickerViewModel = hiltViewModel(),
) {
    val state by vm.state.collectAsStateWithLifecycle()

    LaunchedEffect(state.booking?.id) {
        state.booking?.let { onConfirmed(it.id) }
    }

    val ctaLabel = state.selectedSlot?.let { slot ->
        val day = state.date.format(DateTimeFormatter.ofPattern("EEE"))
        val time = formatLocal(slot.startsAt)
        val price = state.selectedService?.priceAed ?: 0
        "Confirm · $day $time · AED $price"
    } ?: "Pick a time slot"

    Scaffold(
        containerColor = FmbCream,
        bottomBar = {
            Box(modifier = Modifier.fillMaxWidth().background(FmbCream).padding(16.dp)) {
                FmbPrimaryButton(
                    text = ctaLabel,
                    onClick = vm::confirm,
                    enabled = state.selectedSlot != null,
                    loading = state.confirming,
                )
            }
        },
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding)) {

            // Sticky header
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 22.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(MaterialTheme.colorScheme.surface)
                        .border(1.dp, FmbMintEdge, RoundedCornerShape(12.dp))
                        .clickable(onClick = onBack),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back", tint = FmbBlue900, modifier = Modifier.size(14.dp))
                }
                Text(
                    "Pick a time",
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = (-0.3).sp,
                    color = FmbBlue900,
                )
            }

            // Service chips (still useful)
            state.vendor?.let { vendor ->
                Spacer(Modifier.height(8.dp))
                Eyebrow("Service", modifier = Modifier.padding(start = 22.dp))
                Spacer(Modifier.height(8.dp))
                LazyRow(
                    contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 16.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    items(vendor.services, key = { it.id }) { svc ->
                        ServiceChip(svc, selected = state.selectedService?.id == svc.id) {
                            vm.selectService(svc)
                        }
                    }
                }
            }

            // Date row
            Spacer(Modifier.height(20.dp))
            Eyebrow("Date", modifier = Modifier.padding(start = 22.dp))
            Spacer(Modifier.height(8.dp))
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                state.availableDates.take(4).forEach { d ->
                    DayCard(
                        date = d,
                        selected = state.date == d,
                        onClick = { vm.selectDate(d) },
                        modifier = Modifier.weight(1f),
                    )
                }
            }

            // Slots header
            Spacer(Modifier.height(20.dp))
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 22.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Eyebrow("Morning slots", modifier = Modifier.weight(1f))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(modifier = Modifier.size(6.dp).clip(CircleShape).background(FmbBlue500))
                    Spacer(Modifier.width(4.dp))
                    Text("Bay available", fontSize = 10.sp, color = FmbNeutral700)
                }
            }
            Spacer(Modifier.height(8.dp))

            // Slot grid
            Box(modifier = Modifier.weight(1f).fillMaxWidth()) {
                if (state.loading) {
                    CircularProgressIndicator(modifier = Modifier.align(Alignment.Center))
                } else if (state.slots.isEmpty()) {
                    Text(
                        "No slots available for this service.",
                        fontSize = 12.sp,
                        color = FmbNeutral700,
                        modifier = Modifier.align(Alignment.Center),
                    )
                } else {
                    LazyVerticalGrid(
                        columns = GridCells.Fixed(3),
                        contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 16.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        items(state.slots, key = { it.startsAt }) { slot ->
                            SlotCell(
                                slot = slot,
                                selected = state.selectedSlot?.startsAt == slot.startsAt,
                                onClick = { vm.selectSlot(slot) },
                            )
                        }

                        // Sand smart-leave promise card (full-width footer below grid).
                        item(span = { GridItemSpan(3) }) {
                            Spacer(Modifier.height(8.dp))
                        }
                        item(span = { GridItemSpan(3) }) {
                            SmartLeavePromise()
                        }
                    }
                }
            }

            state.error?.let {
                Text(
                    it,
                    color = MaterialTheme.colorScheme.error,
                    fontSize = 12.sp,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                )
            }
        }
    }
}

@Composable
private fun ServiceChip(service: Service, selected: Boolean, onClick: () -> Unit) {
    val bg = if (selected) FmbBlue100 else MaterialTheme.colorScheme.surface
    val border = if (selected) FmbBlue500 else FmbMintEdge
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(12.dp))
            .background(bg)
            .border(1.dp, border, RoundedCornerShape(12.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 10.dp),
    ) {
        Column {
            Text(service.name, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = FmbBlue900)
            Text(
                "${service.durationMin} min · AED ${service.priceAed}",
                fontSize = 11.sp,
                color = if (selected) FmbBlue700 else FmbNeutral700,
            )
        }
    }
}

@Composable
private fun DayCard(
    date: LocalDate,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val today = LocalDate.now()
    val dayOfWeek = date.format(DateTimeFormatter.ofPattern("EEE"))
    val dayNumber = date.format(DateTimeFormatter.ofPattern("dd"))
    val sub = when (date) {
        today -> "Today"
        today.plusDays(1) -> "Tomorrow"
        else -> ""
    }

    val bg = if (selected) FmbBlue700 else MaterialTheme.colorScheme.surface
    val fg = if (selected) Color.White else FmbBlue900
    val subFg = if (selected) Color.White.copy(alpha = 0.85f) else FmbNeutral700
    val border = if (selected) FmbBlue700 else FmbMintEdge

    Column(
        modifier = modifier
            .clip(RoundedCornerShape(14.dp))
            .background(bg)
            .border(1.dp, border, RoundedCornerShape(14.dp))
            .clickable(onClick = onClick)
            .padding(vertical = 10.dp, horizontal = 4.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(dayOfWeek, fontSize = 10.sp, color = fg.copy(alpha = if (selected) 0.85f else 0.7f))
        Spacer(Modifier.height(2.dp))
        Text(dayNumber, fontSize = 18.sp, fontWeight = FontWeight.Bold, color = fg)
        Spacer(Modifier.height(2.dp))
        Box(modifier = Modifier.height(12.dp), contentAlignment = Alignment.Center) {
            if (sub.isNotEmpty()) {
                Text(sub, fontSize = 9.sp, color = subFg)
            }
        }
    }
}

@Composable
private fun SlotCell(slot: Slot, selected: Boolean, onClick: () -> Unit) {
    val isPast = !slot.available
    val bg = when {
        isPast -> Color(0xFFF1F1EE)
        selected -> FmbBlue500
        else -> MaterialTheme.colorScheme.surface
    }
    val fg = when {
        isPast -> Color(0xFFB7B7B0)
        selected -> Color.White
        else -> FmbBlue900
    }
    val border = when {
        isPast -> Color.Transparent
        selected -> FmbBlue500
        else -> FmbMintEdge
    }

    Box(
        modifier = Modifier
            .height(44.dp)
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(bg)
            .border(1.dp, border, RoundedCornerShape(12.dp))
            .clickable(enabled = slot.available, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = formatLocal(slot.startsAt),
            color = fg,
            fontWeight = if (selected) FontWeight.Bold else FontWeight.SemiBold,
            fontSize = 14.sp,
            textDecoration = if (isPast) TextDecoration.LineThrough else null,
        )
    }
}

@Composable
private fun SmartLeavePromise() {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 0.dp)
            .clip(RoundedCornerShape(14.dp))
            .background(FmbSand)
            .padding(14.dp),
    ) {
        Column {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    "You'll get a smart-leave alert",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = FmbBlue700,
                    modifier = Modifier.weight(1f),
                )
                Text("🚦", fontSize = 16.sp)
            }
            Spacer(Modifier.height(4.dp))
            Text(
                "We'll ping you when it's time to head out, factoring traffic.",
                fontSize = 11.sp,
                color = FmbBlue900.copy(alpha = 0.7f),
                lineHeight = 15.sp,
            )
        }
    }
}

private val SLOT_FORMATTER = DateTimeFormatter.ofPattern("HH:mm")

private fun formatLocal(iso: String): String =
    runCatching {
        OffsetDateTime.parse(iso).atZoneSameInstant(ZoneId.systemDefault()).format(SLOT_FORMATTER)
    }.getOrDefault(iso.takeLast(8).take(5))
