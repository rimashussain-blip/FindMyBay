// PaymentAPI.swift
//
// Payment endpoints — parity with `data/api/PaymentApi.kt`.

import Foundation

protocol PaymentAPI {
    func createIntent(bookingId: String) async throws -> PaymentIntentDTO
    func status(ref: String) async throws -> PaymentStatusDTO
}

struct PaymentAPIImpl: PaymentAPI {
    let client: APIClient

    func createIntent(bookingId: String) async throws -> PaymentIntentDTO {
        try await client.request(.POST, path: "bookings/\(bookingId)/pay")
    }

    func status(ref: String) async throws -> PaymentStatusDTO {
        try await client.request(.GET, path: "payments/\(ref)/status")
    }
}
