// OnboardingView.swift
//
// First-run customer onboarding: phone + car details + plate. Shown after a
// successful Google sign-in when `profileComplete == false`. Two-step form.

import SwiftUI

struct OnboardingView: View {

    @Bindable var vm: OnboardingViewModel
    var onComplete: () -> Void

    @Environment(\.fmbScheme) private var scheme

    var body: some View {
        ZStack {
            scheme.background.ignoresSafeArea()
            ScrollView {
                VStack(spacing: 0) {
                    header
                    Spacer().frame(height: 24)
                    switch vm.step {
                    case .carDetails: carDetailsStep
                    case .plate:      plateStep
                    }
                }
                .padding(.horizontal, 24)
                .padding(.top, 24)
                .padding(.bottom, 40)
            }
        }
        .navigationBarBackButtonHidden(true)
    }

    private var header: some View {
        VStack(spacing: 6) {
            HStack {
                stepDot(1, active: true)
                Rectangle().fill(scheme.outline).frame(height: 1)
                stepDot(2, active: vm.step == .plate)
            }
            .padding(.horizontal, 8)

            Text(vm.step == .carDetails ? "Tell us about your car" : "Add your plate number")
                .font(Fmb.Typo.headlineSmall)
                .foregroundStyle(scheme.onBackground)
                .padding(.top, 16)
            Text(vm.step == .carDetails
                 ? "We use this so attendants find your bay quickly."
                 : "Final step — just the licence plate.")
                .font(Fmb.Typo.bodyMedium)
                .foregroundStyle(scheme.onSurfaceVariant)
                .multilineTextAlignment(.center)
        }
    }

    private func stepDot(_ n: Int, active: Bool) -> some View {
        Circle()
            .fill(active ? Fmb.aqua : scheme.surfaceVariant)
            .frame(width: 28, height: 28)
            .overlay(
                Text("\(n)")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(active ? .white : scheme.onSurfaceVariant)
            )
    }

    // MARK: - Step 1

    private var carDetailsStep: some View {
        VStack(alignment: .leading, spacing: 16) {
            field(title: "Mobile number") {
                TextField("+971501234567", text: Binding(
                    get: { vm.phone },
                    set: { vm.setPhone($0) }
                ))
                .keyboardType(.phonePad)
                .textContentType(.telephoneNumber)
            }

            field(title: "Car make") {
                TextField("e.g. Toyota", text: Binding(
                    get: { vm.carMake },
                    set: { vm.setCarMake($0) }
                ))
                .textInputAutocapitalization(.words)
            }

            VStack(alignment: .leading, spacing: 8) {
                Text("Car type")
                    .font(Fmb.Typo.labelMedium)
                    .foregroundStyle(scheme.onSurfaceVariant)
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(CarType.allCases) { type in
                            chip(type.label, on: vm.carType == type) { vm.setCarType(type) }
                        }
                    }
                }
            }

            field(title: "Car colour (optional)") {
                TextField("e.g. White", text: Binding(
                    get: { vm.carColor },
                    set: { vm.setCarColor($0) }
                ))
                .textInputAutocapitalization(.words)
            }

            if let err = vm.error {
                Text(err).font(Fmb.Typo.labelSmall).foregroundStyle(scheme.error)
            }

            Spacer().frame(height: 8)

            primaryButton(label: "Continue", enabled: vm.step1Valid, loading: false) {
                vm.goToPlateStep()
            }
        }
    }

    // MARK: - Step 2

    private var plateStep: some View {
        VStack(alignment: .leading, spacing: 16) {
            field(title: "Plate number") {
                TextField("AB 12345", text: Binding(
                    get: { vm.carPlate },
                    set: { vm.setCarPlate($0) }
                ))
                .autocorrectionDisabled(true)
                .textInputAutocapitalization(.characters)
                .font(.system(size: 22, weight: .semibold, design: .monospaced))
            }

            if let err = vm.error {
                Text(err).font(Fmb.Typo.labelSmall).foregroundStyle(scheme.error)
            }

            Spacer().frame(height: 8)

            primaryButton(label: "Finish setup", enabled: vm.step2Valid, loading: vm.saving) {
                vm.submit(onComplete: onComplete)
            }

            Button("← Back to car details") { vm.goBackToDetails() }
                .font(Fmb.Typo.labelMedium)
                .foregroundStyle(Fmb.deep)
                .frame(maxWidth: .infinity)
                .padding(.top, 4)
        }
    }

    // MARK: - Bits

    private func field<Content: View>(title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(Fmb.Typo.labelMedium)
                .foregroundStyle(scheme.onSurfaceVariant)
            content()
                .padding(.horizontal, 14)
                .padding(.vertical, 12)
                .background(scheme.surfaceContainer)
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .strokeBorder(scheme.outline, lineWidth: 1)
                )
        }
    }

    private func chip(_ label: String, on: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label)
                .font(Fmb.Typo.labelMedium)
                .foregroundStyle(on ? .white : scheme.onSurface)
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
                .background(on ? Fmb.aqua : scheme.surface)
                .clipShape(Capsule())
                .overlay(Capsule().strokeBorder(on ? Fmb.aqua : scheme.outline, lineWidth: 1))
        }
    }

    private func primaryButton(label: String, enabled: Bool, loading: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            ZStack {
                LinearGradient(
                    colors: [Fmb.aquaBright, Fmb.aqua, Fmb.deep],
                    startPoint: .leading, endPoint: .trailing
                )
                .opacity(enabled ? 1 : 0.4)
                if loading {
                    ProgressView().tint(.white)
                } else {
                    Text(label).font(Fmb.Typo.labelLarge).foregroundStyle(.white)
                }
            }
            .frame(height: 50)
            .clipShape(Capsule())
        }
        .disabled(!enabled || loading)
        .frame(maxWidth: .infinity)
    }
}
