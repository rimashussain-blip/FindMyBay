// Models.swift
//
// Find My Bay — domain models. Pure Swift, no framework deps so they're easy
// to test. Source: android/.../domain/model/Models.kt — 1:1 parity.

import Foundation

struct Vendor: Identifiable, Equatable, Hashable {
    let id: String
    let brandName: String
    let city: String
    let emirate: String
    let lat: Double
    let lng: Double
    let distanceMeters: Double
    let freeBays: Int
    let rating: Double?
    let priceFromAed: Int?
    let logoUrl: String?
}

struct VendorDetail: Identifiable, Equatable, Hashable {
    let id: String
    let brandName: String
    let city: String
    let emirate: String
    let addressLine: String?
    let lat: Double
    let lng: Double
    let rating: Double?
    let priceFromAed: Int?
    let logoUrl: String?
    let services: [Service]
    let bays: [Bay]
}

struct Service: Identifiable, Equatable, Hashable {
    let id: String
    let name: String
    let durationMin: Int
    let priceAed: Int
    let vatInclusive: Bool
}

struct Bay: Identifiable, Equatable, Hashable {
    let id: String
    let name: String
    let bayType: String
    /// `free` | `busy` | `closed`
    let status: String
}

struct Slot: Equatable, Hashable {
    /// ISO 8601
    let startsAt: String
    let endsAt: String
    let available: Bool
}

struct AvailabilityResponse: Equatable {
    let serviceId: String
    let serviceName: String
    let durationMin: Int
    /// YYYY-MM-DD
    let date: String
    let slots: [Slot]
}

struct BookingQr: Equatable {
    let qr: String
    let bookingId: String
    let slotStart: String
    let status: String
    let vendorName: String?
    let vendorLogoUrl: String?
    let bayName: String?
    let carMake: String?
    let carType: String?
    let carColor: String?
    let carPlate: String?
    // FTA invoice info — rendered as "TAX INVOICE" strip when present.
    let totalAed: Int?
    let vatAed: Int?
    let invoiceNumber: String?
}

struct Review: Identifiable, Equatable {
    let id: String
    let bookingId: String
    let rating: Int
    let note: String?
    let createdAt: String
}

struct Booking: Identifiable, Equatable, Hashable {
    let id: String
    let status: String
    let vendor: BookingVendor
    let service: BookingService
    let bay: BookingBay
    let slotStart: String
    let slotEnd: String
    let totalAed: Int
    /// VAT component of `totalAed`. `nil` for pre-VAT-rollout bookings.
    let vatAed: Int?
    /// FTA tax-invoice number assigned on payment-success / walk-in creation.
    let invoiceNumber: String?
    let createdAt: String
}

struct BookingVendor: Equatable, Hashable {
    let id: String
    let brandName: String
    let city: String
    let emirate: String
    let logoUrl: String?
}

struct BookingService: Equatable, Hashable {
    let id: String
    let name: String
    let durationMin: Int
    let priceAed: Int
}

struct BookingBay: Equatable, Hashable {
    let id: String
    let name: String
}

struct AuthSession: Equatable {
    let accessToken: String
    let refreshToken: String
    let userId: String
    let phone: String
    let fullName: String?
}

struct UserProfile: Identifiable, Equatable {
    let id: String
    let phone: String?
    let email: String?
    let fullName: String?
    let role: String
    let carMake: String?
    let carType: String?
    let carColor: String?
    let carPlate: String?
    let profileComplete: Bool

    /// Two-letter initials for avatar — matches the Kotlin `initials` getter.
    var initials: String {
        let source: String = {
            if let name = fullName, !name.trimmingCharacters(in: .whitespaces).isEmpty { return name }
            return phone ?? email ?? "?"
        }()
        let separators: CharacterSet = CharacterSet(charactersIn: " @+.")
        let parts = source
            .components(separatedBy: separators)
            .filter { !$0.isEmpty }
            .prefix(2)
            .compactMap { $0.first.map { String($0).uppercased() } }
        let joined = parts.joined()
        return joined.isEmpty ? "?" : joined
    }
}

/// Outcome of `POST /bookings/{id}/cancel`. Includes the refund-policy hint
/// (`free` if cancelled >30 min before slot, otherwise `late_fee_aed_10`).
struct CancelOutcome: Equatable {
    let status: String
    let refundPolicy: String
    let minsToSlot: Int
}

/// Allowed values for `UserProfile.carType` — mirrored from the backend's
/// `CAR_TYPES` const. Used by the onboarding picker.
enum CarType: String, CaseIterable, Identifiable {
    case sedan, hatchback, suv, pickup, van, coupe, other
    var id: String { rawValue }

    /// Title-cased for picker labels.
    var label: String { rawValue.prefix(1).uppercased() + rawValue.dropFirst() }
}
