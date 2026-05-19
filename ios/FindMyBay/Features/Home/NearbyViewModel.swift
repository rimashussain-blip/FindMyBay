// NearbyViewModel.swift
//
// State for the home/map screen — location, vendor list, search, filters.
// Mirrors `feature/home/NearbyViewModel.kt`.

import Foundation
import Observation
import CoreLocation

@Observable @MainActor
final class NearbyViewModel {

    // MARK: - State (matches NearbyUiState)
    var loading: Bool = false
    var lat: Double? = nil
    var lng: Double? = nil
    var vendors: [Vendor] = []
    var error: String? = nil
    var needsPermission: Bool = true

    // Filter chips (computed against `vendors` to produce `filteredVendors`)
    var searchQuery: String = ""
    var freeNowOnly: Bool = false
    var under40Only: Bool = false

    /// View used by the markers + peek card. Eagerly computed via getter to
    /// match the Kotlin `filteredVendors` property.
    var filteredVendors: [Vendor] {
        let q = searchQuery.trimmingCharacters(in: .whitespaces).lowercased()
        return vendors.filter { v in
            let matchesQuery = q.isEmpty
                || v.brandName.lowercased().contains(q)
                || v.city.lowercased().contains(q)
            let matchesFree  = !freeNowOnly || v.freeBays > 0
            let matchesPrice = !under40Only || (v.priceFromAed.map { $0 < 40 } ?? false)
            return matchesQuery && matchesFree && matchesPrice
        }
    }

    // MARK: - Deps
    private let repo: VendorRepository
    private let location: LocationService

    init(repo: VendorRepository, location: LocationService = .shared) {
        self.repo = repo
        self.location = location
    }

    // MARK: - Permissions

    func bootstrap() {
        Task {
            let granted = await location.requestPermission()
            if granted {
                onPermissionGranted()
            } else {
                onPermissionDenied()
            }
        }
    }

    func onPermissionGranted() {
        needsPermission = false
        refresh()
    }

    func onPermissionDenied() {
        // Match the Android fallback — center on Burj Khalifa, no auto-load.
        needsPermission = true
        lat = 25.1972
        lng = 55.2744
        error = LocationError.permissionDenied.errorDescription
    }

    // MARK: - Refresh

    func refresh() {
        loading = true
        error = nil
        Task {
            do {
                let location = try await location.currentLocation()
                lat = location.coordinate.latitude
                lng = location.coordinate.longitude
                let list = try await repo.nearby(lat: location.coordinate.latitude,
                                                 lng: location.coordinate.longitude)
                vendors = list
                loading = false
            } catch {
                loading = false
                self.error = (error as? LocalizedError)?.errorDescription
                    ?? "Couldn't load car washes nearby."
            }
        }
    }

    // MARK: - Filter setters

    func setSearchQuery(_ q: String) { searchQuery = q }
    func toggleFreeNow()             { freeNowOnly = !freeNowOnly }
    func toggleUnder40()             { under40Only = !under40Only }
}
