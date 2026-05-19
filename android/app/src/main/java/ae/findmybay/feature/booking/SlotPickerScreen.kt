package ae.findmybay.feature.booking

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.LocalOffer
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
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
            Column(
                modifier = Modifier.fillMaxWidth().background(FmbCream).padding(horizontal = 16.dp, vertical = 12.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                // Promo-code accordion — collapsed by default to keep the
                // bottom bar minimal; tap "Have a promo code?" to expand
                // the input. The backend validates on confirm so we don't
                // need a separate "Apply" round-trip.
                PromoCodeBlock(
                    expanded = state.promoExpanded,
                    code = state.promoCodeInput,
                    onToggle = vm::togglePromoExpanded,
                    onChange = vm::setPromoCode,
                )
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

            // Slots header — global "Bay available" legend (the section eyebrows
            // sit inside each time-of-day frame below).
            Spacer(Modifier.height(20.dp))
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 22.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Eyebrow("Available slots", modifier = Modifier.weight(1f))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(modifier = Modifier.size(6.dp).clip(CircleShape).background(FmbBlue500))
                    Spacer(Modifier.width(4.dp))
                    Text("Bay available", fontSize = 10.sp, color = FmbNeutral700)
                }
            }
            Spacer(Modifier.height(10.dp))

            // Time-of-day grouped slot grids — Morning · Afternoon · Evening,
            // each in its own framed card matching the map vendor-card style.
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
                    val grouped = remember(state.slots) { groupByTimeOfDay(state.slots) }
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .verticalScroll(rememberScrollState())
                            .padding(horizontal = 16.dp),
                    ) {
                        grouped.forEach { (period, slots) ->
                            if (slots.isNotEmpty()) {
                                TimePeriodFrame(
                                    title = period.label,
                                    icon = period.icon,
                                ) {
                                    SlotsGrid(
                                        slots = slots,
                                        selectedStart = state.selectedSlot?.startsAt,
                                        onSlotClick = { vm.selectSlot(it) },
                                    )
                                }
                                Spacer(Modifier.height(12.dp))
                            }
                        }
                        Spacer(Modifier.height(4.dp))
                        SmartLeavePromise()
                        Spacer(Modifier.height(20.dp))
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
            .padding(vertical = 12.dp, horizontal = 6.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            dayOfWeek,
            fontSize = 11.sp,
            lineHeight = 14.sp,
            color = fg.copy(alpha = if (selected) 0.85f else 0.7f),
        )
        Spacer(Modifier.height(3.dp))
        Text(
            dayNumber,
            fontSize = 20.sp,
            lineHeight = 24.sp,
            fontWeight = FontWeight.Bold,
            color = fg,
        )
        Spacer(Modifier.height(3.dp))
        // Reserve a fixed-height row even on day cells without a Today/Tomorrow
        // label, so all four cards stay the same height.
        Box(modifier = Modifier.height(14.dp), contentAlignment = Alignment.Center) {
            if (sub.isNotEmpty()) {
                Text(
                    sub,
                    fontSize = 10.sp,
                    lineHeight = 12.sp,
                    color = subFg,
                )
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

private val SLOT_FORMATTER = DateTimeFormatter.ofPattern("h:mm a")

private fun formatLocal(iso: String): String =
    runCatching {
        OffsetDateTime.parse(iso).atZoneSameInstant(ZoneId.systemDefault()).format(SLOT_FORMATTER)
    }.getOrDefault(iso.takeLast(8).take(5))

// ─── Time-of-day grouping ─────────────────────────────────────────────────

/**
 * Three buckets the slot picker groups into. Boundaries match how UAE
 * customers think about their day: Morning < 12, Afternoon 12–17, Evening 17+.
 */
private enum class TimePeriod(val label: String, val icon: String) {
    Morning("Morning", "☀️"),
    Afternoon("Afternoon", "🌤"),
    Evening("Evening", "🌙"),
}

private fun groupByTimeOfDay(slots: List<Slot>): Map<TimePeriod, List<Slot>> {
    val out = linkedMapOf(
        TimePeriod.Morning to mutableListOf<Slot>(),
        TimePeriod.Afternoon to mutableListOf<Slot>(),
        TimePeriod.Evening to mutableListOf<Slot>(),
    )
    for (slot in slots) {
        val hour = runCatching {
            OffsetDateTime.parse(slot.startsAt).atZoneSameInstant(ZoneId.systemDefault()).hour
        }.getOrDefault(0)
        val bucket = when {
            hour < 12 -> TimePeriod.Morning
            hour < 17 -> TimePeriod.Afternoon
            else -> TimePeriod.Evening
        }
        out.getValue(bucket).add(slot)
    }
    return out
}

/**
 * Reusable framed card matching the map's vendor-card silhouette: surface
 * background, 18.dp rounding, hairline mint-edge border. Title row sits flush
 * inside the frame.
 */
@Composable
private fun TimePeriodFrame(
    title: String,
    icon: String,
    content: @Composable () -> Unit,
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .background(MaterialTheme.colorScheme.surface)
            .border(1.dp, FmbMintEdge, RoundedCornerShape(18.dp))
            .padding(horizontal = 14.dp, vertical = 12.dp),
    ) {
        Column {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(icon, fontSize = 14.sp)
                Spacer(Modifier.width(6.dp))
                Text(
                    title.uppercase(),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 0.6.sp,
                    color = FmbBlue700,
                )
            }
            Spacer(Modifier.height(10.dp))
            content()
        }
    }
}

/**
 * 3-column grid of slot cells. Implemented with Rows rather than
 * LazyVerticalGrid because each frame holds a small fixed list and we want
 * the parent Column's verticalScroll to drive scrolling.
 */
@Composable
private fun SlotsGrid(
    slots: List<Slot>,
    selectedStart: String?,
    onSlotClick: (Slot) -> Unit,
) {
    val rows = slots.chunked(3)
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        rows.forEach { row ->
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                row.forEach { slot ->
                    Box(modifier = Modifier.weight(1f)) {
                        SlotCell(
                            slot = slot,
                            selected = selectedStart == slot.startsAt,
                            onClick = { onSlotClick(slot) },
                        )
                    }
                }
                // Pad the trailing partial row so cells stay aligned.
                repeat(3 - row.size) {
                    Box(modifier = Modifier.weight(1f))
                }
            }
        }
    }
}

