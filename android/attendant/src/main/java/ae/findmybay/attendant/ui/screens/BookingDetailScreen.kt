package ae.findmybay.attendant.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import ae.findmybay.attendant.data.BookingRow
import ae.findmybay.attendant.data.ServiceGraph
import ae.findmybay.attendant.ui.components.Eyebrow
import ae.findmybay.attendant.ui.components.TierBadge
import ae.findmybay.attendant.ui.theme.*

@Composable
fun BookingDetailScreen(bookingId: String, onClose: () -> Unit) {
    val vm: BookingDetailViewModel = viewModel(
        factory = viewModelFactory { initializer { BookingDetailViewModel(ServiceGraph.repository, bookingId) } }
    )
    val state by vm.state.collectAsStateWithLifecycle()
    LaunchedEffect(state.done) { if (state.done) onClose() }

    val row = state.row

    Box(Modifier.fillMaxSize()) {
        // Dimmed scrim
        Box(Modifier.fillMaxSize().background(Color(0x800B3B36)).clickable(onClick = onClose))

        // Sheet
        Column(
            Modifier.align(Alignment.BottomCenter).fillMaxWidth().fillMaxHeight(0.9f)
                .clip(RoundedCornerShape(topStart = 28.dp, topEnd = 28.dp)).background(FmbCream),
        ) {
            Box(Modifier.fillMaxWidth().padding(top = 10.dp, bottom = 4.dp), contentAlignment = Alignment.Center) {
                Box(Modifier.width(44.dp).height(5.dp).clip(RoundedCornerShape(50)).background(FmbMintEdge))
            }

            if (row == null) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text("Booking not found", color = FmbInkSoft, fontWeight = FontWeight.SemiBold)
                }
                return@Column
            }

            Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(start = 20.dp, end = 20.dp, top = 8.dp, bottom = 16.dp)) {
                // Customer card
                Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp)).background(FmbWhite).border(1.5.dp, FmbPrimary.copy(alpha = 0.25f), RoundedCornerShape(18.dp))) {
                    Row(
                        Modifier.fillMaxWidth().background(Brush.horizontalGradient(listOf(FmbMint, FmbSand))).padding(horizontal = 16.dp, vertical = 10.dp),
                        horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Eyebrow("Booking · ${row.time}")
                        if (!row.isWalkIn) TierBadge(row.tier)
                        else Text("WALK-IN", fontSize = 10.sp, fontWeight = FontWeight.ExtraBold, color = FmbSandText, letterSpacing = 0.3.sp)
                    }
                    Row(Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.size(52.dp).clip(RoundedCornerShape(16.dp)).background(FmbPrimaryDeep), contentAlignment = Alignment.Center) {
                            Text(initials(row.name), color = FmbCream, fontSize = 18.sp, fontWeight = FontWeight.ExtraBold)
                        }
                        Column(Modifier.weight(1f).padding(start = 14.dp)) {
                            Text(row.name, fontSize = 18.sp, fontWeight = FontWeight.ExtraBold, color = FmbInk, letterSpacing = (-0.3).sp)
                            if (row.phone != null) Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 3.dp)) {
                                Icon(Icons.Filled.Phone, null, tint = FmbInkSoft, modifier = Modifier.size(11.dp))
                                Text(" ${row.phone}", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = FmbInkSoft)
                            }
                        }
                    }
                }

                // Service block
                Eyebrow("Service", modifier = Modifier.padding(top = 20.dp, bottom = 10.dp))
                Row(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(FmbWhite).border(1.5.dp, FmbMintEdge, RoundedCornerShape(16.dp)).padding(14.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Column {
                        Text(row.service, fontSize = 16.sp, fontWeight = FontWeight.ExtraBold, color = FmbInk, letterSpacing = (-0.3).sp)
                        Text("${row.durationMin} min · ${row.bay}", fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = FmbInkSoft, modifier = Modifier.padding(top = 3.dp))
                    }
                    Row(verticalAlignment = Alignment.Bottom) {
                        Text("AED ", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = FmbInkSoft, modifier = Modifier.padding(bottom = 4.dp))
                        Text("${row.totalAed}", fontSize = 30.sp, fontWeight = FontWeight.ExtraBold, color = FmbInk, letterSpacing = (-0.8).sp)
                    }
                }

                // Bay
                Eyebrow("Bay", modifier = Modifier.padding(top = 20.dp, bottom = 10.dp))
                Row(
                    Modifier.fillMaxWidth().height(56.dp).clip(RoundedCornerShape(14.dp)).background(FmbWhite).border(1.5.dp, FmbMintEdge, RoundedCornerShape(14.dp)).padding(horizontal = 16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box(Modifier.size(36.dp).clip(RoundedCornerShape(10.dp)).background(FmbPrimary), contentAlignment = Alignment.Center) {
                        Text(row.bay.filter { it.isDigit() }.ifEmpty { "•" }, color = FmbWhite, fontSize = 14.sp, fontWeight = FontWeight.ExtraBold)
                    }
                    Text(row.bay, fontSize = 14.sp, fontWeight = FontWeight.Bold, color = FmbInk, modifier = Modifier.padding(start = 12.dp))
                }

                state.error?.let {
                    Spacer(Modifier.height(16.dp))
                    Box(Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).background(FmbCoralSoft).padding(horizontal = 12.dp, vertical = 10.dp)) {
                        Text(it, color = FmbCoral, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                    }
                }
            }

            // Action stack — depends on current status
            ActionStack(row = row, working = state.working, vm = vm, onClose = onClose)
        }
    }
}

