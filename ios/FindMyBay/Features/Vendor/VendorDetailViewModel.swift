// VendorDetailViewModel.swift
//
// Vendor detail screen state. Fetches the full vendor record (services, bays,
// hours) and lets the user pick a service before continuing to slot picking.
// Mirrors `feature/vendor/VendorDetailViewModel.kt`.

import Foundation
import Observation

@Observable @MainActor
final class VendorDetailViewModel {

    // MARK: - State
    var loading: Bool = true
    var vendor: VendorDetail? = nil
    var selectedServiceId: String? = nil
    var error: String? = nil

    var selectedService: Service? {
        vendor?.services.first { $0.id == selectedServiceId }
    }

    // MARK: - Deps
    let vendorId: String
    private let repo: VendorRepository

    init(vendorId: String, repo: VendorRepository) {
        self.vendorId = vendorId
        self.repo = repo
    }

    // MARK: - Actions

    func load() {
        loading = true
        error = nil
        Task {
            do {
                let v = try await repo.detail(id: vendorId)
                self.vendor = v
                if self.selectedServiceId == nil {
                    self.selectedServiceId = v.services.first?.id
                }
                self.loading = false
            } catch {
                self.loading = false
                self.error = (error as? LocalizedError)?.errorDescription
                    ?? "Couldn't load vendor"
            }
        }
    }

    func selectService(_ id: String) {
        selectedServiceId = id
    }
}
