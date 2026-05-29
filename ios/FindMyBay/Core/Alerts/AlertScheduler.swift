// AlertScheduler.swift
//
// Smart-leave alerting on iOS. The realistic equivalent of Android's
// `USE_FULL_SCREEN_INTENT` + WorkManager safety-net is:
//
//   1. Request `.alert` + `.sound` notification authorization on first
//      booking. Time-sensitive interruption level is automatic on iOS 15+
//      once the user has granted notifications — no separate entitlement
//      needed for the "break through Focus modes" behaviour. ("Critical
//      Alerts" — the lock-screen full-takeover — requires a separate Apple-
//      reviewed entitlement that's only granted to medical/safety apps, so
//      we don't pursue it.)
//
//   2. Schedule a local notification at slot−5min as a safety-net in case
//      the server-side FCM push to the same booking gets delayed.
//
//   3. The push payload sets a deep-link that drops the user straight into
//      `LeaveNowView` when tapped (the `.fullScreenCover` is wired by
//      `RootView` when `pendingLeaveNow` is set).
//
// All work routes through `UNUserNotificationCenter` so it's the same path
// used by APNs payloads from the backend later.

import Foundation
import UserNotifications

@MainActor
enum AlertScheduler {

    /// Request `.alert` + `.sound` + `.timeSensitive` (M3+ Focus pass-thru)
    /// authorization. Returns the resulting authorization status so callers
    /// can decide whether to show an in-app "enable notifications" banner.
    @discardableResult
    static func requestAuthorization() async -> UNAuthorizationStatus {
        let center = UNUserNotificationCenter.current()
        do {
            // `.timeSensitive` is the magic flag — same effect as Android's
            // setFullScreenIntent for breaking Focus modes / Do-Not-Disturb.
            _ = try await center.requestAuthorization(options: [.alert, .sound, .badge, .timeSensitive])
        } catch {
            // Permission denied / restricted — just fall through and read
            // the status.
        }
        return await currentStatus()
    }

    static func currentStatus() async -> UNAuthorizationStatus {
        let settings = await UNUserNotificationCenter.current().notificationSettings()
        return settings.authorizationStatus
    }

    /// Schedule a local "leave now" notification fired at `slotStart - 5min`.
    /// Idempotent per booking id — re-scheduling replaces any prior pending
    /// notification for the same booking (matches Android's `REPLACE` policy
    /// on the WorkManager job).
    static func scheduleLeaveNow(
        bookingId: String,
        vendorName: String,
        slotStart: Date,
        leadTime: TimeInterval = 5 * 60
    ) {
        let fireAt = slotStart.addingTimeInterval(-leadTime)
        // Don't schedule if we're already past the lead time.
        guard fireAt > Date() else { return }

        let content = UNMutableNotificationContent()
        content.title = "Leave now"
        content.body = "Time to head to \(vendorName) for your wash."
        content.sound = .default
        content.interruptionLevel = .timeSensitive   // breaks through Focus / DND
        content.userInfo = [
            "kind": "leave_now",
            "bookingId": bookingId,
            "vendorName": vendorName,
            "slotStart": ISO8601DateFormatter().string(from: slotStart),
        ]
        content.categoryIdentifier = "FMB_LEAVE_NOW"
        // No threading id — each booking is its own thread.

        let trigger = UNCalendarNotificationTrigger(
            dateMatching: Calendar.current.dateComponents(
                [.year, .month, .day, .hour, .minute],
                from: fireAt
            ),
            repeats: false
        )
        let request = UNNotificationRequest(
            identifier: identifier(for: bookingId),
            content: content,
            trigger: trigger
        )
        UNUserNotificationCenter.current().add(request) { error in
            if let error {
                NSLog("AlertScheduler add failed: %@", error.localizedDescription)
            }
        }
    }

    /// Cancel a previously scheduled leave-now alert (e.g. booking cancelled
    /// or completed). Idempotent — silently no-ops if nothing was pending.
    static func cancelLeaveNow(bookingId: String) {
        UNUserNotificationCenter.current()
            .removePendingNotificationRequests(withIdentifiers: [identifier(for: bookingId)])
    }

    private static func identifier(for bookingId: String) -> String {
        "fmb.leaveNow.\(bookingId)"
    }
}
