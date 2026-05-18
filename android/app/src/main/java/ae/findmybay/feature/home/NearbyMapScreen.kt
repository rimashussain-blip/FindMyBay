package ae.findmybay.feature.home

import android.Manifest
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.animation.animateContentSize
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ae.findmybay.R
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import ae.findmybay.core.components.VendorLogo
import ae.findmybay.core.theme.FmbAmber500
import ae.findmybay.core.theme.FmbBlue100
import ae.findmybay.core.theme.FmbBlue500
import ae.findmybay.core.theme.FmbBlue700
import ae.findmybay.core.theme.FmbBlue900
import ae.findmybay.core.theme.FmbCream
import ae.findmybay.core.theme.FmbMintEdge
import ae.findmybay.core.theme.FmbNeutral700
import ae.findmybay.core.theme.FmbSand
import ae.findmybay.domain.model.Vendor
import com.google.accompanist.permissions.ExperimentalPermissionsApi
import com.google.accompanist.permissions.isGranted
import com.google.accompanist.permissions.rememberMultiplePermissionsState
import com.google.android.gms.maps.model.CameraPosition
import com.google.android.gms.maps.model.LatLng
import com.google.android.gms.maps.model.MapStyleOptions
import com.google.maps.android.compose.GoogleMap
import com.google.maps.android.compose.MapProperties
import com.google.maps.android.compose.MapUiSettings
import com.google.maps.android.compose.Marker
import com.google.maps.android.compose.MarkerState
import com.google.maps.android.compose.rememberCameraPositionState

