// RootView.swift
//
// Top-level routing. Three states:
//   1. !didCheckSession  → splash spinner
//   2. signedIn && profileComplete → TabRootView (full app)
//   3. signedIn && !profileComplete → OnboardingView (first-run form)
//   4. !signedIn → SignInView (Google / phone)
//
// On launch we check the Keychain (cheap, no network). If a session exists
// we additionally hit `/auth/me` to learn whether the car-profile fields
// are filled — same pattern as Android's `profileComplete` flag.

import SwiftUI

struct RootView: View {

    @Environment(\.appEnvironment) private var env
    @State private var path = NavigationPath()
    @State private var stage: Stage = .checkingSession

    private enum Stage: Equatable {
        case checkingSession
        case signedOut
        case onboarding
        case signedIn
    }

    var body: some View {
        Group {
            switch stage {
            case .checkingSession: splashView
            case .signedOut:       authStack
            case .onboarding:      onboardingStack
            case .signedIn:        TabRootView(onSignOut: signOut)
            }
        }
        .task { await bootstrap() }
        // Smart-leave alert — takes over the screen whenever the presenter
        // surfaces a payload (notification tap, in-app trigger, etc.). This
        // is the iOS equivalent of Android's `setFullScreenIntent`.
        .fullScreenCover(item: leaveNowBinding) { payload in
            LeaveNowView(
                vendorName: payload.vendorName,
                etaMin: payload.etaMin,
                slotTime: payload.slotTime,
                onDismiss: { env.leaveNow.pending = nil }
            )
        }
    }

    /// Two-way binding to the AppEnvironment-owned LeaveNowPresenter so
    /// `.fullScreenCover(item:)` can dismiss by clearing the value.
    private var leaveNowBinding: Binding<LeaveNowPayload?> {
        Binding(
            get: { env.leaveNow.pending },
            set: { env.leaveNow.pending = $0 }
        )
    }

    // MARK: - Bootstrap

    private func bootstrap() async {
        _ = GoogleSignInService.configureFromInfoPlist()
        let hasSession = await env.authRepo.hasSession()
        if !hasSession {
            stage = .signedOut
            env.realtime.stop()
            return
        }
        // Have a token — ask the server whether the profile is complete.
        // Two distinct failure modes:
        //   1. `.unauthorized` after the auto-refresh pipeline has already
        //      tried (and failed) to renew → the session is genuinely gone,
        //      drop to sign-in.
        //   2. Anything else (transport / 5xx / decode) → keep the user
        //      signed in, optimistically route to the tab shell. Profile
        //      details refetch on first MyBookings / Profile visit.
        do {
            let profile = try await env.authRepo.me()
            stage = profile.profileComplete ? .signedIn : .onboarding
            env.realtime.start()
            env.realtime.onLoginChanged()
        } catch APIError.unauthorized {
            print("🔐 bootstrap: session unauthorized — signing out")
            await env.authRepo.logout()
            env.realtime.stop()
            stage = .signedOut
        } catch {
            // Transient — we still have tokens, just couldn't reach the
            // server. Stay signed in and let the user's first navigation
            // re-trigger /me. Previously this branch logged the user out
            // on every flaky network blip — the cause of the intermittent
            // sign-out users were seeing.
            print("⚠️ bootstrap: /me failed transiently — \(error.localizedDescription)")
            stage = .signedIn
            env.realtime.start()
            env.realtime.onLoginChanged()
        }
    }

    // MARK: - Auth flow (sign in)

    private var authStack: some View {
        let vm = AuthViewModel(auth: env.authRepo)
        return NavigationStack(path: $path) {
            SignInView(
                vm: vm,
                onSignedIn: handleSignedIn,
                onUsePhone: { path.append(AuthRoute.phone) }
            )
            .navigationDestination(for: AuthRoute.self) { route in
                switch route {
                case .phone:
                    PhoneOtpView(vm: vm) { phone in
                        path.append(AuthRoute.verify(phone: phone))
                    }
                case .verify(let phone):
                    OtpVerifyView(
                        vm: vm,
                        phone: phone,
                        onVerified: handleSignedIn,
                        onBack: { path.removeLast() }
                    )
                }
            }
        }
    }

    /// After a successful sign-in we don't yet know whether the user's
    /// car profile is complete. Re-run bootstrap to decide between
    /// onboarding and the tab shell.
    private func handleSignedIn() {
        path = NavigationPath()
        stage = .checkingSession
        Task { await bootstrap() }
    }

    // MARK: - Onboarding flow

    private var onboardingStack: some View {
        let vm = OnboardingViewModel(auth: env.authRepo)
        return NavigationStack {
            OnboardingView(vm: vm) {
                stage = .signedIn
            }
        }
    }

    // MARK: - Sign-out

    private func signOut() {
        Task {
            await env.authRepo.logout()
            GoogleSignInService.signOut()
            env.realtime.stop()
            stage = .signedOut
        }
    }

    // MARK: - Splash

    @Environment(\.fmbScheme) private var scheme

    private var splashView: some View {
        ZStack {
            scheme.background.ignoresSafeArea()
            VStack(spacing: 16) {
                Image(systemName: "car.side.fill")
                    .font(.system(size: 56))
                    .foregroundStyle(scheme.primary)
                ProgressView().tint(scheme.primary)
            }
        }
    }
}

/// Routes inside the auth flow.
enum AuthRoute: Hashable {
    case phone
    case verify(phone: String)
}
