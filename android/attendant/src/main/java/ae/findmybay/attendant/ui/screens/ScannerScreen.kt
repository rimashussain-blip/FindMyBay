package ae.findmybay.attendant.ui.screens

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
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ae.findmybay.attendant.ui.components.Eyebrow
import ae.findmybay.attendant.ui.theme.FmbCream
import ae.findmybay.attendant.ui.theme.FmbPrimary

private val ScanBg = Color(0xFF0B1715)
private val ScanCardBg = Color(0xCC0B1715)
private val ScanBorder = Color(0x2E5EEAD4)

@Composable
fun ScannerScreen(onClose: () -> Unit, onTypeCode: () -> Unit) {
    Box(Modifier.fillMaxSize().background(ScanBg)) {
        // Stylised cabin gradient backdrop
        Box(
            Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        0f to Color(0xFF13302B),
                        0.6f to ScanBg,
                        1f to Color(0xFF000000),
                    )
                )
        )

        // Scan zone (centred)
        Box(Modifier.align(Alignment.Center).size(240.dp)) {
            // soft glow
            Box(
                Modifier.fillMaxSize().background(
                    Brush.radialGradient(
                        colors = listOf(Color(0x4014B8A6), Color(0x0014B8A6)),
                    )
                )
            )
            Canvas(Modifier.fillMaxSize()) {
                val len = 44f
                val sw = 6f
                val c = FmbPrimary
                // top-left
                drawLine(c, Offset(0f, len), Offset(0f, 0f), sw, StrokeCap.Round)
                drawLine(c, Offset(0f, 0f), Offset(len, 0f), sw, StrokeCap.Round)
                // top-right
                drawLine(c, Offset(size.width - len, 0f), Offset(size.width, 0f), sw, StrokeCap.Round)
                drawLine(c, Offset(size.width, 0f), Offset(size.width, len), sw, StrokeCap.Round)
                // bottom-left
                drawLine(c, Offset(0f, size.height - len), Offset(0f, size.height), sw, StrokeCap.Round)
                drawLine(c, Offset(0f, size.height), Offset(len, size.height), sw, StrokeCap.Round)
                // bottom-right
                drawLine(c, Offset(size.width - len, size.height), Offset(size.width, size.height), sw, StrokeCap.Round)
                drawLine(c, Offset(size.width, size.height - len), Offset(size.width, size.height), sw, StrokeCap.Round)
                // scanning bar
                drawLine(c, Offset(10f, size.height / 2f), Offset(size.width - 10f, size.height / 2f), 3f, StrokeCap.Round)
            }
        }

        // Top overlay card
        Box(Modifier.align(Alignment.TopCenter).fillMaxWidth().padding(start = 20.dp, end = 20.dp, top = 56.dp)) {
            Row(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(18.dp))
                    .background(ScanCardBg)
                    .border(1.dp, ScanBorder, RoundedCornerShape(18.dp))
                    .padding(16.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(Modifier.weight(1f)) {
                    Eyebrow("Scan customer QR", color = FmbPrimary)
                    Text("Hold the customer's QR steady", color = FmbCream, fontSize = 14.sp, fontWeight = FontWeight.Bold, letterSpacing = (-0.2).sp, modifier = Modifier.padding(top = 3.dp))
                }
                Box(
                    Modifier.size(40.dp).clip(RoundedCornerShape(12.dp)).background(Color(0x14FFF7EC))
                        .border(1.dp, Color(0x33FFF7EC), RoundedCornerShape(12.dp)).clickable(onClick = onClose),
                    contentAlignment = Alignment.Center,
                ) { Icon(Icons.Filled.Close, "Close", tint = FmbCream, modifier = Modifier.size(18.dp)) }
            }
        }

        // Bottom overlay card
        Column(Modifier.align(Alignment.BottomCenter).fillMaxWidth().padding(start = 20.dp, end = 20.dp, bottom = 48.dp)) {
            Column(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(18.dp))
                    .background(ScanCardBg)
                    .border(1.dp, ScanBorder, RoundedCornerShape(18.dp))
                    .padding(16.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Box(
                    Modifier
                        .fillMaxWidth()
                        .height(60.dp)
                        .clip(RoundedCornerShape(14.dp))
                        .border(1.5.dp, Color(0x66FFF7EC), RoundedCornerShape(14.dp))
                        .clickable(onClick = onTypeCode),
                    contentAlignment = Alignment.Center,
                ) {
                    Text("Type code instead", color = FmbCream, fontSize = 15.sp, fontWeight = FontWeight.Bold)
                }
                Text(
                    "If the QR won't scan, ask the customer to read it",
                    color = Color(0x8CFFF7EC), fontSize = 11.sp, fontWeight = FontWeight.Medium,
                    modifier = Modifier.padding(top = 12.dp),
                )
            }
        }
    }
}
