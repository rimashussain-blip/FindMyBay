// RateBookingView.swift
//
// 5-star rating + optional note. Mirrors `RateBookingScreen.kt`.

import SwiftUI

struct RateBookingView: View {

    let bookingId: String
    var onDone: () -> Void

    @Environment(\.fmbScheme) private var scheme
    @Environment(\.appEnvironment) private var env
    @State private var vm: RateBookingViewModel?

    var body: some View {
        Group {
            if let vm {
                content(vm: vm)
                    .onChange(of: vm.submitted) { _, done in if done { onDone() } }
            } else {
                ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(scheme.background)
            }
        }
        .onAppear {
            if vm == nil {
                let new = RateBookingViewModel(bookingId: bookingId, repo: env.bookingRepo)
                vm = new
                new.loadExisting()
            }
        }
        .navigationTitle("Rate your wash")
        .navigationBarTitleDisplayMode(.inline)
    }

    @ViewBuilder
    private func content(vm: RateBookingViewModel) -> some View {
        ZStack {
            scheme.background.ignoresSafeArea()
            VStack(spacing: 20) {
                Text("How was it?")
                    .font(Fmb.Typo.headlineSmall)
                    .foregroundStyle(scheme.onBackground)
                    .padding(.top, 32)
                stars(vm: vm)
                noteField(vm: vm)
                if let err = vm.error {
                    Text(err).font(Fmb.Typo.labelSmall).foregroundStyle(scheme.error)
                }
                Spacer()
                submitButton(vm: vm)
            }
            .padding(20)
        }
    }

    private func stars(vm: RateBookingViewModel) -> some View {
        HStack(spacing: 12) {
            ForEach(1...5, id: \.self) { i in
                Button {
                    vm.setRating(i)
                } label: {
                    Image(systemName: i <= vm.rating ? "star.fill" : "star")
                        .font(.system(size: 36))
                        .foregroundStyle(i <= vm.rating ? Fmb.amber500 : scheme.onSurfaceVariant)
                }
            }
        }
    }

    private func noteField(vm: RateBookingViewModel) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Note (optional)")
                .font(Fmb.Typo.labelMedium)
                .foregroundStyle(scheme.onSurfaceVariant)
            TextField("Tell us what they nailed (or didn't)", text: Binding(
                get: { vm.note },
                set: { vm.setNote($0) }
            ), axis: .vertical)
            .lineLimit(3...6)
            .padding(.horizontal, 14).padding(.vertical, 12)
            .background(scheme.surfaceContainer)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(scheme.outline, lineWidth: 1))
        }
    }

    private func submitButton(vm: RateBookingViewModel) -> some View {
        let enabled = vm.rating >= 1 && !vm.submitting
        return Button {
            vm.submit()
        } label: {
            ZStack {
                LinearGradient(colors: [Fmb.aquaBright, Fmb.aqua, Fmb.deep],
                               startPoint: .leading, endPoint: .trailing)
                    .opacity(enabled ? 1 : 0.4)
                if vm.submitting {
                    ProgressView().tint(.white)
                } else {
                    Text("Submit").font(Fmb.Typo.labelLarge).foregroundStyle(.white)
                }
            }
            .frame(height: 50)
            .clipShape(Capsule())
        }
        .disabled(!enabled)
        .padding(.bottom, 8)
    }
}
