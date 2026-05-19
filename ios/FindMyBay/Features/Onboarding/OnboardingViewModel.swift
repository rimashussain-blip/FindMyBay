// OnboardingViewModel.swift
//
// First-run customer onboarding form. Two visual steps:
//   Step 1 — phone, car make, type, colour
//   Step 2 — plate
//
// Mirrors `feature/onboarding/OnboardingViewModel.kt`.

import Foundation
import Observation

@Observable @MainActor
final class OnboardingViewModel {

    enum Step { case carDetails, plate }

    // MARK: - State
    var step: Step = .carDetails
    var phone: String = "+971"
    var carMake: String = ""
    var carType: CarType? = nil
    var carColor: String = ""
    var carPlate: String = ""
    var saving: Bool = false
    var error: String? = nil
    var done: Bool = false

    // MARK: - Validation

    var step1Valid: Bool {
        phone.count >= 10
            && carMake.trimmingCharacters(in: .whitespaces).count >= 2
            && carType != nil
    }

    var step2Valid: Bool {
        carPlate.trimmingCharacters(in: .whitespaces).count >= 4
    }

    // MARK: - Deps
    private let auth: AuthRepository

    init(auth: AuthRepository) {
        self.auth = auth
    }

    // MARK: - Inputs

    func setPhone(_ value: String) {
        // Strip everything that isn't a digit or "+"; keep "+" only at the start.
        var cleaned = value.unicodeScalars.filter { CharacterSet(charactersIn: "+0123456789").contains($0) }
            .map(String.init).joined()
        if cleaned.hasPrefix("+") {
            cleaned = "+" + cleaned.dropFirst().filter(\.isNumber)
        } else {
            cleaned = cleaned.filter(\.isNumber)
        }
        phone = cleaned
        error = nil
    }

    func setCarMake(_ value: String) {
        carMake = String(value.prefix(40))
        error = nil
    }

    func setCarType(_ value: CarType) {
        carType = value
        error = nil
    }

    func setCarColor(_ value: String) {
        carColor = String(value.prefix(20))
        error = nil
    }

    func setCarPlate(_ value: String) {
        carPlate = String(value.uppercased().prefix(20))
        error = nil
    }

    // MARK: - Navigation between steps

    func goToPlateStep() {
        if step1Valid { step = .plate; error = nil }
    }

    func goBackToDetails() {
        step = .carDetails; error = nil
    }

    // MARK: - Submit

    /// One PATCH /auth/me/profile with everything. Backend accepts partial
    /// bodies but a single round-trip on Finish is cleaner UX.
    func submit(onComplete: @escaping () -> Void) {
        guard step1Valid && step2Valid else { return }
        saving = true
        error = nil
        Task {
            do {
                _ = try await auth.updateCarProfile(
                    phone: phone,
                    carMake: carMake.trimmingCharacters(in: .whitespaces),
                    carType: carType,
                    carColor: carColor.trimmingCharacters(in: .whitespaces).isEmpty ? nil
                        : carColor.trimmingCharacters(in: .whitespaces),
                    carPlate: carPlate.trimmingCharacters(in: .whitespaces)
                )
                self.saving = false
                self.done = true
                onComplete()
            } catch {
                self.saving = false
                self.error = (error as? LocalizedError)?.errorDescription
                    ?? "Something went wrong, please try again."
            }
        }
    }
}
