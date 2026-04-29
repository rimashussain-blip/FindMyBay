package ae.findmybay.core.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ae.findmybay.core.theme.FmbBlue300
import ae.findmybay.core.theme.FmbBlue700
import ae.findmybay.core.theme.FmbNeutral500
import ae.findmybay.core.theme.primaryCtaGradient

/**
 * Brand mark per design handoff §App Icon: gradient teal rounded square with
 * a white water-drop silhouette wrapping a deep-teal "P".
 */
@Composable
fun LogoMark(size: Dp = 68.dp) {
    Box(
        modifier = Modifier
            .size(size)
            .clip(RoundedCornerShape(percent = 30))
            .background(
                Brush.linearGradient(
                    colors = listOf(FmbBlue300, FmbBlue700),
                    start = Offset(0f, 0f),
                    end = Offset(Float.POSITIVE_INFINITY, Float.POSITIVE_INFINITY),
                )
            ),
        contentAlignment = Alignment.Center,
    ) {
        Canvas(modifier = Modifier.size(size * 0.55f)) {
            drawDrop(this.size)
        }
        Text(
            text = "P",
            color = FmbBlue700,
            fontSize = (size.value * 0.30f).sp,
            fontWeight = FontWeight.ExtraBold,
            modifier = Modifier.padding(top = (size.value * 0.10f).dp),
        )
    }
}

private fun DrawScope.drawDrop(canvasSize: Size) {
    val w = canvasSize.width
    val h = canvasSize.height
    val path = Path().apply {
        val sx = w / 100f
        val sy = h / 100f
        moveTo(50f * sx, 18f * sy)
        cubicTo(50f * sx, 18f * sy, 28f * sx, 42f * sy, 28f * sx, 60f * sy)
        cubicTo(28f * sx, 72f * sy, 38f * sx, 82f * sy, 50f * sx, 82f * sy)
        cubicTo(62f * sx, 82f * sy, 72f * sx, 72f * sy, 72f * sx, 60f * sy)
        cubicTo(72f * sx, 42f * sy, 50f * sx, 18f * sy, 50f * sx, 18f * sy)
        close()
    }
    drawPath(path, color = Color.White)
}

/**
 * Eyebrow label per handoff: 11/700/0.3 uppercase, primary-deep.
 * Used above sections (MOBILE NUMBER, LIVE BAY STATUS, DATE, MORNING SLOTS, etc.)
 */
@Composable
fun Eyebrow(text: String, modifier: Modifier = Modifier) {
    Text(
        text = text.uppercase(),
        color = FmbBlue700,
        fontSize = 11.sp,
        fontWeight = FontWeight.Bold,
        letterSpacing = 0.3.sp,
        modifier = modifier,
    )
}

/**
 * Brand primary CTA button: aqua → deep-teal gradient pill with white label.
 * Use this for every "primary green" action across the app so the look stays
 * consistent. Falls back to a flat neutral fill when disabled, and renders a
 * spinner instead of the label when [loading] is true.
 *
 * Designed to host an optional [leadingIcon] (e.g. credit card) or
 * [trailingIcon] (e.g. chevron). Both icon slots receive a 6.dp gap.
 */
@Composable
fun FmbPrimaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    loading: Boolean = false,
    height: Dp = 52.dp,
    cornerRadius: Dp = 14.dp,
    leadingIcon: (@Composable () -> Unit)? = null,
    trailingIcon: (@Composable () -> Unit)? = null,
) {
    val disabled = !enabled || loading
    // Memoise both brushes — Brush.linearGradient allocates fresh on every
    // call. Without remember, every recomposition (e.g. on each keystroke in
    // a parent text field) re-allocates and invalidates the .background
    // modifier, which compounds badly during keyboard animations.
    val activeBrush = remember { primaryCtaGradient() }
    val disabledBrush = remember {
        Brush.linearGradient(
            listOf(FmbNeutral500.copy(alpha = 0.6f), FmbNeutral500.copy(alpha = 0.6f)),
        )
    }
    val brush: Brush = if (disabled) disabledBrush else activeBrush

    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(height)
            .clip(RoundedCornerShape(cornerRadius))
            .background(brush)
            .clickable(enabled = !disabled, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        if (loading) {
            CircularProgressIndicator(
                strokeWidth = 2.dp,
                modifier = Modifier.size(20.dp),
                color = Color.White,
            )
        } else {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center,
            ) {
                leadingIcon?.let {
                    it()
                    Spacer(Modifier.width(6.dp))
                }
                Text(
                    text,
                    color = Color.White,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.SemiBold,
                    letterSpacing = (-0.1).sp,
                )
                trailingIcon?.let {
                    Spacer(Modifier.width(6.dp))
                    it()
                }
            }
        }
    }
}

/**
 * Soft warm radial halo behind hero elements. Used on Phone OTP behind the
 * LogoMark and on Booking Confirmed behind the success mark.
 */
@Composable
fun SandHalo(
    modifier: Modifier = Modifier,
    diameter: Dp = 180.dp,
    intensity: Float = 0.45f,
) {
    Canvas(modifier = modifier.size(diameter)) {
        drawCircle(
            brush = Brush.radialGradient(
                colors = listOf(
                    Color(0xFFF5C77E).copy(alpha = intensity),
                    Color(0xFFF5C77E).copy(alpha = 0f),
                ),
                center = Offset(this.size.width / 2f, this.size.height / 2f),
                radius = this.size.minDimension / 2f,
            ),
        )
    }
}
