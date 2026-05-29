package ae.findmybay.attendant.ui.screens

import android.Manifest
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.Canvas
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import ae.findmybay.attendant.data.ServiceGraph
import ae.findmybay.attendant.ui.components.Eyebrow
import ae.findmybay.attendant.ui.theme.FmbCream
import ae.findmybay.attendant.ui.theme.FmbPrimary
import com.google.accompanist.permissions.ExperimentalPermissionsApi
import com.google.accompanist.permissions.isGranted
import com.google.accompanist.permissions.rememberPermissionState
import com.google.zxing.BarcodeFormat
import com.google.zxing.BinaryBitmap
import com.google.zxing.DecodeHintType
import com.google.zxing.MultiFormatReader
import com.google.zxing.PlanarYUVLuminanceSource
import com.google.zxing.common.HybridBinarizer
import kotlinx.coroutines.delay
import java.util.concurrent.Executors

private val ScanBg = Color(0xFF0B1715)
private val ScanCardBg = Color(0xCC0B1715)
private val ScanBorder = Color(0x2E5EEAD4)
private val ScanSuccess = Color(0xFF14B8A6)
private val ScanError = Color(0xFFFF8B6B)

@OptIn(ExperimentalPermissionsApi::class)
@Composable
fun ScannerScreen(onClose: () -> Unit) {
    val vm: ScannerViewModel = viewModel(
        factory = viewModelFactory { initializer { ScannerViewModel(ServiceGraph.repository) } }
    )
    val state by vm.state.collectAsStateWithLifecycle()

    val cameraPermission = rememberPermissionState(Manifest.permission.CAMERA)
    LaunchedEffect(Unit) {
        if (!cameraPermission.status.isGranted) cameraPermission.launchPermissionRequest()
    }

    // After a successful check-in, flash the result then pop back to the board
    // (which refreshes on resume and shows the bay flipped to busy).
    LaunchedEffect(state.result) {
        if (state.result != null) {
            delay(1500)
            onClose()
        }
    }

    Box(Modifier.fillMaxSize().background(ScanBg)) {
        if (cameraPermission.status.isGranted) {
            CameraPreview(onQr = vm::onQrDetected, modifier = Modifier.fillMaxSize())
            // Darken edges a touch so the white overlay cards stay legible.
            Box(Modifier.fillMaxSize().background(Color(0x33000000)))
        } else {
            Box(
                Modifier.fillMaxSize().background(
                    Brush.verticalGradient(0f to Color(0xFF13302B), 0.6f to ScanBg, 1f to Color(0xFF000000))
                )
            )
        }

        // Scan-zone reticle
        Box(Modifier.align(Alignment.Center).size(240.dp)) {
            Canvas(Modifier.fillMaxSize()) {
                val len = 44f
                val sw = 6f
                val c = FmbPrimary
                drawLine(c, Offset(0f, len), Offset(0f, 0f), sw, StrokeCap.Round)
                drawLine(c, Offset(0f, 0f), Offset(len, 0f), sw, StrokeCap.Round)
                drawLine(c, Offset(size.width - len, 0f), Offset(size.width, 0f), sw, StrokeCap.Round)
                drawLine(c, Offset(size.width, 0f), Offset(size.width, len), sw, StrokeCap.Round)
                drawLine(c, Offset(0f, size.height - len), Offset(0f, size.height), sw, StrokeCap.Round)
                drawLine(c, Offset(0f, size.height), Offset(len, size.height), sw, StrokeCap.Round)
                drawLine(c, Offset(size.width - len, size.height), Offset(size.width, size.height), sw, StrokeCap.Round)
                drawLine(c, Offset(size.width, size.height - len), Offset(size.width, size.height), sw, StrokeCap.Round)
                drawLine(c, Offset(10f, size.height / 2f), Offset(size.width - 10f, size.height / 2f), 3f, StrokeCap.Round)
            }
        }

        // Top card — title + close
        Box(Modifier.align(Alignment.TopCenter).fillMaxWidth().padding(start = 20.dp, end = 20.dp, top = 24.dp)) {
            Row(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp)).background(ScanCardBg)
                    .border(1.dp, ScanBorder, RoundedCornerShape(18.dp)).padding(16.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(Modifier.weight(1f)) {
                    Eyebrow("Scan customer QR", color = FmbPrimary)
                    Text(
                        if (cameraPermission.status.isGranted) "Hold the customer's QR steady"
                        else "Camera access needed to scan",
                        color = FmbCream, fontSize = 14.sp, fontWeight = FontWeight.Bold,
                        letterSpacing = (-0.2).sp, modifier = Modifier.padding(top = 3.dp),
                    )
                }
                Box(
                    Modifier.size(40.dp).clip(RoundedCornerShape(12.dp)).background(Color(0x14FFF7EC))
                        .border(1.dp, Color(0x33FFF7EC), RoundedCornerShape(12.dp)).clickable(onClick = onClose),
                    contentAlignment = Alignment.Center,
                ) { Icon(Icons.Filled.Close, "Close", tint = FmbCream, modifier = Modifier.size(18.dp)) }
            }
        }

        // Bottom card — permission prompt (if needed) + manual code fallback
        Column(Modifier.align(Alignment.BottomCenter).fillMaxWidth().padding(start = 20.dp, end = 20.dp, bottom = 36.dp)) {
            Column(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp)).background(ScanCardBg)
                    .border(1.dp, ScanBorder, RoundedCornerShape(18.dp)).padding(16.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                if (!cameraPermission.status.isGranted) {
                    PillButton("Grant camera access", onClick = { cameraPermission.launchPermissionRequest() })
                    Spacer(Modifier.height(10.dp))
                }
                PillButton("Type code instead", onClick = vm::openCodeEntry)
                Text(
                    "If the QR won't scan, ask the customer to read the FMB code",
                    color = Color(0x8CFFF7EC), fontSize = 11.sp, fontWeight = FontWeight.Medium,
                    modifier = Modifier.padding(top = 12.dp),
                )
            }
        }

        // Working spinner
        if (state.working) {
            Box(Modifier.fillMaxSize().background(Color(0x66000000)), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = FmbPrimary)
            }
        }

        // Success overlay
        state.result?.let { r ->
            ResultOverlay(
                bg = ScanSuccess,
                icon = { Icon(Icons.Filled.Check, null, tint = Color.White, modifier = Modifier.size(40.dp)) },
                title = if (r.alreadyCheckedIn) "Already checked in" else "Checked in",
                detail = buildString {
                    append(r.customerName)
                    r.bayName?.let { append(" · "); append(it) }
                },
            )
        }

        // Error banner
        state.error?.let { msg ->
            Box(Modifier.align(Alignment.Center).fillMaxWidth().padding(28.dp)) {
                Column(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp)).background(ScanError).padding(20.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Text(msg, color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                    Spacer(Modifier.height(12.dp))
                    Box(
                        Modifier.clip(RoundedCornerShape(12.dp)).background(Color(0x33FFFFFF))
                            .clickable(onClick = vm::dismissError).padding(horizontal = 18.dp, vertical = 8.dp),
                    ) { Text("Try again", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 13.sp) }
                }
            }
        }

        // Manual code-entry dialog
        if (state.showCodeEntry) {
            CodeEntryDialog(
                value = state.codeInput,
                onValue = vm::setCode,
                onSubmit = vm::submitCode,
                onDismiss = vm::closeCodeEntry,
            )
        }
    }
}

