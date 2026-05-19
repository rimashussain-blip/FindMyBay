// ProfileViewModel.swift
//
// Loads /auth/me and exposes name editing + sign-out. Mirrors
// `feature/profile/ProfileViewModel.kt`.

import Foundation
import Observation

@Observable @MainActor
final class ProfileViewModel {

    var loading: Bool = true
    var saving: Bool = false
    var profile: UserProfile? = nil
    var pushEnabled: Bool = true
    var smartAlertsEnabled: Bool = true
    var signedOut: Bool = false
    var error: String? = nil

    private let auth: AuthRepository

    init(auth: AuthRepository) {
        self.auth = auth
    }

    func load() {
        loading = true
        error = nil
        Task {
            do {
                profile = try await auth.me()
                loading = false
            } catch {
                loading = false
                self.error = (error as? LocalizedError)?.errorDescription
                    ?? "Couldn't load profile"
            }
        }
    }

    func saveName(_ newName: String) {
        let trimmed = newName.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return }
        saving = true; error = nil
        Task {
            do {
                profile = try await auth.updateMe(fullName: trimmed)
                saving = false
            } catch {
                saving = false
                self.error = (error as? LocalizedError)?.errorDescription ?? "Couldn't save"
            }
        }
    }

    func togglePush()         { pushEnabled         = !pushEnabled }
    func toggleSmartAlerts()  { smartAlertsEnabled  = !smartAlertsEnabled }

    func signOut() {
        Task {
            await auth.logout()
            signedOut = true
        }
    }
}
