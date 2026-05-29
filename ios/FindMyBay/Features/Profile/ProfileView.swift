// ProfileView.swift
//
// Profile tab — avatar w/ initials, name edit, push toggle, smart-alerts
// toggle, car details summary, sign-out. Mirrors `ProfileScreen.kt`.

import SwiftUI

struct ProfileView: View {

    var onSignOut: () -> Void

    @Environment(\.fmbScheme) private var scheme
    @Environment(\.appEnvironment) private var env
    @State private var vm: ProfileViewModel?
    @State private var nameDraft: String = ""
    @State private var editingName: Bool = false

    var body: some View {
        Group {
            if let vm {
                content(vm: vm)
                    .onChange(of: vm.signedOut) { _, signed in
                        if signed {
                            GoogleSignInService.signOut()
                            onSignOut()
                        }
                    }
            } else {
                ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(scheme.background)
            }
        }
        .onAppear {
            if vm == nil {
                let new = ProfileViewModel(auth: env.authRepo)
                vm = new
                new.load()
            }
        }
        .navigationTitle("Profile")
        .navigationBarTitleDisplayMode(.large)
    }

    @ViewBuilder
    private func content(vm: ProfileViewModel) -> some View {
        ZStack {
            scheme.background.ignoresSafeArea()
            ScrollView {
                if vm.loading {
                    ProgressView().padding(40)
                } else if let p = vm.profile {
                    VStack(spacing: 16) {
                        avatarBlock(p)
                        nameRow(p, vm: vm)
                        contactCard(p)
                        if hasCarDetails(p) { carCard(p) }
                        toggles(vm: vm)
                        Button(role: .destructive, action: { vm.signOut() }) {
                            Text("Sign out")
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 12)
                                .foregroundStyle(scheme.error)
                        }
                        .background(scheme.surfaceContainer)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                        .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(scheme.outline, lineWidth: 1))
                        Spacer().frame(height: 32)
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 16)
                } else if let err = vm.error {
                    Text(err).foregroundStyle(scheme.error).padding(40)
                }
            }
        }
    }

    private func avatarBlock(_ p: UserProfile) -> some View {
        VStack(spacing: 8) {
            ZStack {
                Circle().fill(Fmb.aqua).frame(width: 88, height: 88)
                Text(p.initials)
                    .font(.system(size: 32, weight: .bold))
                    .foregroundStyle(.white)
            }
            Text(p.fullName ?? p.email ?? p.phone ?? "Customer")
                .font(Fmb.Typo.titleLarge)
                .foregroundStyle(scheme.onBackground)
        }
        .padding(.top, 8)
    }

    private func nameRow(_ p: UserProfile, vm: ProfileViewModel) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text("Display name")
                    .font(Fmb.Typo.labelMedium)
                    .foregroundStyle(scheme.onSurfaceVariant)
                Spacer()
                if !editingName {
                    Button("Edit") {
                        nameDraft = p.fullName ?? ""
                        editingName = true
                    }
                    .font(Fmb.Typo.labelMedium)
                    .foregroundStyle(Fmb.deep)
                }
            }
            if editingName {
                HStack(spacing: 8) {
                    TextField("Your name", text: $nameDraft)
                        .padding(.horizontal, 12).padding(.vertical, 10)
                        .background(scheme.surfaceContainer)
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                    Button("Save") {
                        vm.saveName(nameDraft)
                        editingName = false
                    }
                    .disabled(vm.saving || nameDraft.trimmingCharacters(in: .whitespaces).isEmpty)
                    .tint(scheme.primary)
                    Button("Cancel") { editingName = false }
                        .tint(scheme.onSurfaceVariant)
                }
            } else {
                Text(p.fullName ?? "Not set")
                    .font(Fmb.Typo.bodyMedium)
                    .foregroundStyle(scheme.onBackground)
                    .padding(.vertical, 8)
            }
        }
        .padding(14)
        .background(scheme.surfaceContainer)
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(scheme.outline, lineWidth: 1))
    }

    private func contactCard(_ p: UserProfile) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Contact")
                .font(Fmb.Typo.labelMedium)
                .foregroundStyle(scheme.onSurfaceVariant)
            if let email = p.email, !email.isEmpty {
                Label(email, systemImage: "envelope")
                    .font(Fmb.Typo.bodyMedium)
            }
            if let phone = p.phone, !phone.isEmpty {
                Label(phone, systemImage: "phone")
                    .font(Fmb.Typo.bodyMedium)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(scheme.surfaceContainer)
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(scheme.outline, lineWidth: 1))
    }

    private func hasCarDetails(_ p: UserProfile) -> Bool {
        (p.carMake ?? p.carColor ?? p.carPlate) != nil
    }

    private func carCard(_ p: UserProfile) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Vehicle")
                .font(Fmb.Typo.labelMedium)
                .foregroundStyle(scheme.onSurfaceVariant)
            if let plate = p.carPlate, !plate.isEmpty {
                Text(plate)
                    .font(.system(size: 22, weight: .bold, design: .monospaced))
                    .foregroundStyle(scheme.onBackground)
            }
            let parts = [p.carColor, p.carMake, p.carType?.capitalized]
                .compactMap { $0?.trimmingCharacters(in: .whitespaces) }
                .filter { !$0.isEmpty }
            if !parts.isEmpty {
                Text(parts.joined(separator: " · "))
                    .font(Fmb.Typo.bodyMedium)
                    .foregroundStyle(scheme.onSurfaceVariant)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(scheme.surfaceContainer)
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(scheme.outline, lineWidth: 1))
    }

    private func toggles(vm: ProfileViewModel) -> some View {
        VStack(spacing: 8) {
            Toggle(isOn: Binding(get: { vm.pushEnabled },
                                 set: { _ in vm.togglePush() })) {
                Label("Push notifications", systemImage: "bell")
            }
            Toggle(isOn: Binding(get: { vm.smartAlertsEnabled },
                                 set: { _ in vm.toggleSmartAlerts() })) {
                Label("Smart leave-now alerts", systemImage: "location.north.line")
            }
        }
        .padding(14)
        .background(scheme.surfaceContainer)
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(scheme.outline, lineWidth: 1))
    }
}
