// PaymentReturnBus.swift
//
// Mirrors Android's `core/payment/PaymentReturnBus.kt` — a tiny pub/sub the
// payment screen subscribes to so it can react to a `findmybay://payment/return`
// custom URL scheme being delivered to the app while the user is on the pay
// screen. The hosting app (`FindMyBayApp`) decodes the URL and emits via
// `emit(_:)`; the ViewModel is on the consumer side via `events`.

import Foundation
import Observation

/// Outcome the payment hosted page sends back through the deep link.
struct PaymentReturnEvent: Equatable {
    let paymentRef: String
    /// `succeeded` | `failed` | `cancelled` | `unknown`
    let status: String
}

@Observable
final class PaymentReturnBus {

    /// The most-recently-received event. ViewModels can `withObservationTracking`
    /// or watch this property; keeping the cardinality at "last event" is fine
    /// because the payment flow is single-shot per booking.
    private(set) var lastEvent: PaymentReturnEvent?

    /// AsyncStream of incoming events for callers that prefer for-await semantics.
    /// Each subscriber gets its own continuation so events fan out cleanly.
    private var continuations: [UUID: AsyncStream<PaymentReturnEvent>.Continuation] = [:]

    func events() -> AsyncStream<PaymentReturnEvent> {
        AsyncStream { cont in
            let id = UUID()
            self.continuations[id] = cont
            cont.onTermination = { [weak self] _ in
                Task { @MainActor in self?.continuations[id] = nil }
            }
        }
    }

    func emit(_ event: PaymentReturnEvent) {
        lastEvent = event
        for cont in continuations.values { cont.yield(event) }
    }

    /// Convenience: parse a `findmybay://payment/return?ref=…&status=…` URL
    /// and emit if the scheme/host match. Returns `true` if handled.
    @discardableResult
    func handleIncomingURL(_ url: URL) -> Bool {
        guard url.scheme == "findmybay", url.host == "payment" else { return false }
        let comps = URLComponents(url: url, resolvingAgainstBaseURL: false)
        let items = comps?.queryItems ?? []
        guard let ref = items.first(where: { $0.name == "ref" })?.value else { return false }
        let status = items.first(where: { $0.name == "status" })?.value ?? "unknown"
        emit(PaymentReturnEvent(paymentRef: ref, status: status))
        return true
    }
}
