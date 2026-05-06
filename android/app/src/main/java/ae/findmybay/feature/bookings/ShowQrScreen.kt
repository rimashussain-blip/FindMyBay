package ae.findmybay.feature.bookings

import android.app.Activity
import android.view.WindowManager
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.IosShare
import androidx.compose.material.icons.filled.WaterDrop
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import ae.findmybay.core.components.VendorLogo
import ae.findmybay.core.theme.haloGradient
import ae.findmybay.core.theme.primaryCtaGradient
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.qrcode.QRCodeWriter
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ShowQrScreen(
    onBack: () -> Unit,
    vm: ShowQrViewModel = hiltViewModel(),
) {
    val state by vm.state.collectAsStateWithLifecycle()
    val cs = MaterialTheme.colorScheme

    // Boost screen brightness to max while this screen is visible.
    BrightnessBoost()

    Scaffold(
        containerColor = cs.background,
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        "Show QR",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.SemiBold,
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(
                            Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Back",
                            tint = cs.primary,
                        )
                    }
                },
                actions = {
                    IconButton(onClick = { /* TODO share */ }) {
                        Icon(Icons.Filled.IosShare, "Share", tint = cs.onSurfaceVariant)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = cs.background),
            )
        },
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
            contentAlignment = Alignment.TopCenter,
        ) {
            when {
                state.loading -> CircularProgressIndicator(modifier = Modifier.padding(top = 80.dp))
                state.error != null -> Text(
                    state.error!!,
                    color = cs.error,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(24.dp),
                )
                state.qr != null && state.qr!!.status == "in_progress" -> CheckedInBody(
                    modifier = Modifier.padding(24.dp),
                )
                state.qr != null -> QrBody(
                    qrString = state.qr!!.qr,
                    bookingId = state.qr!!.bookingId,
                    vendorName = state.qr!!.vendorName,
                    vendorLogoUrl = state.qr!!.vendorLogoUrl,
                    bayName = state.qr!!.bayName,
                    slotStartIso = state.qr!!.slotStart,
                    carPlate = state.qr!!.carPlate,
                    carDescription = listOfNotNull(
                        state.qr!!.carColor,
                        state.qr!!.carMake,
                        state.qr!!.carType?.replaceFirstChar { it.titlecase() },
                    ).joinToString(" · ").ifBlank { null },
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun QrBody(
    qrString: String,
    bookingId: String,
    vendorName: String?,
    vendorLogoUrl: String?,
    bayName: String?,
    slotStartIso: String,
    carPlate: String?,
    carDescription: String?,
) {
    val cs = MaterialTheme.colorScheme
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var savedToast by remember { mutableStateOf<String?>(null) }
    var showCodeSheet by remember { mutableStateOf(false) }
    val sheetState = rememberModalBottomSheetState()
    val short = remember(bookingId) { shortCode(bookingId) }

    // Build the chip text: "Polaris Auto Spa · Bay 1 · 10:00"
    val chipText = remember(vendorName, bayName, slotStartIso) {
        val parts = mutableListOf<String>()
        if (!vendorName.isNullOrBlank()) parts += vendorName
        if (!bayName.isNullOrBlank()) parts += bayName
        formatSlotTime(slotStartIso)?.let { parts += it }
        if (parts.isEmpty()) "Booking ${shortCode(bookingId)}" else parts.joinToString(" · ")
    }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        // Vendor info pill
        Row(
            modifier = Modifier
                .clip(RoundedCornerShape(20.dp))
                .background(Color.White)
                .border(1.dp, cs.outlineVariant, RoundedCornerShape(20.dp))
                .padding(horizontal = 14.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            VendorLogo(
                logoUrl = vendorLogoUrl,
                brandName = vendorName ?: "Vendor",
                size = 24.dp,
                shape = RoundedCornerShape(8.dp),
            )
            Spacer(Modifier.width(8.dp))
            Text(
                chipText,
                style = MaterialTheme.typography.labelLarge,
                fontWeight = FontWeight.Medium,
                color = cs.onSurface,
            )
        }

        Spacer(Modifier.height(20.dp))

        // Hero text
        Text(
            "Show this to the attendant",
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold,
            color = cs.onBackground,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(8.dp))
        Text(
            "Once they scan, your bay flips to busy and the wash starts.",
            style = MaterialTheme.typography.bodyMedium,
            color = cs.onSurfaceVariant,
            textAlign = TextAlign.Center,
        )

        Spacer(Modifier.height(20.dp))

        // The branded QR card sits on top of a soft cream→mint radial halo
        // so it lifts off the background, matching the handoff mockup.
        Box(
            modifier = Modifier.fillMaxWidth(),
            contentAlignment = Alignment.Center,
        ) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .aspectRatio(1f)
                    .padding(8.dp)
                    .background(haloGradient(), shape = CircleShape),
            )
            BrandedQrCard(
                qrString = qrString,
                shortCode = shortCode(bookingId),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 4.dp),
            )
        }

        Spacer(Modifier.height(16.dp))

        // Pulsing "Waiting for scan" pill
        WaitingForScanPill()

        Spacer(Modifier.height(16.dp))

        // Plate card — shows the customer's car details so the attendant
        // can verify the right car at a glance after scanning. Hidden when
        // the customer hasn't completed onboarding yet.
        if (!carPlate.isNullOrBlank()) {
            PlateCard(plate = carPlate, description = carDescription)
            Spacer(Modifier.height(16.dp))
        }

        // Brightness-boost tip
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(14.dp))
                .background(cs.secondaryContainer)
                .padding(14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier = Modifier
                    .size(28.dp)
                    .clip(CircleShape)
                    .background(cs.tertiaryContainer),
                contentAlignment = Alignment.Center,
            ) {
                Text("💡", fontSize = 14.sp)
            }
            Spacer(Modifier.width(10.dp))
            Text(
                "We'll boost your screen brightness automatically while this QR is open.",
                style = MaterialTheme.typography.bodySmall,
                color = cs.onSecondaryContainer,
            )
        }

        Spacer(Modifier.height(16.dp))

        // Action row: Save (outlined) + Enter code (filled)
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(14.dp))
                    .background(cs.surface)
                    .border(1.dp, cs.outline, RoundedCornerShape(14.dp))
                    .clickable {
                        scope.launch {
                            val bmp = buildBrandedQrBitmap(qrString, short)
                            val uri = saveQrBitmapToGallery(context, bmp, "FindMyBay-FMB-$short")
                            savedToast = if (uri != null) "Saved to Pictures/FindMyBay" else "Couldn't save QR"
                        }
                    }
                    .padding(horizontal = 18.dp, vertical = 14.dp),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Filled.Download, null, tint = cs.onSurface, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(6.dp))
                    Text(
                        "Save",
                        style = MaterialTheme.typography.labelLarge,
                        fontWeight = FontWeight.Medium,
                    )
                }
            }
            Box(
                modifier = Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(14.dp))
                    .background(primaryCtaGradient())
                    .clickable { showCodeSheet = true }
                    .padding(horizontal = 18.dp, vertical = 14.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    "Enter code instead",
                    style = MaterialTheme.typography.labelLarge,
                    fontWeight = FontWeight.SemiBold,
                    color = cs.onPrimary,
                )
            }
        }

        Spacer(Modifier.height(20.dp))

        // Inline saved-toast (no Snackbar bookkeeping needed for an MVP)
        savedToast?.let { msg ->
            Text(
                msg,
                style = MaterialTheme.typography.labelMedium,
                color = cs.primary,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(bottom = 8.dp),
            )
            // auto-dismiss after 2.5s
            androidx.compose.runtime.LaunchedEffect(msg) {
                kotlinx.coroutines.delay(2500)
                savedToast = null
            }
        }
    }

    // Bottom sheet — flips the QR view into a big, attendant-readable code.
    if (showCodeSheet) {
        ModalBottomSheet(
            onDismissRequest = { showCodeSheet = false },
            sheetState = sheetState,
            containerColor = Color.White,
        ) {
            CodeSheetBody(short = short, onClose = { showCodeSheet = false })
        }
    }
}

