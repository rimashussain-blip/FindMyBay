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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ae.findmybay.attendant.ui.components.Eyebrow
import ae.findmybay.attendant.ui.theme.*

private data class Svc(val name: String, val min: Int, val price: Int)

@Composable
fun WalkInScreen(onBack: () -> Unit, onStart: () -> Unit) {
    var bayIdx by remember { mutableIntStateOf(2) }      // Bay 3 default-selected
    var svcIdx by remember { mutableIntStateOf(2) }      // Deep Clean default
    val bays = listOf(Triple("Bay 1", "Sedan", false), Triple("Bay 2", "Sedan", true), Triple("Bay 3", "SUV", false))
    val svcs = listOf(Svc("Quick Wash", 20, 50), Svc("Full Wash", 45, 100), Svc("Deep Clean", 90, 200), Svc("Premium Detail", 180, 450))
    val price = svcs[svcIdx].price

    Box(Modifier.fillMaxSize().background(FmbCream)) {
        Column(Modifier.fillMaxSize()) {
            // Header
            Row(
                Modifier.fillMaxWidth().background(FmbCream).padding(horizontal = 20.dp, vertical = 14.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(
                    Modifier.size(36.dp).clip(RoundedCornerShape(12.dp)).background(FmbWhite)
                        .border(1.dp, FmbMintEdge, RoundedCornerShape(12.dp)).clickable(onClick = onBack),
                    contentAlignment = Alignment.Center,
                ) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back", tint = FmbInk, modifier = Modifier.size(18.dp)) }
                Column(Modifier.padding(start = 10.dp)) {
                    Eyebrow("Started now · 09:41")
                    Text("New walk-in", fontSize = 20.sp, fontWeight = FontWeight.ExtraBold, color = FmbInk, letterSpacing = (-0.4).sp)
                }
            }

            Column(
                Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(start = 20.dp, end = 20.dp, top = 20.dp, bottom = 110.dp),
                verticalArrangement = Arrangement.spacedBy(22.dp),
            ) {
                // Bay
                Column {
                    Eyebrow("1 · Pick a bay", modifier = Modifier.padding(bottom = 10.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        bays.forEachIndexed { i, (name, type, busy) ->
                            val sel = bayIdx == i && !busy
                            Column(
                                Modifier
                                    .height(60.dp)
                                    .clip(RoundedCornerShape(14.dp))
                                    .background(if (sel) FmbMint else if (busy) Color(0xFFF2EFE8) else FmbWhite)
                                    .border(if (sel) 2.dp else 1.5.dp, if (sel) FmbPrimary else FmbMintEdge, RoundedCornerShape(14.dp))
                                    .clickable(enabled = !busy) { bayIdx = i }
                                    .padding(horizontal = 16.dp),
                                verticalArrangement = Arrangement.Center,
                            ) {
                                Text(name, fontSize = 14.sp, fontWeight = FontWeight.ExtraBold, color = if (busy) FmbInkSoft else FmbInk)
                                Text("${if (busy) "Busy" else "Free"} · $type".uppercase(), fontSize = 10.sp, fontWeight = FontWeight.Bold, color = if (busy) FmbCoral else FmbPrimaryDeep, letterSpacing = 0.3.sp)
                            }
                        }
                    }
                }

                // Service
                Column {
                    Eyebrow("2 · Choose a service", modifier = Modifier.padding(bottom = 10.dp))
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        svcs.forEachIndexed { i, s ->
                            val sel = svcIdx == i
                            Row(
                                Modifier
                                    .fillMaxWidth()
                                    .height(64.dp)
                                    .clip(RoundedCornerShape(14.dp))
                                    .background(if (sel) FmbMint else FmbWhite)
                                    .border(if (sel) 2.dp else 1.5.dp, if (sel) FmbPrimary else FmbMintEdge, RoundedCornerShape(14.dp))
                                    .clickable { svcIdx = i }
                                    .padding(horizontal = 16.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Column(Modifier.weight(1f)) {
                                    Text(s.name, fontSize = 15.sp, fontWeight = FontWeight.ExtraBold, color = FmbInk)
                                    Text("${s.min} min", fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = FmbInkSoft, modifier = Modifier.padding(top = 3.dp))
                                }
                                Row(verticalAlignment = Alignment.Bottom) {
                                    Text("AED ", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = FmbInkSoft)
                                    Text("${s.price}", fontSize = 18.sp, fontWeight = FontWeight.ExtraBold, color = FmbInk, letterSpacing = (-0.4).sp)
                                }
                                if (sel) {
                                    Spacer(Modifier.width(12.dp))
                                    Box(Modifier.size(24.dp).clip(RoundedCornerShape(50)).background(FmbPrimary), contentAlignment = Alignment.Center) {
                                        Icon(Icons.Filled.Check, null, tint = FmbWhite, modifier = Modifier.size(14.dp))
                                    }
                                }
                            }
                        }
                    }
                }

                // Optional accordion (collapsed)
                Row(
                    Modifier
                        .fillMaxWidth()
                        .height(60.dp)
                        .clip(RoundedCornerShape(14.dp))
                        .border(1.5.dp, FmbMintEdge, RoundedCornerShape(14.dp))
                        .clickable {}
                        .padding(horizontal = 16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column(Modifier.weight(1f)) {
                        Eyebrow("3 · Optional")
                        Text("Add name & phone", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = FmbInk, modifier = Modifier.padding(top = 2.dp))
                    }
                    Icon(Icons.Filled.Add, null, tint = FmbPrimaryDeep, modifier = Modifier.size(20.dp))
                }
            }
        }

        // CTA
        Box(Modifier.align(Alignment.BottomCenter).fillMaxWidth().padding(start = 16.dp, end = 16.dp, bottom = 28.dp)) {
            Row(
                Modifier
                    .fillMaxWidth()
                    .height(64.dp)
                    .clip(RoundedCornerShape(18.dp))
                    .background(Brush.linearGradient(listOf(FmbPrimary, FmbPrimaryDeep)))
                    .clickable(onClick = onStart),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text("Start now", color = FmbWhite, fontSize = 16.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = (-0.3).sp)
                Text("  ·  AED $price", color = FmbWhite, fontSize = 16.sp, fontWeight = FontWeight.ExtraBold)
                Spacer(Modifier.width(4.dp))
                Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, null, tint = FmbWhite, modifier = Modifier.size(20.dp))
            }
        }
    }
}
