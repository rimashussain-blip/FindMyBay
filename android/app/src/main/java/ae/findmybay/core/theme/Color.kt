package ae.findmybay.core.theme

import androidx.compose.ui.graphics.Color

// ───────────────────────────────────────────────────────────────────────────
// Find My Bay — Material 3 token palette
// Source: design_handoff_find_my_bay (v2 Android handoff) — android-tokens.json
//
// Names kept as `FmbBlue*` for source-compat with existing screens. The M3
// ColorScheme is wired in Theme.kt.
// ───────────────────────────────────────────────────────────────────────────

// ─── Primary teal ramp (M3 ref.palette.primary) ───────────────────────────
val FmbBlue900 = Color(0xFF00201C) // primary 10 — onPrimaryContainer
val FmbBlue700 = Color(0xFF0F766E) // primary 40 — primary-deep, secondary
val FmbBlue500 = Color(0xFF14B8A6) // primary 50 — PRIMARY brand color
val FmbBlue300 = Color(0xFF2DD4BF) // primary 60 — accent gradient stop
val FmbBlue100 = Color(0xFFCCFBF1) // primary 90 — primaryContainer
val FmbMint    = Color(0xFFE6F7F4) // surfaceVariant — surface tint
val FmbMintEdge = Color(0xFFCDEEE8) // outline

// ─── Warm secondary (sand) ─────────────────────────────────────────────────
val FmbSand     = Color(0xFFFCE7C8) // secondary 90 — secondaryContainer
val FmbSandDeep = Color(0xFFF5C77E) // secondary 70 — sand-deep CTA
val FmbAmber500 = Color(0xFFF5C77E) // alias to sand-deep for source-compat
val FmbCream    = Color(0xFFFFF7EC) // background — warm welcoming surface

// ─── Tertiary coral ───────────────────────────────────────────────────────
val FmbCoral     = Color(0xFFFF8B6B) // tertiary 60 — busy / destructive
val FmbCoralSoft = Color(0xFFFFE3D9) // tertiary 90 — coral-soft chip
val FmbRed500    = Color(0xFFFF8B6B) // alias for source-compat

// ─── Status (M3 success uses primary; we keep these for explicit semantics) ─
val FmbGreen500 = Color(0xFF14B8A6) // "free" — primary

// ─── Neutral ramp ─────────────────────────────────────────────────────────
val FmbNeutral900 = Color(0xFF0B3B36) // ink — onBackground / onSurface
val FmbNeutral700 = Color(0xFF3F6B65) // ink-soft — onSurfaceVariant
val FmbNeutral500 = Color(0xFF7A9893)
val FmbNeutral300 = Color(0xFFCDEEE8) // outline
val FmbNeutral100 = Color(0xFFF4FAF7)
val FmbNeutral50  = Color(0xFFFFF7EC) // background == cream

// ───────────────────────────────────────────────────────────────────────────
// Named palette aliases that match the design-handoff swatches verbatim:
//   Aqua · Deep · Cream · Sand · Amber · Coral · Mint · Ink
// Use these inside screen code so intent reads at a glance.
// ───────────────────────────────────────────────────────────────────────────
val FmbAqua  = FmbBlue500           // #14B8A6 — bright aqua / primary
val FmbAquaBright = FmbBlue300      // #2DD4BF — lighter accent stop
val FmbDeep  = FmbBlue700           // #0F766E — deep teal
val FmbCream2 = FmbCream            // #FFF7EC — warm welcoming surface (alias)
val FmbSand2  = FmbSand             // #FCE7C8 — sand chip / glow
val FmbAmber  = FmbSandDeep         // #F5C77E — amber CTA
val FmbCoral2 = FmbCoral            // #FF8B6B — coral accent
val FmbMint2  = FmbMint             // #E6F7F4 — mint surface tint
val FmbInk    = FmbNeutral900       // #0B3B36 — deep ink

// ─── Dark mode tokens (sys.color.dark) ────────────────────────────────────
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
