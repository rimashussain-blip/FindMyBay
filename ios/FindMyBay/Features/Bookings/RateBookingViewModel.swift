// RateBookingViewModel.swift
//
// Rate-and-leave-a-note form for completed bookings. Loads any existing
// review on init so users can edit their previous rating instead of
// double-submitting. Mirrors `RateBookingViewModel.kt`.

import Foundation
import Observation

@Observable @MainActor
final class RateBookingViewModel {

    var rating: Int = 0
    var note: String = ""
    var submitting: Bool = false
    var submitted: Bool = false
    var error: String? = nil

    let bookingId: String
    private let repo: BookingRepository

    init(bookingId: String, repo: BookingRepository) {
        self.bookingId = bookingId
        self.repo = repo
    }

    func loadExisting() {
        Task {
            if let existing = await repo.fetchReview(bookingId: bookingId) {
                rating = existing.rating
                note = existing.note ?? ""
            }
        }
    }

    func setRating(_ stars: Int) { rating = max(0, min(5, stars)) }
    func setNote(_ text: String) { note = String(text.prefix(500)) }

    func submit() {
        guard rating >= 1, !submitting else { return }
        submitting = true; error = nil
        Task {
            do {
                _ = try await repo.submitReview(
                    bookingId: bookingId, rating: rating,
                    note: note.isEmpty ? nil : note
                )
                submitting = false
                submitted = true
            } catch {
                submitting = false
                self.error = (error as? LocalizedError)?.errorDescription
                    ?? "Couldn't submit"
            }
        }
    }
}
