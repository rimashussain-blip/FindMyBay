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
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
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
import androidx.compose.runtime.remember
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

                // Warm custom map style — mint land, sand sweep, white roads,
                // pale teal water/parks, no POIs/transit. Loaded once and cached.
                val ctx = LocalContext.current
                val mapStyle = remember {
                    runCatching { MapStyleOptions.loadRawResourceStyle(ctx, R.raw.map_style_warm) }.getOrNull()
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

            // ── Vendor card peek ────────────────────────────────────────────
            // Use the filtered list so the peek card reflects the active
            // filters / search. If filters wiped everything out, give the user
            // a hint instead of a confusing empty space.
            val visible = state.filteredVendors
            if (visible.isNotEmpty()) {
                val featured = visible.first()
                VendorPeekCard(
                    vendor = featured,
                    onClick = { onVendorClick(featured.id) },
                    modifier = Modifier.padding(16.dp),
                )
            } else if (state.vendors.isNotEmpty()) {
                // Vendors loaded, but every one was filtered out.
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp)
                        .clip(RoundedCornerShape(18.dp))
                        .background(MaterialTheme.colorScheme.surface)
                        .border(1.dp, FmbMintEdge, RoundedCornerShape(18.dp))
                        .padding(14.dp),
                ) {
                    Text(
                        "No matches with these filters. Try clearing search or chips.",
                        fontSize = 12.sp,
                        color = FmbNeutral700,
                    )
                }
            } else {
                Spacer(Modifier.height(16.dp))
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
    Row(
        modifier = modifier
            .clip(RoundedCornerShape(14.dp))
            .background(Color.White.copy(alpha = 0.95f))
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
    val bg = when {
        active -> FmbBlue900
        enabled -> Color.White.copy(alpha = 0.95f)
        else -> Color.White.copy(alpha = 0.6f)
    }
    val fg = when {
        active -> Color.White
        enabled -> FmbBlue900
        else -> FmbNeutral700
    }
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(10.dp))
            .background(bg)
            .let { if (enabled) it.clickable(onClick = onClick!!) else it }
            .padding(horizontal = 10.dp, vertical = 6.dp),
    ) {
        Text(label, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = fg)
    }
}

@Composable
private fun VendorPeekCard(
    vendor: Vendor,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .background(MaterialTheme.colorScheme.surface)
            .border(1.dp, FmbMintEdge, RoundedCornerShape(18.dp))
            .clickable(onClick = onClick)
            .padding(14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // Mint-to-sand thumbnail
        Box(
            modifier = Modifier
                .size(48.dp)
                .clip(RoundedCornerShape(14.dp))
                .background(
                    Brush.linearGradient(
                        colors = listOf(FmbBlue100, FmbSand),
                        start = Offset(0f, 0f),
                        end = Offset(Float.POSITIVE_INFINITY, Float.POSITIVE_INFINITY),
                    )
                ),
            contentAlignment = Alignment.Center,
        ) {
            Text("🚿", fontSize = 22.sp)
        }
        Spacer(Modifier.width(12.dp))

        Column(modifier = Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(vendor.brandName, fontSize = 14.sp, fontWeight = FontWeight.Bold, color = FmbBlue900)
                if (vendor.rating != null) {
                    Spacer(Modifier.width(6.dp))
                    Icon(Icons.Filled.Star, null, tint = FmbAmber500, modifier = Modifier.size(10.dp))
                    Spacer(Modifier.width(2.dp))
                    Text("%.1f".format(vendor.rating), fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = FmbNeutral700)
                }
            }
            Spacer(Modifier.height(2.dp))
            Text(
                "${vendor.city} · ${(vendor.distanceMeters / 1000).format1()} km",
                fontSize = 11.sp,
                color = FmbNeutral700,
            )
            Spacer(Modifier.height(6.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(6.dp))
                        .background(FmbBlue100)
                        .padding(horizontal = 8.dp, vertical = 3.dp),
                ) {
                    Text("${vendor.freeBays} free now", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = FmbBlue700)
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

private fun Double.format1(): String = "%.1f".format(this)
