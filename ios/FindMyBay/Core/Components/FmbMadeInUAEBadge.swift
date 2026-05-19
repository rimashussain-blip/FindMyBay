// FmbMadeInUAEBadge.swift
//
// Compact "MADE IN U.A.E" brand badge with the UAE flag panel on the right.
// Pulled from the Android design handoff — same hex values, same proportions.
//
// Visual structure:
//   ┌────────────────────────────────────┐
//   │  MADE IN          ┌──┬──────────┐   │
//   │  U.A.E            │  │ green    │   │
//   │  (block letters)  │R │──────────│   │
//   │                   │  │ white    │   │
//   │                   │  │──────────│   │
//   │                   │  │ black    │   │
//   │                   └──┴──────────┘   │
//   └────────────────────────────────────┘
//
// Always rendered on a black bg — the bg colour is intentionally non-theme
// so the badge reads as an immutable "made in" stamp regardless of light /
// dark mode.

import SwiftUI

struct FmbMadeInUAEBadge: View {
    var body: some View {
        HStack(spacing: 10) {
            VStack(alignment: .leading, spacing: -1) {
                Text("MADE IN")
                    .font(.system(size: 8, weight: .semibold))
                    .kerning(1.2)
                    .foregroundStyle(Color.white.opacity(0.75))
                Text("U.A.E")
                    .font(.system(size: 18, weight: .black))
                    .kerning(1.0)
                    .foregroundStyle(.white)
            }
            uaeFlag
        }
        .padding(.horizontal, 12).padding(.vertical, 7)
        .background(Color.black)
        .clipShape(RoundedRectangle(cornerRadius: 5))
        .overlay(
            RoundedRectangle(cornerRadius: 5)
                .strokeBorder(Color.black.opacity(0.1), lineWidth: 1)
        )
    }

    /// 12pt-wide red bar + 28pt-wide tri-stripe (green/white/black).
    private var uaeFlag: some View {
        HStack(spacing: 0) {
            // Vertical red bar
            Rectangle()
                .fill(Color(hex: 0xCE1126))
                .frame(width: 12)
            VStack(spacing: 0) {
                Rectangle().fill(Color(hex: 0x00732F))   // green
                Rectangle().fill(Color.white)             // white
                Rectangle().fill(Color.black)             // black
            }
            .frame(width: 28)
        }
        .frame(height: 30)
        .clipShape(RoundedRectangle(cornerRadius: 2))
    }
}
