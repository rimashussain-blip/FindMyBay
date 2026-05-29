package ae.findmybay.attendant.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

// The attendant app is intentionally light-only — wash-floor staff use it
// outdoors in bright sun, where a dark theme would wash out. We ignore the
// system dark setting and always present the cream/teal light scheme.
private val AttendantColors = lightColorScheme(
    primary = FmbPrimary,
    onPrimary = FmbWhite,
    primaryContainer = FmbMint,
    onPrimaryContainer = FmbPrimaryDeep,
    secondary = FmbSandDeep,
    secondaryContainer = FmbSand,
    background = FmbCream,
    onBackground = FmbInk,
    surface = FmbWhite,
    onSurface = FmbInk,
    surfaceVariant = FmbMint,
    onSurfaceVariant = FmbInkSoft,
    outline = FmbMintEdge,
    error = FmbCoral,
    errorContainer = FmbCoralSoft,
)

private val AttendantType = Typography().run {
    // System sans (Plus Jakarta Sans loads via the OS where available, same
    // approach as the customer app). We only tune the headline/title weights
    // toward the brand's heavier, tighter feel.
    copy(
        titleLarge = titleLarge.copy(fontFamily = FontFamily.Default, fontWeight = FontWeight.ExtraBold, letterSpacing = (-0.4).sp),
        titleMedium = titleMedium.copy(fontFamily = FontFamily.Default, fontWeight = FontWeight.Bold),
        bodyLarge = bodyLarge.copy(fontFamily = FontFamily.Default),
        bodyMedium = bodyMedium.copy(fontFamily = FontFamily.Default),
        labelLarge = labelLarge.copy(fontFamily = FontFamily.Default, fontWeight = FontWeight.SemiBold),
    )
}

@Composable
fun FmbAttendantTheme(content: @Composable () -> Unit) {
    @Suppress("UNUSED_EXPRESSION")
    isSystemInDarkTheme() // referenced to avoid lint; we deliberately stay light
    MaterialTheme(
        colorScheme = AttendantColors,
        typography = AttendantType,
        content = content,
    )
}
