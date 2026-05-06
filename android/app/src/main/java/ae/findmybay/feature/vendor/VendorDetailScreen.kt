package ae.findmybay.feature.vendor

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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
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
import ae.findmybay.core.components.Eyebrow
import ae.findmybay.core.components.FmbPrimaryButton
import ae.findmybay.core.components.VendorLogo
import ae.findmybay.core.theme.FmbAmber500
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
import ae.findmybay.domain.model.Bay
import ae.findmybay.domain.model.Service
import ae.findmybay.domain.model.VendorDetail

@Composable
fun VendorDetailScreen(
    onBack: () -> Unit,
    onBook: (vendorId: String) -> Unit,
    vm: VendorDetailViewModel = hiltViewModel(),
) {
    val state by vm.state.collectAsStateWithLifecycle()

    Scaffold(
        containerColor = FmbCream,
        bottomBar = {
            state.vendor?.let { v ->
                val picked = state.selectedService
                val label = picked?.let { "Book a wash · AED ${it.priceAed}" } ?: "Book a wash"
                Box(modifier = Modifier.fillMaxWidth().background(FmbCream).padding(16.dp)) {
                    FmbPrimaryButton(
                        text = label,
                        onClick = { onBook(v.id) },
                        trailingIcon = {
                            Icon(
                                Icons.AutoMirrored.Filled.KeyboardArrowRight,
                                null,
                                tint = Color.White,
                                modifier = Modifier.size(16.dp),
                            )
                        },
                    )
                }
            }
        },
    ) { padding ->
        Box(modifier = Modifier.fillMaxSize().padding(padding)) {
            when {
                state.loading -> CircularProgressIndicator(modifier = Modifier.align(Alignment.Center))
                state.error != null -> Text(
                    state.error!!,
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier.align(Alignment.Center).padding(24.dp),
                )
                state.vendor != null -> VendorBody(
                    v = state.vendor!!,
                    selectedServiceId = state.selectedServiceId,
                    onBack = onBack,
                    onSelectService = vm::selectService,
                )
            }
        }
    }
}

@Composable
private fun VendorBody(
    v: VendorDetail,
    selectedServiceId: String?,
    onBack: () -> Unit,
    onSelectService: (String) -> Unit,
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(bottom = 8.dp),
        verticalArrangement = Arrangement.spacedBy(0.dp),
    ) {
        item { HeroCard(v, onBack = onBack) }
        item { TitleBlock(v) }
        item { Spacer(Modifier.height(12.dp)); LiveBayStatusCard(v.bays) }
        item {
            Spacer(Modifier.height(14.dp))
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 22.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text("Services", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = FmbBlue900, modifier = Modifier.weight(1f))
                Text("See all", fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = FmbBlue700)
            }
        }
        items(v.services, key = { it.id }) { svc ->
            ServiceRow(
                service = svc,
                picked = svc.id == selectedServiceId,
                onClick = { onSelectService(svc.id) },
            )
        }
    }
}