@Composable
private fun CodeSheetBody(short: String, onClose: () -> Unit) {
    val cs = MaterialTheme.colorScheme
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 24.dp, vertical = 16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            "Show this code to the attendant",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold,
            color = cs.onBackground,
        )
        Spacer(Modifier.height(4.dp))
        Text(
            "They'll type it into their tablet to start the wash.",
            style = MaterialTheme.typography.bodySmall,
            color = cs.onSurfaceVariant,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(28.dp))
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(20.dp))
                .background(cs.primaryContainer)
                .padding(vertical = 36.dp),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                "FMB-$short",
                fontSize = 56.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 6.sp,
                color = cs.onPrimaryContainer,
            )
        }
        Spacer(Modifier.height(28.dp))
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(14.dp))
                .background(primaryCtaGradient())
                .clickable(onClick = onClose)
                .padding(vertical = 14.dp),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                "Got it",
                style = MaterialTheme.typography.labelLarge,
                fontWeight = FontWeight.SemiBold,
                color = cs.onPrimary,
            )
        }
        Spacer(Modifier.height(24.dp))
    }
}

// ─────────────────────────────────────────────────────────────────────────
// Branded QR card — corner brackets + rounded-pixel QR + center water-drop logo
// ─────────────────────────────────────────────────────────────────────────

