// APIClient.swift
//
// Generic JSON-over-URLSession client. Replaces the Android
// `Retrofit + OkHttp + AuthInterceptor` stack with a single async/await type.
//
// Auto-refresh policy
// -------------------
// When an authenticated request returns 401 the client transparently calls
// `POST /auth/refresh` once with the stored refresh token, persists the
// rotated pair, and retries the original request.
//
// Critically, the keychain is **only wiped on a *definite* refresh failure**
// (the backend tells us the refresh token is invalid/revoked/expired —
// itself a 401 from `/auth/refresh`). For every transient failure of the
// refresh call — network down, 5xx, TLS hiccup, slow server — we leave the
// keychain alone and just propagate `.unauthorized` so the caller can show
// a transient error / retry. Previous versions would clear the keychain on
// any refresh failure which caused intermittent sign-outs that looked
// completely random.

import Foundation

/// Header marker that mirrors the Android `@Headers("No-Auth: true")` annotation
/// — when present, the auth interceptor will NOT attach the bearer token.
/// Use it on `auth/otp/*`, `auth/google`, `auth/refresh`, etc.
let kNoAuthHeader = "X-Fmb-No-Auth"

/// Internal header — added by the retry logic to the second attempt of a
/// previously-401'd request so the recursion terminates after one refresh.
private let kRetriedHeader = "X-Fmb-Retried"

/// HTTP verb.
enum HTTPMethod: String {
    case GET, POST, PATCH, PUT, DELETE
}

/// Refresh outcomes. Only `.refreshTokenInvalid` causes a keychain wipe.
private enum RefreshOutcome {
    case success
    /// 401 from `/auth/refresh` — the refresh token is genuinely no good.
    case refreshTokenInvalid
    /// Network down, 5xx, timeout, no AuthAPI bound yet. Don't wipe.
    case transient
}

