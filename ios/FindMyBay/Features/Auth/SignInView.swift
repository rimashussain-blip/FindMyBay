// SignInView.swift
//
// Auth entry point. Three options, in priority order:
//   • Continue with Google   (wired to GoogleSignInService)
//   • Sign in with Apple     (wired to AppleSignInService — requires the
//                              Sign in with Apple capability on the bundle)
//   • Continue with phone    (fallback — pushes the existing OTP flow)

import AuthenticationServices
import SwiftUI

struct SignInView: View {

    @Bindable var vm: AuthViewModel
    @Environment(\.fmbScheme) private var scheme

    var onSignedIn: () -> Void
    var onUsePhone: () -> Void

    var body: some View {
        ZStack {
            scheme.background.ignoresSafeArea()

            VStack(spacing: 0) {
                Spacer().frame(height: 64)

                ZStack {
                    Circle()
                        .fill(Fmb.sand.opacity(0.45))
                        .frame(width: 180, height: 180)
                    Image(systemName: "car.side.fill")
                        .font(.system(size: 56))
                        .foregroundStyle(Fmb.aqua)
                }

                Spacer().frame(height: 22)

                Text("Find My Bay")
                    .font(Fmb.Typo.headlineSmall)
                    .foregroundStyle(scheme.onBackground)

                Spacer().frame(height: 8)

                Text("Book a free wash bay in seconds — across the UAE.")
                    .font(Fmb.Typo.bodyMedium)
                    .foregroundStyle(scheme.onSurfaceVariant)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 24)

                Spacer().frame(height: 40)

                googleButton
                    .padding(.horizontal, 24)

                Spacer().frame(height: 12)

                appleButton
                    .padding(.horizontal, 24)

                Spacer().frame(height: 24)

                divider
                    .padding(.horizontal, 24)

                Spacer().frame(height: 16)

                phoneLink

                if let err = vm.error {
                    Spacer().frame(height: 16)
                    Text(err)
                        .font(Fmb.Typo.labelSmall)
                        .foregroundStyle(scheme.error)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 24)
                }

                Spacer()

                FmbMadeInUAEBadge()
                    .padding(.bottom, 20)
            }
        }
    }

    // MARK: - Buttons

    private var googleButton: some View {
        Button {
            vm.signInWithGoogle(onVerified: onSignedIn)
        } label: {
            HStack(spacing: 12) {
                if vm.loading {
                    ProgressView().tint(scheme.onSurface)
                } else {
                    googleLogoMark
                }
                Text(vm.loading ? "Signing in…" : "Continue with Google")
                    .font(Fmb.Typo.labelLarge)
                    .foregroundStyle(scheme.onSurface)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 52)
            .background(scheme.surfaceContainer)
            .clipShape(RoundedRectangle(cornerRadius: 14))
            .overlay(
                RoundedRectangle(cornerRadius: 14)
                    .strokeBorder(scheme.outline, lineWidth: 1)
            )
        }
        .disabled(vm.loading || !GoogleSignInService.isConfigured)
        .opacity(GoogleSignInService.isConfigured ? 1 : 0.6)
    }

    private var appleButton: some View {
        // We don't use `SignInWithAppleButton` directly because it bypasses
        // our AppleSignInService (no nonce / coordinator wiring) — Apple's
        // canned view runs its own ASAuthorizationController. To keep one
        // code path through AppleSignInService we render Apple's required
        // visual treatment ourselves and trigger our service on tap.
        //
        // The treatment matches §3.2.1 of Apple's Human Interface Guidelines
        // (Sign in with Apple): black fill, white logo + label, system-medium
        // weight, equal padding, rounded corners.
        Button {
            vm.signInWithApple(onVerified: onSignedIn)
        } label: {
            HStack(spacing: 12) {
                if vm.loading {
                    ProgressView().tint(.white)
                } else {
                    Image(systemName: "applelogo")
                        .font(.system(size: 18, weight: .medium))
                }
                Text(vm.loading ? "Signing in…" : "Sign in with Apple")
                    .font(Fmb.Typo.labelLarge)
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .frame(height: 52)
            .background(Color.black)
            .clipShape(RoundedRectangle(cornerRadius: 14))
        }
        .disabled(vm.loading)
    }

    private var divider: some View {
        HStack(spacing: 12) {
            Rectangle().fill(scheme.outline).frame(height: 1)
            Text("or")
                .font(Fmb.Typo.labelSmall)
                .foregroundStyle(scheme.onSurfaceVariant)
            Rectangle().fill(scheme.outline).frame(height: 1)
        }
    }

    private var phoneLink: some View {
        Button(action: onUsePhone) {
            HStack(spacing: 6) {
                Image(systemName: "phone.fill")
                Text("Continue with phone")
            }
            .font(Fmb.Typo.labelLarge)
            .foregroundStyle(Fmb.deep)
        }
    }

    // MARK: - Google "G" mark (drawn rather than asset-baked so it scales)

    private var googleLogoMark: some View {
        // Single-color fallback — the official multi-color "G" requires
        // shipping an asset. SF Symbol is a tasteful neutral substitute.
        Image(systemName: "g.circle.fill")
            .font(.system(size: 22))
            .foregroundStyle(Fmb.deep)
    }
}

#Preview {
    SignInView(
        vm: AuthViewModel(auth: AuthRepository(
            api: AuthAPIImpl(client: APIClient(tokens: TokenStore())),
            tokens: TokenStore()
        )),
        onSignedIn: {},
        onUsePhone: {}
    )
    .fmbTheme()
}
