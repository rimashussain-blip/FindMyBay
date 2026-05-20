// FmbPromoCodeBlock.swift
//
// "Have a promo code?" accordion that sits above the Confirm CTA on the
// slot picker. Single text input, auto-uppercased, no Apply button —
// validation happens server-side when the user taps Confirm and the
// backend rejects with a `promo_*` error code (surfaced by the caller
// via `APIError.userMessage`).
//
// When collapsed AND a code has been typed, the chip label flips to
// `"Promo: WELCOME10"` so the user knows it's still in play.
//
// Mirrors Android's PromoCodeBlock from feature/booking/SlotPickerScreen.kt.

import SwiftUI

struct FmbPromoCodeBlock: View {

    @Binding var code: String
    @Binding var expanded: Bool

    @Environment(\.fmbScheme) private var scheme
    @FocusState private var fieldFocused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header row — always visible, tap to toggle.
            Button {
                withAnimation(.easeInOut(duration: 0.22)) {
                    expanded.toggle()
                    if !expanded { fieldFocused = false }
                }
            } label: {
                HStack(spacing: 10) {
                    Image(systemName: "tag.fill")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Fmb.deep)
                    Text(label)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(scheme.onSurface)
                        .lineLimit(1)
                    Spacer()
                    Image(systemName: expanded ? "chevron.up" : "chevron.down")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(Fmb.neutral700)
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 12)
            }
            .buttonStyle(.plain)

            if expanded {
                VStack(alignment: .leading, spacing: 6) {
                    TextField("WELCOME10", text: $code)
                        .focused($fieldFocused)
                        .submitLabel(.done)
                        .onSubmit { fieldFocused = false }
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.characters)
                        .font(.system(size: 14, weight: .semibold, design: .monospaced))
                        .foregroundStyle(scheme.onSurface)
                        .tint(scheme.primary)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 10)
                        .background(scheme.surfaceContainerLow)
                        .overlay(
                            RoundedRectangle(cornerRadius: 10)
                                .strokeBorder(Fmb.aqua.opacity(0.6), lineWidth: 1)
                        )
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                        .onChange(of: code) { _, new in
                            // Backend uppercases on receipt anyway, but
                            // doing it locally keeps the label in sync
                            // when the field is collapsed.
                            let upper = new.uppercased()
                            if upper != code { code = upper }
                        }

                    Text("Codes are checked when you tap Confirm.")
                        .font(.system(size: 11))
                        .foregroundStyle(Fmb.neutral700)
                }
                .padding(.horizontal, 14)
                .padding(.bottom, 12)
            }
        }
        .background(scheme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                // Soft mintEdge hairline, NOT the 1.5pt aqua of FmbCard.
                // The Android handover commit explicitly carved this
                // exception out — "inputs / chips / dividers stay on the
                // soft mint-edge hairline so hierarchy survives".
                .strokeBorder(Fmb.mintEdge, lineWidth: 1)
        )
    }

    /// "Promo: WELCOME10" when collapsed with a value, otherwise the
    /// generic CTA copy.
    private var label: String {
        let trimmed = code.trimmingCharacters(in: .whitespaces)
        if !trimmed.isEmpty && !expanded {
            return "Promo: \(trimmed)"
        }
        return "Have a promo code?"
    }
}

#Preview("Collapsed empty") {
    StatefulPreview(initialCode: "", initialExpanded: false)
        .padding(16)
        .fmbTheme()
}

#Preview("Collapsed with value") {
    StatefulPreview(initialCode: "WELCOME10", initialExpanded: false)
        .padding(16)
        .fmbTheme()
}

#Preview("Expanded") {
    StatefulPreview(initialCode: "", initialExpanded: true)
        .padding(16)
        .fmbTheme()
}

private struct StatefulPreview: View {
    @State var code: String
    @State var expanded: Bool
    init(initialCode: String, initialExpanded: Bool) {
        _code = State(initialValue: initialCode)
        _expanded = State(initialValue: initialExpanded)
    }
    var body: some View {
        FmbPromoCodeBlock(code: $code, expanded: $expanded)
    }
}
