// NearbyMapView.swift
//
// Home/map. Mirrors design handoff screen #3:
//   • Greeting line + "Nearby car washes" headline + refresh chip
//   • Map fills the rest with rounded 24px corners + 16px side padding
//   • Glassy search bar floats over the map (white 92% opacity, blur)
//   • Filter chips below it (active = ink/white, others = white/ink)
//   • Bottom NearbyResultsSheet — collapsible list of every match.
//     Collapsed by default to the nearest available studio (or the
//     nearest overall if every bay is busy); tapping the mint→sand
//     header strip expands into a scrollable list. Mirrors Google
//     Maps' search-results sheet and the Android counterpart.

import SwiftUI
import CoreLocation

struct NearbyMapView: View {

    @Environment(\.fmbScheme) private var scheme
    @Environment(\.appEnvironment) private var env
    @Environment(\.colorScheme) private var colorScheme
    @State private var vm: NearbyViewModel?
    @State private var resultsExpanded: Bool = false
    var onVendorTap: (Vendor) -> Void = { _ in }

    var body: some View {
        Group {
            if let vm {
                content(vm: vm)
            } else {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(scheme.background)
            }
        }
        .onAppear {
            if vm == nil {
                let new = NearbyViewModel(repo: env.vendorRepo)
                vm = new
                new.bootstrap()
            }
        }
        .navigationBarHidden(true)
    }

    @ViewBuilder
    private func content(vm: NearbyViewModel) -> some View {
        ZStack(alignment: .top) {
            scheme.background.ignoresSafeArea()

            VStack(spacing: 12) {
                header(vm: vm)
                mapWithOverlays(vm: vm)
                resultsArea(vm: vm)
            }
            .padding(.top, 8)
            .padding(.bottom, 12)
        }
    }

    // MARK: - Results area

    @ViewBuilder
    private func resultsArea(vm: NearbyViewModel) -> some View {
        let visible = vm.filteredVendors
        if !visible.isEmpty {
            NearbyResultsSheet(
                vendors: visible,
                expanded: $resultsExpanded,
                onVendorTap: onVendorTap
            )
            .padding(.horizontal, 16)
        } else if !vm.vendors.isEmpty {
            // Vendors loaded, but every match was filtered out. Show a
            // hint card so the empty space doesn't feel like a bug.
            FmbCard(corner: 18, padding: 14) {
                Text("No studios match these filters. Try clearing one.")
                    .font(.system(size: 11))
                    .foregroundStyle(Fmb.neutral700)
            }
            .padding(.horizontal, 16)
        }
    }

    // MARK: - Header

