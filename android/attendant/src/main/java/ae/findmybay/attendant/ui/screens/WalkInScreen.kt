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
import androidx.compose.foundation.layout.imePadding
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
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
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
import ae.findmybay.attendant.data.ServiceGraph
import ae.findmybay.attendant.ui.components.Eyebrow
import ae.findmybay.attendant.ui.theme.*

@Composable
fun WalkInScreen(onBack: () -> Unit, onStart: () -> Unit) {
    val vm: WalkInViewModel = viewModel(
        factory = viewModelFactory { initializer { WalkInViewModel(ServiceGraph.repository) } }
    )
    val state by vm.state.collectAsStateWithLifecycle()

    LaunchedEffect(state.done) { if (state.done) onStart() }

    val price = state.selectedService?.priceAed ?: 0

    Box(Modifier.fillMaxSize().background(FmbCream).imePadding()) {
        Column(Modifier.fillMaxSize()) {
            // Header
            Row(
                Modifier.fillMaxWidth().background(FmbCream).padding(horizontal = 20.dp, vertical = 14.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(
                    Modifier.size(36.dp).clip(RoundedCornerShape(12.dp)).background(FmbWhite).border(1.dp, FmbMintEdge, RoundedCornerShape(12.dp)).clickable(onClick = onBack),
                    contentAlignment = Alignment.Center,
                ) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back", tint = FmbInk, modifier = Modifier.size(18.dp)) }
                Column(Modifier.padding(start = 10.dp)) {
                    Eyebrow("Started now")
                    Text("New walk-in", fontSize = 20.sp, fontWeight = FontWeight.ExtraBold, color = FmbInk, letterSpacing = (-0.4).sp)
                }
            }

            if (state.loading) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = FmbPrimary) }
                return@Column
            }

            Column(
                Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(start = 20.dp, end = 20.dp, top = 20.dp, bottom = 110.dp),
                verticalArrangement = Arrangement.spacedBy(22.dp),
            ) {
                // Bay
                Column {
                    Eyebrow("1 · Pick a bay", modifier = Modifier.padding(bottom = 10.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        state.bays.forEach { b ->
                            val busy = b.status != "free"
                            val sel = state.selectedBayId == b.id && !busy
                            Column(
                                Modifier.height(60.dp).clip(RoundedCornerShape(14.dp))
                                    .background(if (sel) FmbMint else if (busy) Color(0xFFF2EFE8) else FmbWhite)
                                    .border(if (sel) 2.dp else 1.5.dp, if (sel) FmbPrimary else FmbMintEdge, RoundedCornerShape(14.dp))
                                    .clickable(enabled = !busy) { vm.selectBay(b.id) }
                                    .padding(horizontal = 16.dp),
                                verticalArrangement = Arrangement.Center,
                            ) {
                                Text(b.name, fontSize = 14.sp, fontWeight = FontWeight.ExtraBold, color = if (busy) FmbInkSoft else FmbInk)
                                Text("${if (busy) b.status else "Free"} · ${b.bayType}".uppercase(), fontSize = 10.sp, fontWeight = FontWeight.Bold, color = if (busy) FmbCoral else FmbPrimaryDeep, letterSpacing = 0.3.sp)
                            }
                        }
                    }
                }

                // Service
                Column {
                    Eyebrow("2 · Choose a service", modifier = Modifier.padding(bottom = 10.dp))
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        state.services.forEach { s ->
                            val sel = state.selectedServiceId == s.id
                            Row(
                                Modifier.fillMaxWidth().height(64.dp).clip(RoundedCornerShape(14.dp))
                                    .background(if (sel) FmbMint else FmbWhite)
                                    .border(if (sel) 2.dp else 1.5.dp, if (sel) FmbPrimary else FmbMintEdge, RoundedCornerShape(14.dp))
                                    .clickable { vm.selectService(s.id) }
                                    .padding(horizontal = 16.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Column(Modifier.weight(1f)) {
                                    Text(s.name, fontSize = 15.sp, fontWeight = FontWeight.ExtraBold, color = FmbInk)
                                    Text("${s.durationMin} min", fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = FmbInkSoft, modifier = Modifier.padding(top = 3.dp))
                                }
                                Row(verticalAlignment = Alignment.Bottom) {
                                    Text("AED ", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = FmbInkSoft)
                                    Text("${s.priceAed}", fontSize = 18.sp, fontWeight = FontWeight.ExtraBold, color = FmbInk, letterSpacing = (-0.4).sp)
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

                // Optional details
                Column {
                    Row(
                        Modifier.fillMaxWidth().height(60.dp).clip(RoundedCornerShape(14.dp)).border(1.5.dp, FmbMintEdge, RoundedCornerShape(14.dp)).clickable { vm.toggleExpanded() }.padding(horizontal = 16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Column(Modifier.weight(1f)) {
                            Eyebrow("3 · Optional")
                            Text("Add name & phone", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = FmbInk, modifier = Modifier.padding(top = 2.dp))
                        }
                        Icon(Icons.Filled.Add, null, tint = FmbPrimaryDeep, modifier = Modifier.size(20.dp))
                    }
                    if (state.expanded) {
                        Spacer(Modifier.height(10.dp))
                        OutlinedTextField(value = state.name, onValueChange = vm::setName, singleLine = true, placeholder = { Text("Customer name") }, modifier = Modifier.fillMaxWidth(), colors = walkinFieldColors())
                        Spacer(Modifier.height(8.dp))
                        OutlinedTextField(value = state.phone, onValueChange = vm::setPhone, singleLine = true, placeholder = { Text("+971 50…") }, modifier = Modifier.fillMaxWidth(), colors = walkinFieldColors())
                    }
                }

                state.error?.let {
                    Box(Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).background(FmbCoralSoft).padding(horizontal = 12.dp, vertical = 10.dp)) {
                        Text(it, color = FmbCoral, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                    }
                }
            }
        }

        // CTA
        Box(Modifier.align(Alignment.BottomCenter).fillMaxWidth().padding(start = 16.dp, end = 16.dp, bottom = 28.dp)) {
            Row(
                Modifier.fillMaxWidth().height(64.dp).clip(RoundedCornerShape(18.dp))
                    .background(if (state.canSubmit) Brush.linearGradient(listOf(FmbPrimary, FmbPrimaryDeep)) else Brush.linearGradient(listOf(FmbMintEdge, FmbMintEdge)))
                    .clickable(enabled = state.canSubmit) { vm.submit() },
                horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically,
            ) {
                if (state.submitting) {
                    CircularProgressIndicator(color = FmbWhite, strokeWidth = 2.dp, modifier = Modifier.size(22.dp))
                } else {
                    Text("Start now", color = FmbWhite, fontSize = 16.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = (-0.3).sp)
                    Text("  ·  AED $price", color = FmbWhite, fontSize = 16.sp, fontWeight = FontWeight.ExtraBold)
                    Spacer(Modifier.width(4.dp))
                    Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, null, tint = FmbWhite, modifier = Modifier.size(20.dp))
                }
            }
        }
    }
}

@Composable
private fun walkinFieldColors() = OutlinedTextFieldDefaults.colors(
    focusedBorderColor = FmbPrimary,
    unfocusedBorderColor = FmbMintEdge,
    focusedContainerColor = FmbWhite,
    unfocusedContainerColor = FmbWhite,
    cursorColor = FmbPrimary,
)
