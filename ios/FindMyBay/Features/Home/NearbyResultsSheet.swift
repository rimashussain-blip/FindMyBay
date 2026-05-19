// NearbyResultsSheet.swift
//
// Google-Maps-style search-results sheet that sits below the Nearby map.
// Collapses to the headline pick (nearest available studio — or the
// absolute nearest if every bay is busy) and expands on tap into a
// scrollable list of every match.
//
// Visual treatment:
//   • 22-radius rounded panel, 1.5pt aqua outline (matches FmbCard).
//   • Mint→sand gradient header strip (mirrors the active-booking card on
//     My Bookings — keeps the "warm strip up top" pattern consistent).
//   • Drag-handle pill + count + chevron in the header.
//   • `.animation` on the expansion so it grows/collapses smoothly.
//
// Travel-time per row is a quick UAE-city estimate (32 km/h baseline)
// computed locally — the actual Distance Matrix lookup runs server-side
// for the smart-leave alert, we don't burn an API call per row here.
//
// Mirrors Android's `NearbyResultsSheet` from commit 771e9f2.

import SwiftUI

struct NearbyResultsSheet: View {

    let vendors: [Vendor]
    @Binding var expanded: Bool
    var onVendorTap: (Vendor) -> Void = { _ in }

    @Environment(\.fmbScheme) private var scheme

    /// Cap on the expanded panel's height. The list scrolls inside; the
    /// map stays visible. Matches the Android `heightIn(max = 280.dp)`.
    private let maxExpandedHeight: CGFloat = 280

    /// The headline pick when collapsed: prefer a studio with at least one
    /// free bay, else the absolute nearest. Backend returns the list pre-
    /// sorted by distance so scanning front-to-back is fine.
    private var headline: Vendor? {
        vendors.first(where: { $0.freeBays > 0 }) ?? vendors.first
    }

    var body: some View {
        VStack(spacing: 0) {
            header
            if expanded {
                ScrollView {
                    LazyVStack(spacing: 6) {
                        ForEach(vendors, id: \.id) { v in
                            VendorListRow(vendor: v)
                                .contentShape(Rectangle())
                                .onTapGesture { onVendorTap(v) }
                        }
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 4)
                }
                .frame(maxHeight: maxExpandedHeight)
            } else if let h = headline {
                VendorListRow(vendor: h)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 4)
                    .contentShape(Rectangle())
                    .onTapGesture { onVendorTap(h) }
            }
        }
        // Sheet body follows the theme — warm cream surface in light mode,
        // deep teal surface-container in dark. The gradient header strip
        // stays pinned to mint→sand in both (brand-fixed contrast band).
        .background(scheme.surfaceContainer)
        .clipShape(RoundedRectangle(cornerRadius: 22))
        .overlay(
            RoundedRectangle(cornerRadius: 22)
                .strokeBorder(Fmb.aqua, lineWidth: 1.5)
        )
        .animation(.easeInOut(duration: 0.22), value: expanded)
    }

    // MARK: - Header strip

    private var header: some View {
        VStack(spacing: 0) {
            // Drag-handle pill — pure decoration; the whole header is tappable.
            Capsule()
                .fill(Fmb.mintEdge)
                .frame(width: 36, height: 4)
                .padding(.top, 8)

            HStack(spacing: 4) {
                Text("\(vendors.count) \(vendors.count == 1 ? "studio" : "studios") near you")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(Fmb.deep)
                Spacer()
                Text(expanded ? "Tap to collapse" : "Tap to view all")
                    .font(.system(size: 10, weight: .medium))
                    .foregroundStyle(Fmb.neutral700)
                Image(systemName: expanded ? "chevron.up" : "chevron.down")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Fmb.neutral700)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 8)
        }
        .frame(maxWidth: .infinity)
        .background(
            LinearGradient(
                colors: [Fmb.mint, Fmb.sand],
                startPoint: .leading, endPoint: .trailing
            )
        )
        .contentShape(Rectangle())
        .onTapGesture { expanded.toggle() }
    }
}

// MARK: - Row

/// Single vendor row inside the results sheet. Compact treatment —
/// 44px logo, name + rating on top, city/distance/travel-time middle,
/// "N free now" pill + price bottom. Tap is handled by the host so the
/// row stays a pure presentational view.
struct VendorListRow: View {

    let vendor: Vendor

    @Environment(\.fmbScheme) private var scheme

    var body: some View {
        HStack(spacing: 10) {
            FmbVendorLogo(
                logoUrl: vendor.logoUrl,
                brandName: vendor.brandName,
                size: 44,
                corner: 12
            )
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(vendor.brandName)
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(scheme.onSurface)
                        .lineLimit(1)
                    if let rating = vendor.rating {
                        Text("★")
                            .font(.system(size: 10))
                            .foregroundStyle(Fmb.amber500)
                        Text(String(format: "%.1f", rating))
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundStyle(scheme.onSurfaceVariant)
                    }
                }
                Text(suffixLine)
                    .font(.system(size: 11))
                    .foregroundStyle(scheme.onSurfaceVariant)
                    .lineLimit(1)
                HStack(spacing: 6) {
                    // The "free now" pill stays mint→deep in both modes —
                    // a brand-fixed positive signal. Mint contrasts well
                    // against both light and dark sheet bodies.
                    Text("\(vendor.freeBays) free now")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundStyle(Fmb.deep)
                        .padding(.horizontal, 7)
                        .padding(.vertical, 2)
                        .background(Fmb.mint)
                        .clipShape(RoundedRectangle(cornerRadius: 6))
                    if let p = vendor.priceFromAed {
                        Text("from AED \(p)")
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundStyle(scheme.onSurface)
                    }
                }
                .padding(.top, 3)
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 10)
        // Row sits ONE elevation step above the sheet body so it reads as
        // a tappable tile. In light mode the difference between sheet
        // (`surfaceContainer` cream) and row (`surfaceContainerHigh` sand-
        // tint) is subtle; in dark mode it's a clear step from deep-teal
        // panel up to a slightly brighter card.
        .background(scheme.surfaceContainerHigh)
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }

    /// "City · 1.4 km · ~3 min". The travel-time tail is dropped if the
    /// distance is too small to be meaningful ("standing on top of it").
    private var suffixLine: String {
        let km = vendor.distanceMeters / 1000.0
        let kmStr = String(format: "%.1f km", km)
        let travel = Self.estimateTravelMinutes(meters: vendor.distanceMeters)
        return "\(vendor.city) · \(kmStr) · \(travel)"
    }

    /// Quick travel-time estimate. UAE-city average ≈ 32 km/h (signals,
    /// school zones, summer-afternoon traffic). Good enough for "is this
    /// worth driving to?" at a glance — not a routing decision.
    static func estimateTravelMinutes(meters: Double) -> String {
        let minutes = Int((meters / 1000.0 / 32.0 * 60.0).rounded())
        if minutes < 1 { return "<1 min" }
        if minutes < 60 { return "~\(minutes) min" }
        let hours = minutes / 60
        let rem = minutes % 60
        return "~\(hours)h \(rem)m"
    }
}
