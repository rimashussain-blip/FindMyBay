// BookingRepository.swift
//
// Maps `BookingAPI` DTOs into pure domain models. Mirrors `BookingRepository.kt`.

import Foundation

actor BookingRepository {
    private let api: BookingAPI

    init(api: BookingAPI) {
        self.api = api
    }

    /// Create a new booking. `slotStartIso` is the ISO 8601 string returned
    /// from `/vendors/:id/availability`.
    /// `promoCode` is optional. Backend uppercases + trims on receipt; we
    /// still normalise here so the wire payload is canonical (and an empty
    /// string is collapsed to nil to avoid the backend rejecting it).
    func create(
        vendorId: String,
        serviceId: String,
        slotStartIso: String,
        promoCode: String? = nil
    ) async throws -> Booking {
        let cleaned = promoCode?
            .trimmingCharacters(in: .whitespaces)
            .uppercased()
        let normalised = (cleaned?.isEmpty ?? true) ? nil : cleaned
        let dto = try await api.create(CreateBookingBody(
            vendorId: vendorId,
            serviceId: serviceId,
            slotStart: slotStartIso,
            promoCode: normalised
        ))
        return Self.toDomain(dto)
    }

    /// All bookings the current user owns. Sorted server-side: upcoming first.
    func mine() async throws -> [Booking] {
        let resp = try await api.mine()
        return resp.items.map(Self.toDomain)
    }

    /// QR payload for an existing booking.
    func qr(bookingId: String) async throws -> BookingQr {
        let dto = try await api.qr(id: bookingId)
        return BookingQr(
            qr: dto.qr,
            bookingId: dto.bookingId,
            slotStart: dto.slotStart,
            status: dto.status,
            vendorName: dto.vendorName,
            vendorLogoUrl: dto.vendorLogoUrl,
            bayName: dto.bayName,
            carMake: dto.carMake,
            carType: dto.carType,
            carColor: dto.carColor,
            carPlate: dto.carPlate,
            totalAed: dto.totalAed,
            vatAed: dto.vatAed,
            invoiceNumber: dto.invoiceNumber
        )
    }

    /// Cancel a booking. Returns the refund-policy hint.
    func cancel(bookingId: String) async throws -> CancelOutcome {
        let dto = try await api.cancel(id: bookingId)
        return CancelOutcome(
            status: dto.status,
            refundPolicy: dto.refundPolicy,
            minsToSlot: dto.minsToSlot
        )
    }

    func submitReview(bookingId: String, rating: Int, note: String?) async throws -> Review {
        let dto = try await api.submitReview(id: bookingId, body: ReviewBody(rating: rating, note: note))
        return Review(
            id: dto.id, bookingId: dto.bookingId,
            rating: dto.rating, note: dto.note, createdAt: dto.createdAt
        )
    }

    /// Returns nil when the booking has no review yet (treats 404 as nil).
    func fetchReview(bookingId: String) async -> Review? {
        do {
            let dto = try await api.getReview(id: bookingId)
            return Review(
                id: dto.id, bookingId: dto.bookingId,
                rating: dto.rating, note: dto.note, createdAt: dto.createdAt
            )
        } catch {
            return nil
        }
    }

    // MARK: - Mapping

    private static func toDomain(_ d: BookingDTO) -> Booking {
        Booking(
            id: d.id,
            status: d.status,
            vendor: BookingVendor(
                id: d.vendor.id,
                brandName: d.vendor.brandName,
                city: d.vendor.city,
                emirate: d.vendor.emirate,
                logoUrl: d.vendor.logoUrl
            ),
            service: BookingService(
                id: d.service.id, name: d.service.name,
                durationMin: d.service.durationMin, priceAed: d.service.priceAed
            ),
            bay: BookingBay(id: d.bay.id, name: d.bay.name),
            slotStart: d.slotStart,
            slotEnd: d.slotEnd,
            totalAed: d.totalAed,
            vatAed: d.vatAed,
            discountAed: d.discountAed,
            promoCode: d.promoCode,
            invoiceNumber: d.invoiceNumber,
            createdAt: d.createdAt
        )
    }
}
