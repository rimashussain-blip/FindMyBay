package ae.findmybay.attendant.ui.screens

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
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.outlined.FilterList
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
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
import ae.findmybay.attendant.ui.components.PillKind
import ae.findmybay.attendant.ui.components.RefreshOnResume
import ae.findmybay.attendant.ui.components.StatusPill
import ae.findmybay.attendant.ui.components.TierBadge
import ae.findmybay.attendant.ui.theme.*

@Composable
fun BookingsScreen(onBack: () -> Unit, onOpenBooking: (String) -> Unit) {
    val vm: BookingsViewModel = viewModel(
        factory = viewModelFactory { initializer { BookingsViewModel(ServiceGraph.repository) } }
    )
    val state by vm.state.collectAsStateWithLifecycle()
    RefreshOnResume { vm.load() }

    Column(Modifier.fillMaxSize().background(FmbCream)) {
        // Header
        Row(
            Modifier.fillMaxWidth().background(FmbCream).padding(horizontal = 20.dp, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            SquareIcon(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back", tint = FmbInk, modifier = Modifier.size(18.dp)) }
            Text("Bookings", fontSize = 20.sp, fontWeight = FontWeight.ExtraBold, color = FmbInk, letterSpacing = (-0.4).sp, modifier = Modifier.weight(1f).padding(start = 10.dp))
            SquareIcon(onClick = { vm.load() }) { Icon(Icons.Outlined.FilterList, "Refresh", tint = FmbInkSoft, modifier = Modifier.size(17.dp)) }
        }

        // Tabs
        Row(
            Modifier.padding(horizontal = 20.dp).fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(FmbMint).border(1.dp, FmbMintEdge, RoundedCornerShape(14.dp)).padding(4.dp),
        ) {
            BookingsTab.entries.forEach { t ->
                val active = state.tab == t
                Row(
                    Modifier.weight(1f).height(40.dp).clip(RoundedCornerShape(11.dp)).background(if (active) FmbPrimary else Color.Transparent).clickable { vm.selectTab(t) },
                    horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(t.label, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = if (active) FmbWhite else FmbPrimaryDeep)
                    Spacer(Modifier.width(6.dp))
                    Box(Modifier.clip(RoundedCornerShape(5.dp)).background(if (active) Color(0x38FFFFFF) else FmbWhite).padding(horizontal = 6.dp, vertical = 1.dp)) {
                        Text("${state.count(t)}", fontSize = 10.sp, fontWeight = FontWeight.ExtraBold, color = if (active) FmbWhite else FmbPrimaryDeep)
                    }
                }
            }
        }

        when {
            state.loading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = FmbPrimary) }
            state.error != null && state.all.isEmpty() -> Box(Modifier.fillMaxSize().padding(32.dp), contentAlignment = Alignment.Center) {
                Text(state.error!!, color = FmbInkSoft, fontWeight = FontWeight.SemiBold)
            }
            state.visible.isEmpty() -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("Nothing here yet.", color = FmbInkSoft, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
            }
            else -> LazyColumn(
                Modifier.fillMaxSize(),
                contentPadding = androidx.compose.foundation.layout.PaddingValues(start = 20.dp, end = 20.dp, top = 12.dp, bottom = 32.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                items(state.visible, key = { it.id }) { r ->
                    BookingRowCard(
                        r = r,
                        actioning = state.actioningId == r.id,
                        canCheckIn = r.status in setOf("confirmed", "alert_scheduled", "alerted"),
                        onClick = { onOpenBooking(r.id) },
                        onCheckIn = { vm.checkIn(r) },
                    )
                }
            }
        }
    }
}

@Composable
private fun BookingRowCard(
    r: BookingRow,
    actioning: Boolean,
    canCheckIn: Boolean,
    onClick: () -> Unit,
    onCheckIn: () -> Unit,
) {
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(if (r.status == "completed") Color(0xFFF7F4EC) else FmbWhite)
            .border(1.5.dp, if (r.status == "in_progress") FmbPrimary else FmbMintEdge, RoundedCornerShape(16.dp))
            .clickable(onClick = onClick)
            .alpha(if (r.status == "completed") 0.78f else 1f)
            .padding(horizontal = 14.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.clip(RoundedCornerShape(10.dp)).background(FmbSand).padding(horizontal = 10.dp, vertical = 6.dp)) {
            Text(r.time, color = FmbSandText, fontSize = 13.sp, fontWeight = FontWeight.ExtraBold)
        }
        Column(Modifier.weight(1f).padding(start = 12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(r.name, fontSize = 15.sp, fontWeight = FontWeight.Bold, color = FmbInk, maxLines = 1)
                Spacer(Modifier.width(7.dp))
                if (!r.isWalkIn) TierBadge(r.tier)
            }
            Text("${r.service} · ${r.durationMin} min · ${r.bay}", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = FmbInkSoft, modifier = Modifier.padding(top = 3.dp))
        }
        if (actioning) {
            CircularProgressIndicator(color = FmbPrimary, strokeWidth = 2.dp, modifier = Modifier.size(20.dp))
        } else if (canCheckIn) {
            Box(
                Modifier.clip(RoundedCornerShape(10.dp)).background(FmbPrimary).clickable(onClick = onCheckIn).padding(horizontal = 12.dp, vertical = 8.dp),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Filled.Check, null, tint = FmbWhite, modifier = Modifier.size(14.dp))
                    Text(" Check in", color = FmbWhite, fontSize = 11.sp, fontWeight = FontWeight.ExtraBold)
                }
            }
        } else {
            when (r.status) {
                "in_progress" -> StatusPill(PillKind.InProgress, "In Progress")
                "completed" -> StatusPill(PillKind.Done, "Completed")
                "cancelled", "no_show" -> StatusPill(PillKind.Alert, r.status.replace('_', ' '))
                else -> StatusPill(PillKind.Free, "Confirmed")
            }
        }
    }
}

@Composable
private fun SquareIcon(onClick: () -> Unit, content: @Composable () -> Unit) {
    Box(
        Modifier.size(36.dp).clip(RoundedCornerShape(12.dp)).background(FmbWhite).border(1.dp, FmbMintEdge, RoundedCornerShape(12.dp)).clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) { content() }
}
