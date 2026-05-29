// BookingAPI.swift
//
// Booking endpoints — parity with `data/api/BookingApi.kt`.

import Foundation

protocol BookingAPI {
    func create(_ body: CreateBookingBody) async throws -> BookingDTO
    func mine() async throws -> BookingListResponse
    func qr(id: String) async throws -> BookingQrDTO
    func cancel(id: String) async throws -> CancelBookingResponse
    func submitReview(id: String, body: ReviewBody) async throws -> ReviewDTO
    func getReview(id: String) async throws -> ReviewDTO
}

struct BookingAPIImpl: BookingAPI {
    let client: APIClient

    func create(_ body: CreateBookingBody) async throws -> BookingDTO {
        try await client.request(.POST, path: "bookings", body: body)
    }

    func mine() async throws -> BookingListResponse {
        try await client.request(.GET, path: "bookings/me")
    }

    func qr(id: String) async throws -> BookingQrDTO {
        try await client.request(.GET, path: "bookings/\(id)/qr")
    }

    func cancel(id: String) async throws -> CancelBookingResponse {
        try await client.request(.POST, path: "bookings/\(id)/cancel")
    }

    func submitReview(id: String, body: ReviewBody) async throws -> ReviewDTO {
        try await client.request(.POST, path: "bookings/\(id)/review", body: body)
    }

    func getReview(id: String) async throws -> ReviewDTO {
        try await client.request(.GET, path: "bookings/\(id)/review")
    }
}
