package ae.findmybay.core.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// Material 3 ColorScheme aligned to android-tokens.json (sys.color.light/dark).

private val LightColors = lightColorScheme(
    primary = Color(0xFF14B8A6),
    onPrimary = Color.White,
    primaryContainer = Color(0xFFCCFBF1),
    onPrimaryContainer = Color(0xFF00201C),
    secondary = Color(0xFF7A5732),
    onSecondary = Color.White,
    secondaryContainer = Color(0xFFFCE7C8),
    onSecondaryContainer = Color(0xFF2A1A05),
    tertiary = Color(0xFFFF8B6B),
    onTertiary = Color.White,
    tertiaryContainer = Color(0xFFFFE3D9),
    onTertiaryContainer = Color(0xFF3A0F00),
    error = Color(0xFFBA1A1A),
    onError = Color.White,
    errorContainer = Color(0xFFFFDAD6),
    onErrorContainer = Color(0xFF410002),
    background = Color(0xFFFFF7EC),
    onBackground = Color(0xFF0B3B36),
    surface = Color(0xFFFFF7EC),
    onSurface = Color(0xFF0B3B36),
    surfaceVariant = Color(0xFFE6F7F4),
    onSurfaceVariant = Color(0xFF3F6B65),
    surfaceContainerLowest = Color.White,
    surfaceContainerLow = Color(0xFFFFFBF3),
    surfaceContainer = Color(0xFFF4F1E5),
    surfaceContainerHigh = Color(0xFFEBE7DC),
    surfaceContainerHighest = Color(0xFFE1DDD2),
    outline = Color(0xFFCDEEE8),
    outlineVariant = Color(0xFFDBE7E4),
    scrim = Color.Black,
    inverseSurface = Color(0xFF0B3B36),
    inverseOnSurface = Color(0xFFFFF7EC),
    inversePrimary = Color(0xFF5EEAD4),
)

private val DarkColors = darkColorScheme(
    primary = Color(0xFF5EEAD4),
    onPrimary = Color(0xFF003731),
    primaryContainer = Color(0xFF005048),
    onPrimaryContainer = Color(0xFFCCFBF1),
    secondary = Color(0xFFF5C77E),
    onSecondary = Color(0xFF412A0E),
    secondaryContainer = Color(0xFF5C3F1F),
    onSecondaryContainer = Color(0xFFFCE7C8),
    tertiary = Color(0xFFFFC2AC),
    onTertiary = Color(0xFF5C1C0A),
    tertiaryContainer = Color(0xFF7E2D17),
    onTertiaryContainer = Color(0xFFFFE3D9),
    error = Color(0xFFFFB4AB),
    onError = Color(0xFF690005),
    errorContainer = Color(0xFF93000A),
    onErrorContainer = Color(0xFFFFDAD6),
    background = Color(0xFF06201D),
    onBackground = Color(0xFFE6F7F4),
    surface = Color(0xFF06201D),
    onSurface = Color(0xFFE6F7F4),
    surfaceVariant = Color(0xFF0B3B36),
    onSurfaceVariant = Color(0xFF9CB5B0),
    surfaceContainerLowest = Color(0xFF021614),
    surfaceContainerLow = Color(0xFF0B2926),
    surfaceContainer = Color(0xFF0F302C),
    surfaceContainerHigh = Color(0xFF163B36),
    surfaceContainerHighest = Color(0xFF1F4641),
    outline = Color(0xFF577D77),
    outlineVariant = Color(0xFF1F4E48),
    scrim = Color.Black,
    inverseSurface = Color(0xFFE6F7F4),
    inverseOnSurface = Color(0xFF0B3B36),
    inversePrimary = Color(0xFF0F766E),
)

@Composable
fun FindMyBayTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    val colors = if (darkTheme) DarkColors else LightColors
    MaterialTheme(
        colorScheme = colors,
        typography = FmbTypography,
        content = content,
    )
}
