// LeaveNowPresenter.swift
//
// App-wide router for the smart-leave alert. The notification delegate
// publishes here when a notification is tapped, and `RootView` observes the
// `pending` payload to present `LeaveNowView` as a `.fullScreenCover`. The
// cover takes over the active tab + nav stack — the closest iOS comes to
// Android's `setFullScreenIntent` for in-app delivery.

import Foundation
import UIKit
import UserNotifications
import Observation

/// One-shot payload describing a pending leave-now alert.
struct LeaveNowPayload: Identifiable, Equatable {
    let id = UUID()
    let bookingId: String
    let vendorName: String
    let slotTime: String   // already formatted ("2:30 PM")
    let etaMin: Int        // best estimate; 0 if unknown
}

@Observable
final class LeaveNowPresenter: NSObject, UNUserNotificationCenterDelegate {

    /// Set to non-nil when an alert should be shown. `RootView` watches this
    /// via `.fullScreenCover(item: presenter.pending)` and clears it when
    /// the cover is dismissed.
    var pending: LeaveNowPayload?

    override init() {
        super.init()
        UNUserNotificationCenter.current().delegate = self
    }

    /// Manually trigger the alert (e.g. from a debug menu or an in-app
    /// "preview" button — handy for design review).
    @MainActor
    func trigger(bookingId: String, vendorName: String, slotTime: String, etaMin: Int = 0) {
        pending = LeaveNowPayload(
            bookingId: bookingId,
            vendorName: vendorName,
            slotTime: slotTime,
            etaMin: etaMin
        )
    }

    // MARK: - UNUserNotificationCenterDelegate

    /// Foreground delivery — the OS hands us the notification; we surface
    /// the in-app sheet rather than the OS banner so the experience matches
    /// "incoming call" full-screen takeover.
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        if isLeaveNow(notification) {
            Task { @MainActor in self.publishFrom(notification: notification) }
            // Still suppress the OS banner — our sheet covers everything.
            completionHandler([.sound])
        } else {
            completionHandler([.banner, .sound, .list])
        }
    }

    /// User tapped the notification from the lock screen / Notification
    /// Center / banner. Surface the sheet.
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        if isLeaveNow(response.notification) {
            Task { @MainActor in self.publishFrom(notification: response.notification) }
        }
        completionHandler()
    }

    // MARK: - Helpers

    private func isLeaveNow(_ n: UNNotification) -> Bool {
        (n.request.content.userInfo["kind"] as? String) == "leave_now"
    }

    @MainActor
    private func publishFrom(notification: UNNotification) {
        let info = notification.request.content.userInfo
        let bookingId  = info["bookingId"] as? String ?? ""
        let vendorName = info["vendorName"] as? String ?? "your wash"
        let slotIso    = info["slotStart"] as? String ?? ""
        pending = LeaveNowPayload(
            bookingId: bookingId,
            vendorName: vendorName,
            slotTime: FmbTime.clock12(slotIso),
            etaMin: 0
        )
    }
}
