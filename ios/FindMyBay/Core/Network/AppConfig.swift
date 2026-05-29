// AppConfig.swift
//
// Centralised compile-time / runtime configuration. Source of truth for the
// backend base URL, API keys (read from Info.plist where they exist), and
// other environment knobs. The Android equivalent is BuildConfig.

import Foundation

enum AppConfig {
    /// Backend base URL. Trailing slash matches Retrofit's `baseUrl()` style
    /// — relative paths in API specs (`auth/otp/request`) resolve correctly.
    /// Hosted on Azure Container Apps in UAE North.
    static let apiBaseURL: URL = URL(
        string: "https://fmb-backend.bravegrass-00d218a4.uaenorth.azurecontainerapps.io/"
    )!

    /// Origin form (no trailing slash) for Socket.IO. Matches the Android
    /// `RealtimeClient.start()` behaviour.
    static var realtimeOrigin: String {
        var s = apiBaseURL.absoluteString
        if s.hasSuffix("/") { s.removeLast() }
        return s
    }

    /// Google Maps iOS API key. Read from `GOOGLE_MAPS_API_KEY` in Info.plist.
    /// Falls back to empty string in dev — the map will render blank tiles.
    /// Set this in a non-committed `Secrets.xcconfig` once you have the key
    /// (see iOS README).
    static var googleMapsAPIKey: String {
        Bundle.main.object(forInfoDictionaryKey: "GOOGLE_MAPS_API_KEY") as? String ?? ""
    }

    /// True when running in the iOS Simulator. Useful for guarding APNs
    /// registration paths that don't work on simulator.
    static var isRunningInSimulator: Bool {
        #if targetEnvironment(simulator)
        return true
        #else
        return false
        #endif
    }
}
