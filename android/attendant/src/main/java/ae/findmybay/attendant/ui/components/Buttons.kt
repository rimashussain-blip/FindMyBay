package ae.findmybay.attendant.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ae.findmybay.attendant.ui.theme.FmbPrimary
import ae.findmybay.attendant.ui.theme.FmbPrimaryDeep
import ae.findmybay.attendant.ui.theme.FmbWhite

// Brand primary CTA — aqua → deep-teal gradient pill, white label, optional
// leading icon. 60dp+ tall by default for gloved-thumb tap targets.
@Composable
fun FmbPrimaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    height: Dp = 60.dp,
    cornerRadius: Dp = 16.dp,
    leadingIcon: ImageVector? = null,
) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(height)
            .clip(RoundedCornerShape(cornerRadius))
            .background(
                Brush.linearGradient(listOf(FmbPrimary, FmbPrimaryDeep))
            )
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            if (leadingIcon != null) {
                Icon(
                    leadingIcon, contentDescription = null,
                    tint = FmbWhite,
                    modifier = Modifier.height(20.dp).padding(end = 8.dp),
                )
            }
            Text(
                text = text,
                color = FmbWhite,
                fontSize = 15.sp,
                fontWeight = FontWeight.ExtraBold,
                letterSpacing = (-0.2).sp,
            )
        }
    }
}
