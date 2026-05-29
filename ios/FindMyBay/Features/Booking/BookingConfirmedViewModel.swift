// BookingConfirmedViewModel.swift
//
// "Your booking is confirmed" screen. Loads /bookings/me and finds the row
// matching `bookingId`. Mirrors `feature/booking/BookingConfirmedViewModel.kt`
// — minus the AlertWindow / AlertSafetyNet local-notification scheduling
// (those are FCM safety nets that need Apple Developer + APNs to be useful).

import Foundation
import Observation

@Observable @MainActor
final class BookingConfirmedViewModel {

    var loading: Bool = true
    var booking: Booking? = nil
    var error: String? = nil

    let bookingId: String
    private let repo: BookingRepository

    init(bookingId: String, repo: BookingRepository) {
        self.bookingId = bookingId
        self.repo = repo
    }

    func load() {
        Task {
            do {
                let list = try await repo.mine()
                if let match = list.first(where: { $0.id == bookingId }) {
                    booking = match
                } else {
                    error = "Booking not found"
                }
                loading = false
            } catch {
                loading = false
                self.error = (error as? LocalizedError)?.errorDescription
                    ?? "Couldn't load booking"
            }
        }
    }
}
