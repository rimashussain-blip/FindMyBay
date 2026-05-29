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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.automirrored.outlined.Logout
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.outlined.Info
import androidx.compose.material.icons.outlined.PhotoCamera
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import ae.findmybay.attendant.data.BayView
import ae.findmybay.attendant.data.ServiceGraph
import ae.findmybay.attendant.data.UpNextView
import ae.findmybay.attendant.ui.components.CountdownRing
import ae.findmybay.attendant.ui.components.Eyebrow
import ae.findmybay.attendant.ui.components.RefreshOnResume
import ae.findmybay.attendant.ui.components.M1Mark
import ae.findmybay.attendant.ui.components.PillKind
import ae.findmybay.attendant.ui.components.StatusPill
import ae.findmybay.attendant.ui.components.TierBadge
import ae.findmybay.attendant.ui.theme.*

@Composable
fun BayBoardScreen(
    onWalkIn: () -> Unit,
    onScan: () -> Unit,
    onBookings: () -> Unit,
    onOpenBooking: (String) -> Unit,
    onSignedOut: () -> Unit,
    onMustChangePassword: () -> Unit = {},
) {
    val vm: BayBoardViewModel = viewModel(
        factory = viewModelFactory { initializer { BayBoardViewModel(ServiceGraph.repository) } }
    )
    val state by vm.state.collectAsStateWithLifecycle()

    LaunchedEffect(state.signedOut) { if (state.signedOut) onSignedOut() }
    RefreshOnResume { vm.load() }

    val data = state.data
    // Staff created with a temp password must set their own before using the app.
    LaunchedEffect(data?.mustChangePassword) {
        if (data?.mustChangePassword == true) onMustChangePassword()
    }

    Box(Modifier.fillMaxSize().background(FmbCream)) {
        Column(Modifier.fillMaxSize()) {
            StickyHeader(
                title = data?.brandName ?: "findMy Bay",
                sub = data?.let { "${it.vendorStatus} · live" } ?: "Loading…",
                onSignOut = vm::signOut,
                onRefresh = { vm.load() },
            )

            when {
                state.loading -> LoadingBlock()
                state.error != null && data == null -> ErrorBlock(state.error!!, onRetry = { vm.load(initial = true) })
                data != null -> LazyColumn(
                    Modifier.fillMaxSize(),
                    contentPadding = androidx.compose.foundation.layout.PaddingValues(start = 20.dp, end = 20.dp, top = 18.dp, bottom = 120.dp),
                ) {
                    item {
                        Row(
                            Modifier.fillMaxWidth().padding(bottom = 12.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.Bottom,
                        ) {
                            Eyebrow("Bays · ${data.bays.size} total")
                            Text("${data.freeCount} free · ${data.busyCount} busy · ${data.closedCount} closed", fontSize = 11.sp, color = FmbInkSoft, fontWeight = FontWeight.SemiBold)
                        }
                    }
                    items(data.bays.chunked(2)) { rowBays ->
                        Row(Modifier.fillMaxWidth().padding(bottom = 12.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            rowBays.forEach { bay -> Box(Modifier.weight(1f)) { BayTile(bay) } }
                            if (rowBays.size == 1) Spacer(Modifier.weight(1f))
                        }
                    }
                    if (data.upNext.isNotEmpty()) {
                        item {
                            Row(
                                Modifier.fillMaxWidth().padding(top = 10.dp, bottom = 10.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.Bottom,
                            ) {
                                Eyebrow("Up next · ${data.upNext.size}")
                                Text("See all", fontSize = 11.sp, color = FmbPrimaryDeep, fontWeight = FontWeight.Bold, modifier = Modifier.clickable(onClick = onBookings))
                            }
                        }
                        items(data.upNext) { u ->
                            UpNextCard(u, onClick = { onOpenBooking(u.bookingId) })
                            Spacer(Modifier.height(10.dp))
                        }
                    }
                }
            }
        }

        // Floating action bar
        Row(
            Modifier.align(Alignment.BottomCenter).fillMaxWidth().padding(start = 20.dp, end = 20.dp, bottom = 28.dp),
            horizontalArrangement = Arrangement.spacedBy(14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Row(
                Modifier.weight(1f).height(64.dp).clip(RoundedCornerShape(18.dp)).background(FmbPrimaryDeep).clickable(onClick = onWalkIn),
                horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(Icons.Filled.Add, null, tint = FmbWhite, modifier = Modifier.size(20.dp))
                Spacer(Modifier.width(8.dp))
                Text("Walk-in", color = FmbWhite, fontSize = 14.sp, fontWeight = FontWeight.ExtraBold)
            }
            FabSquare(onClick = onScan) { Icon(Icons.Outlined.PhotoCamera, "Scan", tint = FmbPrimaryDeep, modifier = Modifier.size(22.dp)) }
            FabSquare(onClick = onBookings) { Icon(Icons.AutoMirrored.Filled.List, "Bookings", tint = FmbPrimaryDeep, modifier = Modifier.size(22.dp)) }
        }
    }
}

@Composable
private fun LoadingBlock() {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        CircularProgressIndicator(color = FmbPrimary)
    }
}

@Composable
private fun ErrorBlock(msg: String, onRetry: () -> Unit) {
    Column(
        Modifier.fillMaxSize().padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text("Couldn't load the bay board", fontSize = 16.sp, fontWeight = FontWeight.ExtraBold, color = FmbInk)
        Text(msg, fontSize = 12.sp, color = FmbInkSoft, fontWeight = FontWeight.Medium, modifier = Modifier.padding(top = 6.dp))
        Spacer(Modifier.height(16.dp))
        Box(
            Modifier.clip(RoundedCornerShape(12.dp)).background(FmbMint).clickable(onClick = onRetry).padding(horizontal = 20.dp, vertical = 12.dp),
        ) { Text("Retry", color = FmbPrimaryDeep, fontWeight = FontWeight.Bold) }
    }
}

@Composable
private fun FabSquare(onClick: () -> Unit, content: @Composable () -> Unit) {
    Box(
        Modifier.size(64.dp).clip(RoundedCornerShape(18.dp)).background(FmbWhite).border(1.5.dp, FmbMintEdge, RoundedCornerShape(18.dp)).clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) { content() }
}

@Composable
private fun BayTile(bay: BayView) {
    val busy = bay.state == "busy"
    val closed = bay.state == "closed"
    val border = when (bay.state) { "busy" -> FmbSandDeep; "closed" -> FmbClosedEdge; else -> FmbPrimary }
    val bg = if (closed) FmbClosedBg else FmbWhite
    val ink = if (closed) FmbClosedInk else FmbInk

    Column(
        Modifier.fillMaxWidth().height(168.dp).clip(RoundedCornerShape(16.dp)).background(bg).border(1.5.dp, border, RoundedCornerShape(16.dp)).padding(14.dp),
        verticalArrangement = Arrangement.SpaceBetween,
    ) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(bay.name, fontSize = 22.sp, fontWeight = FontWeight.ExtraBold, color = ink, letterSpacing = (-0.5).sp)
            if (busy) CountdownRing(pct = bay.pct, size = 52.dp)
        }
        if (busy) {
            Column {
                Text(bay.customer ?: "", fontSize = 20.sp, fontWeight = FontWeight.ExtraBold, color = FmbInk, letterSpacing = (-0.4).sp, maxLines = 1)
                if (bay.service != null) Text(bay.service, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = FmbInkSoft, modifier = Modifier.padding(top = 4.dp))
            }
        } else if (closed) {
            Text("Closed", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = FmbClosedInk)
        }
        Box {
            when (bay.state) {
                "free" -> StatusPill(PillKind.Free, "Free")
                "busy" -> StatusPill(PillKind.Busy, "Busy", sub = "${bay.remainMin} min")
                else -> StatusPill(PillKind.Closed, "Closed")
            }
        }
    }
}

@Composable
private fun UpNextCard(u: UpNextView, onClick: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(FmbWhite).border(1.5.dp, FmbMintEdge, RoundedCornerShape(16.dp)).clickable(onClick = onClick).padding(horizontal = 14.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.clip(RoundedCornerShape(10.dp)).background(FmbSand).padding(horizontal = 11.dp, vertical = 6.dp)) {
            Text(u.time, color = FmbSandText, fontSize = 14.sp, fontWeight = FontWeight.ExtraBold)
        }
        Column(Modifier.weight(1f).padding(start = 12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(u.name, fontSize = 15.sp, fontWeight = FontWeight.Bold, color = FmbInk, maxLines = 1)
                Spacer(Modifier.width(7.dp))
                TierBadge(u.tier)
            }
            Text("${u.service} · ${u.bay}", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = FmbInkSoft, modifier = Modifier.padding(top = 3.dp))
        }
        Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, null, tint = FmbInkSoft, modifier = Modifier.size(18.dp))
    }
}

