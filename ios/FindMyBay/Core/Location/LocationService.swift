// LocationService.swift
//
// Lightweight CoreLocation wrapper. Provides a one-shot async API:
// `requestPermission()` and `currentLocation()`. Replaces the Android
// `FusedLocationProviderClient.getCurrentLocation(...)` call from
// `NearbyViewModel.kt`.

import Foundation
import CoreLocation

enum LocationError: Error, LocalizedError {
    case permissionDenied
    case unavailable

    var errorDescription: String? {
        switch self {
        case .permissionDenied: return "Allow location access to see car washes near you."
        case .unavailable:      return "Couldn't read your location. Try again outdoors or with GPS on."
        }
    }
}

@MainActor
final class LocationService: NSObject, CLLocationManagerDelegate {

    static let shared = LocationService()

    private let manager = CLLocationManager()
    private var locationContinuation: CheckedContinuation<CLLocation, Error>?
    private var permissionContinuation: CheckedContinuation<Bool, Never>?

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
    }

    var authorizationStatus: CLAuthorizationStatus { manager.authorizationStatus }

    /// Returns `true` once the user has granted (or had previously granted)
    /// at-least-while-in-use permission. Resolves immediately if status is
    /// already determined.
    func requestPermission() async -> Bool {
        let status = manager.authorizationStatus
        if status == .authorizedWhenInUse || status == .authorizedAlways { return true }
        if status == .denied || status == .restricted { return false }

        return await withCheckedContinuation { (cont: CheckedContinuation<Bool, Never>) in
            permissionContinuation = cont
            manager.requestWhenInUseAuthorization()
        }
    }

    /// One-shot fetch of the current location. Times out after ~10s.
    func currentLocation() async throws -> CLLocation {
        let status = manager.authorizationStatus
        guard status == .authorizedWhenInUse || status == .authorizedAlways else {
            throw LocationError.permissionDenied
        }
        return try await withCheckedThrowingContinuation { cont in
            locationContinuation = cont
            manager.requestLocation()
        }
    }

    // MARK: - CLLocationManagerDelegate

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        let status = manager.authorizationStatus
        if let cont = permissionContinuation, status != .notDetermined {
            permissionContinuation = nil
            cont.resume(returning: status == .authorizedWhenInUse || status == .authorizedAlways)
        }
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let cont = locationContinuation else { return }
        locationContinuation = nil
        if let location = locations.last {
            cont.resume(returning: location)
        } else {
            cont.resume(throwing: LocationError.unavailable)
        }
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        guard let cont = locationContinuation else { return }
        locationContinuation = nil
        cont.resume(throwing: LocationError.unavailable)
    }
}
