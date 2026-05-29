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
import androidx.compose.material.icons.filled.SwapHoriz
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ae.findmybay.attendant.ui.components.Eyebrow
import ae.findmybay.attendant.ui.components.Tier
import ae.findmybay.attendant.ui.components.TierBadge
import ae.findmybay.attendant.ui.theme.*

@Composable
fun BookingDetailScreen(onClose: () -> Unit) {
    Box(Modifier.fillMaxSize().background(FmbCream)) {
        // Dimmed bay-board behind
        Column(Modifier.fillMaxSize()) {
            StickyHeader("Aqua Car Wash", "Business Bay · Open")
            Row(
                Modifier.fillMaxWidth().padding(20.dp).alpha(0.32f),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                repeat(2) {
                    Box(Modifier.weight(1f).height(148.dp).clip(RoundedCornerShape(16.dp)).background(FmbWhite).border(1.5.dp, FmbPrimary, RoundedCornerShape(16.dp)))
                }
            }
        }
        // Dim overlay
        Box(Modifier.fillMaxSize().background(Color(0x800B3B36)).clickable(onClick = onClose))

        // Sheet
        Column(
            Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .fillMaxHeight(0.88f)
                .clip(RoundedCornerShape(topStart = 28.dp, topEnd = 28.dp))
                .background(FmbCream),
        ) {
            // Grab handle
            Box(Modifier.fillMaxWidth().padding(top = 10.dp, bottom = 4.dp), contentAlignment = Alignment.Center) {
                Box(Modifier.width(44.dp).height(5.dp).clip(RoundedCornerShape(50)).background(FmbMintEdge))
            }

            Column(
                Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(start = 20.dp, end = 20.dp, top = 8.dp, bottom = 16.dp),
            ) {
                // Customer card
                Column(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp)).background(FmbWhite)
                        .border(1.5.dp, FmbPrimary.copy(alpha = 0.25f), RoundedCornerShape(18.dp)),
                ) {
                    Row(
                        Modifier.fillMaxWidth().background(Brush.horizontalGradient(listOf(FmbMint, FmbSand))).padding(horizontal = 16.dp, vertical = 10.dp),
                        horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Eyebrow("Booking · 10:30 today")
                        TierBadge(Tier.Gold)
                    }
                    Row(Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.size(52.dp).clip(RoundedCornerShape(16.dp)).background(FmbPrimaryDeep), contentAlignment = Alignment.Center) {
                            Text("HA", color = FmbCream, fontSize = 18.sp, fontWeight = FontWeight.ExtraBold)
                        }
                        Column(Modifier.weight(1f).padding(start = 14.dp)) {
                            Text("Hessa Al Mansoori", fontSize = 18.sp, fontWeight = FontWeight.ExtraBold, color = FmbInk, letterSpacing = (-0.3).sp)
                            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 3.dp)) {
                                Icon(Icons.Filled.Phone, null, tint = FmbInkSoft, modifier = Modifier.size(11.dp))
                                Text(" +971 50 234 5678", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = FmbInkSoft)
                            }
                        }
                    }
                }

                // Vehicle grid
                Eyebrow("Vehicle", modifier = Modifier.padding(top = 20.dp, bottom = 10.dp))
                val car = listOf("Make" to "Nissan", "Type" to "Patrol SUV", "Colour" to "Pearl White", "Plate" to "DXB · A 42891")
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    car.chunked(2).forEach { pair ->
                        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            pair.forEach { (l, v) ->
                                Column(Modifier.weight(1f).clip(RoundedCornerShape(14.dp)).background(FmbMint).padding(horizontal = 14.dp, vertical = 12.dp)) {
                                    Eyebrow(l)
                                    Text(v, fontSize = 14.sp, fontWeight = FontWeight.ExtraBold, color = FmbInk, modifier = Modifier.padding(top = 5.dp))
                                }
                            }
                        }
                    }
                }

                // Service block
                Eyebrow("Service · with promo", modifier = Modifier.padding(top = 20.dp, bottom = 10.dp))
                Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(FmbWhite).border(1.5.dp, FmbMintEdge, RoundedCornerShape(16.dp)).padding(14.dp)) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Column {
                            Text("Deep Clean", fontSize = 16.sp, fontWeight = FontWeight.ExtraBold, color = FmbInk, letterSpacing = (-0.3).sp)
                            Text("90 min · includes interior shampoo", fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = FmbInkSoft, modifier = Modifier.padding(top = 3.dp))
                        }
                        Column(horizontalAlignment = Alignment.End) {
                            Text("AED 200", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = FmbInkSoft, textDecoration = TextDecoration.LineThrough)
                            Row(verticalAlignment = Alignment.Bottom) {
                                Text("180", fontSize = 34.sp, fontWeight = FontWeight.ExtraBold, color = FmbInk, letterSpacing = (-1).sp)
                                Text(".00", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = FmbInkSoft)
                            }
                        }
                    }
                    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 10.dp)) {
                        Box(Modifier.clip(RoundedCornerShape(6.dp)).background(FmbSand).padding(horizontal = 9.dp, vertical = 4.dp)) {
                            Text("AQUA10 · −AED 20", fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, color = FmbSandText, letterSpacing = 0.3.sp)
                        }
                        Text("  Auto-applied", fontSize = 11.sp, color = FmbInkSoft)
                    }
                }

                // Bay assignment
                Eyebrow("Bay assignment", modifier = Modifier.padding(top = 20.dp, bottom = 10.dp))
                Row(
                    Modifier.fillMaxWidth().height(56.dp).clip(RoundedCornerShape(14.dp)).background(FmbWhite).border(1.5.dp, FmbMintEdge, RoundedCornerShape(14.dp)).clickable {}.padding(horizontal = 16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box(Modifier.size(36.dp).clip(RoundedCornerShape(10.dp)).background(FmbPrimary), contentAlignment = Alignment.Center) {
                        Text("3", color = FmbWhite, fontSize = 14.sp, fontWeight = FontWeight.ExtraBold)
                    }
                    Column(Modifier.weight(1f).padding(start = 12.dp)) {
                        Text("Bay 3 · SUV", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = FmbInk)
                        Text("FREE NOW", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = FmbPrimaryDeep, letterSpacing = 0.3.sp)
                    }
                    Icon(Icons.Filled.SwapHoriz, null, tint = FmbPrimaryDeep, modifier = Modifier.size(14.dp))
                    Text(" Swap", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = FmbPrimaryDeep)
                }
            }

            // Action stack
            Column(
                Modifier.fillMaxWidth().background(FmbWhite).padding(start = 16.dp, end = 16.dp, top = 14.dp, bottom = 28.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Row(
                    Modifier.fillMaxWidth().height(60.dp).clip(RoundedCornerShape(16.dp)).background(Brush.linearGradient(listOf(FmbPrimary, FmbPrimaryDeep))).clickable(onClick = onClose),
                    horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(Icons.Filled.Check, null, tint = FmbWhite, modifier = Modifier.size(20.dp))
                    Text("  Check in · Send wash-ready push", color = FmbWhite, fontSize = 15.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = (-0.2).sp)
                }
                Box(
                    Modifier.fillMaxWidth().height(52.dp).clip(RoundedCornerShape(14.dp)).background(FmbWhite).border(1.5.dp, FmbPrimary, RoundedCornerShape(14.dp)).clickable {},
                    contentAlignment = Alignment.Center,
                ) { Text("Mark in-progress", color = FmbPrimaryDeep, fontSize = 14.sp, fontWeight = FontWeight.Bold) }
                Box(Modifier.fillMaxWidth().height(36.dp).clickable(onClick = onClose), contentAlignment = Alignment.Center) {
                    Text("Cancel · No-show", color = FmbCoral, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}
