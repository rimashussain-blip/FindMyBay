// RealtimeClient.swift
//
// Socket.IO client for `booking:status` push events. Mirrors the Android
// `core/realtime/RealtimeClient.kt`:
//   1. Connect once after sign-in to the API base URL (no /socket.io path
//      — Socket.IO discovers it automatically).
//   2. On `connect`, emit `subscribe:customer <userId>` so the server adds
//      us to `customer:<userId>` room.
//   3. Listen for `booking:status` events; surface them as a Swift
//      `AsyncStream` so view-models can `for await` updates without
//      knowing about Socket.IO.
//
// Internally guarded by an internal serial queue rather than `@MainActor`
// because the host `AppEnvironment` is constructed at SwiftUI environment-
// key default-value time, which is non-isolated.

import Foundation
import SocketIO

/// One realtime push: the server changed the status of a booking we own.
struct BookingStatusEvent: Equatable, Sendable {
    let bookingId: String
    let status: String
}

final class RealtimeClient: @unchecked Sendable {

    private let tokens: TokenStore
    private let manager: SocketManager
    private let socket: SocketIOClient
    private let stateQueue = DispatchQueue(label: "ae.findmybay.realtime")

    // Mutated only from `stateQueue`.
    private var subscribedUserId: String? = nil
    private var continuations: [UUID: AsyncStream<BookingStatusEvent>.Continuation] = [:]

    init(tokens: TokenStore, baseURL: URL = AppConfig.apiBaseURL) {
        self.tokens = tokens
        // SocketIOClient appends `/socket.io` to whatever URL we hand it,
        // so pass the bare API origin.
        let origin: URL = {
            guard let scheme = baseURL.scheme, let host = baseURL.host else { return baseURL }
            var c = URLComponents()
            c.scheme = scheme
            c.host = host
            if let port = baseURL.port { c.port = port }
            return c.url ?? baseURL
        }()
        self.manager = SocketManager(socketURL: origin, config: [
            .compress,
            .reconnects(true),
            .reconnectAttempts(-1),
            .reconnectWait(2),
        ])
        self.socket = manager.defaultSocket
        registerHandlers()
    }

    // MARK: - Public

    /// Idempotent — repeat calls reuse the same socket. Connects + subscribes
    /// once a `userId` is in the TokenStore.
    func start() {
        if socket.status == .connected || socket.status == .connecting { return }
        socket.connect()
    }

    func stop() {
        socket.disconnect()
        stateQueue.async { self.subscribedUserId = nil }
    }

    /// Force a re-subscribe — useful right after a fresh sign-in where the
    /// socket may already be connected for the previous user.
    func onLoginChanged() {
        Task { await ensureSubscribed(force: true) }
    }

    /// Stream of `booking:status` events. Each subscriber gets its own
    /// continuation so multiple view-models can listen.
    func bookingStatusEvents() -> AsyncStream<BookingStatusEvent> {
        AsyncStream { cont in
            let id = UUID()
            self.stateQueue.async { self.continuations[id] = cont }
            cont.onTermination = { [weak self] _ in
                self?.stateQueue.async { self?.continuations.removeValue(forKey: id) }
            }
        }
    }

    // MARK: - Internals

    private func registerHandlers() {
        socket.on(clientEvent: .connect) { [weak self] _, _ in
            print("🛰️ Realtime: connected")
            Task { await self?.ensureSubscribed() }
        }
        socket.on(clientEvent: .disconnect) { _, _ in
            print("🛰️ Realtime: disconnected")
        }
        socket.on(clientEvent: .error) { args, _ in
            print("🛰️ Realtime: error \(args)")
        }
        socket.on("booking:status") { [weak self] data, _ in
            guard let self else { return }
            let payload = data.first as? [String: Any]
            let bookingId = payload?["bookingId"] as? String
            let status    = payload?["status"]    as? String
            if let bookingId, let status, !bookingId.isEmpty, !status.isEmpty {
                print("🛰️ Realtime: booking:status \(bookingId) → \(status)")
                let event = BookingStatusEvent(bookingId: bookingId, status: status)
                self.stateQueue.async {
                    for cont in self.continuations.values { cont.yield(event) }
                }
            }
        }
    }

    private func ensureSubscribed(force: Bool = false) async {
        guard let userId = await tokens.userId() else {
            print("🛰️ Realtime: no userId in TokenStore — skipping subscribe")
            return
        }
        let alreadySubscribed: Bool = await withCheckedContinuation { cont in
            stateQueue.async {
                cont.resume(returning: !force && userId == self.subscribedUserId)
            }
        }
        if alreadySubscribed { return }
        socket.emit("subscribe:customer", userId)
        stateQueue.async { self.subscribedUserId = userId }
        print("🛰️ Realtime: subscribed as customer:\(userId)")
    }
}
