// FmbTheme.swift
//
// Find My Bay — Material 3 ColorScheme equivalent for SwiftUI.
// Source: core/theme/Theme.kt — parity with the Android `lightColorScheme` / `darkColorScheme`.
//
// SwiftUI doesn't have a true equivalent of M3's `ColorScheme`. We expose the
// same semantic role names through `FmbScheme.current(for:)` which returns the
// right palette for the current `ColorScheme` (`.light` or `.dark`).

import SwiftUI

/// Semantic Material 3 color roles, ported 1:1 from Theme.kt.
struct FmbScheme {
    let primary: Color
    let onPrimary: Color
    let primaryContainer: Color
    let onPrimaryContainer: Color

    let secondary: Color
    let onSecondary: Color
    let secondaryContainer: Color
    let onSecondaryContainer: Color

    let tertiary: Color
    let onTertiary: Color
    let tertiaryContainer: Color
    let onTertiaryContainer: Color

    let error: Color
    let onError: Color
    let errorContainer: Color
    let onErrorContainer: Color

    let background: Color
    let onBackground: Color

    let surface: Color
    let onSurface: Color
    let surfaceVariant: Color
    let onSurfaceVariant: Color

    // Elevation tiers — M3 surfaceContainer ramp. We use these for cards that
    // sit "above" the page so they stay visibly separated from the bg in dark
    // mode (where `surface` == `background`). Light values are warm off-white,
    // dark values climb a teal staircase from #021614 → #1F4641.
    let surfaceContainerLowest: Color
    let surfaceContainerLow: Color
    let surfaceContainer: Color
    let surfaceContainerHigh: Color
    let surfaceContainerHighest: Color

    let outline: Color
    let outlineVariant: Color

    static let light = FmbScheme(
        primary:              Color(hex: 0x14B8A6),
        onPrimary:            .white,
        primaryContainer:     Color(hex: 0xCCFBF1),
        onPrimaryContainer:   Color(hex: 0x00201C),
        secondary:            Color(hex: 0x7A5732),
        onSecondary:          .white,
        secondaryContainer:   Color(hex: 0xFCE7C8),
        onSecondaryContainer: Color(hex: 0x2A1A05),
        tertiary:             Color(hex: 0xFF8B6B),
        onTertiary:           .white,
        tertiaryContainer:    Color(hex: 0xFFE3D9),
        onTertiaryContainer:  Color(hex: 0x3A0F00),
        error:                Color(hex: 0xBA1A1A),
        onError:              .white,
        errorContainer:       Color(hex: 0xFFDAD6),
        onErrorContainer:     Color(hex: 0x410002),
        background:           Color(hex: 0xFFF7EC),
        onBackground:         Color(hex: 0x0B3B36),
        surface:              Color(hex: 0xFFF7EC),
        onSurface:            Color(hex: 0x0B3B36),
        surfaceVariant:       Color(hex: 0xE6F7F4),
        onSurfaceVariant:     Color(hex: 0x3F6B65),
        surfaceContainerLowest:  Color(hex: 0xFFFFFF),
        surfaceContainerLow:     Color(hex: 0xFFFBF3),
        surfaceContainer:        Color(hex: 0xF4F1E5),
        surfaceContainerHigh:    Color(hex: 0xEBE7DC),
        surfaceContainerHighest: Color(hex: 0xE1DDD2),
        outline:              Color(hex: 0xCDEEE8),
        outlineVariant:       Color(hex: 0xDBE7E4)
    )

    static let dark = FmbScheme(
        primary:              Color(hex: 0x5EEAD4),
        onPrimary:            Color(hex: 0x003731),
        primaryContainer:     Color(hex: 0x005048),
        onPrimaryContainer:   Color(hex: 0xCCFBF1),
        secondary:            Color(hex: 0xF5C77E),
        onSecondary:          Color(hex: 0x412A0E),
        secondaryContainer:   Color(hex: 0x5C3F1F),
        onSecondaryContainer: Color(hex: 0xFCE7C8),
        tertiary:             Color(hex: 0xFFC2AC),
        onTertiary:           Color(hex: 0x5C1C0A),
        tertiaryContainer:    Color(hex: 0x7E2D17),
        onTertiaryContainer:  Color(hex: 0xFFE3D9),
        error:                Color(hex: 0xFFB4AB),
        onError:              Color(hex: 0x690005),
        errorContainer:       Color(hex: 0x93000A),
        onErrorContainer:     Color(hex: 0xFFDAD6),
        background:           Color(hex: 0x06201D),
        onBackground:         Color(hex: 0xE6F7F4),
        surface:              Color(hex: 0x06201D),
        onSurface:            Color(hex: 0xE6F7F4),
        surfaceVariant:       Color(hex: 0x0B3B36),
        onSurfaceVariant:     Color(hex: 0x9CB5B0),
        surfaceContainerLowest:  Color(hex: 0x021614),
        surfaceContainerLow:     Color(hex: 0x0B2926),
        surfaceContainer:        Color(hex: 0x0F302C),
        surfaceContainerHigh:    Color(hex: 0x163B36),
        surfaceContainerHighest: Color(hex: 0x1F4641),
        outline:              Color(hex: 0x577D77),
        outlineVariant:       Color(hex: 0x1F4E48)
    )

    /// Pick the right scheme for the current SwiftUI environment.
    static func current(for scheme: ColorScheme) -> FmbScheme {
        scheme == .dark ? .dark : .light
    }
}

// MARK: - Environment plumbing

private struct FmbSchemeKey: EnvironmentKey {
    static let defaultValue: FmbScheme = .light
}

extension EnvironmentValues {
    /// The active Material-3-equivalent color scheme. Read inside any view via
    /// `@Environment(\.fmbScheme) var scheme`.
    var fmbScheme: FmbScheme {
        get { self[FmbSchemeKey.self] }
        set { self[FmbSchemeKey.self] = newValue }
    }
}

/// View modifier that picks the right palette for the current colorScheme and
/// pushes it down via `EnvironmentValues.fmbScheme`. Apply once at the root.
struct FindMyBayTheme: ViewModifier {
    @Environment(\.colorScheme) private var colorScheme

    func body(content: Content) -> some View {
        content
            .environment(\.fmbScheme, FmbScheme.current(for: colorScheme))
            .tint(FmbScheme.current(for: colorScheme).primary)
    }
}

extension View {
    /// Apply the FindMyBay design system. Wrap your root view in this once.
    func fmbTheme() -> some View { modifier(FindMyBayTheme()) }
}
