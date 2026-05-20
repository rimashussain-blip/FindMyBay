// BookingDTOs.swift
//
// Wire-format types for the bookings/* endpoints. Source: BookingDtos.kt.

import Foundation

struct CreateBookingBody: Codable {
    let vendorId: String
    let serviceId: String
    /// ISO 8601
    let slotStart: String
    /// Optional promo code (e.g. `WELCOME10`). Backend uppercases + trims on
    /// receipt; we still normalise on send so the wire payload is canonical.
    /// Nil → no promo attempted. Invalid → 409 `promo_*` from the server,
    /// caller renders the message via `APIError.userMessage`.
    let promoCode: String?
}

struct BookingDTO: Codable {
    let id: String
    let status: String
    let vendor: BookingVendorDTO
    let service: BookingServiceDTO
    let bay: BookingBayDTO
    let slotStart: String
    let slotEnd: String
    /// Final amount after VAT and any promo discount.
    let totalAed: Int
    /// VAT component of `totalAed` (whole AED). Present after the backend
    /// rolled out VAT computation; nil on older records.
    let vatAed: Int?
    /// Discount in whole AED applied via `promoCode`. 0 if no promo was used.
    /// Defaults via the custom decoder below so older /bookings/me records
    /// that pre-date the field still decode.
    let discountAed: Int
    /// Promo code the discount was sourced from. Nil if no promo was used
    /// (or for pre-promo legacy records).
    let promoCode: String?
    /// FTA invoice number — assigned on payment success / walk-in creation.
    /// `nil` until the booking has cleared.
    let invoiceNumber: String?
    let createdAt: String

    // Tolerant decoding: `discountAed` / `promoCode` were added on the v0.2.4
    // backend release. iOS clients on older databases (dev / staging) or
    // bookings created before the migration ran won't have them. Default to
    // 0 / nil so the response decoder doesn't fail.
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id             = try c.decode(String.self, forKey: .id)
        status         = try c.decode(String.self, forKey: .status)
        vendor         = try c.decode(BookingVendorDTO.self, forKey: .vendor)
        service        = try c.decode(BookingServiceDTO.self, forKey: .service)
        bay            = try c.decode(BookingBayDTO.self, forKey: .bay)
        slotStart      = try c.decode(String.self, forKey: .slotStart)
        slotEnd        = try c.decode(String.self, forKey: .slotEnd)
        totalAed       = try c.decode(Int.self, forKey: .totalAed)
        vatAed         = try c.decodeIfPresent(Int.self, forKey: .vatAed)
        discountAed    = try c.decodeIfPresent(Int.self, forKey: .discountAed) ?? 0
        promoCode      = try c.decodeIfPresent(String.self, forKey: .promoCode)
        invoiceNumber  = try c.decodeIfPresent(String.self, forKey: .invoiceNumber)
        createdAt      = try c.decode(String.self, forKey: .createdAt)
    }
}

struct BookingListResponse: Codable {
    let items: [BookingDTO]
}

struct BookingVendorDTO: Codable {
    let id: String
    let brandName: String
    let city: String
    let emirate: String
    let logoUrl: String?
}

struct BookingServiceDTO: Codable {
    let id: String
    let name: String
    let durationMin: Int
    let priceAed: Int
}

struct BookingBayDTO: Codable {
    let id: String
    let name: String
}

struct BookingQrDTO: Codable {
    let qr: String
    let bookingId: String
    let slotStart: String
    let status: String
    let vendorName: String?
    let vendorLogoUrl: String?
    let bayName: String?
    // Car details, shown to attendant alongside the QR.
    let carMake: String?
    let carType: String?
    let carColor: String?
    let carPlate: String?
    // FTA invoice — present once payment cleared.
    let totalAed: Int?
    let vatAed: Int?
    let invoiceNumber: String?
}

struct CancelBookingResponse: Codable {
    let id: String
    let status: String
    /// `free` if cancelled >30 min before slot, otherwise `late_fee_aed_10`.
    let refundPolicy: String
    let minsToSlot: Int
}

struct ReviewBody: Codable {
    let rating: Int
    let note: String?
}

struct ReviewDTO: Codable {
    let id: String
    let bookingId: String
    let rating: Int
    let note: String?
    let createdAt: String
}