@OptIn(ExperimentalMaterial3Api::class, ExperimentalPermissionsApi::class)
@Composable
fun NearbyMapScreen(
    onVendorClick: (vendorId: String) -> Unit = {},
    vm: NearbyViewModel = hiltViewModel(),
) {
    val state by vm.state.collectAsStateWithLifecycle()

    val perms = rememberMultiplePermissionsState(
        listOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)
    )

    LaunchedEffect(perms.allPermissionsGranted) {
        if (perms.allPermissionsGranted) vm.onPermissionGranted() else perms.launchMultiplePermissionRequest()
    }
    LaunchedEffect(perms.permissions.map { it.status.isGranted }) {
        when {
            perms.allPermissionsGranted -> vm.onPermissionGranted()
            !perms.allPermissionsGranted && !perms.shouldShowRationale -> Unit
            !perms.allPermissionsGranted -> vm.onPermissionDenied()
        }
    }

    Scaffold(containerColor = FmbCream) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding)) {

            // ── Header per handoff §3 ───────────────────────────────────────
            Column(modifier = Modifier.padding(start = 24.dp, end = 16.dp, top = 8.dp, bottom = 12.dp)) {
                Text(
                    "Good morning ☀️",
                    fontSize = 12.sp,
                    color = FmbNeutral700,
                )
                Spacer(Modifier.height(4.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        "Nearby car washes",
                        fontSize = 22.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = (-0.4).sp,
                        color = FmbBlue900,
                        modifier = Modifier.weight(1f),
                    )
                    // Mint refresh square
                    Box(
                        modifier = Modifier
                            .size(36.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .background(FmbBlue100)
                            .clickable(onClick = vm::refresh),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(
                            Icons.Filled.Refresh,
                            contentDescription = "Refresh",
                            tint = FmbBlue700,
                            modifier = Modifier.size(16.dp),
                        )
                    }
                }
            }

            // ── Map card with search pill + filter chips ─────────────────────
            // Mint-edge frame around the map so it reads as a distinct card
            // against the cream backdrop, matching the handoff mockup.
            Box(
                modifier = Modifier
                    .weight(1f)
                    .padding(horizontal = 16.dp)
                    .clip(RoundedCornerShape(24.dp))
                    .border(1.5.dp, FmbMintEdge, RoundedCornerShape(24.dp)),
            ) {
                val center = LatLng(state.lat ?: 25.1972, state.lng ?: 55.2744)
                val cameraPositionState = rememberCameraPositionState {
                    position = CameraPosition.fromLatLngZoom(center, 13f)
                }
                LaunchedEffect(state.lat, state.lng) {
                    if (state.lat != null && state.lng != null) {
                        cameraPositionState.position = CameraPosition.fromLatLngZoom(center, 13.5f)
                    }
                }

                // Custom map style — picks the dark variant when the app theme
                // is dark (deep teal-ink tiles + mint accents) or the warm
                // variant in light mode (mint land + sand sweep + white roads).
                // Re-loaded whenever the theme flips so the map switches live.
                val ctx = LocalContext.current
                val bg = MaterialTheme.colorScheme.background
                val isDark = (0.299f * bg.red + 0.587f * bg.green + 0.114f * bg.blue) < 0.5f
                val mapStyle = remember(isDark) {
                    val resId = if (isDark) R.raw.map_style_dark else R.raw.map_style_warm
                    runCatching { MapStyleOptions.loadRawResourceStyle(ctx, resId) }.getOrNull()
                }

                GoogleMap(
                    modifier = Modifier.fillMaxSize(),
                    cameraPositionState = cameraPositionState,
                    properties = MapProperties(
                        isMyLocationEnabled = !state.needsPermission,
                        mapStyleOptions = mapStyle,
                    ),
                    uiSettings = MapUiSettings(
                        zoomControlsEnabled = false,
                        myLocationButtonEnabled = false,
                        mapToolbarEnabled = false,
                    ),
                ) {
                    state.filteredVendors.forEach { v ->
                        Marker(
                            state = MarkerState(position = LatLng(v.lat, v.lng)),
                            title = v.brandName,
                            snippet = "${v.freeBays} free · from AED ${v.priceFromAed ?: "—"}",
                        )
                    }
                }

                // Search pill (floating, real text input)
                SearchPill(
                    query = state.searchQuery,
                    onQueryChange = vm::setSearchQuery,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(14.dp),
                )

                // Filter chips — toggleable. "Open late" stays disabled until
                // /vendors/nearby returns operating hours (small backend follow-up).
                Row(
                    modifier = Modifier
                        .padding(start = 14.dp, top = 60.dp)
                        .fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    FilterChip(
                        label = "Free now",
                        active = state.freeNowOnly,
                        onClick = vm::toggleFreeNow,
                    )
                    FilterChip(
                        label = "Under AED 40",
                        active = state.under40Only,
                        onClick = vm::toggleUnder40,
                    )
                    FilterChip(
                        label = "Open late",
                        active = false,
                        onClick = null, // not yet supported — see ViewModel comment
                    )
                }

                // Status banner if loading or error
                if (state.loading || state.error != null) {
                    Box(
                        modifier = Modifier
                            .align(Alignment.TopCenter)
                            .padding(top = 110.dp, start = 14.dp, end = 14.dp)
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(12.dp))
                            .background(Color.White.copy(alpha = 0.95f))
                            .padding(12.dp),
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            if (state.loading) {
                                CircularProgressIndicator(strokeWidth = 2.dp, modifier = Modifier.size(16.dp))
                                Spacer(Modifier.width(10.dp))
                                Text("Finding car washes near you…", fontSize = 12.sp)
                            } else {
                                Icon(Icons.Filled.LocationOn, null, tint = MaterialTheme.colorScheme.error, modifier = Modifier.size(16.dp))
                                Spacer(Modifier.width(10.dp))
                                Text(state.error ?: "", fontSize = 12.sp, modifier = Modifier.weight(1f))
                                Button(onClick = vm::refresh) { Text("Retry", fontSize = 12.sp) }
                            }
                        }
                    }
                }

            }

            // ── Results panel ──────────────────────────────────────────────
            // Lives outside the map Box so the map and the panel read as two
            // separate surfaces with a clean gap between them, rather than the
            // panel floating over the map and clipping pins underneath.
            val visible = state.filteredVendors
            val userLat = state.lat
            val userLng = state.lng
            if (visible.isNotEmpty()) {
                NearbyResultsSheet(
                    vendors = visible,
                    userLat = userLat,
                    userLng = userLng,
                    onVendorClick = onVendorClick,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 12.dp)
                        .heightIn(max = 280.dp),
                )
            } else if (state.vendors.isNotEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp)
                        .clip(RoundedCornerShape(18.dp))
                        .background(MaterialTheme.colorScheme.surface)
                        // Standard FMB card outline (1.5dp primary aqua).
                        .border(1.5.dp, FmbBlue500, RoundedCornerShape(18.dp))
                        .padding(14.dp),
                ) {
                    Text(
                        "No matches with these filters. Try clearing search or chips.",
                        fontSize = 12.sp,
                        color = FmbNeutral700,
                    )
                }
            }
        }
    }
}

