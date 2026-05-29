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
import androidx.compose.foundation.layout.offset
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
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ae.findmybay.attendant.ui.components.PillKind
import ae.findmybay.attendant.ui.components.StatusPill
import ae.findmybay.attendant.ui.components.Tier
import ae.findmybay.attendant.ui.components.TierBadge
import ae.findmybay.attendant.ui.theme.*

private data class Row2(
    val time: String, val name: String, val tier: Tier, val service: String,
    val dur: String, val bay: String, val status: String, val swipe: Boolean = false,
)

@Composable
fun BookingsScreen(onBack: () -> Unit, onOpenBooking: (String) -> Unit) {
    var tab by remember { mutableIntStateOf(0) }
    val rows = listOf(
        Row2("09:30", "Khalid Saeed", Tier.Platinum, "Deep Clean", "90 min", "Bay 2", "in"),
        Row2("10:30", "Hessa Al Mansoori", Tier.Gold, "Full Wash", "45 min", "Bay 1", "alert", swipe = true),
        Row2("10:45", "Omar Rashid", Tier.Silver, "Premium Detail", "180 min", "Bay 3", "free"),
        Row2("11:30", "Mariam Yousef", Tier.Gold, "Full Wash", "45 min", "Bay 1", "free"),
        Row2("12:00", "Tariq Bin Saif", Tier.Bronze, "Quick Wash", "20 min", "Bay 3", "free"),
        Row2("08:30", "Layla Hassan", Tier.Gold, "Quick Wash", "20 min", "Bay 1", "done"),
    )

    Column(Modifier.fillMaxSize().background(FmbCream)) {
        // Header
        Row(
            Modifier.fillMaxWidth().background(FmbCream).padding(horizontal = 20.dp, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            SquareIcon(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back", tint = FmbInk, modifier = Modifier.size(18.dp)) }
            Text("Bookings", fontSize = 20.sp, fontWeight = FontWeight.ExtraBold, color = FmbInk, letterSpacing = (-0.4).sp, modifier = Modifier.weight(1f).padding(start = 10.dp))
            SquareIcon(onClick = {}) { Icon(Icons.Outlined.FilterList, "Filter", tint = FmbInkSoft, modifier = Modifier.size(17.dp)) }
        }

        // Tabs
        Row(
            Modifier
                .padding(horizontal = 20.dp)
                .fillMaxWidth()
                .clip(RoundedCornerShape(14.dp))
                .background(FmbMint)
                .border(1.dp, FmbMintEdge, RoundedCornerShape(14.dp))
                .padding(4.dp),
            horizontalArrangement = Arrangement.spacedBy(0.dp),
        ) {
            listOf("Today" to 6, "Upcoming" to 12, "Completed" to 24).forEachIndexed { i, (label, n) ->
                val active = tab == i
                Row(
                    Modifier
                        .weight(1f)
                        .height(40.dp)
                        .clip(RoundedCornerShape(11.dp))
                        .background(if (active) FmbPrimary else Color.Transparent)
                        .clickable { tab = i },
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(label, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = if (active) FmbWhite else FmbPrimaryDeep)
                    Spacer(Modifier.width(6.dp))
                    Box(
                        Modifier.clip(RoundedCornerShape(5.dp))
                            .background(if (active) Color(0x38FFFFFF) else FmbWhite)
                            .padding(horizontal = 6.dp, vertical = 1.dp),
                    ) {
                        Text("$n", fontSize = 10.sp, fontWeight = FontWeight.ExtraBold, color = if (active) FmbWhite else FmbPrimaryDeep)
                    }
                }
            }
        }

        // Pull-to-refresh hint
        Row(
            Modifier.fillMaxWidth().padding(top = 10.dp, bottom = 4.dp),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(Modifier.size(14.dp).clip(RoundedCornerShape(50)).border(1.6.dp, FmbMintEdge, RoundedCornerShape(50)))
            Text("Pull to refresh", fontSize = 10.sp, fontWeight = FontWeight.SemiBold, color = FmbInkSoft, modifier = Modifier.padding(start = 6.dp))
        }

        // List
        LazyColumn(
            Modifier.fillMaxSize(),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(start = 20.dp, end = 20.dp, top = 4.dp, bottom = 32.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            items(rows) { r -> BookingRow(r, onClick = { onOpenBooking(r.name) }) }
        }
    }
}

@Composable
private fun BookingRow(r: Row2, onClick: () -> Unit) {
    Box(Modifier.fillMaxWidth()) {
        // Swipe-revealed action behind the card
        if (r.swipe) {
            Row(
                Modifier
                    .fillMaxWidth()
                    .height(72.dp)
                    .clip(RoundedCornerShape(16.dp))
                    .background(FmbPrimary)
                    .padding(end = 22.dp),
                horizontalArrangement = Arrangement.End,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text("Check in", color = FmbWhite, fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 0.4.sp)
                Spacer(Modifier.width(8.dp))
                Icon(Icons.Filled.Check, null, tint = FmbWhite, modifier = Modifier.size(22.dp))
            }
        }
        Row(
            Modifier
                .fillMaxWidth()
                .offset(x = if (r.swipe) (-78).dp else 0.dp)
                .clip(RoundedCornerShape(16.dp))
                .background(if (r.status == "done") Color(0xFFF7F4EC) else FmbWhite)
                .border(1.5.dp, if (r.status == "in") FmbPrimary else FmbMintEdge, RoundedCornerShape(16.dp))
                .clickable(onClick = onClick)
                .alpha(if (r.status == "done") 0.78f else 1f)
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
                    TierBadge(r.tier)
                }
                Text("${r.service} · ${r.dur} · ${r.bay}", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = FmbInkSoft, modifier = Modifier.padding(top = 3.dp))
            }
            when (r.status) {
                "in" -> StatusPill(PillKind.InProgress, "In Progress")
                "alert" -> StatusPill(PillKind.Alert, "Alerted")
                "done" -> StatusPill(PillKind.Done, "Completed")
                else -> StatusPill(PillKind.Free, "Confirmed")
            }
        }
    }
}

@Composable
private fun SquareIcon(onClick: () -> Unit, content: @Composable () -> Unit) {
    Box(
        Modifier.size(36.dp).clip(RoundedCornerShape(12.dp)).background(FmbWhite)
            .border(1.dp, FmbMintEdge, RoundedCornerShape(12.dp)).clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) { content() }
}
