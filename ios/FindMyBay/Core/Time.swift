// Time.swift
//
// Shared date/time formatters. The app **always** displays slot/booking
// times in 12-hour `h:mm a` (e.g. "2:30 PM"), regardless of the user's
// system 24-hour setting — matches the Android app and the smart-leave
// FCM push body the backend already sends in that format.

import Foundation

enum FmbTime {

    /// ISO-8601 parser that tolerates fractional seconds (the backend sends
    /// `2026-05-13T14:30:00.000Z`) or no fractional component.
    private static let parser: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()
    private static let parserNoFrac: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()

    static func parse(_ iso: String) -> Date? {
        parser.date(from: iso) ?? parserNoFrac.date(from: iso)
    }

    /// 12-hour HH:mm AM/PM. Returns the raw ISO string back on parse failure.
    static func clock12(_ iso: String) -> String {
        guard let d = parse(iso) else { return iso }
        return clock12.string(from: d)
    }
    private static let clock12: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "h:mm a"
        return f
    }()

    /// "EEE d MMM" → "Tue 28 Apr"
    static func dayShort(_ iso: String) -> String {
        guard let d = parse(iso) else { return iso }
        return dayShort.string(from: d)
    }
    private static let dayShort: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "EEE d MMM"
        return f
    }()

    /// "EEE d MMM · h:mm a" → "Tue 28 Apr · 2:30 PM"
    static func dayAndClock12(_ iso: String) -> String {
        guard let d = parse(iso) else { return iso }
        return dayAndClock12.string(from: d)
    }
    private static let dayAndClock12: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "EEE d MMM · h:mm a"
        return f
    }()
}
