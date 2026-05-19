// DeviceAPI.swift
//
// Device endpoints — parity with `data/api/DeviceApi.kt`.

import Foundation

protocol DeviceAPI {
    func register(fcmToken: String) async throws -> OkResponse
    func reportLocation(lat: Double, lng: Double, accuracyM: Double?) async throws -> OkResponse
}

struct DeviceAPIImpl: DeviceAPI {
    let client: APIClient

    func register(fcmToken: String) async throws -> OkResponse {
        let body = RegisterDeviceBody(fcmToken: fcmToken, platform: "ios")
        return try await client.request(.POST, path: "devices/register", body: body)
    }

    func reportLocation(lat: Double, lng: Double, accuracyM: Double?) async throws -> OkResponse {
        let body = LocationBody(lat: lat, lng: lng, accuracyM: accuracyM)
        return try await client.request(.POST, path: "devices/location", body: body)
    }
}