@Composable
private fun HeroCard(v: VendorDetail, onBack: () -> Unit) {
    val hasLogo = !v.logoUrl.isNullOrBlank()
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 4.dp)
            .height(130.dp)
            .clip(RoundedCornerShape(22.dp))
            .background(
                Brush.linearGradient(
                    colors = listOf(FmbBlue100, FmbSand),
                    start = Offset(0f, 0f),
                    end = Offset(Float.POSITIVE_INFINITY, Float.POSITIVE_INFINITY),
                )
            ),
    ) {
        // Decorative bubbles
        Box(
            modifier = Modifier
                .padding(start = 240.dp)
                .size(80.dp)
                .clip(CircleShape)
                .background(Color.White.copy(alpha = 0.4f)),
        )

        // Back glass square
        Box(
            modifier = Modifier
                .padding(12.dp)
                .size(34.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(Color.White.copy(alpha = 0.9f))
                .clickable(onClick = onBack),
            contentAlignment = Alignment.Center,
        ) {
            Icon(Icons.AutoMirrored.Filled.ArrowBack, null, tint = FmbBlue900, modifier = Modifier.size(14.dp))
        }

        // Heart save (top right)
        Box(
            modifier = Modifier
                .align(Alignment.TopEnd)
                .padding(12.dp)
                .size(34.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(Color.White.copy(alpha = 0.9f)),
            contentAlignment = Alignment.Center,
        ) {
            Icon(Icons.Filled.FavoriteBorder, null, tint = FmbRed500, modifier = Modifier.size(16.dp))
        }

        // Vendor logo (bottom left) — falls back to a 🚗 glyph if the
        // vendor hasn't uploaded a logo yet, so the hero card never feels empty.
        if (hasLogo) {
            VendorLogo(
                logoUrl = v.logoUrl,
                brandName = v.brandName,
                size = 64.dp,
                shape = RoundedCornerShape(18.dp),
                modifier = Modifier
                    .align(Alignment.BottomStart)
                    .padding(start = 18.dp, bottom = 14.dp),
            )
        } else {
            Text(
                "🚗",
                fontSize = 36.sp,
                modifier = Modifier.align(Alignment.BottomStart).padding(start = 18.dp, bottom = 14.dp),
            )
        }
    }
}

@Composable
private fun TitleBlock(v: VendorDetail) {
    Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 22.dp, vertical = 14.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                v.brandName,
                fontSize = 19.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = (-0.4).sp,
                color = FmbBlue900,
                modifier = Modifier.weight(1f),
            )
            if (v.rating != null) {
                Icon(Icons.Filled.Star, null, tint = FmbAmber500, modifier = Modifier.size(11.dp))
                Spacer(Modifier.width(3.dp))
                Text("%.1f".format(v.rating), fontSize = 12.sp, fontWeight = FontWeight.Bold, color = FmbBlue900)
                Spacer(Modifier.width(4.dp))
                Text("(214)", fontSize = 10.sp, color = FmbNeutral700)
            }
        }
        Spacer(Modifier.height(2.dp))
        Text(
            listOfNotNull(v.addressLine, v.city, v.emirate).joinToString(" · "),
            fontSize = 11.sp,
            color = FmbNeutral700,
        )
    }
}

@Composable
private fun LiveBayStatusCard(bays: List<Bay>) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp)
            .clip(RoundedCornerShape(18.dp))
            .background(MaterialTheme.colorScheme.surface)
            .border(1.dp, FmbMintEdge, RoundedCornerShape(18.dp))
            .padding(horizontal = 14.dp, vertical = 12.dp),
    ) {
        Column {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Eyebrow("Live bay status", modifier = Modifier.weight(1f))
                Box(
                    modifier = Modifier.size(6.dp).clip(CircleShape).background(FmbBlue500),
                )
                Spacer(Modifier.width(4.dp))
                Text("Updated now", fontSize = 10.sp, color = FmbNeutral700)
            }
            Spacer(Modifier.height(8.dp))

            // 4-up bay grid (clip to 4 visually; show "+ N more" if there are more)
            val visible = bays.take(4)
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                visible.forEach { bay ->
                    BayPill(bay, modifier = Modifier.weight(1f))
                }
                // Pad with empty cells if fewer than 4
                repeat(4 - visible.size) {
                    Spacer(modifier = Modifier.weight(1f))
                }
            }
        }
    }
}

@Composable
private fun BayPill(bay: Bay, modifier: Modifier = Modifier) {
    val free = bay.status == "free"
    val bg = if (free) FmbBlue100 else FmbCoralSoft
    val fg = if (free) FmbBlue700 else FmbRed500
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(10.dp))
            .background(bg)
            .padding(vertical = 8.dp, horizontal = 6.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(bay.name, fontSize = 9.sp, fontWeight = FontWeight.SemiBold, color = FmbNeutral700)
        Spacer(Modifier.height(1.dp))
        Text(bay.status, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = fg)
    }
}

@Composable
private fun ServiceRow(service: Service, picked: Boolean, onClick: () -> Unit) {
    val border = if (picked) FmbBlue500 else FmbMintEdge
    val bg = if (picked) FmbBlue100 else MaterialTheme.colorScheme.surface
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 4.dp)
            .clip(RoundedCornerShape(14.dp))
            .background(bg)
            .border(1.dp, border, RoundedCornerShape(14.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier
                .size(38.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(Color.White.copy(alpha = 0.7f)),
            contentAlignment = Alignment.Center,
        ) {
            Text(if (picked) "💦" else "✨", fontSize = 18.sp)
        }
        Spacer(Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(service.name, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = FmbBlue900)
            Spacer(Modifier.height(2.dp))
            Text(
                "${service.durationMin} min · " + if (service.vatInclusive) "VAT incl." else "VAT extra",
                fontSize = 11.sp,
                color = FmbNeutral700,
            )
        }
        Text(
            "AED ${service.priceAed}",
            fontSize = 14.sp,
            fontWeight = FontWeight.ExtraBold,
            color = FmbBlue700,
        )
    }
}
