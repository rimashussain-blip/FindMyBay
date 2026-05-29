// FmbTypography.swift
//
// Find My Bay — Material 3 type scale ported to SwiftUI.
// Source: android-tokens.json sys.typescale (parity with core/theme/Type.kt).
//
// SwiftUI doesn't have a Typography record like M3 does, so we expose each
// scale step as a static `Font` that screens can apply via `.font(Fmb.Typo.titleLarge)`.

import SwiftUI

extension Fmb {
    /// Material 3 type scale for the FindMyBay app, mapped to SwiftUI Font.
    /// We use the system font (San Francisco) — the equivalent of FontFamily.Default
    /// on Android, which uses Roboto. Both are the platform's default sans-serif.
    ///
    /// Named `Typo` (not `Type`) because `Type` is a Swift metatype keyword.
    enum Typo {
        static let displayLarge   = Font.system(size: 57, weight: .regular)
        static let displayMedium  = Font.system(size: 45, weight: .regular)
        static let displaySmall   = Font.system(size: 36, weight: .regular)

        static let headlineLarge  = Font.system(size: 32, weight: .regular)
        static let headlineMedium = Font.system(size: 28, weight: .regular)
        static let headlineSmall  = Font.system(size: 24, weight: .medium)

        static let titleLarge     = Font.system(size: 22, weight: .medium)
        static let titleMedium    = Font.system(size: 16, weight: .medium)
        static let titleSmall     = Font.system(size: 14, weight: .medium)

        static let bodyLarge      = Font.system(size: 16, weight: .regular)
        static let bodyMedium     = Font.system(size: 14, weight: .regular)
        static let bodySmall      = Font.system(size: 12, weight: .regular)

        static let labelLarge     = Font.system(size: 14, weight: .medium)
        static let labelMedium    = Font.system(size: 12, weight: .medium)
        static let labelSmall     = Font.system(size: 11, weight: .medium)
    }
}
