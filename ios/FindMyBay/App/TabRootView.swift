// TabRootView.swift
//
// Bottom-tab shell shown after sign-in. Mirrors `BottomNav.kt` from Android:
// four tabs (Home · Bookings · Loyalty · Profile), each owning its own
// NavigationStack so push-navigation doesn't cross tab boundaries. The Home
// stack also carries the entire booking flow (vendor detail → slot picker
// → review pay → booking confirmed → show QR / rate).

import SwiftUI

struct TabRootView: View {

    @Environment(\.fmbScheme) private var scheme
    @State private var selection: HomeTab = .home

    @State private var homePath     = NavigationPath()
    @State private var bookingsPath = NavigationPath()
    @State private var loyaltyPath  = NavigationPath()
    @State private var profilePath  = NavigationPath()

    var onSignOut: () -> Void

    var body: some View {
        TabView(selection: $selection) {
            tab(.home, path: $homePath) {
                NearbyMapView { vendor in
                    homePath.append(AppRoute.vendorDetail(vendorId: vendor.id))
                }
            }
            tab(.bookings, path: $bookingsPath) {
                MyBookingsView(
                    onShowQR: { id in bookingsPath.append(AppRoute.showQr(bookingId: id)) },
                    onRate:   { id in bookingsPath.append(AppRoute.rateBooking(bookingId: id)) }
                )
            }
            tab(.loyalty, path: $loyaltyPath) { LoyaltyPlaceholder() }
            tab(.profile, path: $profilePath) {
                ProfileView(onSignOut: onSignOut)
            }
        }
        .tint(scheme.primary)
    }

    /// Wraps any tab's content view in a NavigationStack with the route map.
    /// AppRoute → concrete view dispatch lives in `AppRouteView` below so
    /// adding a new screen is one switch-case there.
    @ViewBuilder
    private func tab<Content: View>(
        _ tab: HomeTab,
        path: Binding<NavigationPath>,
        @ViewBuilder content: () -> Content
    ) -> some View {
        NavigationStack(path: path) {
            content()
                .navigationDestination(for: AppRoute.self) { route in
                    AppRouteView(
                        route: route,
                        path: path,
                        switchToBookingsTab: {
                            // From any tab — usually invoked from the
                            // BookingConfirmed "View my bookings" CTA.
                            selection = .bookings
                            path.wrappedValue = NavigationPath()
                        }
                    )
                }
        }
        .tabItem {
            Label(tab.label,
                  systemImage: selection == tab ? tab.selectedIcon : tab.unselectedIcon)
        }
        .tag(tab)
    }
}

// MARK: - Route → View dispatcher

/// Single place that maps an `AppRoute` to its destination view. Holds the
/// nav path for the *current* tab so screens can push further routes onto
/// the same stack (e.g. SlotPicker → ReviewPay → BookingConfirmed).
private struct AppRouteView: View {
    let route: AppRoute
    @Binding var path: NavigationPath
    var switchToBookingsTab: () -> Void

    var body: some View {
        switch route {
        case .vendorDetail(let id):
            VendorDetailView(vendorId: id) { vendorId, _ in
                path.append(AppRoute.slotPicker(vendorId: vendorId))
            }
        case .slotPicker(let id):
            SlotPickerView(vendorId: id) { bookingId in
                path.append(AppRoute.reviewPay(bookingId: bookingId))
            }
        case .reviewPay(let id):
            ReviewPayView(bookingId: id) { bookingId in
                // Replace ReviewPay with the confirmed page so the user
                // can't accidentally pay twice via a back-swipe.
                path.removeLast()
                path.append(AppRoute.bookingConfirmed(bookingId: bookingId))
            }
        case .bookingConfirmed(let id):
            BookingConfirmedView(
                bookingId: id,
                onShowQR: { bid in path.append(AppRoute.showQr(bookingId: bid)) },
                onMyBookings: switchToBookingsTab
            )
        case .showQr(let id):
            ShowQRView(bookingId: id)
        case .rateBooking(let id):
            RateBookingView(bookingId: id) {
                path.removeLast()
            }
        case .leaveNow(let v, let eta, let slot):
            LeaveNowView(
                vendorName: v, etaMin: eta, slotTime: slot,
                onDismiss: { path.removeLast() }
            )
        }
    }
}

// MARK: - Loyalty placeholder (no Android backend yet)

private struct LoyaltyPlaceholder: View {
    @Environment(\.fmbScheme) private var scheme
    var body: some View {
        ZStack {
            scheme.background.ignoresSafeArea()
            VStack(spacing: 12) {
                Image(systemName: "gift.fill")
                    .font(.system(size: 48))
                    .foregroundStyle(scheme.primary)
                Text("Loyalty")
                    .font(Fmb.Typo.headlineSmall)
                Text("Coming soon.")
                    .font(Fmb.Typo.bodyMedium)
                    .foregroundStyle(scheme.onSurfaceVariant)
            }
        }
        .navigationTitle("Loyalty")
    }
}