@Composable
private fun BrandedQrCard(
    qrString: String,
    shortCode: String,
    modifier: Modifier = Modifier,
) {
    val cs = MaterialTheme.colorScheme
    val ink = cs.onBackground
    val primary = cs.primary

    Surface(
        modifier = modifier,
        shape = RoundedCornerShape(28.dp),
        color = Color.White,
        tonalElevation = 0.dp,
        shadowElevation = 6.dp,
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 20.dp, vertical = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            // Square QR area; brackets sit at the corners and the QR is inset
            // inward so the L-shapes clearly frame it like a scanner reticle.
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .aspectRatio(1f),
            ) {
                CornerBrackets(color = primary)
                BrandedQrCanvas(
                    qrString = qrString,
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(22.dp),
                )
            }

            Spacer(Modifier.height(18.dp))

            Text(
                "BOOKING CODE",
                style = MaterialTheme.typography.labelSmall,
                fontWeight = FontWeight.Bold,
                letterSpacing = 2.sp,
                color = cs.onSurfaceVariant,
            )
            Spacer(Modifier.height(4.dp))
            Text(
                "FMB-$shortCode",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                letterSpacing = 4.sp,
                color = ink,
            )
        }
    }
}

@Composable
private fun CornerBrackets(color: Color) {
    Canvas(modifier = Modifier.fillMaxSize()) {
        val len = size.minDimension * 0.13f
        val stroke = size.minDimension * 0.026f
        val s = Stroke(width = stroke, cap = androidx.compose.ui.graphics.StrokeCap.Round)

        fun bracketPath(x0: Float, y0: Float, dx: Int, dy: Int): Path = Path().apply {
            moveTo(x0, y0 + dy * len)
            lineTo(x0, y0)
            lineTo(x0 + dx * len, y0)
        }
        // Top-left
        drawPath(bracketPath(0f, 0f, dx = 1, dy = 1), color, style = s)
        // Top-right
        drawPath(bracketPath(size.width, 0f, dx = -1, dy = 1), color, style = s)
        // Bottom-left
        drawPath(bracketPath(0f, size.height, dx = 1, dy = -1), color, style = s)
        // Bottom-right
        drawPath(bracketPath(size.width, size.height, dx = -1, dy = -1), color, style = s)
    }
}