/**
 * Collapsible promo-code input above the Confirm CTA. Default-collapsed so
 * the screen isn't visually noisy for the common case (no promo). The
 * actual validation happens server-side on `create()` — if the code is
 * wrong, the SlotPickerViewModel surfaces the backend's error message.
 */
@Composable
private fun PromoCodeBlock(
    expanded: Boolean,
    code: String,
    onToggle: () -> Unit,
    onChange: (String) -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(MaterialTheme.colorScheme.surface)
            .border(1.dp, FmbMintEdge, RoundedCornerShape(14.dp)),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clickable(onClick = onToggle)
                .padding(horizontal = 14.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Icon(
                imageVector = Icons.Filled.LocalOffer,
                contentDescription = null,
                tint = FmbBlue700,
                modifier = Modifier.size(18.dp),
            )
            Text(
                text = if (code.isNotBlank() && !expanded) "Promo: $code" else "Have a promo code?",
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                color = FmbBlue900,
                modifier = Modifier.weight(1f),
            )
            Icon(
                imageVector = if (expanded) Icons.Filled.ExpandLess else Icons.Filled.ExpandMore,
                contentDescription = if (expanded) "Hide" else "Show",
                tint = FmbNeutral700,
                modifier = Modifier.size(18.dp),
            )
        }
        if (expanded) {
            Box(modifier = Modifier.padding(horizontal = 14.dp, vertical = 4.dp)) {
                OutlinedTextField(
                    value = code,
                    onValueChange = { onChange(it.trim().uppercase()) },
                    placeholder = { Text("WELCOME10", fontSize = 13.sp) },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = FmbBlue500,
                        unfocusedBorderColor = FmbMintEdge,
                    ),
                )
            }
            Text(
                "Codes are checked when you tap Confirm.",
                fontSize = 11.sp,
                color = FmbNeutral700,
                modifier = Modifier.padding(start = 14.dp, end = 14.dp, bottom = 10.dp),
            )
        }
    }
}
