// SlotPickerViewModel.swift
//
// Drives the slot picker — service selector, date strip (today + next 3 days),
// and a list of bookable time slots. On confirm, posts to `/bookings` and
// surfaces the new Booking so the UI can navigate to ReviewPay.
//
// Mirrors `feature/booking/SlotPickerViewModel.kt`.

import Foundation
import Observation

@Observable @MainActor
final class SlotPickerViewModel {

    // MARK: - State
    var loading: Bool = false
    var vendor: VendorDetail? = nil
    var selectedService: Service? = nil
    var date: Date = Date()
    var slots: [Slot] = []
    var selectedSlot: Slot? = nil
    var booking: Booking? = nil
    var confirming: Bool = false
    var error: String? = nil

    /// Today + next 3 days, normalised to start-of-day.
    var availableDates: [Date] {
        let cal = Calendar.current
        let start = cal.startOfDay(for: Date())
        return (0..<4).compactMap { cal.date(byAdding: .day, value: $0, to: start) }
    }

    // MARK: - Deps
    let vendorId: String
    private let vendors: VendorRepository
    private let bookings: BookingRepository

    init(vendorId: String, vendors: VendorRepository, bookings: BookingRepository) {
        self.vendorId = vendorId
        self.vendors = vendors
        self.bookings = bookings
    }

    // MARK: - Loaders

    func loadVendor() {
        loading = true
        error = nil
        Task {
            do {
                let v = try await vendors.detail(id: vendorId)
                vendor = v
                if selectedService == nil { selectedService = v.services.first }
                loading = false
                if selectedService != nil { loadSlots() }
            } catch {
                loading = false
                self.error = (error as? LocalizedError)?.errorDescription
                    ?? "Couldn't load vendor"
            }
        }
    }

    func selectService(_ s: Service) {
        selectedService = s
        selectedSlot = nil
        loadSlots()
    }

    func selectDate(_ newDate: Date) {
        if Calendar.current.isDate(newDate, inSameDayAs: date) { return }
        date = newDate
        selectedSlot = nil
        loadSlots()
    }

    private func loadSlots() {
        guard let service = selectedService else { return }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.timeZone = TimeZone.current
        let dateStr = formatter.string(from: date)
        loading = true
        error = nil
        slots = []
        Task {
            do {
                let resp = try await vendors.availability(
                    vendorId: vendorId, serviceId: service.id, date: dateStr
                )
                slots = resp.slots
                loading = false
            } catch {
                loading = false
                self.error = (error as? LocalizedError)?.errorDescription
                    ?? "Couldn't load slots"
            }
        }
    }

    func selectSlot(_ slot: Slot) {
        if slot.available { selectedSlot = slot }
    }

    // MARK: - Confirm

    /// Creates the booking and stores the result on `booking`. Caller observes
    /// that property to navigate to ReviewPay.
    func confirm() {
        guard let service = selectedService, let slot = selectedSlot else { return }
        confirming = true
        error = nil
        Task {
            do {
                let b = try await bookings.create(
                    vendorId: vendorId, serviceId: service.id, slotStartIso: slot.startsAt
                )
                booking = b
                confirming = false
            } catch {
                confirming = false
                self.error = (error as? LocalizedError)?.errorDescription
                    ?? "Couldn't confirm booking"
            }
        }
    }
}
