// ReviewPayView.swift
//
// "Review & pay" screen — vendor + service summary, total, "Pay AED X" CTA
// that opens the hosted payment page. Mirrors `ReviewPayScreen.kt`.

import SwiftUI

struct ReviewPayView: View {

    let bookingId: String
    var onConfirmed: (_ bookingId: String) -> Void

    @Environment(\.fmbScheme) private var scheme
    @Environment(\.appEnvironment) private var env
    @State private var vm: ReviewPayViewModel?

    var body: some View {
        Group {
            if let vm {
                content(vm: vm)
                    .onChange(of: vm.confirmed) { _, isConfirmed in
                        if isConfirmed { onConfirmed(bookingId) }
                    }
            } else {
                ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(scheme.background)
            }
        }
        .onAppear {
            if vm == nil {
                let new = ReviewPayViewModel(
                    bookingId: bookingId,
                    bookings: env.bookingRepo,
                    payments: env.paymentRepo,
                    returnBus: env.paymentReturnBus
                )
                vm = new
                new.start()
            }
        }
        .navigationTitle("Review & pay")
        .navigationBarTitleDisplayMode(.inline)
    }

    @ViewBuilder
    private func content(vm: ReviewPayViewModel) -> some View {
        ZStack {
            scheme.background.ignoresSafeArea()
            ScrollView {
                if vm.loading {
                    ProgressView().padding(40)
                } else if let b = vm.booking {
                    VStack(alignment: .leading, spacing: 16) {
                        bookingSummary(b)
                        Divider().background(scheme.outline)
                        priceSummary(b)
                        if let reason = vm.failureReason {
                            errorBanner(reason)
                        }
                        if vm.polling {
                            HStack(spacing: 8) {
                                ProgressView()
                                Text("Confirming payment…")
                                    .font(Fmb.Typo.bodyMedium)
                            }
                            .padding(12)
                            .frame(maxWidth: .infinity)
                            .background(scheme.surfaceContainer)
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                        }
                        Spacer().frame(height: 80)
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 16)
                } else if let err = vm.error {
                    Text(err).foregroundStyle(scheme.error).padding(40)
                }
            }
            VStack { Spacer(); payButton(vm: vm) }
        }
        .sheet(isPresented: Binding(
            get: { vm.hostedPageURL != nil },
            set: { open in if !open { vm.dismissPaymentSheet() } }
        )) {
            if let url = vm.hostedPageURL { SafariSheet(url: url) }
        }
    }

    // MARK: - Sections

    private func bookingSummary(_ b: Booking) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(b.vendor.brandName)
                .font(Fmb.Typo.titleLarge)
                .foregroundStyle(scheme.onBackground)
            Text("\(b.vendor.city) · \(b.vendor.emirate)")
                .font(Fmb.Typo.bodySmall)
                .foregroundStyle(scheme.onSurfaceVariant)
            HStack(spacing: 6) {
                Image(systemName: "calendar")
                Text(prettyTime(b.slotStart))
            }
            .padding(.top, 4)
            .font(Fmb.Typo.bodyMedium)
            .foregroundStyle(scheme.onBackground)

            HStack(spacing: 6) {
                Image(systemName: "wrench.and.screwdriver")
                Text("\(b.service.name) · \(b.service.durationMin) min")
            }
            .font(Fmb.Typo.bodyMedium)
            .foregroundStyle(scheme.onBackground)

            HStack(spacing: 6) {
                Image(systemName: "square.grid.2x2")
                Text("Bay \(b.bay.name)")
            }
            .font(Fmb.Typo.bodyMedium)
            .foregroundStyle(scheme.onBackground)
        }
    }

    private func priceSummary(_ b: Booking) -> some View {
        VStack(spacing: 6) {
            HStack {
                Text("Total")
                    .font(Fmb.Typo.titleMedium)
                Spacer()
                Text("AED \(b.totalAed)")
                    .font(Fmb.Typo.titleLarge)
                    .foregroundStyle(Fmb.deep)
            }
            HStack {
                Text("Inclusive of VAT")
                    .font(Fmb.Typo.labelSmall)
                    .foregroundStyle(scheme.onSurfaceVariant)
                Spacer()
            }
        }
    }

    private func errorBanner(_ msg: String) -> some View {
        HStack(spacing: 10) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(scheme.error)
            Text(msg)
                .font(Fmb.Typo.bodySmall)
                .foregroundStyle(scheme.onSurface)
            Spacer()
        }
        .padding(12)
        .background(scheme.surfaceContainer)
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }

    @ViewBuilder
    private func payButton(vm: ReviewPayViewModel) -> some View {
        if let b = vm.booking, !vm.confirmed {
            Button {
                vm.pay()
            } label: {
                ZStack {
                    LinearGradient(
                        colors: [Fmb.aquaBright, Fmb.aqua, Fmb.deep],
                        startPoint: .leading, endPoint: .trailing
                    )
                    if vm.launching {
                        ProgressView().tint(.white)
                    } else {
                        Text("Pay AED \(b.totalAed)")
                            .font(Fmb.Typo.labelLarge)
                            .foregroundStyle(.white)
                    }
                }
                .frame(height: 50)
                .clipShape(Capsule())
            }
            .disabled(vm.launching)
            .padding(.horizontal, 16).padding(.bottom, 12)
        }
    }

    // MARK: - Helpers

    private func prettyTime(_ iso: String) -> String {
        FmbTime.dayAndClock12(iso)
    }
}
