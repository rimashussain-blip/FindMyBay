// FindMyBayApp.swift
//
// SwiftUI app entry point. Equivalent of MainActivity.kt + FindMyBayApp.kt.
// Owns app-wide singletons (DI container) and dispatches incoming URLs to
// the right handler — Google OAuth callback or `findmybay://payment/return`.

import SwiftUI
import GoogleSignIn

@main
struct FindMyBayApp: App {

    /// App-wide singletons. Held by the App so they outlive every view.
    /// Named `appEnv` (not `environment`) so calls to SwiftUI's `.environment()`
    /// view modifier resolve unambiguously inside the Scene body.
    @State private var appEnv: AppEnvironment = AppEnvironment.live()

    init() {
        // SDKs that need static one-shot setup before any view that uses them
        // is constructed. Both are no-ops with a friendly log if their key
        // is still a placeholder — the rest of the app keeps running.
        _ = GoogleSignInService.configureFromInfoPlist()
        _ = GoogleMapsService.configure()
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(\.appEnvironment, appEnv)
                .fmbTheme()
                // App follows the system color scheme. We briefly locked to
                // light mode in build 5 to mirror Android commit 771e9f2,
                // but Android reverted that in 43ab59a — dark mode is fully
                // designed (dark FmbScheme) and users who prefer dark on
                // their phone should get it. Per-screen dark-mode pins
                // (Smart Leave Alert's fixed gradient, Show QR module
                // colour, vendor-detail back chevron, map-error banner)
                // all stay so dark mode renders correctly everywhere.
                .onOpenURL { url in handleIncoming(url) }
        }
    }

    /// Custom URL scheme dispatcher.
    /// - Google Sign-In returns through a `com.googleusercontent.apps.*` URL
    ///   that the SDK consumes via `GIDSignIn.handle(_:)`.
    /// - Payment hosted page returns through `findmybay://payment/return?…`.
    private func handleIncoming(_ url: URL) {
        if GIDSignIn.sharedInstance.handle(url) { return }
        if appEnv.paymentReturnBus.handleIncomingURL(url) { return }
        print("Incoming URL not handled: \(url.absoluteString)")
    }
}

// MARK: - AppEnvironment (manual DI container — replaces Hilt)

/// Container that exposes app-wide singletons (token store, API clients) to
/// views via `@Environment(\.appEnvironment)`. Replaces Hilt's `@Inject`
/// graph from the Android side.
@Observable
final class AppEnvironment {
    let tokens: TokenStore
    let apiClient: APIClient
    // Network-layer protocols
    let auth: AuthAPI
    let vendors: VendorAPI
    let bookings: BookingAPI
    let payments: PaymentAPI
    let devices: DeviceAPI
    // Repositories (use-case layer)
    let authRepo: AuthRepository
    let vendorRepo: VendorRepository
    let bookingRepo: BookingRepository
    let paymentRepo: PaymentRepository
    let paymentReturnBus: PaymentReturnBus
    let realtime: RealtimeClient
    let leaveNow: LeaveNowPresenter

    init(tokens: TokenStore, apiClient: APIClient) {
        self.tokens = tokens
        self.apiClient = apiClient
        let auth = AuthAPIImpl(client: apiClient)
        let vendors = VendorAPIImpl(client: apiClient)
        let bookings = BookingAPIImpl(client: apiClient)
        let payments = PaymentAPIImpl(client: apiClient)
        self.auth        = auth
        self.vendors     = vendors
        self.bookings    = bookings
        self.payments    = payments
        self.devices     = DeviceAPIImpl(client: apiClient)
        self.authRepo    = AuthRepository(api: auth, tokens: tokens)
        self.vendorRepo  = VendorRepository(api: vendors)
        self.bookingRepo = BookingRepository(api: bookings)
        self.paymentRepo = PaymentRepository(api: payments)
        self.paymentReturnBus = PaymentReturnBus()
        self.realtime    = RealtimeClient(tokens: tokens)
        self.leaveNow    = LeaveNowPresenter()
        // Late-bind AuthAPI on the client so `rawRequest` can reach the
        // refresh endpoint when an authenticated call returns 401.
        Task { await apiClient.setAuthAPI(auth) }
    }

    static func live() -> AppEnvironment {
        let tokens = TokenStore()
        let client = APIClient(tokens: tokens)
        return AppEnvironment(tokens: tokens, apiClient: client)
    }
}

private struct AppEnvironmentKey: EnvironmentKey {
    static let defaultValue: AppEnvironment = AppEnvironment.live()
}

extension EnvironmentValues {
    var appEnvironment: AppEnvironment {
        get { self[AppEnvironmentKey.self] }
        set { self[AppEnvironmentKey.self] = newValue }
    }
}
