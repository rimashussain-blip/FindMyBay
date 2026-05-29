// OtpVerifyView.swift
//
// 6-digit OTP entry. Mirrors design handoff screen #2 — back chip in the
// top-left, two-line headline, masked phone, six 40×52 mint-aqua cells
// (white cell with focus halo when active), resend countdown, solid aqua
// "Verify & continue" CTA.

import SwiftUI

struct OtpVerifyView: View {

    @Bindable var vm: AuthViewModel
    let phone: String
    var onVerified: () -> Void
    var onBack: () -> Void

    @Environment(\.fmbScheme) private var scheme
    @FocusState private var codeFocused: Bool
    @State private var resendIn: Int = 24

    var body: some View {
        ZStack(alignment: .topLeading) {
            scheme.background.ignoresSafeArea()

            VStack(alignment: .leading, spacing: 0) {
                Spacer().frame(height: 8)
                FmbBackChip(action: onBack)

                Spacer().frame(height: 20)

                Text("Enter the code\nwe just sent you")
                    .font(.system(size: 26, weight: .bold))
                    .kerning(-0.5)
                    .foregroundStyle(scheme.onBackground)

                Spacer().frame(height: 12)

                Text("A 6-digit code was sent to")
                    .font(.system(size: 13))
                    .foregroundStyle(scheme.onSurfaceVariant)
                Text(prettyPhone(phone.isEmpty ? vm.phone : phone))
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Fmb.deep)

                Spacer().frame(height: 32)

                otpCells

                Spacer().frame(height: 18)

                resendRow

                if let err = vm.error {
                    Spacer().frame(height: 12)
                    Text(err)
                        .font(.system(size: 11))
                        .foregroundStyle(scheme.error)
                }

                Spacer()

                FmbPrimaryButton(
                    title: "Verify & continue",
                    loading: vm.loading,
                    enabled: canVerify,
                    action: { vm.verifyOtp(onVerified: onVerified) }
                )
                .padding(.bottom, 28)
            }
            .padding(.horizontal, 28)
        }
        .navigationBarBackButtonHidden(true)
        .onAppear {
            codeFocused = true
            startResendCountdown()
        }
    }

    // MARK: - OTP cells

    private var otpCells: some View {
        ZStack(alignment: .center) {
            // Hidden field captures keyboard / paste / one-time-code auto-fill.
            TextField("", text: Binding(
                get: { vm.code },
                set: { vm.onCodeChange($0) }
            ))
            .keyboardType(.numberPad)
            .textContentType(.oneTimeCode)
            .focused($codeFocused)
            .opacity(0.001)
            .frame(width: 1, height: 1)
            .accessibilityLabel("OTP code")

            HStack(spacing: 8) {
                ForEach(0..<6, id: \.self) { i in
                    cell(at: i)
                }
            }
            .contentShape(Rectangle())
            .onTapGesture { codeFocused = true }
        }
        .frame(maxWidth: .infinity)
    }

    @ViewBuilder
    private func cell(at i: Int) -> some View {
        let chars = Array(vm.code)
        let filled = i < chars.count
        let isActive = (i == chars.count) && codeFocused
        ZStack {
            RoundedRectangle(cornerRadius: 12)
                .fill(filled ? scheme.surfaceVariant : Color.white)
            RoundedRectangle(cornerRadius: 12)
                .strokeBorder(Fmb.aqua, lineWidth: 1.5)
            if isActive {
                RoundedRectangle(cornerRadius: 12)
                    .stroke(Fmb.aqua.opacity(0.15), lineWidth: 4)
            }
            if filled {
                Text(String(chars[i]))
                    .font(.system(size: 22, weight: .bold))
                    .foregroundStyle(scheme.onBackground)
            }
        }
        .frame(width: 40, height: 52)
    }

    // MARK: - Resend

    private var resendRow: some View {
        HStack(spacing: 4) {
            Text("Didn't get it?")
                .font(.system(size: 12))
                .foregroundStyle(scheme.onSurfaceVariant)
            if resendIn > 0 {
                Text("Resend in 0:\(String(format: "%02d", resendIn))")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Fmb.deep)
            } else {
                Button("Resend") {
                    vm.requestOtp(onSent: { _ in startResendCountdown() })
                }
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Fmb.deep)
            }
        }
        .frame(maxWidth: .infinity, alignment: .center)
    }

    private func startResendCountdown() {
        resendIn = 24
        Task {
            while resendIn > 0 {
                try? await Task.sleep(nanoseconds: 1_000_000_000)
                await MainActor.run { if resendIn > 0 { resendIn -= 1 } }
            }
        }
    }

    private var canVerify: Bool { vm.code.count == 6 }

    // MARK: - Helpers

    /// Renders `+971501234567` as `+971 50 123 4567` for display.
    private func prettyPhone(_ e164: String) -> String {
        guard e164.hasPrefix("+971") else { return e164 }
        let digits = e164.dropFirst(4)
        guard digits.count == 9 else { return e164 }
        let a = digits.prefix(2)
        let b = digits.dropFirst(2).prefix(3)
        let c = digits.dropFirst(5)
        return "+971 \(a) \(b) \(c)"
    }
}

#Preview {
    NavigationStack {
        OtpVerifyView(
            vm: AuthViewModel(auth: AuthRepository(
                api: AuthAPIImpl(client: APIClient(tokens: TokenStore())),
                tokens: TokenStore()
            )),
            phone: "+971501234567",
            onVerified: {},
            onBack: {}
        )
    }
    .fmbTheme()
}
