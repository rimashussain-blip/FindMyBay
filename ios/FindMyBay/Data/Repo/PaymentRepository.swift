// PaymentRepository.swift
//
// Thin pass-through over `PaymentAPI`. Payments returns DTOs directly to the
// view-models because the wire shape is already user-facing (hostedPageUrl,
// processor, status). Mirrors `PaymentRepository.kt`.

import Foundation

actor PaymentRepository {
    private let api: PaymentAPI

    init(api: PaymentAPI) {
        self.api = api
    }

    func createIntent(bookingId: String) async throws -> PaymentIntentDTO {
        try await api.createIntent(bookingId: bookingId)
    }

    func status(paymentRef: String) async throws -> PaymentStatusDTO {
        try await api.status(ref: paymentRef)
    }
}
