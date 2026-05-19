// MyBookingsViewModel.swift
//
// Loads `/bookings/me` and exposes a list. Mirrors `MyBookingsViewModel.kt`.
// Includes confirm-cancel state for the cancel sheet. Realtime status
// listener will be wired in once Socket.IO lands.

import Foundation
import Observation

@Observable @MainActor
final class MyBookingsViewModel {

    struct CancelDialogState: Equatable {
        var booking: Booking
        var submitting: Bool = false
        var error: String? = nil
    }

    // MARK: - State
    var loading: Bool = true
    var bookings: [Booking] = []
    var error: String? = nil
    var cancelDialog: CancelDialogState? = nil
    /// One-shot toast/snackbar copy after a cancel completes.
    var lastCancelMessage: String? = nil

    // MARK: - Deps
    private let repo: BookingRepository
    private var realtimeTask: Task<Void, Never>? = nil

    init(repo: BookingRepository) {
        self.repo = repo
    }

    // No explicit deinit — the realtime task captures `[weak self]` so once
    // the view-model is released the loop sees nil and exits naturally.

    /// Subscribe to `booking:status` realtime pushes. Each event triggers a
    /// silent refresh so the list flips status without the user yanking to
    /// reload. Call once after the view-model is constructed.
    func observeRealtime(_ realtime: RealtimeClient) {
        realtimeTask?.cancel()
        let stream = realtime.bookingStatusEvents()
        realtimeTask = Task { [weak self] in
            for await _ in stream {
                guard let self else { break }
                self.load(silent: true)
            }
        }
    }

    func load(silent: Bool = false) {
        if !silent { loading = true; error = nil }
        Task {
            do {
                bookings = try await repo.mine()
                loading = false
            } catch {
                loading = false
                self.error = (error as? LocalizedError)?.errorDescription
                    ?? "Couldn't load bookings"
            }
        }
    }

    func askCancel(_ booking: Booking) {
        cancelDialog = CancelDialogState(booking: booking)
    }

    func dismissCancelDialog() {
        cancelDialog = nil
    }

    func consumeCancelMessage() {
        lastCancelMessage = nil
    }

    func confirmCancel() {
        guard var d = cancelDialog, !d.submitting else { return }
        d.submitting = true; d.error = nil
        cancelDialog = d
        let bookingId = d.booking.id
        Task {
            do {
                let outcome = try await repo.cancel(bookingId: bookingId)
                let msg = outcome.refundPolicy == "free"
                    ? "Cancelled. You won't be charged."
                    : "Cancelled. AED 10 fee applies (within 30 minutes of slot)."
                cancelDialog = nil
                lastCancelMessage = msg
                // Optimistically flip status locally so the UI updates without
                // waiting for a refetch.
                bookings = bookings.map { b in
                    if b.id == bookingId {
                        return Booking(
                            id: b.id, status: "cancelled",
                            vendor: b.vendor, service: b.service, bay: b.bay,
                            slotStart: b.slotStart, slotEnd: b.slotEnd,
                            totalAed: b.totalAed,
                            vatAed: b.vatAed,
                            invoiceNumber: b.invoiceNumber,
                            createdAt: b.createdAt
                        )
                    }
                    return b
                }
                // Also cancel any pending leave-now notification for this booking.
                AlertScheduler.cancelLeaveNow(bookingId: bookingId)
                load(silent: true)
            } catch {
                if var current = cancelDialog {
                    current.submitting = false
                    current.error = (error as? LocalizedError)?.errorDescription
                        ?? "Couldn't cancel — please try again."
                    cancelDialog = current
                }
            }
        }
    }
}
