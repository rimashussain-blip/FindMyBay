// ReviewPayViewModel.swift
//
// Loads the booking, opens the hosted payment page in a Safari view, and
// listens for the `findmybay://payment/return` deep link via PaymentReturnBus.
// On a `succeeded` return, polls `/payments/:ref/status` until the backend
// confirms before flipping the UI to "confirmed".
//
// Mirrors `feature/payment/ReviewPayViewModel.kt`.

import Foundation
import Observation

@Observable @MainActor
final class ReviewPayViewModel {

    // MARK: - State
    var loading: Bool = true
    var booking: Booking? = nil
    var paymentRef: String? = nil
    var hostedPageURL: URL? = nil
    var launching: Bool = false
    var polling: Bool = false
    var confirmed: Bool = false
    var failureReason: String? = nil
    var error: String? = nil

    // MARK: - Deps
    let bookingId: String
    private let bookings: BookingRepository
    private let payments: PaymentRepository
    private let returnBus: PaymentReturnBus

    init(bookingId: String,
         bookings: BookingRepository,
         payments: PaymentRepository,
         returnBus: PaymentReturnBus) {
        self.bookingId = bookingId
        self.bookings = bookings
        self.payments = payments
        self.returnBus = returnBus
    }

    func start() {
        loadBooking()
        observeReturnBus()
    }

    private func loadBooking() {
        Task {
            do {
                let list = try await bookings.mine()
                guard let match = list.first(where: { $0.id == bookingId }) else {
                    loading = false
                    error = "Booking not found"
                    return
                }
                booking = match
                let paid: Set<String> = ["confirmed", "alert_scheduled", "alerted", "in_progress"]
                if paid.contains(match.status) {
                    confirmed = true
                }
                loading = false
            } catch {
                loading = false
                self.error = (error as? LocalizedError)?.errorDescription
                    ?? "Couldn't load booking"
            }
        }
    }

    /// Click handler for "Pay AED X". Creates the intent on the backend then
    /// returns a URL the host view can open in `SFSafariViewController`.
    func pay() {
        guard !launching else { return }
        launching = true
        error = nil
        failureReason = nil
        Task {
            do {
                let intent = try await payments.createIntent(bookingId: bookingId)
                paymentRef = intent.paymentRef
                hostedPageURL = URL(string: intent.hostedPageUrl)
                launching = false
            } catch {
                launching = false
                self.error = (error as? LocalizedError)?.errorDescription
                    ?? "Couldn't start payment"
            }
        }
    }

    func dismissPaymentSheet() {
        hostedPageURL = nil
    }

    private func observeReturnBus() {
        Task {
            for await event in returnBus.events() {
                guard event.paymentRef == paymentRef else { continue }
                if event.status == "succeeded" {
                    pollUntilConfirmed(ref: event.paymentRef)
                } else {
                    failureReason = "Payment didn't go through. Please try again."
                }
            }
        }
    }

    /// On `succeeded` deep-link, the webhook may not have hit our backend
    /// yet. Poll for up to ~10 s before surfacing a "still processing" message.
    private func pollUntilConfirmed(ref: String) {
        polling = true
        Task {
            let confirmedSet: Set<String> = ["confirmed", "alert_scheduled", "alerted", "in_progress"]
            for attempt in 0..<10 {
                if let s = try? await payments.status(paymentRef: ref) {
                    if s.status == "succeeded", confirmedSet.contains(s.bookingStatus) {
                        polling = false
                        confirmed = true
                        return
                    }
                    if s.status == "failed" || s.status == "cancelled" {
                        polling = false
                        failureReason = "Payment was declined."
                        return
                    }
                }
                let delayNs: UInt64 = attempt < 3 ? 600_000_000 : 1_500_000_000
                try? await Task.sleep(nanoseconds: delayNs)
            }
            polling = false
            failureReason = "We're still confirming your payment. Check My Bookings shortly."
        }
    }
}