    private func header(vm: NearbyViewModel) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("\(greetingPrefix()) ☀️")
                .font(.system(size: 12))
                .foregroundStyle(scheme.onSurfaceVariant)
            HStack {
                Text("Nearby car washes")
                    .font(.system(size: 22, weight: .bold))
                    .kerning(-0.4)
                    .foregroundStyle(scheme.onBackground)
                Spacer()
                Button { vm.refresh() } label: {
                    Image(systemName: "arrow.clockwise")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Fmb.deep)
                        .frame(width: 36, height: 36)
                        .background(scheme.surfaceVariant)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                }
            }
        }
        .padding(.horizontal, 24)
    }

    // MARK: - Map + overlays

    @ViewBuilder
    private func mapWithOverlays(vm: NearbyViewModel) -> some View {
        ZStack(alignment: .top) {
            mapLayer(vm: vm)
                .clipShape(RoundedRectangle(cornerRadius: 24))
                .padding(.horizontal, 16)

            VStack(spacing: 8) {
                searchBar(vm: vm)
                filterChips(vm: vm)
                if let err = vm.error {
                    errorBanner(err).padding(.top, 4)
                }
                Spacer()
            }
            .padding(.horizontal, 30) // 16 + 14 to inset overlays slightly within the map card
            .padding(.top, 14)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    @ViewBuilder
    private func mapLayer(vm: NearbyViewModel) -> some View {
        if GoogleMapsService.isConfigured {
            GoogleMapView(
                cameraTarget: vm.lat.flatMap { lat in
                    vm.lng.map { lng in CLLocationCoordinate2D(latitude: lat, longitude: lng) }
                },
                vendors: vm.filteredVendors,
                colorScheme: colorScheme,
                onVendorTap: onVendorTap
            )
            // 1.5px mintEdge frame around the map so it reads as a card —
            // matches the Android `Modifier.border(1.5.dp, FmbMintEdge, …)`.
            .overlay(
                RoundedRectangle(cornerRadius: 24)
                    .strokeBorder(scheme.outline, lineWidth: 1.5)
            )
        } else {
            mapPlaceholder
        }
    }

    private var mapPlaceholder: some View {
        ZStack {
            LinearGradient(
                colors: [scheme.surfaceVariant, scheme.background, scheme.surfaceVariant],
                startPoint: .topLeading, endPoint: .bottomTrailing
            )
            VStack(spacing: 6) {
                Image(systemName: "map")
                    .font(.system(size: 40))
                    .foregroundStyle(Fmb.deep)
                Text("Map disabled — set GOOGLE_MAPS_API_KEY in project.yml.")
                    .font(.system(size: 12))
                    .foregroundStyle(scheme.onSurfaceVariant)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 32)
            }
        }
    }

    // MARK: - Search bar

    private func searchBar(vm: NearbyViewModel) -> some View {
        // The search bar floats over the map. The map can be either light
        // (warm cream tiles) or dark (deep teal tiles), so we pick a high-
        // elevation surface tone in each mode that reads clearly against
        // both. Foreground text uses on-surface so it always contrasts.
        HStack(spacing: 10) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(scheme.onSurface.opacity(0.55))
            TextField("Search by area or vendor", text: Binding(
                get: { vm.searchQuery },
                set: { vm.setSearchQuery($0) }
            ))
            .font(.system(size: 13))
            .foregroundStyle(scheme.onSurface)
            .tint(scheme.primary)
            if !vm.searchQuery.isEmpty {
                Button { vm.setSearchQuery("") } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(scheme.onSurface.opacity(0.5))
                }
            }
        }
        .padding(.horizontal, 14).padding(.vertical, 10)
        .background(searchBarSurface, in: RoundedRectangle(cornerRadius: 14))
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .strokeBorder(scheme.outline.opacity(0.5), lineWidth: 0.5)
        )
        .shadow(color: scheme.onBackground.opacity(0.18), radius: 14, x: 0, y: 4)
    }

    /// Picks a near-opaque surface tone that reads clearly against the map.
    /// Light mode → almost-white; dark mode → an elevated dark-teal panel.
    private var searchBarSurface: Color {
        // colorScheme is already in scope on this view.
        colorScheme == .dark
            ? Color(hex: 0x163B36).opacity(0.94)   // surfaceContainerHigh
            : Color.white.opacity(0.94)
    }

    // MARK: - Filter chips

    private func filterChips(vm: NearbyViewModel) -> some View {
        HStack(spacing: 6) {
            FmbFilterChip(label: "Free now", isOn: vm.freeNowOnly) { vm.toggleFreeNow() }
            FmbFilterChip(label: "Under AED 40", isOn: vm.under40Only) { vm.toggleUnder40() }
            FmbFilterChip(label: "Open late", isOn: false) { /* placeholder filter */ }
            Spacer()
        }
    }

    private func errorBanner(_ msg: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(Fmb.coral)
            // Pinned to brand-dark: the pill behind us is fixed white-92,
            // so a theme-aware text color would flip to cream in dark mode
            // and disappear. Same fix as the VendorDetail back button.
            Text(msg)
                .font(.system(size: 11))
                .foregroundStyle(Fmb.ink)
                .lineLimit(2)
            Spacer()
        }
        .padding(10)
        .background(Color.white.opacity(0.92))
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }

    /// "Good morning" / "Good afternoon" / "Good evening" depending on hour.
    /// Matches the Android string verbatim; the sun emoji is the suffix.
    private func greetingPrefix() -> String {
        let hour = Calendar.current.component(.hour, from: Date())
        switch hour {
        case 5..<12:  return "Good morning"
        case 12..<17: return "Good afternoon"
        default:      return "Good evening"
        }
    }
}
