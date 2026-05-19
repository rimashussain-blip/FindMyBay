// SlotPickerView.swift
//
// Pick a time. Mirrors design handoff screen #5:
//   • Top: back chip + "Pick a time" headline
//   • DATE strip — 4 day cards, selected = deep teal bg, with "Today" /
//     "Tomorrow" tags under the date
//   • MORNING SLOTS section header with Bay availability hint, 3-column grid
//     of time chips (white default, aqua selected, grey + strikethrough when
//     unavailable)
//   • Smart-leave teaser card (sand bg with 🚦)
//   • Sticky bottom "Confirm · Tue 10:00 · AED 35"

import SwiftUI

struct SlotPickerView: View {

    let vendorId: String
    var onBookingCreated: (_ bookingId: String) -> Void

    @Environment(\.fmbScheme) private var scheme
    @Environment(\.appEnvironment) private var env
    @State private var vm: SlotPickerViewModel?
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        Group {
            if let vm {
                content(vm: vm)
                    .onChange(of: vm.booking?.id) { _, newId in
                        if let id = newId { onBookingCreated(id) }
                    }
            } else {
                ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(scheme.background)
            }
        }
        .onAppear {
            if vm == nil {
                let new = SlotPickerViewModel(
                    vendorId: vendorId,
                    vendors: env.vendorRepo,
                    bookings: env.bookingRepo
                )
                vm = new
                new.loadVendor()
            }
        }
        .navigationBarBackButtonHidden(true)
    }

    @ViewBuilder
    private func content(vm: SlotPickerViewModel) -> some View {
        ZStack(alignment: .bottom) {
            scheme.background.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    // Header row
                    HStack(spacing: 12) {
                        FmbBackChip(action: { dismiss() })
                        Text("Pick a time")
                            .font(.system(size: 17, weight: .bold))
                            .kerning(-0.3)
                            .foregroundStyle(scheme.onBackground)
                    }
                    .padding(.horizontal, 22)

                    Spacer().frame(height: 20)

                    // Date strip
                    VStack(alignment: .leading, spacing: 8) {
                        FmbSectionLabel(text: "Date").padding(.leading, 6)
                        HStack(spacing: 8) {
                            ForEach(Array(vm.availableDates.enumerated()), id: \.offset) { (i, date) in
                                let on = Calendar.current.isDate(date, inSameDayAs: vm.date)
                                dayCard(date: date, on: on, todayOffset: i)
                                    .onTapGesture { vm.selectDate(date) }
                            }
                        }
                    }
                    .padding(.horizontal, 16)

                    Spacer().frame(height: 20)

                    // Slots — grouped Morning / Afternoon / Evening (matches Android).
                    if vm.loading {
                        ProgressView().padding(20).frame(maxWidth: .infinity)
                    } else if vm.slots.isEmpty {
                        Text("No slots available — try another day.")
                            .font(.system(size: 12))
                            .foregroundStyle(scheme.onSurfaceVariant)
                            .padding(20)
                            .frame(maxWidth: .infinity)
                    } else {
                        slotsByPeriod(vm: vm)
                            .padding(.horizontal, 16)
                    }

                    Spacer().frame(height: 18)

                    smartLeaveTeaser
                        .padding(.horizontal, 16)

                    if let err = vm.error {
                        Text(err)
                            .font(.system(size: 11))
                            .foregroundStyle(scheme.error)
                            .padding(.horizontal, 22)
                            .padding(.top, 12)
                    }

                    Spacer().frame(height: 100)
                }
                .padding(.top, 8)
            }
            stickyCTA(vm: vm)
        }
    }

    // MARK: - Day card

    private func dayCard(date: Date, on: Bool, todayOffset: Int) -> some View {
        let weekday = formatted(date, "EEE")
        let day = formatted(date, "dd")
        let tag: String = todayOffset == 0 ? "Today"
                       : todayOffset == 1 ? "Tomorrow"
                       : ""
        return VStack(spacing: 2) {
            Text(weekday)
                .font(.system(size: 10))
                .opacity(0.85)
            Text(day)
                .font(.system(size: 18, weight: .bold))
            Text(tag)
                .font(.system(size: 9))
                .opacity(0.7)
                .frame(height: 10)
        }
        // Selected = deep teal fill + onPrimary text (white in light, ink in
        // dark inverse). Otherwise = surfaceContainer card with onSurface text.
        .foregroundStyle(on ? scheme.onPrimary : scheme.onSurface)
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .background(on ? scheme.primary : scheme.surfaceContainer)
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .strokeBorder(on ? scheme.primary : scheme.outline, lineWidth: 1)
        )
    }

    private func formatted(_ date: Date, _ format: String) -> String {
        let f = DateFormatter()
        f.dateFormat = format
        return f.string(from: date)
    }

    // MARK: - Slot groups

    /// Three buckets the slot picker groups into. Boundaries match the
    /// Android app verbatim — Morning < 12, Afternoon 12–17, Evening 17+.
    private enum TimePeriod: String, CaseIterable {
        case morning, afternoon, evening
        var title: String {
            switch self {
            case .morning:   return "Morning"
            case .afternoon: return "Afternoon"
            case .evening:   return "Evening"
            }
        }
        var icon: String {
            switch self {
            case .morning:   return "☀️"
            case .afternoon: return "🌤"
            case .evening:   return "🌙"
            }
        }
    }

    /// Splits slots into the three time-of-day buckets, preserving order.
    /// Slots whose start hour can't be parsed fall into Morning.
    private func groupedByPeriod(_ slots: [Slot]) -> [(TimePeriod, [Slot])] {
        var buckets: [TimePeriod: [Slot]] = [.morning: [], .afternoon: [], .evening: []]
        let parser = ISO8601DateFormatter()
        parser.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        for slot in slots {
            let date = parser.date(from: slot.startsAt) ?? ISO8601DateFormatter().date(from: slot.startsAt)
            let hour = date.map { Calendar.current.component(.hour, from: $0) } ?? 0
            let bucket: TimePeriod = hour < 12 ? .morning
                                  : hour < 17 ? .afternoon
                                              : .evening
            buckets[bucket, default: []].append(slot)
        }
        return TimePeriod.allCases.compactMap { p in
            guard let s = buckets[p], !s.isEmpty else { return nil }
            return (p, s)
        }
    }

    @ViewBuilder
    private func slotsByPeriod(vm: SlotPickerViewModel) -> some View {
        VStack(alignment: .leading, spacing: 18) {
            ForEach(groupedByPeriod(vm.slots), id: \.0) { (period, slots) in
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        HStack(spacing: 6) {
                            Text(period.icon)
                            FmbSectionLabel(text: period.title)
                        }
                        Spacer()
                        // Right-aligned hint: count of free slots in this bucket.
                        let free = slots.filter(\.available).count
                        if free > 0 {
                            HStack(spacing: 4) {
                                Circle().fill(scheme.primary).frame(width: 6, height: 6)
                                Text("\(free) free")
                                    .font(.system(size: 10))
                                    .foregroundStyle(scheme.onSurfaceVariant)
                            }
                        }
                    }
                    .padding(.horizontal, 6)

                    LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 3), spacing: 8) {
                        ForEach(slots, id: \.startsAt) { slot in
                            slotChip(slot: slot, vm: vm)
                        }
                    }
                }
            }
        }
    }

    private func slotChip(slot: Slot, vm: SlotPickerViewModel) -> some View {
        // Selected: aqua filled, white label.
        // Available: surfaceContainer bg, onSurface label, outline stroke.
        // Unavailable: lowered surfaceContainerLowest bg, dim text, strikethrough.
        let on = vm.selectedSlot?.startsAt == slot.startsAt
        let unavailable = !slot.available
        let fg: Color = unavailable ? scheme.onSurfaceVariant.opacity(0.4)
                                    : on ? scheme.onPrimary : scheme.onSurface
        let bg: Color = unavailable ? scheme.surfaceContainerLowest
                                    : on ? scheme.primary : scheme.surfaceContainer
        let stroke: Color = on ? scheme.primary
                              : unavailable ? Color.clear : scheme.outline
        return Button {
            vm.selectSlot(slot)
        } label: {
            Text(timeLabel(slot.startsAt))
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(fg)
                .strikethrough(unavailable)
                .padding(.vertical, 12)
                .frame(maxWidth: .infinity)
                .background(bg)
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .strokeBorder(stroke, lineWidth: 1)
                )
                .shadow(color: on ? scheme.primary.opacity(0.3) : .clear, radius: 14, x: 0, y: 6)
        }
        .disabled(unavailable)
    }

    private func timeLabel(_ iso: String) -> String {
        FmbTime.clock12(iso)
    }

    // MARK: - Smart leave teaser

    private var smartLeaveTeaser: some View {
        // Themed warm surface (sand) that doesn't flip with the system theme,
        // so both text lines stay in the brand ink palette — light-text-on-
        // light-bg would otherwise vanish in dark mode.
        HStack(alignment: .top, spacing: 10) {
            Text("🚦").font(.system(size: 18))
            VStack(alignment: .leading, spacing: 4) {
                Text("You'll get a smart-leave alert")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Fmb.deep)
                Text("We'll ping you when it's time to head out, factoring traffic.")
                    .font(.system(size: 11))
                    .foregroundStyle(Fmb.ink.opacity(0.75))
                    .lineSpacing(2)
            }
            Spacer(minLength: 0)
        }
        .padding(14)
        .background(Fmb.sand)
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }

    // MARK: - Sticky CTA

    @ViewBuilder
    private func stickyCTA(vm: SlotPickerViewModel) -> some View {
        let enabled = vm.selectedSlot != nil && !vm.confirming
        VStack {
            FmbPrimaryButton(
                title: confirmTitle(vm: vm),
                loading: vm.confirming,
                enabled: enabled,
                action: { vm.confirm() }
            )
        }
        .padding(.horizontal, 16).padding(.bottom, 16).padding(.top, 12)
        .background(LinearGradient(
            colors: [scheme.background.opacity(0), scheme.background],
            startPoint: .top, endPoint: .center
        ))
    }

    private func confirmTitle(vm: SlotPickerViewModel) -> String {
        guard let slot = vm.selectedSlot, let svc = vm.selectedService else {
            return "Confirm"
        }
        return "Confirm · \(formatted(vm.date, "EEE")) \(timeLabel(slot.startsAt)) · AED \(svc.priceAed)"
    }
}
