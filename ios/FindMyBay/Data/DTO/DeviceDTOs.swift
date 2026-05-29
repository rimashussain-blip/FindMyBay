// DeviceDTOs.swift
//
// Wire-format types for the devices/* endpoints. Source: data/api/DeviceApi.kt
// (DTOs are defined inline alongside the interface on the Kotlin side).

import Foundation

struct RegisterDeviceBody: Codable {
    let fcmToken: String
    /// Always `"ios"` for this app.
    let platform: String
}

struct LocationBody: Codable {
    let lat: Double
    let lng: Double
    let accuracyM: Double?
}

struct OkResponse: Codable {
    let ok: Bool
}
