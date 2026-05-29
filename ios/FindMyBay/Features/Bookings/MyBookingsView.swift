// MyBookingsView.swift
//
// Mirrors design handoff screen #8:
//   • Top row: "My bookings" title + mint chip with + icon
//   • Upcoming/Past segmented control (rounded white pill)
//   • Active booking card with mint→sand gradient header showing
//     "Tomorrow · 10:00" and "in 18h 14m" countdown, vendor row + price,
//     three-action row: aqua "Show QR" / outlined "Reschedule" / × cancel.
//   • Subsequent upcoming card has a "SCHEDULED" mint pill + plain layout.
//   • Loyalty teaser tile at the end (sand → coral gradient + 🎁 + progress bar).

import SwiftUI

struct MyBookingsView: View {

    @Environment(\.fmbScheme) private var scheme
    @Environment(\.appEnvironment) private var env
    @State private var vm: MyBookingsViewModel?
    @State private var tab: Tab = .upcoming

    var onShowQR: (_ bookingId: String) -> Void
    var onRate:   (_ bookingId: String) -> Void

    private enum Tab { case upcoming, past }

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
                // First visit on this app session — full load + subscribe to
                // realtime push events.
                let new = MyBookingsViewModel(repo: env.bookingRepo)
                vm = new
                new.load()
                new.observeRealtime(env.realtime)
            } else {
                // Returning to the tab — silently refresh so any booking
                // created in another tab (or another device, or via the
                // backend admin) shows up without a manual pull-to-refresh.
                vm?.load(silent: true)
            }
        }
        .navigationBarHidden(true)
    }

    @ViewBuilder
    private func content(vm: MyBookingsViewModel) -> some View {
        ZStack {
            scheme.background.ignoresSafeArea()
            VStack(spacing: 0) {
                header
                segmentedTab
                    .padding(.horizontal, 16)
                    .padding(.top, 14)
                ScrollView {
                    if vm.loading {
                        ProgressView().padding(40)
                    } else if let err = vm.error {
                        VStack(spacing: 10) {
                            Text(err).foregroundStyle(scheme.error)
                            Button("Retry") { vm.load() }
                        }
                        .padding(40)
                    } else {
                        list(vm: vm)
                    }
                }
                .refreshable { vm.load(silent: true) }
            }
        }
        .sheet(item: dialogBinding(vm)) { dialog in
            cancelSheet(dialog: dialog, vm: vm)
        }
        .alert(vm.lastCancelMessage ?? "", isPresented: cancelToastBinding(vm)) {
            Button("OK") { vm.consumeCancelMessage() }
        }
    }

    // MARK: - Header

    private var header: some View {
        HStack {
            Text("My bookings")
                .font(.system(size: 22, weight: .bold))
                .kerning(-0.4)
                .foregroundStyle(scheme.onBackground)
            Spacer()
            Image(systemName: "plus")
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(Fmb.deep)
                .frame(width: 36, height: 36)
                .background(scheme.surfaceVariant)
                .clipShape(RoundedRectangle(cornerRadius: 12))
        }
        .padding(.horizontal, 22)
        .padding(.top, 8)
    }

    // MARK: - Segmented control

    private var segmentedTab: some View {
        HStack(spacing: 0) {
            segment("Upcoming", on: tab == .upcoming) { tab = .upcoming }
            segment("Past",     on: tab == .past)     { tab = .past }
        }
        .padding(4)
        .background(scheme.surfaceContainer)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12).strokeBorder(scheme.outline, lineWidth: 1)
        )
    }

    private func segment(_ label: String, on: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(on ? .white : scheme.onSurfaceVariant)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
                .background(on ? Fmb.aqua : Color.clear)
                .clipShape(RoundedRectangle(cornerRadius: 9))
        }
    }

    // MARK: - List

    private func list(vm: MyBookingsViewModel) -> some View {
        let filtered = vm.bookings.filter {
            (tab == .upcoming) == isUpcoming($0)
        }
        return VStack(spacing: 10) {
            if filtered.isEmpty { emptyState }
            ForEach(Array(filtered.enumerated()), id: \.element.id) { (i, b) in
                if i == 0 && tab == .upcoming {
                    activeCard(b, vm: vm)
                } else {
                    plainCard(b, vm: vm)
                }
            }
            if tab == .upcoming {
                loyaltyTeaser.padding(.top, 6)
            }
            Spacer().frame(height: 24)
        }
        .padding(.horizontal, 16)
        .padding(.top, 12)
    }

    private func isUpcoming(_ b: Booking) -> Bool {
        let upcomingStatuses: Set<String> = [
            "pending_payment", "confirmed", "alert_scheduled", "alerted", "in_progress"
        ]
        return upcomingStatuses.contains(b.status)
    }

    private var emptyState: some View {
        VStack(spacing: 12) {
            Image(systemName: "calendar.badge.clock")
                .font(.system(size: 48))
                .foregroundStyle(Fmb.aqua)
            Text("No \(tab == .upcoming ? "upcoming" : "past") bookings")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(scheme.onBackground)
            Text(tab == .upcoming
                 ? "Tap the Home tab to find a wash bay nearby."
                 : "Bookings you've completed will appear here.")
                .font(.system(size: 12))
                .foregroundStyle(scheme.onSurfaceVariant)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 24)
        }
        .padding(.top, 40)
    }

    // MARK: - Cards

    private func activeCard(_ b: Booking, vm: MyBookingsViewModel) -> some View {
        VStack(spacing: 0) {
            // Gradient header
            HStack {
                Text(headerLeftText(b.slotStart))
                    .font(.system(size: 10, weight: .bold))
                    .kerning(0.3)
                    .foregroundStyle(Fmb.deep)
                Spacer()
                Text(countdownText(b.slotStart))
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(Fmb.deep)
            }
            .padding(.horizontal, 14).padding(.vertical, 8)
            .background(LinearGradient(
                colors: [Fmb.mint, Fmb.sand],
                startPoint: .leading, endPoint: .trailing
            ))

            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 10) {
                    FmbVendorLogo(
                        logoUrl: b.vendor.logoUrl,
                        brandName: b.vendor.brandName,
                        size: 38,
                        corner: 12
                    )
                    VStack(alignment: .leading, spacing: 2) {
                        Text(b.vendor.brandName)
                            .font(.system(size: 13, weight: .bold))
                            .foregroundStyle(scheme.onBackground)
                        Text("\(b.service.name) · Bay \(b.bay.name)")
                            .font(.system(size: 10))
                            .foregroundStyle(scheme.onSurfaceVariant)
                    }
                    Spacer()
                    Text("AED \(b.totalAed)")
                        .font(.system(size: 14, weight: .heavy))
                        .foregroundStyle(Fmb.deep)
                }
                HStack(spacing: 8) {
                    Button { onShowQR(b.id) } label: {
                        HStack(spacing: 4) {
                            Image(systemName: "qrcode")
                                .font(.system(size: 11, weight: .semibold))
                            Text("Show QR").font(.system(size: 11, weight: .semibold))
                        }
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity).frame(height: 36)
                        .background(Fmb.deep)
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                    }
                    Button {
                        // Reschedule placeholder.
                    } label: {
                        Text("Reschedule")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(scheme.onBackground)
                            .frame(maxWidth: .infinity).frame(height: 36)
                            .background(scheme.surfaceContainer)
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                            .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(scheme.outline, lineWidth: 1))
                    }
                    Button { vm.askCancel(b) } label: {
                        Text("✕")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(Fmb.coral)
                            .frame(width: 36, height: 36)
                            .background(scheme.surfaceContainer)
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                            .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(scheme.outline, lineWidth: 1))
                    }
                }
            }
            .padding(14)
        }
        .background(scheme.surfaceContainer)
        .clipShape(RoundedRectangle(cornerRadius: 18))
        .overlay(
            RoundedRectangle(cornerRadius: 18).strokeBorder(Fmb.aqua, lineWidth: 1.5)
        )
        .shadow(color: Fmb.aqua.opacity(0.15), radius: 18, x: 0, y: 8)
    }

    private func plainCard(_ b: Booking, vm: MyBookingsViewModel) -> some View {
        FmbCard(corner: 18, padding: 14) {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text(plainCardDate(b.slotStart))
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(scheme.onSurfaceVariant)
                    Spacer()
                    statusPill(b.status)
                }
                HStack(spacing: 10) {
                    ZStack {
                        RoundedRectangle(cornerRadius: 12)
                            .fill(LinearGradient(
                                colors: [Fmb.mint, Fmb.sand],
                                startPoint: .topLeading, endPoint: .bottomTrailing
                            ))
                        Text("✨").font(.system(size: 18))
                    }
                    .frame(width: 38, height: 38)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(b.vendor.brandName)
                            .font(.system(size: 13, weight: .bold))
                            .foregroundStyle(scheme.onBackground)
                        Text("\(b.service.name) · Bay \(b.bay.name)")
                            .font(.system(size: 10))
                            .foregroundStyle(scheme.onSurfaceVariant)
                    }
                    Spacer()
                    Text("AED \(b.totalAed)")
                        .font(.system(size: 14, weight: .heavy))
                        .foregroundStyle(Fmb.deep)
                }
                if b.status == "completed" {
                    HStack {
                        Spacer()
                        Button("Rate this wash") { onRate(b.id) }
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(Fmb.deep)
                    }
                }
            }
        }
    }

    private func statusPill(_ s: String) -> some View {
        let label: String
        let bg: Color
        let fg: Color
        switch s {
        case "pending_payment": label = "AWAITING PAYMENT"; bg = Fmb.sand; fg = Fmb.deep
        case "confirmed":       label = "SCHEDULED";        bg = scheme.surfaceVariant; fg = Fmb.deep
        case "alert_scheduled": label = "REMINDER SET";     bg = scheme.surfaceVariant; fg = Fmb.deep
        case "alerted":         label = "LEAVE SOON";       bg = Fmb.coralSoft; fg = Fmb.coral
        case "in_progress":     label = "IN PROGRESS";      bg = Fmb.deep; fg = .white
        case "completed":       label = "COMPLETED";        bg = scheme.surfaceVariant; fg = Fmb.deep
        case "cancelled":       label = "CANCELLED";        bg = Color(red: 0.93, green: 0.93, blue: 0.92); fg = scheme.onSurfaceVariant
        default:                label = s.uppercased();     bg = scheme.surfaceVariant; fg = Fmb.deep
        }
        return Text(label)
            .font(.system(size: 9, weight: .heavy))
            .foregroundStyle(fg)
            .padding(.horizontal, 8).padding(.vertical, 3)
            .background(bg)
            .clipShape(RoundedRectangle(cornerRadius: 6))
    }

    // MARK: - Loyalty teaser

    private var loyaltyTeaser: some View {
        // The card's background is the brand-fixed sand → coral gradient in
        // BOTH light and dark mode (it's a "themed" surface that doesn't flip
        // with the system). Text colours are therefore hardcoded to the
        // brand ink palette so they read on warm regardless of mode — using
        // `scheme.onBackground` here would make the text light in dark mode
        // and disappear against the warm gradient.
        HStack(spacing: 12) {
            Text("🎁").font(.system(size: 28))
            VStack(alignment: .leading, spacing: 2) {
                Text("One free wash on us")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(Fmb.ink)
                Text("3 of 5 washes complete")
                    .font(.system(size: 10))
                    .foregroundStyle(Fmb.neutral700)
                ProgressView(value: 0.6)
                    .tint(Fmb.deep)
                    .background(Color.white.opacity(0.6))
                    .frame(height: 4)
                    .padding(.top, 4)
            }
            Spacer()
        }
        .padding(14)
        .background(LinearGradient(
            colors: [Fmb.sand, Fmb.coralSoft],
            startPoint: .topLeading, endPoint: .bottomTrailing
        ))
        .clipShape(RoundedRectangle(cornerRadius: 18))
    }

    // MARK: - Cancel sheet

    private func cancelSheet(dialog: MyBookingsViewModel.CancelDialogState, vm: MyBookingsViewModel) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Cancel this booking?")
                .font(.system(size: 22, weight: .bold))
                .foregroundStyle(scheme.onBackground)
            Text("\(dialog.booking.vendor.brandName) · \(plainCardDate(dialog.booking.slotStart))")
                .font(.system(size: 13))
                .foregroundStyle(scheme.onSurfaceVariant)
            Text("If you cancel within 30 minutes of the slot, an AED 10 fee applies.")
                .font(.system(size: 12))
                .foregroundStyle(scheme.onSurfaceVariant)
            if let err = dialog.error {
                Text(err).font(.system(size: 11)).foregroundStyle(Fmb.coral)
            }
            Spacer().frame(height: 8)
            HStack(spacing: 10) {
                FmbSecondaryButton(title: "Keep booking") { vm.dismissCancelDialog() }
                Button {
                    vm.confirmCancel()
                } label: {
                    if dialog.submitting {
                        ProgressView().tint(.white)
                            .frame(maxWidth: .infinity).frame(height: 44)
                    } else {
                        Text("Cancel booking")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(.white)
                            .frame(maxWidth: .infinity).frame(height: 44)
                    }
                }
                .background(Fmb.coral)
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .disabled(dialog.submitting)
            }
        }
        .padding(20)
        .presentationDetents([.medium, .large])
    }

    // MARK: - Bindings + helpers

    private func dialogBinding(_ vm: MyBookingsViewModel) -> Binding<MyBookingsViewModel.CancelDialogState?> {
        Binding(get: { vm.cancelDialog }, set: { vm.cancelDialog = $0 })
    }

    private func cancelToastBinding(_ vm: MyBookingsViewModel) -> Binding<Bool> {
        Binding(
            get: { vm.lastCancelMessage != nil },
            set: { v in if !v { vm.consumeCancelMessage() } }
        )
    }

    private func headerLeftText(_ iso: String) -> String {
        guard let date = FmbTime.parse(iso) else { return iso }
        let cal = Calendar.current
        let prefix: String
        if cal.isDateInToday(date)       { prefix = "Today" }
        else if cal.isDateInTomorrow(date) { prefix = "Tomorrow" }
        else { prefix = FmbTime.dayShort(iso) }
        return "\(prefix) · \(FmbTime.clock12(iso))"
    }

    private func countdownText(_ iso: String) -> String {
        let parser = ISO8601DateFormatter()
        parser.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard let date = parser.date(from: iso) ?? ISO8601DateFormatter().date(from: iso) else { return "" }
        let interval = Int(date.timeIntervalSinceNow)
        if interval < 60 { return "starting now" }
        let mins = interval / 60
        if mins < 60 { return "in \(mins)m" }
        let hours = mins / 60
        let leftover = mins % 60
        return "in \(hours)h \(leftover)m"
    }

    private func plainCardDate(_ iso: String) -> String {
        FmbTime.dayAndClock12(iso)
    }
}

extension MyBookingsViewModel.CancelDialogState: Identifiable {
    public var id: String { booking.id }
}
