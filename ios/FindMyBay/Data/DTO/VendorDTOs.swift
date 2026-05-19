// VendorDTOs.swift
//
// Wire-format types for the vendors/* endpoints.
// Source: data/api/dto/VendorDtos.kt + VendorDetailDtos.kt.

import Foundation

struct VendorListResponse: Codable {
    let items: [VendorDTO]
}

struct VendorDTO: Codable {
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

struct VendorDetailDTO: Codable {
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
    let services: [ServiceDTO]
    let bays: [BayDTO]
}

struct ServiceDTO: Codable {
    let id: String
    let name: String
    let durationMin: Int
    let priceAed: Int
    let vatInclusive: Bool

    enum CodingKeys: String, CodingKey {
        case id, name, durationMin, priceAed, vatInclusive
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id           = try c.decode(String.self, forKey: .id)
        name         = try c.decode(String.self, forKey: .name)
        durationMin  = try c.decode(Int.self, forKey: .durationMin)
        priceAed     = try c.decode(Int.self, forKey: .priceAed)
        vatInclusive = try c.decodeIfPresent(Bool.self, forKey: .vatInclusive) ?? true
    }
}

struct BayDTO: Codable {
    let id: String
    let name: String
    let bayType: String
    let status: String
}

struct AvailabilityResponseDTO: Codable {
    let serviceId: String
    let serviceName: String
    let durationMin: Int
    let date: String
    let slots: [SlotDTO]
}

struct SlotDTO: Codable {
    let startsAt: String
    let endsAt: String
    let available: Bool
}
