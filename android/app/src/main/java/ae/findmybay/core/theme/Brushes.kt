package ae.findmybay.core.theme

import androidx.compose.runtime.Composable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color

// ─────────────────────────────────────────────────────────────────────────
// Find My Bay — signature brand gradients used across screens.
// All gradients are theme-aware: the underlying Fmb* tokens switch with
// MaterialTheme.colorScheme so light/dark each render correctly.
// ─────────────────────────────────────────────────────────────────────────

/**
 * App-icon / logo tile background.
 * Bright Aqua at the top-left fading into Deep teal at the bottom-right —
 * the same gradient used on the launcher icon and the welcome logo tile.
 */
@Composable
@ReadOnlyComposable
fun logoGradient(): Brush = Brush.linearGradient(
    colors = listOf(FmbAquaBright, FmbDeep),
    start = Offset(0f, 0f),
    end = Offset(Float.POSITIVE_INFINITY, Float.POSITIVE_INFINITY),
)

/**
 * "Leave now" hero gradient — deep aqua at the top fading to ink at the
 * bottom. Used as the full-bleed background on smart-leave alerts.
 */
@Composable
@ReadOnlyComposable
fun heroGradient(): Brush = Brush.verticalGradient(
    colors = listOf(FmbDeep, FmbInk),
)

/**
 * Warm sand-to-amber CTA pill ("I'm leaving now"). Reassuring weight,
 * matches the loyalty teaser gradient too.
 */
@Composable
@ReadOnlyComposable
fun amberCtaGradient(): Brush = Brush.linearGradient(
    colors = listOf(FmbSand, FmbAmber),
    start = Offset(0f, 0f),
    end = Offset(Float.POSITIVE_INFINITY, Float.POSITIVE_INFINITY),
)

/**
 * Soft cream → mint radial halo placed *behind* hero cards (Show QR,
 * Booking Confirmed) so the card lifts off the cream backdrop the way
 * it does on the design mockup.
 */
@Composable
@ReadOnlyComposable
fun haloGradient(): Brush = Brush.radialGradient(
    colors = listOf(FmbMint.copy(alpha = 0.85f), Color.Transparent),
)

/**
 * Subtle aqua-to-deep gradient on primary CTAs (Confirm slot, Send code,
 * Enter code instead). Reads as flat at a glance, picks up depth on closer
 * inspection — a nicer feel than a flat tint.
 */
@Composable
@ReadOnlyComposable
fun primaryCtaGradient(): Brush = Brush.linearGradient(
    colors = listOf(FmbAqua, FmbDeep),
    start = Offset(0f, 0f),
    end = Offset(Float.POSITIVE_INFINITY, Float.POSITIVE_INFINITY),
)