@Composable
private fun PillButton(label: String, onClick: () -> Unit) {
    Box(
        Modifier.fillMaxWidth().height(56.dp).clip(RoundedCornerShape(14.dp))
            .border(1.5.dp, Color(0x66FFF7EC), RoundedCornerShape(14.dp)).clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) { Text(label, color = FmbCream, fontSize = 15.sp, fontWeight = FontWeight.Bold) }
}

@Composable
private fun ResultOverlay(bg: Color, icon: @Composable () -> Unit, title: String, detail: String) {
    Box(Modifier.fillMaxSize().background(Color(0xCC0B1715)), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Box(
                Modifier.size(84.dp).clip(RoundedCornerShape(28.dp)).background(bg),
                contentAlignment = Alignment.Center,
            ) { icon() }
            Spacer(Modifier.height(18.dp))
            Text(title, color = FmbCream, fontSize = 20.sp, fontWeight = FontWeight.ExtraBold)
            Spacer(Modifier.height(6.dp))
            Text(detail, color = Color(0xCCFFF7EC), fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
        }
    }
}

@Composable
private fun CodeEntryDialog(value: String, onValue: (String) -> Unit, onSubmit: () -> Unit, onDismiss: () -> Unit) {
    Box(
        Modifier.fillMaxSize().background(Color(0xAA000000)).clickable(onClick = onDismiss),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            Modifier.fillMaxWidth().padding(28.dp).clip(RoundedCornerShape(20.dp)).background(FmbCream).padding(20.dp),
        ) {
            Eyebrow("Manual check-in", color = FmbPrimary)
            Text("Enter the FMB code", fontSize = 18.sp, fontWeight = FontWeight.ExtraBold, color = Color(0xFF0B3B36), modifier = Modifier.padding(top = 4.dp, bottom = 14.dp))
            OutlinedTextField(
                value = value,
                onValueChange = onValue,
                singleLine = true,
                placeholder = { Text("FMB-1A2B") },
                modifier = Modifier.fillMaxWidth(),
                keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(capitalization = KeyboardCapitalization.Characters),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = FmbPrimary,
                    unfocusedBorderColor = Color(0xFFCDEEE8),
                    focusedContainerColor = Color.White,
                    unfocusedContainerColor = Color.White,
                    cursorColor = FmbPrimary,
                ),
            )
            Spacer(Modifier.height(16.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Box(
                    Modifier.weight(1f).height(52.dp).clip(RoundedCornerShape(14.dp)).border(1.5.dp, Color(0xFFCDEEE8), RoundedCornerShape(14.dp)).clickable(onClick = onDismiss),
                    contentAlignment = Alignment.Center,
                ) { Text("Cancel", color = Color(0xFF5C7A75), fontWeight = FontWeight.Bold) }
                Box(
                    Modifier.weight(1f).height(52.dp).clip(RoundedCornerShape(14.dp)).background(FmbPrimary).clickable(onClick = onSubmit),
                    contentAlignment = Alignment.Center,
                ) { Text("Check in", color = Color.White, fontWeight = FontWeight.ExtraBold) }
            }
        }
    }
}