actor APIClient {

    private let baseURL: URL
    private let session: URLSession
    private let tokens: TokenStore
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder

    /// Coalesces concurrent refresh attempts — if 5 requests all 401 at once
    /// we want a single hit to `/auth/refresh`, not five.
    private var inFlightRefresh: Task<RefreshOutcome, Never>?

    /// `AuthAPI` reference is set after construction (to break the cycle:
    /// AuthAPI needs APIClient, APIClient needs AuthAPI for refresh).
    private var authAPI: AuthAPI?

    init(baseURL: URL = AppConfig.apiBaseURL,
         tokens: TokenStore,
         session: URLSession = .shared) {
        self.baseURL = baseURL
        self.tokens = tokens
        self.session = session

        let dec = JSONDecoder()
        self.decoder = dec

        let enc = JSONEncoder()
        enc.outputFormatting = []
        self.encoder = enc
    }

    /// Late-bound to break the AuthAPI ↔ APIClient init cycle. Call once
    /// from `AppEnvironment.init` while still on the main thread before
    /// any view triggers a request.
    func setAuthAPI(_ api: AuthAPI) { self.authAPI = api }

    // MARK: - Public

    @discardableResult
    func request<T: Decodable>(
        _ method: HTTPMethod,
        path: String,
        query: [URLQueryItem] = [],
        body: Encodable? = nil,
        headers: [String: String] = [:]
    ) async throws -> T {
        let data = try await rawRequest(
            method, path: path, query: query, body: body, headers: headers
        )
        if T.self == EmptyResponse.self { return EmptyResponse() as! T }
        do { return try decoder.decode(T.self, from: data) }
        catch { throw APIError.decoding(error) }
    }

    func requestNoBody(
        _ method: HTTPMethod,
        path: String,
        query: [URLQueryItem] = [],
        body: Encodable? = nil,
        headers: [String: String] = [:]
    ) async throws {
        _ = try await rawRequest(
            method, path: path, query: query, body: body, headers: headers
        )
    }

    // MARK: - Internals

    private func rawRequest(
        _ method: HTTPMethod,
        path: String,
        query: [URLQueryItem],
        body: Encodable?,
        headers: [String: String]
    ) async throws -> Data {
        let url = try buildURL(path: path, query: query)
        var req = URLRequest(url: url)
        req.httpMethod = method.rawValue
        req.setValue("application/json", forHTTPHeaderField: "Accept")

        // Attach bearer unless this call is marked No-Auth.
        let isNoAuth = headers[kNoAuthHeader] != nil
        if !isNoAuth, let token = await tokens.accessToken() {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        if let body {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            do { req.httpBody = try encoder.encode(AnyEncodable(body)) }
            catch { throw APIError.decoding(error) }
        }

        for (k, v) in headers where k != kNoAuthHeader && k != kRetriedHeader {
            req.setValue(v, forHTTPHeaderField: k)
        }

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: req)
        } catch {
            throw APIError.transport(error)
        }

        guard let http = response as? HTTPURLResponse else {
            throw APIError.malformedResponse
        }

        switch http.statusCode {
        case 200..<300:
            return data

        case 401, 403:
            let alreadyRetried = headers[kRetriedHeader] != nil
            if !isNoAuth, !alreadyRetried, await tokens.refreshToken() != nil {
                let outcome = await coalescedRefresh()
                switch outcome {
                case .success:
                    var retryHeaders = headers
                    retryHeaders[kRetriedHeader] = "1"
                    return try await rawRequest(
                        method, path: path, query: query,
                        body: body, headers: retryHeaders
                    )
                case .refreshTokenInvalid:
                    // Definite — refresh token is bad. The session is over.
                    print("🔐 APIClient: refresh token invalid — clearing keychain")
                    await tokens.clear()
                case .transient:
                    // Network blip / 5xx / no-AuthAPI window. Keep tokens
                    // so the user doesn't get silently signed out for a
                    // momentary blip; the caller propagates .unauthorized
                    // and the next call after the network recovers will
                    // refresh and proceed.
                    print("🔐 APIClient: refresh transiently failed — keeping tokens")
                }
            }
            let message = (try? decoder.decode(APIErrorBody.self, from: data))?.message
            throw APIError.unauthorized(message: message)

        default:
            let message = (try? decoder.decode(APIErrorBody.self, from: data))?.message
            throw APIError.http(status: http.statusCode, message: message)
        }
    }

    /// One refresh attempt shared across concurrent callers.
    private func coalescedRefresh() async -> RefreshOutcome {
        if let existing = inFlightRefresh { return await existing.value }

        let task = Task<RefreshOutcome, Never> { [weak self] in
            guard let self else { return .transient }
            defer { Task { await self.clearInFlight() } }
            return await self.performRefresh()
        }
        inFlightRefresh = task
        return await task.value
    }

    private func clearInFlight() { inFlightRefresh = nil }

    private func performRefresh() async -> RefreshOutcome {
        guard let authAPI else {
            print("⚠️ APIClient: no AuthAPI bound — treating refresh as transient")
            return .transient
        }
        guard let presented = await tokens.refreshToken() else {
            // No refresh token at all → can't refresh. Treat as definite
            // (we're not signed in).
            return .refreshTokenInvalid
        }

        do {
            let resp = try await authAPI.refresh(RefreshBody(refreshToken: presented))
            guard let existing = await tokens.session() else {
                // Race: session was cleared between the call going out and
                // the response coming back. Treat as definite.
                return .refreshTokenInvalid
            }
            let rotated = AuthSession(
                accessToken: resp.accessToken,
                refreshToken: resp.refreshToken,
                userId: existing.userId,
                phone: existing.phone,
                fullName: existing.fullName
            )
            await tokens.save(session: rotated)
            return .success
        } catch APIError.unauthorized {
            // Backend explicitly rejected the refresh token.
            return .refreshTokenInvalid
        } catch {
            // Network, 5xx, decoding error — keep tokens, fail this call.
            print("⚠️ APIClient: refresh transient — \(error.localizedDescription)")
            return .transient
        }
    }

    private func buildURL(path: String, query: [URLQueryItem]) throws -> URL {
        let trimmed = path.hasPrefix("/") ? String(path.dropFirst()) : path
        guard var components = URLComponents(
            url: baseURL.appendingPathComponent(trimmed),
            resolvingAgainstBaseURL: false
        ) else { throw APIError.malformedResponse }
        if !query.isEmpty {
            components.queryItems = (components.queryItems ?? []) + query
        }
        guard let url = components.url else { throw APIError.malformedResponse }
        return url
    }
}

struct EmptyResponse: Decodable {}

private struct AnyEncodable: Encodable {
    let _encode: (Encoder) throws -> Void
    init<T: Encodable>(_ wrapped: T) { self._encode = wrapped.encode }
    func encode(to encoder: Encoder) throws { try _encode(encoder) }
}
