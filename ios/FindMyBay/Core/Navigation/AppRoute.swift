// AppRoute.swift
//
// Route enums shared by the four tab `NavigationStack`s. Mirrors `Routes`
// from `core/nav/AppNav.kt` 1:1 so both platforms agree on URL-shaped paths
// when we deep-link via push notifications and the payment custom-tab return.

import Foundation

/// One of the four bottom-tab roots. The `TabView` selection is bound to this.
enum HomeTab: String, Hashable, CaseIterable, Identifiable {
    case home, bookings, loyalty, profile

    var id: String { rawValue }

    var label: String {
        switch self {
        case .home:     return "Home"
        case .bookings: return "Bookings"
        case .loyalty:  return "Loyalty"
        case .profile:  return "Profile"
        }
    }

    /// SF Symbol for the unselected/selected pair.
    var unselectedIcon: String {
        switch self {
        case .home:     return "house"
        case .bookings: return "calendar"
        case .loyalty:  return "gift"
        case .profile:  return "person"
        }
    }

    var selectedIcon: String {
        switch self {
        case .home:     return "house.fill"
        case .bookings: return "calendar"
        case .loyalty:  return "gift.fill"
        case .profile:  return "person.fill"
        }
    }
}

/// Push-navigation routes inside any tab. Push these via `path.append(...)`.
/// One enum across all tabs because flows can cross tab boundaries (e.g.
/// tapping a vendor from the map opens VendorDetail in the same stack).
enum AppRoute: Hashable {
    case vendorDetail(vendorId: String)
    /// `initialServiceId` is the service the user picked on Vendor Detail.
    /// Optional because deep-links can arrive without it. SlotPickerViewModel
    /// honours it as `vendor.services.first { $0.id == initialServiceId }`
    /// before falling back to `.first`. Earlier nav dropped this value so
    /// "Deep Clean" tapped on the detail page always landed on "Quick Wash"
    /// at the slot picker.
    case slotPicker(vendorId: String, initialServiceId: String?)
    case reviewPay(bookingId: String)
    case bookingConfirmed(bookingId: String)
    case showQr(bookingId: String)
    case rateBooking(bookingId: String)
    case leaveNow(vendorName: String, etaMin: Int, slotTime: String)
}
