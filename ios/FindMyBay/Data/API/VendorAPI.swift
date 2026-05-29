// VendorAPI.swift
//
// Vendor endpoints — parity with `data/api/VendorApi.kt`.

import Foundation

protocol VendorAPI {
    func nearby(lat: Double, lng: Double,
                radiusMeters: Int,
                serviceId: String?) async throws -> VendorListResponse
    func detail(id: String) async throws -> VendorDetailDTO
    func availability(id: String, serviceId: String, date: String) async throws -> AvailabilityResponseDTO
}

struct VendorAPIImpl: VendorAPI {
    let client: APIClient

    func nearby(lat: Double, lng: Double,
                radiusMeters: Int = 15_000,
                serviceId: String? = nil) async throws -> VendorListResponse {
        var query: [URLQueryItem] = [
            .init(name: "lat",    value: String(lat)),
            .init(name: "lng",    value: String(lng)),
            .init(name: "radius", value: String(radiusMeters)),
        ]
        if let serviceId { query.append(.init(name: "serviceId", value: serviceId)) }
        return try await client.request(.GET, path: "vendors/nearby", query: query)
    }

    func detail(id: String) async throws -> VendorDetailDTO {
        try await client.request(.GET, path: "vendors/\(id)")
    }

    func availability(id: String, serviceId: String, date: String) async throws -> AvailabilityResponseDTO {
        try await client.request(
            .GET,
            path: "vendors/\(id)/availability",
            query: [
                .init(name: "serviceId", value: serviceId),
                .init(name: "date",      value: date),
            ]
        )
    }
}