@Composable
private fun SearchPill(
    query: String,
    onQueryChange: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val cs = MaterialTheme.colorScheme
    Row(
        modifier = modifier
            .clip(RoundedCornerShape(14.dp))
            // Surface in light = warm cream-white; in dark = #06201D ink card.
            // Hairline mint-edge outline picks up nicely against either.
            .background(cs.surface.copy(alpha = 0.95f))
            .border(1.dp, FmbMintEdge, RoundedCornerShape(14.dp))
            .padding(horizontal = 14.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            Icons.Filled.Search,
            contentDescription = null,
            tint = FmbNeutral700,
            modifier = Modifier.size(14.dp),
        )
        Spacer(Modifier.width(10.dp))
        Box(modifier = Modifier.weight(1f)) {
            BasicTextField(
                value = query,
                onValueChange = onQueryChange,
                singleLine = true,
                textStyle = TextStyle(fontSize = 13.sp, color = FmbBlue900),
                cursorBrush = androidx.compose.ui.graphics.SolidColor(FmbBlue700),
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                modifier = Modifier.fillMaxWidth(),
                decorationBox = { inner ->
                    if (query.isEmpty()) {
                        Text(
                            "Search by area or vendor",
                            fontSize = 13.sp,
                            color = FmbNeutral700,
                        )
                    }
                    inner()
                },
            )
        }
        if (query.isNotEmpty()) {
            Spacer(Modifier.width(6.dp))
            Box(
                modifier = Modifier
                    .size(18.dp)
                    .clip(CircleShape)
                    .background(FmbMintEdge)
                    .clickable { onQueryChange("") },
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    Icons.Filled.Close,
                    contentDescription = "Clear",
                    tint = FmbBlue900,
                    modifier = Modifier.size(10.dp),
                )
            }
        }
    }
}

/**
 * Toggle chip on the map. Pass `onClick = null` for a disabled-looking chip
 * (e.g. "Open late" until the backend returns vendor hours).
 */
@Composable
private fun FilterChip(
    label: String,
    active: Boolean,
    onClick: (() -> Unit)?,
) {
    val enabled = onClick != null
    val cs = MaterialTheme.colorScheme

    // Active = aqua-tinted fill with the brand primary as both border + text,
    //          so it pops against the dark map without going neon. In light
    //          mode, primaryContainer reads as the existing minty pill.
    // Inactive enabled = surface fill with a hairline outline.
    // Disabled = same surface but at reduced opacity, muted text.
    val bg = when {
        active -> cs.primaryContainer
        enabled -> cs.surface.copy(alpha = 0.95f)
        else -> cs.surface.copy(alpha = 0.6f)
    }
    val border = when {
        active -> cs.primary
        else -> FmbMintEdge
    }
    val fg = when {
        active -> if (cs.background.red < 0.3f) cs.primary else FmbBlue900
        enabled -> FmbBlue900
        else -> FmbNeutral700
    }
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(10.dp))
            .background(bg)
            .border(1.dp, border, RoundedCornerShape(10.dp))
            .let { if (enabled) it.clickable(onClick = onClick!!) else it }
            .padding(horizontal = 12.dp, vertical = 7.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            if (active) {
                Icon(
                    Icons.Filled.Check,
                    contentDescription = null,
                    tint = fg,
                    modifier = Modifier.size(11.dp),
                )
                Spacer(Modifier.width(4.dp))
            }
            Text(label, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = fg)
        }
    }
}

/**
 * Floating bottom-sheet style results list. Collapses to show only the
 * nearest available studio (or the nearest one overall if every bay is
 * busy); tapping the header expands the panel into a scrollable list of
 * all matches. Mirrors how Google Maps' search-results sheet behaves —
 * compact by default, full-list-on-demand.
 */
