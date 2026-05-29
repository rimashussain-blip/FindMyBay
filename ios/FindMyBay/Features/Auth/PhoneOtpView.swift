// PhoneOtpView.swift
//
// Phone-number entry. Mirrors design handoff screen #1 — sand halo behind a
// gradient logo mark, "MOBILE NUMBER" caps label, white phone field with
// "🇦🇪 +971" prefix and divider, solid aqua "Send code" CTA, terms footer.

import SwiftUI

struct PhoneOtpView: View {

    @Bindable var vm: AuthViewModel
    @Environment(\.fmbScheme) private var scheme

    /// Called once the OTP has been requested successfully.
    var onOtpSent: (String) -> Void

    var body: some View {
        ZStack {
            scheme.background.ignoresSafeArea()

            VStack(spacing: 0) {
                Spacer().frame(height: 40)

                ZStack {
                    FmbSandHalo(diameter: 180, intensity: 0.45)
                    FmbLogoMark(size: 68)
                }

                Spacer().frame(height: 22)

                Text("Find My Bay")
                    .font(.system(size: 28, weight: .bold))
                    .kerning(-0.6)
                    .foregroundStyle(scheme.onBackground)

                Spacer().frame(height: 8)

                Text("Book a free wash bay in seconds — across the UAE.")
                    .font(.system(size: 13))
                    .foregroundStyle(scheme.onSurfaceVariant)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 16)
                    .lineSpacing(4)

                Spacer().frame(height: 36)

                phoneFieldGroup

                if let err = vm.error {
                    Spacer().frame(height: 8)
                    Text(err)
                        .font(.system(size: 11))
                        .foregroundStyle(scheme.error)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }

                Spacer().frame(height: 16)

                FmbPrimaryButton(
                    title: "Send code",
                    loading: vm.loading,
                    enabled: canSend,
                    action: { vm.requestOtp(onSent: onOtpSent) }
                )

                Spacer()

                termsFooter
                FmbMadeInUAEBadge()
                    .padding(.top, 14)
                    .padding(.bottom, 20)
            }
            .padding(.horizontal, 28)
        }
    }

    // MARK: - Phone field

    private var phoneFieldGroup: some View {
        VStack(alignment: .leading, spacing: 8) {
            FmbSectionLabel(text: "Mobile number")

            HStack(spacing: 10) {
                Text("🇦🇪 +971")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(scheme.onBackground)
                Rectangle()
                    .fill(scheme.outline)
                    .frame(width: 1, height: 18)
                TextField(
                    "50 123 4567",
                    text: Binding(
                        get: { Self.localPart(of: vm.phone) },
                        set: { vm.onPhoneChange("+971" + $0.filter(\.isNumber)) }
                    )
                )
                .keyboardType(.phonePad)
                .textContentType(.telephoneNumber)
                .autocorrectionDisabled(true)
                .font(.system(size: 15))
                .foregroundStyle(scheme.onBackground)
            }
            .padding(.horizontal, 16).padding(.vertical, 14)
            .background(scheme.surfaceContainer)
            .clipShape(RoundedRectangle(cornerRadius: 14))
            .overlay(
                RoundedRectangle(cornerRadius: 14)
                    .strokeBorder(scheme.outline, lineWidth: 1)
            )
            .shadow(color: scheme.onBackground.opacity(0.04), radius: 1, x: 0, y: 1)
        }
    }

    /// Phone is stored E.164 (`+971501234567`) but the visible field shows
    /// only the local digits ("50 123 4567"). Strip the country prefix so
    /// the user types the local part naturally.
    private static func localPart(of e164: String) -> String {
        var s = e164
        if s.hasPrefix("+971") { s.removeFirst(4) }
        return s
    }

    private var canSend: Bool { vm.phone.count >= 11 }

    // MARK: - Footer

    private var termsFooter: some View {
        VStack(spacing: 0) {
            Text("By continuing you agree to the")
                .font(.system(size: 11))
                .foregroundStyle(scheme.onSurfaceVariant)
            HStack(spacing: 4) {
                Text("Terms").foregroundStyle(Fmb.deep)
                Text("&").foregroundStyle(scheme.onSurfaceVariant)
                Text("Privacy Policy").foregroundStyle(Fmb.deep)
            }
            .font(.system(size: 11, weight: .medium))
        }
    }
}

#Preview {
    PhoneOtpView(
        vm: AuthViewModel(auth: AuthRepository(
            api: AuthAPIImpl(client: APIClient(tokens: TokenStore())),
            tokens: TokenStore()
        )),
        onOtpSent: { _ in }
    )
    .fmbTheme()
}
