// FmbComponents.swift
//
// Reusable visual atoms that repeat across the design handoff:
//   • FmbPrimaryButton  — 52h, 14r, scheme.primary fill, onPrimary text
//   • FmbSecondaryButton — 44h, 12r, surface bg, outline border, onSurface text
//   • FmbBackChip       — 36x36 surface square, 12r, onBackground chevron
//   • FmbSectionLabel   — uppercase 11/600/primary with 0.3 letter-spacing
//   • FmbCard           — surfaceContainerLowest with outline border
//   • FmbLogoMark       — gradient aqua→deep rounded square with shield + 'P'
//   • FmbSandHalo       — radial sand glow used behind the logo
//
// Source: `findMy Bay/Find My Bay.html` design handoff. Light + dark variants
// follow the M3 tokens in `FmbScheme` so views auto-flip with iOS dark mode.

import SwiftUI

// MARK: - Primary CTA

/// 52h flat fill that uses `scheme.primary` (auto-flips light/dark).
struct FmbPrimaryButton: View {
    let title: String
    var icon: String? = nil
    var loading: Bool = false
    var enabled: Bool = true
    var action: () -> Void

    @Environment(\.fmbScheme) private var scheme

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                if loading {
                    ProgressView().tint(scheme.onPrimary)
                } else {
                    Text(title)
                        .font(.system(size: 15, weight: .semibold))
                        .kerning(-0.2)
                        .foregroundStyle(scheme.onPrimary)
                    if let icon {
                        Image(systemName: icon)
                            .font(.system(size: 12, weight: .heavy))
                            .foregroundStyle(scheme.onPrimary)
                    }
                }
            }
            .frame(maxWidth: .infinity)
            .frame(height: 52)
            .background(scheme.primary.opacity(enabled ? 1 : 0.5))
            .clipShape(RoundedRectangle(cornerRadius: 14))
            .shadow(color: scheme.primary.opacity(0.35), radius: 16, x: 0, y: 8)
        }
        .disabled(!enabled || loading)
    }
}

// MARK: - Secondary outlined button

struct FmbSecondaryButton: View {
    let title: String
    var icon: String? = nil
    var action: () -> Void

    @Environment(\.fmbScheme) private var scheme

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                if let icon { Text(icon) }
                Text(title)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(scheme.onSurface)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 44)
            .background(scheme.surface)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .strokeBorder(scheme.outline, lineWidth: 1)
            )
        }
    }
}

// MARK: - Back chip

struct FmbBackChip: View {
    var action: () -> Void
    @Environment(\.fmbScheme) private var scheme

    var body: some View {
        Button(action: action) {
            Image(systemName: "chevron.left")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(scheme.onSurface)
                .frame(width: 36, height: 36)
                .background(scheme.surface)
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .strokeBorder(scheme.outline, lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Back")
    }
}

// MARK: - Section label

struct FmbSectionLabel: View {
    let text: String
    @Environment(\.fmbScheme) private var scheme
    var body: some View {
        Text(text.uppercased())
            .font(.system(size: 11, weight: .semibold))
            .kerning(0.3)
            .foregroundStyle(scheme.primary)
    }
}

// MARK: - Card surface

/// Surfaces the white "card" treatment from the handoff (surface + outline
/// border + 18px corners + a subtle shadow). Wrap any content view to get
/// the consistent look without re-typing the modifiers.
struct FmbCard<Content: View>: View {
    var corner: CGFloat = 18
    var padding: CGFloat = 14
    @ViewBuilder var content: Content

    @Environment(\.fmbScheme) private var scheme

    var body: some View {
        // Standardized 1.5pt primary-aqua outline across every major card —
        // matches the design's ActiveBookingCard treatment and the Android
        // .border(1.5.dp, FmbBlue500, ...) convention. Surface stays on the
        // warm cream-ish container tone; inputs / chips / dividers continue
        // to use the soft mintEdge hairline so visual hierarchy survives.
        content
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(scheme.surfaceContainer)
            .clipShape(RoundedRectangle(cornerRadius: corner))
            .overlay(
                RoundedRectangle(cornerRadius: corner)
                    .strokeBorder(Fmb.aqua, lineWidth: 1.5)
            )
            .shadow(color: Color(red: 0.04, green: 0.23, blue: 0.21).opacity(0.06),
                    radius: 14, x: 0, y: 6)
    }
}

// MARK: - Logo + halo

struct FmbLogoMark: View {
    var size: CGFloat = 68

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: size * 0.3)
                .fill(LinearGradient(
                    colors: [Fmb.aquaBright, Fmb.deep],
                    startPoint: .topLeading, endPoint: .bottomTrailing
                ))
                .frame(width: size, height: size)
                .shadow(color: Fmb.deep.opacity(0.3), radius: 12, x: 0, y: 10)

            // Shield + "P" — pulled from the design SVG.
            ZStack {
                Path { p in
                    p.move(to: CGPoint(x: size * 0.5,  y: size * 0.18))
                    p.addQuadCurve(to: CGPoint(x: size * 0.28, y: size * 0.6),
                                   control: CGPoint(x: size * 0.28, y: size * 0.42))
                    p.addArc(center: CGPoint(x: size * 0.5, y: size * 0.6),
                             radius: size * 0.22, startAngle: .degrees(180),
                             endAngle: .degrees(0), clockwise: false)
                    p.addQuadCurve(to: CGPoint(x: size * 0.5, y: size * 0.18),
                                   control: CGPoint(x: size * 0.72, y: size * 0.42))
                    p.closeSubpath()
                }
                .fill(Color.white)
                Text("P")
                    .font(.system(size: size * 0.28, weight: .heavy, design: .default))
                    .kerning(-1)
                    .foregroundStyle(Fmb.deep)
                    .offset(y: size * 0.10)
            }
            .frame(width: size, height: size)
        }
    }
}

struct FmbSandHalo: View {
    var diameter: CGFloat = 180
    var intensity: Double = 0.45

    var body: some View {
        Circle()
            .fill(
                RadialGradient(
                    colors: [Fmb.sandDeep.opacity(intensity), Fmb.sandDeep.opacity(0)],
                    center: .center, startRadius: 0, endRadius: diameter * 0.5
                )
            )
            .frame(width: diameter, height: diameter)
    }
}

// MARK: - Filter chip

struct FmbFilterChip: View {
    let label: String
    var isOn: Bool
    var action: () -> Void

    @Environment(\.fmbScheme) private var scheme

    var body: some View {
        Button(action: action) {
            Text(label)
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(isOn ? scheme.onPrimary : scheme.onSurface)
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(isOn ? scheme.primary : scheme.surface.opacity(0.92))
                .clipShape(RoundedRectangle(cornerRadius: 10))
                .shadow(color: scheme.onBackground.opacity(0.06), radius: 4, x: 0, y: 2)
        }
    }
}
