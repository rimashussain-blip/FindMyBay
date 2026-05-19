// BookingDTOs.swift
//
// Wire-format types for the bookings/* endpoints. Source: BookingDtos.kt.

import Foundation

struct CreateBookingBody: Codable {
    let vendorId: String
    let serviceId: String
    /// ISO 8601
    let slotStart: String
}

struct BookingDTO: Codable {
    let id: String
    let status: String
    let vendor: BookingVendorDTO
    let service: BookingServiceDTO
    let bay: BookingBayDTO
    let slotStart: String
    let slotEnd: String
    let totalAed: Int
    /// VAT component of `totalAed` (whole AED). Present after the backend
    /// rolled out VAT computation; nil on older records.
    let vatAed: Int?
    /// FTA invoice number — assigned on payment success / walk-in creation.
    /// `nil` until the booking has cleared.
    let invoiceNumber: String?
    let createdAt: String
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
