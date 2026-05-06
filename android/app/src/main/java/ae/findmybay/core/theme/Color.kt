package ae.findmybay.core.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.ui.graphics.Color

// ───────────────────────────────────────────────────────────────────────────
// Find My Bay — semantic colour tokens.
//
// Each Fmb* token is a *theme-aware* @Composable getter that reads from
// MaterialTheme.colorScheme. That way the same token renders the right
// value in light + dark mode automatically — screens don't need to know.
//
// Light scheme = sand+cream warm aqua (the original Find My Bay look).
// Dark scheme  = M3 dark teal-ink (#06201D → #1F4641) with a desaturated
//                aqua accent (#5EEAD4). Sand stays as the warm secondary
//                so the brand still feels welcoming, never sterile.
// Both are defined in Theme.kt's LightColors / DarkColors.
// ───────────────────────────────────────────────────────────────────────────

// ─── Primary teal ramp ────────────────────────────────────────────────────

/** Deepest ink — large headings on background. Light: #0B3B36, Dark: #E6F7F4. */
val FmbBlue900: Color
    @Composable @ReadOnlyComposable get() = MaterialTheme.colorScheme.onBackground

/** Brand "deep" — primary CTA shade. Light: #0F766E, Dark: #5EEAD4 (inverse). */
val FmbBlue700: Color
    @Composable @ReadOnlyComposable get() =
        if (isAppInDarkTheme()) MaterialTheme.colorScheme.primary
        else Color(0xFF0F766E)

/** Brand bright aqua. Light: #14B8A6, Dark: #5EEAD4. */
val FmbBlue500: Color
    @Composable @ReadOnlyComposable get() = MaterialTheme.colorScheme.primary

/** Light teal accent. Light: #2DD4BF, Dark: #5EEAD4. */
val FmbBlue300: Color
    @Composable @ReadOnlyComposable get() =
        if (isAppInDarkTheme()) MaterialTheme.colorScheme.primary
        else Color(0xFF2DD4BF)

/** Mint container. Light: #CCFBF1, Dark: #005048 (deep teal container). */
val FmbBlue100: Color
    @Composable @ReadOnlyComposable get() = MaterialTheme.colorScheme.primaryContainer

/** Surface tint. Light: #E6F7F4, Dark: #0B3B36. */
val FmbMint: Color
    @Composable @ReadOnlyComposable get() = MaterialTheme.colorScheme.surfaceVariant

/** Hairline edge. Light: #CDEEE8, Dark: #577D77. */
val FmbMintEdge: Color
    @Composable @ReadOnlyComposable get() = MaterialTheme.colorScheme.outline

// ─── Warm secondary (sand) ────────────────────────────────────────────────

/** Sand chip / glow. Light: #FCE7C8, Dark: #5C3F1F. */
val FmbSand: Color
    @Composable @ReadOnlyComposable get() = MaterialTheme.colorScheme.secondaryContainer

/** Amber accent — stays warm in both modes. Light: #F5C77E, Dark: #F5C77E. */
val FmbSandDeep: Color
    @Composable @ReadOnlyComposable get() =
        if (isAppInDarkTheme()) Color(0xFFF5C77E)
        else Color(0xFFF5C77E)

/** Alias — same as FmbSandDeep. */
val FmbAmber500: Color
    @Composable @ReadOnlyComposable get() = FmbSandDeep

/** Cream warm background. Light: #FFF7EC, Dark: #06201D. */
val FmbCream: Color
    @Composable @ReadOnlyComposable get() = MaterialTheme.colorScheme.background

// ─── Tertiary coral ───────────────────────────────────────────────────────

/** Coral. Light: #FF8B6B, Dark: #FFC2AC. */
val FmbCoral: Color
    @Composable @ReadOnlyComposable get() = MaterialTheme.colorScheme.tertiary

/** Coral soft. Light: #FFE3D9, Dark: #7E2D17. */
val FmbCoralSoft: Color
    @Composable @ReadOnlyComposable get() = MaterialTheme.colorScheme.tertiaryContainer

/** Alias for source-compat. */
val FmbRed500: Color
    @Composable @ReadOnlyComposable get() = FmbCoral

// ─── Status semantics ─────────────────────────────────────────────────────

