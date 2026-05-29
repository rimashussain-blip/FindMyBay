// FmbColors.swift
//
// Find My Bay — design-token palette for SwiftUI.
// Source: android-tokens.json (parity with android/.../core/theme/Color.kt).
//
// Names mirror the Kotlin tokens (FmbBlue500, FmbCoral, FmbInk, etc.) so
// screen code reads the same on both platforms.

import SwiftUI

extension Color {
    /// Construct a SwiftUI `Color` from a 0xRRGGBB hex literal.
    init(hex: UInt32, opacity: Double = 1.0) {
        let r = Double((hex >> 16) & 0xFF) / 255.0
        let g = Double((hex >>  8) & 0xFF) / 255.0
        let b = Double( hex        & 0xFF) / 255.0
        self.init(.sRGB, red: r, green: g, blue: b, opacity: opacity)
    }
}

/// Static brand swatches used by SwiftUI screens.
///
/// These intentionally match the Kotlin token names. M3 semantic roles
/// (primary / surface / etc.) live on `FmbScheme` — these are the raw
/// brand colors a screen reaches for when it wants "the aqua" specifically.
enum Fmb {
    // MARK: - Primary teal ramp
    static let blue900 = Color(hex: 0x00201C) // primary 10 — onPrimaryContainer
    static let blue700 = Color(hex: 0x0F766E) // primary 40 — primary-deep
    static let blue500 = Color(hex: 0x14B8A6) // primary 50 — PRIMARY brand color
    static let blue300 = Color(hex: 0x2DD4BF) // primary 60 — accent gradient stop
    static let blue100 = Color(hex: 0xCCFBF1) // primary 90 — primaryContainer
    static let mint    = Color(hex: 0xE6F7F4) // surfaceVariant
    static let mintEdge = Color(hex: 0xCDEEE8) // outline

    // MARK: - Warm secondary (sand)
    static let sand     = Color(hex: 0xFCE7C8) // secondaryContainer
    static let sandDeep = Color(hex: 0xF5C77E) // sand-deep CTA
    static let amber500 = Color(hex: 0xF5C77E) // alias
    static let cream    = Color(hex: 0xFFF7EC) // background

    // MARK: - Tertiary coral
    static let coral     = Color(hex: 0xFF8B6B) // busy / destructive
    static let coralSoft = Color(hex: 0xFFE3D9)
    static let red500    = Color(hex: 0xFF8B6B) // alias

    // MARK: - Status (M3 success uses primary)
    static let green500 = Color(hex: 0x14B8A6) // "free" — primary

    // MARK: - Neutral ramp
    static let neutral900 = Color(hex: 0x0B3B36) // onBackground / onSurface
    static let neutral700 = Color(hex: 0x3F6B65) // onSurfaceVariant
    static let neutral500 = Color(hex: 0x7A9893)
    static let neutral300 = Color(hex: 0xCDEEE8) // outline
    static let neutral100 = Color(hex: 0xF4FAF7)
    static let neutral50  = Color(hex: 0xFFF7EC) // background

    // MARK: - Named handoff aliases — Aqua · Deep · Cream · Sand · Amber · Coral · Mint · Ink
    static let aqua       = blue500       // #14B8A6
    static let aquaBright = blue300       // #2DD4BF
    static let deep       = blue700       // #0F766E
    static let ink        = neutral900    // #0B3B36

    // MARK: - Dark mode tokens (sys.color.dark)
    enum Dark {
        static let primary             = Color(hex: 0x5EEAD4)
        static let onPrimary           = Color(hex: 0x003731)
        static let primaryContainer    = Color(hex: 0x005048)
        static let onPrimaryContainer  = Color(hex: 0xCCFBF1)
        static let background          = Color(hex: 0x06201D)
        static let surface             = Color(hex: 0x06201D)
        static let onSurface           = Color(hex: 0xE6F7F4)
        static let surfaceVariant      = Color(hex: 0x0B3B36)
        static let onSurfaceVariant    = Color(hex: 0x9CB5B0)
        static let outline             = Color(hex: 0x577D77)
    }
}

// MARK: - Color sugar — leading-dot syntax for the named handoff swatches
//
// Lets views write `.aqua` / `.deep` / `.sand` etc. wherever a `Color` is
// expected, mirroring the way the Android code uses `FmbAqua` / `FmbDeep`
// directly without a namespace prefix.
extension Color {
    static let fmbAqua       = Fmb.aqua
    static let fmbAquaBright = Fmb.aquaBright
    static let fmbDeep       = Fmb.deep
    static let fmbCream      = Fmb.cream
    static let fmbSand       = Fmb.sand
    static let fmbSandDeep   = Fmb.sandDeep
    static let fmbAmber      = Fmb.amber500
    static let fmbCoral      = Fmb.coral
    static let fmbCoralSoft  = Fmb.coralSoft
    static let fmbMint       = Fmb.mint
    static let fmbInk        = Fmb.ink
}

