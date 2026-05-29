// GoogleMapsService.swift
//
// One-shot initializer for the Google Maps SDK. Must be called once before
// any `GMSMapView` is constructed — typically from `FindMyBayApp.init`.

import Foundation
import GoogleMaps

enum GoogleMapsService {

    static var isConfigured: Bool {
        let key = AppConfig.googleMapsAPIKey
        return !key.isEmpty && !key.contains("REPLACE_WITH")
    }

    /// Reads `GOOGLE_MAPS_API_KEY` from Info.plist and primes the SDK.
    /// Safe to call multiple times — Google ignores subsequent calls.
    /// Returns `false` (with a console warning) if the key is missing
    /// so the rest of the app keeps running with an empty map.
    @discardableResult
    static func configure() -> Bool {
        guard isConfigured else {
            print("⚠️ GoogleMaps: GOOGLE_MAPS_API_KEY missing or placeholder. " +
                  "Set the iOS Maps API key in project.yml and regenerate.")
            return false
        }
        GMSServices.provideAPIKey(AppConfig.googleMapsAPIKey)
        return true
    }
}
