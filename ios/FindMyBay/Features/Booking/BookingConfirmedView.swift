// BookingConfirmedView.swift
//
// Mirrors design handoff screen #6:
//   • Layered halos (sand → mint) behind a gradient checkmark badge
//   • "You're all set!" headline + smart-leave reassurance copy
//   • Receipt-style card with vendor row, dotted notch divider, key-value
//     rows (Service / Bay / Time / Duration), bold AED total
//   • Two outlined action buttons (📅 Add to calendar · 🧭 Get directions)
//   • Solid aqua "Done" button at the bottom

import SwiftUI
import UserNotifications

struct BookingConfirmedView: View {

    let bookingId: String
    var onShowQR: (_ bookingId: String) -> Void
    var onMyBookings: () -> Void

    @Environment(\.fmbScheme) private var scheme
    @Environment(\.appEnvironment) private var env
    @State private var vm: BookingConfirmedViewModel?
    @State private var notificationStatus: UNAuthorizationStatus = .notDetermined
    @State private var didScheduleAlert = false

    var body: some View {
        Group {
            if let vm {
                content(vm: vm)
            } else {
                ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(scheme.background)
            }
        }
        .onAppear {
            if vm == nil {
                let new = BookingConfirmedViewModel(bookingId: bookingId, repo: env.bookingRepo)
                vm = new
                new.load()
            }
            // Refresh notification permission status each time the screen
            // re-appears (e.g. user toggled in Settings and came back).
            Task {
                notificationStatus = await AlertScheduler.requestAuthorization()
                maybeScheduleAlert()
            }
        }
        .navigationBarBackButtonHidden(true)
    }

    /// Schedules the slot-5min local notification once we have:
    /// (a) booking data loaded, (b) notification permission granted, and
    /// (c) we haven't already scheduled it in this view-instance.
    private func maybeScheduleAlert() {
        guard let booking = vm?.booking,
              notificationStatus == .authorized,
              !didScheduleAlert,
              let slot = FmbTime.parse(booking.slotStart)
        else { return }
        AlertScheduler.scheduleLeaveNow(
            bookingId: booking.id,
            vendorName: booking.vendor.brandName,
            slotStart: slot
        )
        didScheduleAlert = true
    }