@Composable
private fun CameraPreview(onQr: (String) -> Unit, modifier: Modifier = Modifier) {
    val lifecycleOwner = LocalLifecycleOwner.current
    val executor = remember { Executors.newSingleThreadExecutor() }
    DisposableEffect(Unit) { onDispose { executor.shutdown() } }

    AndroidView(
        modifier = modifier,
        factory = { ctx ->
            val previewView = PreviewView(ctx).apply {
                scaleType = PreviewView.ScaleType.FILL_CENTER
                implementationMode = PreviewView.ImplementationMode.COMPATIBLE
            }
            val providerFuture = ProcessCameraProvider.getInstance(ctx)
            providerFuture.addListener({
                val provider = providerFuture.get()
                val preview = Preview.Builder().build().also { it.setSurfaceProvider(previewView.surfaceProvider) }
                val analysis = ImageAnalysis.Builder()
                    .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                    .build()
                    .also { it.setAnalyzer(executor, QrCodeAnalyzer(onQr)) }
                try {
                    provider.unbindAll()
                    provider.bindToLifecycle(lifecycleOwner, CameraSelector.DEFAULT_BACK_CAMERA, preview, analysis)
                } catch (_: Exception) {
                    // Camera unavailable (e.g. emulator with no back cam) — the
                    // manual code path still works.
                }
            }, ContextCompat.getMainExecutor(ctx))
            previewView
        },
    )
}

/** Decodes the camera's luminance plane into a QR string with zxing. */
private class QrCodeAnalyzer(private val onQr: (String) -> Unit) : ImageAnalysis.Analyzer {
    private val reader = MultiFormatReader().apply {
        setHints(
            mapOf(
                DecodeHintType.POSSIBLE_FORMATS to listOf(BarcodeFormat.QR_CODE),
                DecodeHintType.TRY_HARDER to true,
            )
        )
    }

    override fun analyze(image: ImageProxy) {
        try {
            val plane = image.planes[0]
            val buffer = plane.buffer
            val data = ByteArray(buffer.remaining())
            buffer.get(data)
            val source = PlanarYUVLuminanceSource(
                data, plane.rowStride, image.height,
                0, 0, image.width, image.height, false,
            )
            val bitmap = BinaryBitmap(HybridBinarizer(source))
            val result = reader.decodeWithState(bitmap)
            result.text?.let(onQr)
        } catch (_: Exception) {
            // No QR in this frame — ignore.
        } finally {
            reader.reset()
            image.close()
        }
    }
}
