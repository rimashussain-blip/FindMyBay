// VendorDetailView.swift
//
// Vendor detail. Mirrors design handoff screen #4:
//   • 130h gradient hero (mint → sand) with decorative circles, back +
//     heart action chips, big 🚗 emoji bottom-left.
//   • Brand name row with rating block.
//   • Live bay status card (4 bay tiles, mint=free / coral=busy).
//   • Services list — selected row in mint with aqua border.
//   • Sticky bottom "Book a wash · AED N →" CTA.

import SwiftUI

struct VendorDetailView: View {

    @Environment(\.fmbScheme) private var scheme
    @Environment(\.appEnvironment) private var env
    @State private var vm: VendorDetailViewModel?
    let vendorId: String
    var onBookSlot: (_ vendorId: String, _ serviceId: String) -> Void

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        Group {
            if let vm {
                content(vm: vm)
            } else {
                ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(scheme.background)
            }
        }
        .onAppear {
            if vm == nil {
                let new = VendorDetailViewModel(vendorId: vendorId, repo: env.vendorRepo)
                vm = new
                new.load()
            }
        }
        .navigationBarBackButtonHidden(true)
    }

    @ViewBuilder
    private func content(vm: VendorDetailViewModel) -> some View {
        ZStack(alignment: .bottom) {
            scheme.background.ignoresSafeArea()
            ScrollView {
                if vm.loading {
                    ProgressView().padding(40)
                } else if let v = vm.vendor {
                    VStack(alignment: .leading, spacing: 12) {
                        hero(v: v)
                            .padding(.horizontal, 16)
                        nameRow(v: v)
                            .padding(.horizontal, 22)
                        liveBayCard(bays: v.bays)
                            .padding(.horizontal, 16)
                        servicesHeader
                            .padding(.horizontal, 22)
                        servicesList(v: v, vm: vm)
                            .padding(.horizontal, 16)
                        Spacer().frame(height: 100)
                    }
                    .padding(.top, 4)
                } else if let err = vm.error {
                    errorView(err) { vm.load() }
                }
            }
            // Sticky bottom CTA
            stickyCTA(vm: vm)
        }
    }

    // MARK: - Hero

    private func hero(v: VendorDetail) -> some View {
        ZStack {
            // Scheme-aware hero — `primaryContainer → secondaryContainer`
            // resolves to mint→sand in light mode and deep teal→sand-deep in
            // dark mode, so the banner reads on-brand in both appearances.
            LinearGradient(
                colors: [scheme.primaryContainer, scheme.secondaryContainer],
                startPoint: .topLeading, endPoint: .bottomTrailing
            )
            // Decorative circles
            Circle()
                .fill(Color.white.opacity(0.4))
                .frame(width: 80, height: 80)
                .offset(x: 110, y: -45)
            Circle()
                .fill(Color.white.opacity(0.5))
                .frame(width: 40, height: 40)
                .offset(x: 70, y: 40)
            // Bottom-left brand car illustration (replaces the red 🚗 emoji
            // that iOS otherwise renders — keeps the hero on-brand).
            VStack {
                Spacer()
                HStack {
                    FmbBrandCar(width: 80)
                    Spacer()
                }
            }
            .padding(.leading, 14).padding(.bottom, 10)

            // Top action chips
            VStack {
                HStack {
                    Button { dismiss() } label: {
                        Image(systemName: "chevron.left")
                            .font(.system(size: 12, weight: .bold))
                            // Pinned to brand-dark because the pill behind us
                            // is a fixed white-90 — `scheme.onBackground`
                            // would flip to cream in dark mode and disappear
                            // on the white pill. Same reasoning applies to
                            // the heart icon (already uses fixed Fmb.coral).
                            .foregroundStyle(Fmb.ink)
                            .frame(width: 34, height: 34)
                            .background(Color.white.opacity(0.9))
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                    }
                    Spacer()
                    Image(systemName: "heart")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Fmb.coral)
                        .frame(width: 34, height: 34)
                        .background(Color.white.opacity(0.9))
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                }
                Spacer()
            }
            .padding(12)
        }
        .frame(height: 130)
        .clipShape(RoundedRectangle(cornerRadius: 22))
    }

    // MARK: - Name row

    private func nameRow(v: VendorDetail) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(alignment: .firstTextBaseline) {
                Text(v.brandName)
                    .font(.system(size: 19, weight: .bold))
                    .kerning(-0.4)
                    .foregroundStyle(scheme.onBackground)
                Spacer()
                if let rating = v.rating {
                    HStack(spacing: 4) {
                        Text("★").font(.system(size: 11)).foregroundStyle(Fmb.amber500)
                        Text(String(format: "%.1f", rating))
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(scheme.onBackground)
                    }
                }
            }
            Text("\(v.city) · \(v.emirate)\(v.addressLine.map { " · \($0)" } ?? "")")
                .font(.system(size: 11))
                .foregroundStyle(scheme.onSurfaceVariant)
        }
    }

    // MARK: - Live bay card

    private func liveBayCard(bays: [Bay]) -> some View {
        FmbCard(corner: 18, padding: 14) {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    FmbSectionLabel(text: "Live bay status")
                    Spacer()
                    HStack(spacing: 4) {
                        Circle().fill(Fmb.aqua).frame(width: 6, height: 6)
                        Text("Updated now")
                            .font(.system(size: 10))
                            .foregroundStyle(scheme.onSurfaceVariant)
                    }
                }
                if bays.isEmpty {
                    Text("No bays reported")
                        .font(.system(size: 11))
                        .foregroundStyle(scheme.onSurfaceVariant)
                } else {
                    HStack(spacing: 6) {
                        ForEach(bays.prefix(4)) { bay in
                            bayTile(bay)
                        }
                        // Pad to 4 if vendor has fewer.
                        ForEach(0..<max(0, 4 - bays.count), id: \.self) { _ in
                            Color.clear.frame(maxWidth: .infinity)
                        }
                    }
                }
            }
        }
    }

    private func bayTile(_ bay: Bay) -> some View {
        // Brand-fixed swatches — the bay status reads at a glance on both
        // light and dark surfaces. Using `scheme.surfaceVariant` for "free"
        // collapses to nearly the same shade as `Fmb.deep` text in dark mode,
        // so we keep mint/coral here.
        let isFree = bay.status == "free"
        let bg = isFree ? Fmb.mint : Fmb.coralSoft
        let label = bay.status == "closed" ? "closed" : (isFree ? "free" : "busy")
        let labelColor = isFree ? Fmb.deep : Fmb.coral
        return VStack(spacing: 2) {
            Text(bay.name)
                .font(.system(size: 9, weight: .semibold))
                .foregroundStyle(Fmb.neutral700)
            Text(label)
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(labelColor)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
        .background(bg)
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }

    // MARK: - Services

    private var servicesHeader: some View {
        HStack {
            Text("Services").font(.system(size: 14, weight: .bold)).foregroundStyle(scheme.onBackground)
            Spacer()
            Text("See all").font(.system(size: 11, weight: .semibold)).foregroundStyle(Fmb.deep)
        }
    }

    private func servicesList(v: VendorDetail, vm: VendorDetailViewModel) -> some View {
        VStack(spacing: 8) {
            ForEach(v.services) { service in
                serviceRow(service: service, on: vm.selectedServiceId == service.id) {
                    vm.selectService(service.id)
                }
            }
        }
    }

    private func serviceRow(service: Service, on: Bool, action: @escaping () -> Void) -> some View {
        // Selected: `scheme.surfaceVariant` (mint in light, deep teal in dark)
        //           with aqua border. Reads as the "picked" option in both
        //           modes because of the saturated stroke.
        // Unselected: `scheme.surfaceContainer` (off-white-cream light /
        //             elevated dark teal dark). Avoids the previous
        //             `Color.white` which turned into white-on-light-text
        //             in dark mode and made the row text invisible.
        Button(action: action) {
            HStack(spacing: 12) {
                ZStack {
                    RoundedRectangle(cornerRadius: 12)
                        .fill(scheme.surface.opacity(0.7))
                    Text(serviceEmoji(service.name)).font(.system(size: 18))
                }
                .frame(width: 38, height: 38)

                VStack(alignment: .leading, spacing: 2) {
                    Text(service.name)
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(scheme.onSurface)
                    Text("\(service.durationMin) min · VAT incl.")
                        .font(.system(size: 11))
                        .foregroundStyle(scheme.onSurfaceVariant)
                }
                Spacer()
                Text("AED \(service.priceAed)")
                    .font(.system(size: 14, weight: .heavy))
                    .foregroundStyle(scheme.primary)
            }
            .padding(.horizontal, 14).padding(.vertical, 12)
            .background(on ? scheme.surfaceVariant : scheme.surfaceContainer)
            .clipShape(RoundedRectangle(cornerRadius: 14))
            .overlay(
                RoundedRectangle(cornerRadius: 14)
                    .strokeBorder(on ? scheme.primary : scheme.outline, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }

    private func serviceEmoji(_ name: String) -> String {
        let s = name.lowercased()
        if s.contains("premium") || s.contains("wax") { return "✨" }
        if s.contains("interior") { return "🧴" }
        if s.contains("quick") || s.contains("exterior") || s.contains("wash") { return "💦" }
        return "🚿"
    }

    // MARK: - Sticky CTA

    @ViewBuilder
    private func stickyCTA(vm: VendorDetailViewModel) -> some View {
        if let service = vm.selectedService {
            VStack {
                FmbPrimaryButton(
                    title: "Book a wash · AED \(service.priceAed)",
                    icon: "arrow.right",
                    action: { onBookSlot(vm.vendorId, service.id) }
                )
            }
            .padding(.horizontal, 16).padding(.bottom, 16).padding(.top, 12)
            .background(LinearGradient(
                colors: [scheme.background.opacity(0), scheme.background],
                startPoint: .top, endPoint: .center
            ))
        }
    }

    // MARK: -

    private func errorView(_ msg: String, retry: @escaping () -> Void) -> some View {
        VStack(spacing: 12) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 36))
                .foregroundStyle(scheme.error)
            Text(msg).font(.system(size: 13)).multilineTextAlignment(.center)
            Button("Retry", action: retry).tint(Fmb.aqua)
        }
        .padding(40)
    }
}