@Composable
private fun BrandedQrCanvas(qrString: String, modifier: Modifier = Modifier) {
    val cs = MaterialTheme.colorScheme
    val moduleColor = cs.onSurface
    val white = Color.White
    val primary = cs.primary

    // High error correction so the centre logo overlay doesn't break the scan.
    val matrix = remember(qrString) {
        QRCodeWriter().encode(
            qrString,
            BarcodeFormat.QR_CODE,
            33, // logical module count — actual size handled by Canvas
            33,
            mapOf(
                EncodeHintType.ERROR_CORRECTION to ErrorCorrectionLevel.H,
                EncodeHintType.MARGIN to 0,
            ),
        )
    }

    Canvas(modifier = modifier) {
        val cellW = size.width / matrix.width
        val cellH = size.height / matrix.height
        val cell = minOf(cellW, cellH)
        val pad = cell * 0.12f
        val r = cell * 0.32f

        // Carve out a circular gap in the centre for the logo.
        val cx = size.width / 2
        val cy = size.height / 2
        val logoRadius = size.minDimension * 0.13f

        for (x in 0 until matrix.width) {
            for (y in 0 until matrix.height) {
                if (!matrix[x, y]) continue
                val px = x * cell + cell / 2
                val py = y * cell + cell / 2
                // Skip modules covered by logo.
                val dx = px - cx
                val dy = py - cy
                if (dx * dx + dy * dy < (logoRadius * 0.95f) * (logoRadius * 0.95f)) continue

                drawRoundRect(
                    color = moduleColor,
                    topLeft = Offset(x * cell + pad, y * cell + pad),
                    size = Size(cell - 2 * pad, cell - 2 * pad),
                    cornerRadius = CornerRadius(r, r),
                )
            }
        }

        // Logo: white halo + teal disc + white water drop.
        drawCircle(color = white, radius = logoRadius * 1.15f, center = Offset(cx, cy))
        drawCircle(color = primary, radius = logoRadius, center = Offset(cx, cy))

        // Mini water-drop in white at centre.
        translate(left = cx - logoRadius * 0.5f, top = cy - logoRadius * 0.55f) {
            val w = logoRadius
            val h = logoRadius * 1.1f
            val drop = Path().apply {
                moveTo(w / 2, 0f)
                cubicTo(w / 2, 0f, w * 0.05f, h * 0.45f, w * 0.05f, h * 0.65f)
                cubicTo(w * 0.05f, h * 0.85f, w * 0.30f, h, w / 2, h)
                cubicTo(w * 0.70f, h, w * 0.95f, h * 0.85f, w * 0.95f, h * 0.65f)
                cubicTo(w * 0.95f, h * 0.45f, w / 2, 0f, w / 2, 0f)
                close()
            }
            drawPath(drop, color = white)
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────
// Pulse pill + brightness boost + checked-in success
// ─────────────────────────────────────────────────────────────────────────

@Composable
private fun WaitingForScanPill() {
    val cs = MaterialTheme.colorScheme
    val transition = rememberInfiniteTransition(label = "scan-pulse")
    val alpha by transition.animateFloat(
        initialValue = 1f,
        targetValue = 0.4f,
        animationSpec = infiniteRepeatable<Float>(
            animation = tween<Float>(durationMillis = 900),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "scan-pulse-alpha",
    )

    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(20.dp))
            .background(cs.primaryContainer)
            .padding(horizontal = 14.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier
                .size(8.dp)
                .clip(CircleShape)
                .background(cs.primary.copy(alpha = alpha)),
        )
        Spacer(Modifier.width(8.dp))
        Text(
            "Waiting for scan",
            style = MaterialTheme.typography.labelMedium,
            fontWeight = FontWeight.Medium,
            color = cs.onPrimaryContainer,
        )
    }
}

@Composable
private fun BrightnessBoost() {
    val view = LocalView.current
    DisposableEffect(Unit) {
        val window = (view.context as? Activity)?.window
        val params = window?.attributes
        val original = params?.screenBrightness
        params?.screenBrightness = 1.0f
        window?.attributes = params
        onDispose {
            val restored = window?.attributes
            restored?.screenBrightness =
                original ?: WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_NONE
            window?.attributes = restored
        }
    }
}

@Composable
private fun CheckedInBody(modifier: Modifier = Modifier) {
    val cs = MaterialTheme.colorScheme
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(top = 64.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            modifier = Modifier
                .size(96.dp)
                .clip(CircleShape)
                .background(cs.primaryContainer),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                Icons.Filled.CheckCircle,
                contentDescription = null,
                tint = cs.primary,
                modifier = Modifier.size(56.dp),
            )
        }
        Spacer(Modifier.height(20.dp))
        Text(
            "Checked in!",
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.Bold,
            color = cs.onBackground,
        )
        Spacer(Modifier.height(8.dp))
        Text(
            "Your wash has started. We'll text you when it's done.",
            style = MaterialTheme.typography.bodyMedium,
            color = cs.onSurfaceVariant,
            textAlign = TextAlign.Center,
        )
    }
}

/** Friendly 4-character code derived from the booking id (e.g. "04A2"). */
private fun shortCode(bookingId: String): String =
    bookingId.takeLast(4).uppercase()

/** "2026-04-27T10:00:00.000Z" → "10:00" (24h, local zone). Returns null if unparsable. */
private fun formatSlotTime(iso: String): String? = runCatching {
    val instant = java.time.Instant.parse(iso)
    val local = instant.atZone(java.time.ZoneId.systemDefault())
    val fmt = java.time.format.DateTimeFormatter.ofPattern("HH:mm")
    local.format(fmt)
}.getOrNull()

/**
 * Plate-styled card on the QR screen: deep teal pill with the plate in a
 * monospaced bold treatment and the car description (colour, make, type)
 * underneath. Reads at-a-glance for the attendant who just scanned.
 */
@Composable
private fun PlateCard(plate: String, description: String?) {
    val cs = MaterialTheme.colorScheme
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(cs.primaryContainer)
            .border(1.dp, cs.primary, RoundedCornerShape(16.dp))
            .padding(horizontal = 16.dp, vertical = 14.dp),
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth()) {
            Text(
                "ATTENDANT — LOOK FOR",
                style = MaterialTheme.typography.labelSmall,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.6.sp,
                color = cs.onPrimaryContainer.copy(alpha = 0.7f),
            )
            Spacer(Modifier.height(6.dp))
            Text(
                plate,
                fontSize = 22.sp,
                fontWeight = FontWeight.ExtraBold,
                letterSpacing = 1.6.sp,
                color = cs.onPrimaryContainer,
            )
            if (!description.isNullOrBlank()) {
                Spacer(Modifier.height(4.dp))
                Text(
                    description,
                    style = MaterialTheme.typography.labelMedium,
                    color = cs.onPrimaryContainer.copy(alpha = 0.85f),
                )
            }
        }
    }
}
