// FmbVendorLogo.swift
//
// Vendor logo tile with graceful fallback.
//
// Behaviour:
//   1. logoUrl present + image loads → show the image, aspect-fit on a white
//      pad so coloured logos read against any background.
//   2. logoUrl absent OR load fails → show the first letter of brandName on
//      the mint→sand gradient (matches the Android fallback).
//
// Replaces the placeholder `Text("🚿")` glyph we shipped in 0.1.0, which
// renders as a paper-plane glyph on devices without the right emoji table.

import SwiftUI

struct FmbVendorLogo: View {

    /// Optional remote URL. nil/empty → fallback to the initial.
    let logoUrl: String?
    /// Used for the fallback "initial" badge and for accessibility labels.
    let brandName: String
    /// Outer tile size (square). Default sized for the peek/booking cards.
    var size: CGFloat = 48
    /// Outer corner radius — matches `FmbCard` corners so we tile nicely.
    var corner: CGFloat = 14

    var body: some View {
        ZStack {
            // Brand-fixed gradient so the tile reads on both light and
            // dark surfaces. Same hues the Android cards use.
            RoundedRectangle(cornerRadius: corner)
                .fill(LinearGradient(
                    colors: [Fmb.mint, Fmb.sand],
                    startPoint: .topLeading, endPoint: .bottomTrailing
                ))

            content
        }
        .frame(width: size, height: size)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(brandName)
    }

    @ViewBuilder
    private var content: some View {
        if let urlString = logoUrl,
           !urlString.isEmpty,
           let url = URL(string: urlString) {
            AsyncImage(url: url) { phase in
                switch phase {
                case .success(let img):
                    img
                        .resizable()
                        .scaledToFit()
                        .padding(size * 0.12)          // breathing room
                case .empty:
                    // While loading — show the initial dimmed so a missed
                    // load doesn't flash a different visual.
                    initialBadge.opacity(0.6)
                case .failure:
                    initialBadge
                @unknown default:
                    initialBadge
                }
            }
        } else {
            initialBadge
        }
    }

    private var initialBadge: some View {
        Text(initial)
            .font(.system(size: size * 0.42, weight: .heavy, design: .rounded))
            .foregroundStyle(Fmb.deep)
    }

    /// First letter of `brandName`, uppercased. `"Euro Car Wash"` → `"E"`.
    /// Falls back to `"?"` if the brand has only whitespace.
    private var initial: String {
        let trimmed = brandName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let first = trimmed.first else { return "?" }
        return String(first).uppercased()
    }
}

#Preview {
    HStack(spacing: 12) {
        FmbVendorLogo(logoUrl: nil, brandName: "Euro Car Wash")
        FmbVendorLogo(logoUrl: "https://invalid.test/missing.png",
                      brandName: "Sparkle")
        FmbVendorLogo(logoUrl: nil, brandName: "Quick Wash", size: 38, corner: 10)
    }
    .padding()
    .fmbTheme()
}
