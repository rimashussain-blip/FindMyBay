// APIError.swift
//
// Typed error hierarchy for the HTTP layer. Lets ViewModels switch on error
// kinds without parsing strings.

import Foundation

enum APIError: Error, LocalizedError {
    /// Request couldn't be sent (no network, DNS fail, TLS error, etc.).
    case transport(Error)
    /// Server returned a non-2xx status code with the structured `{error:{code,message}}`
    /// envelope our backend uses. `code` is e.g. `"promo_not_started"`,
    /// `"phone_taken"`, `"validation_failed"`. Callers that want to switch on
    /// specific failures (promo evaluation, phone collision, etc.) read `code`;
    /// generic UI just reads `message` / `errorDescription`.
    case http(status: Int, code: String?, message: String?)
    /// 401/403 with no clear backend message — likely a stale token on a
    /// post-auth call. Surfaces with `message` populated when available so
    /// first-time sign-in failures show the real reason ("Google sign-in
    /// failed", etc.) instead of the generic expiry copy.
    case unauthorized(message: String? = nil)
    /// JSON decoding failed — usually a backend/iOS contract drift.
    case decoding(Error)
    /// Unexpected response shape (e.g. body present but not JSON).
    case malformedResponse

    var errorDescription: String? {
        switch self {
        case .transport(let e):           return "Network error: \(e.localizedDescription)"
        case .http(let s, _, let m):      return m.map { "HTTP \(s): \($0)" } ?? "HTTP \(s)"
        case .unauthorized(let m):        return m ?? "Your session expired — please sign in again."
        case .decoding(let e):            return "Server response could not be read: \(e.localizedDescription)"
        case .malformedResponse:          return "Server returned an unexpected response."
        }
    }

    /// Just the human-readable bit — for showing in UI without the "HTTP 409:" prefix.
    /// Matches the migration spec's `userMessage`.
    var userMessage: String {
        switch self {
        case .http(_, _, let m):  return m ?? "Request failed."
        case .unauthorized(let m): return m ?? "Your session expired — please sign in again."
        case .transport(let e):   return e.localizedDescription
        case .decoding:           return "Unexpected response from the server."
        case .malformedResponse:  return "Server returned an unexpected response."
        }
    }

    /// The backend's error code if any — e.g. `"promo_not_started"`. Use this to
    /// branch UI on specific failures without string-matching the message.
    var code: String? {
        if case let .http(_, code, _) = self { return code }
        return nil
    }
}

/// Standard error envelope our backend returns on failures:
/// `{ "error": { "code": "validation_failed", "message": "...", "details": {...} } }`
struct APIErrorBody: Codable {
    let error: ErrorDetail?

    struct ErrorDetail: Codable {
        let code: String?
        let message: String?
    }

    /// Convenience accessors used by the HTTP layer.
    var message: String? { error?.message }
    var code: String? { error?.code }
}
