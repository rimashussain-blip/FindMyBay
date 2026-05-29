// ShowQRViewModel.swift
//
// Loads `/bookings/{id}/qr` and polls every 30s so when the vendor scans
// the code (status flips to `in_progress`) we surface that without a
// pull-to-refresh. Mirrors `feature/bookings/ShowQrViewModel.kt`.

import Foundation
import Observation

@Observable @MainActor
final class ShowQRViewModel {
    var loading: Bool = true
    var qr: BookingQr? = nil
    var error: String? = nil

    let bookingId: String
    private let repo: BookingRepository
    private var pollTask: Task<Void, Never>? = nil

    init(bookingId: String, repo: BookingRepository) {
        self.bookingId = bookingId
        self.repo = repo
    }

    func start() {
        load()
        pollTask?.cancel()
        pollTask = Task { [weak self] in
            while let self, !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 30_000_000_000)
                if Task.isCancelled { break }
                if self.qr?.status != "in_progress" {
                    self.load(silent: true)
                }
            }
        }
    }

    func stop() {
        pollTask?.cancel()
        pollTask = nil
    }

    func load(silent: Bool = false) {
        if !silent { loading = true; error = nil }
        Task {
            do {
                qr = try await repo.qr(bookingId: bookingId)
                loading = false
            } catch {
                if !silent {
                    loading = false
                    self.error = (error as? LocalizedError)?.errorDescription
                        ?? "Couldn't load QR"
                }
            }
        }
    }
}