@Composable
private fun NearbyResultsSheet(
    vendors: List<Vendor>,
    userLat: Double?,
    userLng: Double?,
    onVendorClick: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val cs = MaterialTheme.colorScheme
    var expanded by remember { mutableStateOf(false) }

    // The "headline" pick when collapsed: prefer a studio with at least one
    // free bay, fall back to the absolute nearest if every studio is busy.
    // The list arrives already sorted by distance from the backend so we
    // can scan front-to-back without re-sorting.
    val headline = remember(vendors) {
        vendors.firstOrNull { it.freeBays > 0 } ?: vendors.first()
    }

    Column(
        modifier = modifier
            .clip(RoundedCornerShape(22.dp))
            .background(cs.surface)
            // Standard FMB card outline (1.5dp primary aqua).
            .border(1.5.dp, FmbBlue500, RoundedCornerShape(22.dp))
            .animateContentSize(),
    ) {
        // Tap target for the whole header strip — drag-handle, count, and
        // hint all live in one clickable row so the affordance is obvious.
        // The mint→sand gradient header mirrors the active-booking card on
        // the My Bookings screen, keeping a consistent "card has a warm
        // strip up top" pattern across the customer app.
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(
                    Brush.linearGradient(
                        colors = listOf(FmbBlue100, FmbSand),
                        start = Offset(0f, 0f),
                        end = Offset(Float.POSITIVE_INFINITY, 0f),
                    )
                )
                .clickable { expanded = !expanded },
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Box(
                modifier = Modifier
                    .padding(top = 8.dp)
                    .size(width = 36.dp, height = 4.dp)
                    .clip(RoundedCornerShape(2.dp))
                    .background(FmbMintEdge),
            )
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 14.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    "${vendors.size} ${if (vendors.size == 1) "studio" else "studios"} near you",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = FmbBlue900,
                )
                Spacer(Modifier.weight(1f))
                Text(
                    if (expanded) "Tap to collapse" else "Tap to view all",
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Medium,
                    color = FmbNeutral700,
                )
                Spacer(Modifier.width(4.dp))
                Icon(
                    imageVector = if (expanded) Icons.Filled.KeyboardArrowUp
                                  else Icons.Filled.KeyboardArrowDown,
                    contentDescription = if (expanded) "Collapse list" else "Expand list",
                    tint = FmbNeutral700,
                    modifier = Modifier.size(16.dp),
                )
            }
        }

        if (expanded) {
            // Full scrollable list. Capped via the parent's heightIn so the
            // map stays visible; users scroll inside the sheet for the rest.
            LazyColumn(
                verticalArrangement = Arrangement.spacedBy(6.dp),
                contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp),
            ) {
                items(vendors, key = { it.id }) { v ->
                    VendorListRow(
                        vendor = v,
                        userLat = userLat,
                        userLng = userLng,
                        onClick = { onVendorClick(v.id) },
                    )
                }
            }
        } else {
            // Collapsed peek — just the headline pick. A LazyColumn isn't
            // needed here, and not using one keeps the sheet's vertical
            // height tight (no scroll-pad overhead).
            Box(modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)) {
                VendorListRow(
                    vendor = headline,
                    userLat = userLat,
                    userLng = userLng,
                    onClick = { onVendorClick(headline.id) },
                )
            }
        }
    }
}

@Composable
private fun VendorListRow(
    vendor: Vendor,
    userLat: Double?,
    userLng: Double?,
    onClick: () -> Unit,
) {
    val km = vendor.distanceMeters / 1000.0
    val travel = estimateTravelMinutes(vendor.distanceMeters)
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(MaterialTheme.colorScheme.surface)
            .clickable(onClick = onClick)
            .padding(horizontal = 10.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        VendorLogo(
            logoUrl = vendor.logoUrl,
            brandName = vendor.brandName,
            size = 44.dp,
            shape = RoundedCornerShape(12.dp),
        )
        Spacer(Modifier.width(10.dp))
        Column(modifier = Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    vendor.brandName,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    color = FmbBlue900,
                    modifier = Modifier.weight(1f, fill = false),
                )
                if (vendor.rating != null) {
                    Spacer(Modifier.width(6.dp))
                    Icon(Icons.Filled.Star, null, tint = FmbAmber500, modifier = Modifier.size(10.dp))
                    Spacer(Modifier.width(2.dp))
                    Text(
                        "%.1f".format(vendor.rating),
                        fontSize = 10.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = FmbNeutral700,
                    )
                }
            }
            Spacer(Modifier.height(2.dp))
            // Distance + travel time. The "—" prefix on the suffix avoids
            // rendering "0.0 km · ~0 min" for a customer who's standing on
            // top of the studio.
            val suffix = buildString {
                append("${vendor.city} · ${"%.1f".format(km)} km")
                if (userLat != null && userLng != null) {
                    append(" · ")
                    append(travel)
                }
            }
            Text(
                suffix,
                fontSize = 11.sp,
                color = FmbNeutral700,
                maxLines = 1,
            )
            Spacer(Modifier.height(5.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(6.dp))
                        .background(FmbBlue100)
                        .padding(horizontal = 7.dp, vertical = 2.dp),
                ) {
                    Text(
                        "${vendor.freeBays} free now",
                        fontSize = 9.sp,
                        fontWeight = FontWeight.Bold,
                        color = FmbBlue700,
                    )
                }
                Spacer(Modifier.width(6.dp))
                Text(
                    "from AED ${vendor.priceFromAed ?: "—"}",
                    fontSize = 10.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = FmbBlue900,
                )
            }
        }
    }
}

/**
 * Quick travel-time estimate for the floating sheet. UAE-city average of
 * ~32 km/h (signals, school zones, summer-afternoon traffic) — close enough
 * for "is this worth driving to?" at-a-glance. The proper Distance Matrix
 * lookup runs server-side as part of the smart-leave alert; we don't burn
 * an API call per row on a passive list view.
 */
private fun estimateTravelMinutes(distanceMeters: Double): String {
    val minutes = (distanceMeters / 1000.0 / 32.0 * 60.0).toInt()
    return when {
        minutes < 1 -> "<1 min"
        minutes < 60 -> "~$minutes min"
        else -> "~${minutes / 60}h ${minutes % 60}m"
    }
}

private fun Double.format1(): String = "%.1f".format(this)