// ─── Shared sticky header ────────────────────────────────────────────────────
@Composable
fun StickyHeader(title: String, sub: String, onSignOut: () -> Unit = {}, onRefresh: (() -> Unit)? = null) {
    Row(
        Modifier.fillMaxWidth().background(FmbCream).padding(horizontal = 20.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        M1Mark(size = 36.dp)
        Column(Modifier.weight(1f).padding(start = 12.dp)) {
            Text(title, fontSize = 16.sp, fontWeight = FontWeight.ExtraBold, color = FmbInk, letterSpacing = (-0.3).sp, maxLines = 1)
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 2.dp)) {
                Box(Modifier.size(6.dp).clip(CircleShape).background(FmbPrimary))
                Text(sub, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = FmbPrimaryDeep, modifier = Modifier.padding(start = 5.dp))
            }
        }
        if (onRefresh != null) {
            HeaderIconButton(onClick = onRefresh) { Icon(Icons.Outlined.Refresh, "Refresh", tint = FmbInkSoft, modifier = Modifier.size(18.dp)) }
            Spacer(Modifier.width(8.dp))
        }
        HeaderIconButton(onClick = {}) { Icon(Icons.Outlined.Info, "Info", tint = FmbInkSoft, modifier = Modifier.size(18.dp)) }
        Spacer(Modifier.width(8.dp))
        HeaderIconButton(onClick = onSignOut) { Icon(Icons.AutoMirrored.Outlined.Logout, "Sign out", tint = FmbInkSoft, modifier = Modifier.size(17.dp)) }
    }
}

@Composable
private fun HeaderIconButton(onClick: () -> Unit, content: @Composable () -> Unit) {
    Box(
        Modifier.size(36.dp).clip(RoundedCornerShape(12.dp)).background(FmbWhite).border(1.dp, FmbMintEdge, RoundedCornerShape(12.dp)).clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) { content() }
}