@Composable
private fun ActionStack(row: BookingRow, working: Boolean, vm: BookingDetailViewModel, onClose: () -> Unit) {
    val canCheckIn = row.status in setOf("confirmed", "alert_scheduled", "alerted")
    val inProgress = row.status == "in_progress"
    val terminal = row.status in setOf("completed", "cancelled", "no_show")

    Column(
        Modifier.fillMaxWidth().background(FmbWhite).padding(start = 16.dp, end = 16.dp, top = 14.dp, bottom = 28.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        when {
            terminal -> {
                Box(
                    Modifier.fillMaxWidth().height(52.dp).clip(RoundedCornerShape(14.dp)).background(FmbMint).clickable(onClick = onClose),
                    contentAlignment = Alignment.Center,
                ) { Text("Done · ${row.status.replace('_', ' ')}", color = FmbPrimaryDeep, fontSize = 14.sp, fontWeight = FontWeight.Bold) }
            }
            else -> {
                // Primary action
                Row(
                    Modifier.fillMaxWidth().height(60.dp).clip(RoundedCornerShape(16.dp)).background(Brush.linearGradient(listOf(FmbPrimary, FmbPrimaryDeep)))
                        .clickable(enabled = !working) { if (inProgress) vm.markComplete() else vm.checkIn() },
                    horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically,
                ) {
                    if (working) {
                        CircularProgressIndicator(color = FmbWhite, strokeWidth = 2.dp, modifier = Modifier.size(20.dp))
                    } else {
                        Icon(Icons.Filled.Check, null, tint = FmbWhite, modifier = Modifier.size(20.dp))
                        Text(
                            if (inProgress) "  Mark complete · Send wash-ready push" else "  Check in",
                            color = FmbWhite, fontSize = 15.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = (-0.2).sp,
                        )
                    }
                }
                if (canCheckIn) {
                    Box(
                        Modifier.fillMaxWidth().height(52.dp).clip(RoundedCornerShape(14.dp)).background(FmbWhite).border(1.5.dp, FmbPrimary, RoundedCornerShape(14.dp)).clickable(enabled = !working) { vm.markComplete() },
                        contentAlignment = Alignment.Center,
                    ) { Text("Mark complete", color = FmbPrimaryDeep, fontSize = 14.sp, fontWeight = FontWeight.Bold) }
                }
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center) {
                    Box(Modifier.clickable(enabled = !working) { vm.cancel() }.padding(horizontal = 16.dp, vertical = 8.dp)) {
                        Text("Cancel", color = FmbCoral, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }
                    Box(Modifier.clickable(enabled = !working) { vm.noShow() }.padding(horizontal = 16.dp, vertical = 8.dp)) {
                        Text("No-show", color = FmbCoral, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

private fun initials(name: String): String =
    name.trim().split(" ").filter { it.isNotEmpty() }.take(2).joinToString("") { it.first().uppercase() }.ifEmpty { "?" }
