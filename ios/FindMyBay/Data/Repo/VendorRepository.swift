// VendorRepository.swift
//
// Maps `VendorAPI` DTOs into pure domain models. Mirrors `VendorRepository.kt`.

import Foundation

actor VendorRepository {
    private let api: VendorAPI

    init(api: VendorAPI) {
        self.api = api
    }

    func nearby(lat: Double, lng: Double, radiusMeters: Int = 15_000) async throws -> [Vendor] {
        let resp = try await api.nearby(lat: lat, lng: lng, radiusMeters: radiusMeters, serviceId: nil)
        return resp.items.map(Self.toDomain)
    }

    func detail(id: String) async throws -> VendorDetail {
        let dto = try await api.detail(id: id)
        return VendorDetail(
            id: dto.id, brandName: dto.brandName, city: dto.city, emirate: dto.emirate,
            addressLine: dto.addressLine, lat: dto.lat, lng: dto.lng,
            rating: dto.rating, priceFromAed: dto.priceFromAed, logoUrl: dto.logoUrl,
            services: dto.services.map {
                Service(id: $0.id, name: $0.name, durationMin: $0.durationMin,
                        priceAed: $0.priceAed, vatInclusive: $0.vatInclusive)
            },
            bays: dto.bays.map { Bay(id: $0.id, name: $0.name, bayType: $0.bayType, status: $0.status) }
        )
    }

    func availability(vendorId: String, serviceId: String, date: String) async throws -> AvailabilityResponse {
        let dto = try await api.availability(id: vendorId, serviceId: serviceId, date: date)
        return AvailabilityResponse(
            serviceId: dto.serviceId, serviceName: dto.serviceName,
            durationMin: dto.durationMin, date: dto.date,
            slots: dto.slots.map { Slot(startsAt: $0.startsAt, endsAt: $0.endsAt, available: $0.available) }
        )
    }

    // MARK: -

    private static func toDomain(_ d: VendorDTO) -> Vendor {
        Vendor(
            id: d.id, brandName: d.brandName, city: d.city, emirate: d.emirate,
            lat: d.lat, lng: d.lng, distanceMeters: d.distanceMeters,
            freeBays: d.freeBays, rating: d.rating,
            priceFromAed: d.priceFromAed, logoUrl: d.logoUrl
        )
    }
}