/** "Free / available" green — same hue as primary. */
val FmbGreen500: Color
    @Composable @ReadOnlyComposable get() = MaterialTheme.colorScheme.primary

// ─── Neutral ramp ─────────────────────────────────────────────────────────

/** Body / subtitle ink. Light: #0B3B36, Dark: #E6F7F4. */
val FmbNeutral900: Color
    @Composable @ReadOnlyComposable get() = MaterialTheme.colorScheme.onBackground

/** Soft body / metadata. Light: #3F6B65, Dark: #9CB5B0. */
val FmbNeutral700: Color
    @Composable @ReadOnlyComposable get() = MaterialTheme.colorScheme.onSurfaceVariant

val FmbNeutral500: Color
    @Composable @ReadOnlyComposable get() =
        if (isAppInDarkTheme()) Color(0xFF7A9893)
        else Color(0xFF7A9893)

val FmbNeutral300: Color
    @Composable @ReadOnlyComposable get() = MaterialTheme.colorScheme.outline

val FmbNeutral100: Color
    @Composable @ReadOnlyComposable get() = MaterialTheme.colorScheme.surfaceContainerLow

val FmbNeutral50: Color
    @Composable @ReadOnlyComposable get() = MaterialTheme.colorScheme.background

// ─── Named handoff aliases (Aqua / Deep / Cream / Sand / Amber / Coral / Mint / Ink)
//     Use these inside screen code so intent reads at a glance.
// ─────────────────────────────────────────────────────────────────────────

/** #14B8A6 light — bright aqua / primary. */
val FmbAqua: Color
    @Composable @ReadOnlyComposable get() = FmbBlue500

/** #2DD4BF light — lighter accent stop. */
val FmbAquaBright: Color
    @Composable @ReadOnlyComposable get() = FmbBlue300

/** #0F766E light — deep teal. */
val FmbDeep: Color
    @Composable @ReadOnlyComposable get() = FmbBlue700

/** #FFF7EC — warm welcoming surface. */
val FmbCream2: Color
    @Composable @ReadOnlyComposable get() = FmbCream

/** #FCE7C8 — sand chip / glow. */
val FmbSand2: Color
    @Composable @ReadOnlyComposable get() = FmbSand

/** #F5C77E — amber CTA. */
val FmbAmber: Color
    @Composable @ReadOnlyComposable get() = FmbSandDeep

/** #FF8B6B — coral accent. */
val FmbCoral2: Color
    @Composable @ReadOnlyComposable get() = FmbCoral

/** #E6F7F4 — mint surface tint. */
val FmbMint2: Color
    @Composable @ReadOnlyComposable get() = FmbMint

/** #0B3B36 — deep ink. */
val FmbInk: Color
    @Composable @ReadOnlyComposable get() = MaterialTheme.colorScheme.onBackground

// ─── Helpers ──────────────────────────────────────────────────────────────

/**
 * Heuristic: are we currently rendering against a dark colorScheme? Reads
 * the `background` luminance — works regardless of whether the user forced
 * light/dark from settings or we inherited from the system.
 */
@Composable
@ReadOnlyComposable
private fun isAppInDarkTheme(): Boolean {
    val bg = MaterialTheme.colorScheme.background
    // Cheap luminance: dark backgrounds register < 0.5
    val l = 0.299f * bg.red + 0.587f * bg.green + 0.114f * bg.blue
    return l < 0.5f
}

// ─── Static dark-mode references (kept for direct use if needed) ──────────
// These are also wired into Theme.kt's DarkColors. Most screens shouldn't
// need them — the Fmb* tokens above already switch automatically.
val FmbDarkPrimary           = Color(0xFF5EEAD4)
val FmbDarkOnPrimary         = Color(0xFF003731)
val FmbDarkPrimaryContainer  = Color(0xFF005048)
val FmbDarkOnPrimaryContainer = Color(0xFFCCFBF1)
val FmbDarkBackground        = Color(0xFF06201D)
val FmbDarkSurface           = Color(0xFF06201D)
val FmbDarkOnSurface         = Color(0xFFE6F7F4)
val FmbDarkSurfaceVariant    = Color(0xFF0B3B36)
val FmbDarkOnSurfaceVariant  = Color(0xFF9CB5B0)
val FmbDarkOutline           = Color(0xFF577D77)
