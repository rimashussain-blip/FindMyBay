package ae.findmybay.attendant.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ae.findmybay.attendant.ui.theme.FmbCoral
import ae.findmybay.attendant.ui.theme.FmbCoralSoft
import ae.findmybay.attendant.ui.theme.FmbCream
import ae.findmybay.attendant.ui.theme.FmbMint
import ae.findmybay.attendant.ui.theme.FmbPrimary
import ae.findmybay.attendant.ui.theme.FmbPrimaryDeep
import ae.findmybay.attendant.ui.theme.FmbSand
import ae.findmybay.attendant.ui.theme.FmbSandDeep
import ae.findmybay.attendant.ui.theme.FmbSandText
import ae.findmybay.attendant.ui.theme.FmbWhite

// ─── M1 Marker ────────────────────────────────────────────────────────────
// Brand kit "M1 Marker": deep-teal squircle, cream teardrop, circular cutout
// through the centre. The cutout is drawn by overpainting a bg-coloured circle
// onto the cream drop, which reads as a hole.
@Composable
fun M1Mark(size: Dp = 36.dp, bg: Color = FmbPrimaryDeep, fg: Color = FmbCream) {
    Box(
        modifier = Modifier
            .size(size)
            .clip(RoundedCornerShape(percent = 22))
            .background(bg),
        contentAlignment = Alignment.Center,
    ) {
        Canvas(modifier = Modifier.size(size)) {
            val sx = this.size.width / 100f
            val sy = this.size.height / 100f
            val drop = Path().apply {
                moveTo(50f * sx, 14f * sy)
                cubicTo(50f * sx, 14f * sy, 22f * sx, 46f * sy, 22f * sx, 66f * sy)
                cubicTo(22f * sx, 81f * sy, 35f * sx, 90f * sy, 50f * sx, 90f * sy)
                cubicTo(65f * sx, 90f * sy, 78f * sx, 81f * sy, 78f * sx, 66f * sy)
                cubicTo(78f * sx, 46f * sy, 50f * sx, 14f * sy, 50f * sx, 14f * sy)
                close()
            }
            drawPath(drop, color = fg)
            drawCircle(color = bg, radius = 14f * sx, center = Offset(50f * sx, 58f * sy))
        }
    }
}

// ─── Eyebrow label ──────────────────────────────────────────────────────────
@Composable
fun Eyebrow(text: String, color: Color = FmbPrimaryDeep, modifier: Modifier = Modifier) {
    Text(
        text = text.uppercase(),
        color = color,
        fontSize = 11.sp,
        fontWeight = FontWeight.Bold,
        letterSpacing = 0.3.sp,
        modifier = modifier,
    )
}

// ─── Status pill ────────────────────────────────────────────────────────────
enum class PillKind { Free, Busy, Closed, Alert, InProgress, Done }

@Composable
fun StatusPill(kind: PillKind, text: String, sub: String? = null, big: Boolean = false) {
    val bg: Color; val fg: Color; val dot: Color
    when (kind) {
        PillKind.Free, PillKind.Done -> { bg = FmbMint; fg = FmbPrimaryDeep; dot = FmbPrimary }
        PillKind.Busy -> { bg = FmbSand; fg = FmbSandText; dot = FmbSandDeep }
        PillKind.Closed -> { bg = Color(0xFFE8E8E3); fg = Color(0xFF7A7A75); dot = Color(0xFFA8A8A0) }
        PillKind.Alert -> { bg = FmbCoralSoft; fg = FmbCoral; dot = FmbCoral }
        PillKind.InProgress -> { bg = FmbPrimary; fg = FmbWhite; dot = FmbWhite }
    }
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .clip(RoundedCornerShape(6.dp))
            .background(bg)
            .padding(
                if (big) PaddingValues(horizontal = 12.dp, vertical = 6.dp)
                else PaddingValues(horizontal = 9.dp, vertical = 4.dp)
            ),
    ) {
        Box(
            Modifier
                .size(if (big) 7.dp else 6.dp)
                .clip(CircleShape)
                .background(dot),
        )
        Text(
            text = buildString {
                append(text.uppercase())
                if (sub != null) append(" · ${sub.uppercase()}")
            },
            color = fg,
            fontSize = if (big) 12.sp else 11.sp,
            fontWeight = FontWeight.ExtraBold,
            letterSpacing = 0.4.sp,
            modifier = Modifier.padding(start = 6.dp),
        )
    }
}

// ─── Loyalty tier badge ──────────────────────────────────────────────────────
enum class Tier { Bronze, Silver, Gold, Platinum }

@Composable
fun TierBadge(tier: Tier) {
    val bg: Color; val fg: Color
    when (tier) {
        Tier.Bronze -> { bg = Color(0xFFC58A4E); fg = FmbWhite }
        Tier.Silver -> { bg = Color(0xFFC1CBCD); fg = Color(0xFF3A4244) }
        Tier.Gold -> { bg = FmbSandDeep; fg = FmbSandText }
        Tier.Platinum -> { bg = FmbPrimary; fg = FmbPrimaryDeep }
    }
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .clip(RoundedCornerShape(50))
            .background(bg)
            .padding(horizontal = 9.dp, vertical = 3.dp),
    ) {
        Text(
            text = "★ ${tier.name.uppercase()}",
            color = fg,
            fontSize = 10.sp,
            fontWeight = FontWeight.ExtraBold,
            letterSpacing = 0.3.sp,
        )
    }
}

// ─── Countdown ring (busy bay tiles) ─────────────────────────────────────────
@Composable
fun CountdownRing(pct: Float, size: Dp = 56.dp) {
    Box(modifier = Modifier.size(size), contentAlignment = Alignment.Center) {
        Canvas(modifier = Modifier.size(size)) {
            val stroke = 4f * (this.size.width / 56f)
            val inset = stroke / 2f + 1f
            // Track
            drawArc(
                color = FmbSand,
                startAngle = 0f, sweepAngle = 360f, useCenter = false,
                topLeft = Offset(inset, inset),
                size = androidx.compose.ui.geometry.Size(this.size.width - inset * 2, this.size.height - inset * 2),
                style = androidx.compose.ui.graphics.drawscope.Stroke(width = stroke),
            )
            // Progress
            drawArc(
                color = FmbSandDeep,
                startAngle = -90f, sweepAngle = 360f * pct.coerceIn(0f, 1f), useCenter = false,
                topLeft = Offset(inset, inset),
                size = androidx.compose.ui.geometry.Size(this.size.width - inset * 2, this.size.height - inset * 2),
                style = androidx.compose.ui.graphics.drawscope.Stroke(
                    width = stroke,
                    cap = androidx.compose.ui.graphics.StrokeCap.Round,
                ),
            )
        }
    }
}
