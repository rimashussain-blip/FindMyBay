// PaymentDTOs.swift
//
// Wire-format types for the payments/* and bookings/{id}/pay endpoints.
// Source: PaymentDtos.kt.

import Foundation

struct PaymentIntentDTO: Codable {
    let paymentRef: String
    let hostedPageUrl: String
    let processor: String
    let amountAed: Int
    let status: String
}

struct PaymentStatusDTO: Codable {
    let paymentRef: String
    /// `pending` | `succeeded` | `failed` | `cancelled`
    let status: String
    let bookingId: String
    let bookingStatus: String
}