    @ViewBuilder
    private func content(vm: BookingConfirmedViewModel) -> some View {
        ZStack {
            scheme.background.ignoresSafeArea()
            ScrollView {
                if vm.loading {
                    ProgressView().padding(40)
                } else if let b = vm.booking {
                    VStack(spacing: 0) {
                        Spacer().frame(height: 28)
                        haloedCheck
                        Spacer().frame(height: 22)
                        Text("You're all set!")
                            .font(.system(size: 22, weight: .bold))
                            .kerning(-0.4)
                            .foregroundStyle(scheme.onBackground)
                        Spacer().frame(height: 6)
                        Text("We'll send a smart-leave alert so you arrive on time — even in traffic.")
                            .font(.system(size: 12))
                            .foregroundStyle(scheme.onSurfaceVariant)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 36)
                            .lineSpacing(4)

                        Spacer().frame(height: 22)
                        receiptCard(b)
                            .padding(.horizontal, 22)

                        if notificationStatus == .denied
                            || notificationStatus == .notDetermined {
                            Spacer().frame(height: 12)
                            notificationsBanner
                                .padding(.horizontal, 22)
                        }

                        Spacer().frame(height: 12)
                        actionRow
                            .padding(.horizontal, 22)

                        Spacer().frame(height: 28)
                        FmbPrimaryButton(title: "Show QR", action: { onShowQR(b.id) })
                            .padding(.horizontal, 22)

                        Button("View my bookings", action: onMyBookings)
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(Fmb.deep)
                            .padding(.top, 10)

                        Spacer().frame(height: 40)
                    }
                } else if let err = vm.error {
                    Text(err).foregroundStyle(scheme.error).padding(40)
                }
            }
        }
    }

    // MARK: - Halo + check

    private var haloedCheck: some View {
        ZStack {
            Circle().fill(Fmb.sandDeep.opacity(0.35)).frame(width: 108, height: 108)
            Circle().fill(scheme.surfaceVariant).frame(width: 84, height: 84)
            Circle()
                .fill(LinearGradient(
                    colors: [Fmb.aquaBright, Fmb.deep],
                    startPoint: .topLeading, endPoint: .bottomTrailing
                ))
                .frame(width: 64, height: 64)
                .shadow(color: Fmb.deep.opacity(0.35), radius: 18, x: 0, y: 12)
            Image(systemName: "checkmark")
                .font(.system(size: 28, weight: .heavy))
                .foregroundStyle(.white)
        }
    }

    // MARK: - Receipt card

    @ViewBuilder
    private func receiptCard(_ b: Booking) -> some View {
        VStack(spacing: 0) {
            HStack(spacing: 10) {
                ZStack {
                    RoundedRectangle(cornerRadius: 12)
                        .fill(LinearGradient(
                            colors: [Fmb.mint, Fmb.sand],
                            startPoint: .topLeading, endPoint: .bottomTrailing
                        ))
                    Text("🚿").font(.system(size: 18))
                }
                .frame(width: 38, height: 38)
                VStack(alignment: .leading, spacing: 2) {
                    Text(b.vendor.brandName)
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(scheme.onBackground)
                    Text("\(b.vendor.city), \(b.vendor.emirate)")
                        .font(.system(size: 10))
                        .foregroundStyle(scheme.onSurfaceVariant)
                }
                Spacer()
            }
            .padding(.bottom, 12)

            // Notched dotted divider
            ZStack {
                Rectangle()
                    .fill(Color.black.opacity(0.08))
                    .frame(height: 1)
                HStack {
                    Circle().fill(scheme.background).frame(width: 16, height: 16)
                        .offset(x: -2)
                    Spacer()
                    Circle().fill(scheme.background).frame(width: 16, height: 16)
                        .offset(x: 2)
                }
            }
            .padding(.horizontal, -2)

            VStack(spacing: 0) {
                row("Service", b.service.name)
                row("Bay", "Bay \(b.bay.name)")
                row("Time", prettyDate(b.slotStart))
                row("Duration", "\(b.service.durationMin) min")
                // FTA invoice + VAT — only rendered after the backend has
                // assigned an invoice number (payment cleared / walk-in).
                if let invoice = b.invoiceNumber {
                    row("Invoice", invoice)
                }
                if let vat = b.vatAed {
                    row("VAT (5%)", "AED \(vat)")
                }
            }
            .padding(.top, 8)

            Rectangle()
                .fill(Color.black.opacity(0.08))
                .frame(height: 1)
                .padding(.vertical, 8)

            HStack {
                Text("Total")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(scheme.onBackground)
                Spacer()
                Text("AED \(b.totalAed)")
                    .font(.system(size: 18, weight: .heavy))
                    .foregroundStyle(Fmb.deep)
            }
            .padding(.top, 4)
        }
        .padding(16)
        .background(scheme.surfaceContainer)
        .clipShape(RoundedRectangle(cornerRadius: 18))
        .overlay(
            RoundedRectangle(cornerRadius: 18)
                .strokeBorder(scheme.outline, lineWidth: 1)
        )
        .shadow(color: scheme.onBackground.opacity(0.06), radius: 18, x: 0, y: 6)
    }

    private func row(_ key: String, _ value: String) -> some View {
        HStack {
            Text(key)
                .font(.system(size: 11))
                .foregroundStyle(scheme.onSurfaceVariant)
            Spacer()
            Text(value)
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(scheme.onBackground)
        }
        .padding(.vertical, 5)
    }

    // MARK: - Notifications permission banner
    //
    // Equivalent of Android's banner that detects canUseFullScreenIntent()
    // == false and deep-links to Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT.
    // Auto-hides once status flips to .authorized (re-checked on every
    // onAppear, so coming back from Settings refreshes it).
    private var notificationsBanner: some View {
        HStack(alignment: .center, spacing: 10) {
            Image(systemName: "bell.badge.fill")
                .font(.system(size: 18))
                .foregroundStyle(Fmb.deep)
            VStack(alignment: .leading, spacing: 2) {
                Text("Enable notifications")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(Fmb.ink)
                Text("So we can ping you when it's time to leave.")
                    .font(.system(size: 11))
                    .foregroundStyle(Fmb.ink.opacity(0.75))
            }
            Spacer(minLength: 0)
            Button {
                openNotificationSettings()
            } label: {
                Text(notificationStatus == .denied ? "Settings" : "Enable")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 12).padding(.vertical, 8)
                    .background(Fmb.deep)
                    .clipShape(Capsule())
            }
        }
        .padding(12)
        .background(Fmb.sand)
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }

    private func openNotificationSettings() {
        if notificationStatus == .notDetermined {
            // First-time prompt — request rather than opening Settings.
            Task { notificationStatus = await AlertScheduler.requestAuthorization() }
        } else if let url = URL(string: UIApplication.openSettingsURLString) {
            // Already-denied / restricted — Settings is the only way back.
            UIApplication.shared.open(url)
        }
    }

    // MARK: - Action row

    private var actionRow: some View {
        HStack(spacing: 8) {
            FmbSecondaryButton(title: "Add to calendar", icon: "📅", action: {})
            FmbSecondaryButton(title: "Get directions", icon: "🧭", action: {})
        }
    }

    // MARK: -

    private func prettyDate(_ iso: String) -> String {
        FmbTime.dayAndClock12(iso)
    }
}
