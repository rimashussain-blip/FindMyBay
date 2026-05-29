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

    /// Promo accordion state — see PromoCodeBlock in SlotPickerView. Sent
    /// to the backend on confirm. Validation happens server-side; we don't
    /// pre-check the code here.
    var promoCode: String = ""
    var promoExpanded: Bool = false

    /// Today + next 3 days, normalised to start-of-day.
    var availableDates: [Date] {
        let cal = Calendar.current
        let start = cal.startOfDay(for: Date())
        return (0..<4).compactMap { cal.date(byAdding: .day, value: $0, to: start) }
    }

    // MARK: - Deps
    let vendorId: String
    /// Service id chosen on Vendor Detail. We match against the loaded
    /// vendor's services list and fall back to `.first` if missing — covers
    /// deep-links that opened the slot picker without an explicit service.
    private let initialServiceId: String?
    private let vendors: VendorRepository
    private let bookings: BookingRepository

    init(vendorId: String,
         initialServiceId: String? = nil,
         vendors: VendorRepository,
         bookings: BookingRepository) {
        self.vendorId = vendorId
        self.initialServiceId = initialServiceId
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
                // Honour the service the user picked on Vendor Detail. If
                // the id doesn't match any returned service (stale link,
                // deleted service), fall back to the first one so the
                // picker still shows something usable.
                if selectedService == nil {
                    selectedService = v.services.first { $0.id == initialServiceId }
                        ?? v.services.first
                }
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
    /// that property to navigate to ReviewPay. Promo errors (`promo_*` codes
    /// from the backend, all 409 except `promo_not_found` which is 404) are
    /// surfaced verbatim via `APIError.userMessage` so the user sees the
    /// real reason ("Promo can't be applied: not started", etc.) rather than
    /// a generic "Couldn't confirm booking".
    func confirm() {
        guard let service = selectedService, let slot = selectedSlot else { return }
        confirming = true
        error = nil
        let codeToSend = promoCode
            .trimmingCharacters(in: .whitespaces)
            .uppercased()
        Task {
            do {
                let b = try await bookings.create(
                    vendorId: vendorId,
                    serviceId: service.id,
                    slotStartIso: slot.startsAt,
                    promoCode: codeToSend.isEmpty ? nil : codeToSend
                )
                booking = b
                confirming = false
            } catch let api as APIError {
                confirming = false
                self.error = api.userMessage
            } catch {
                confirming = false
                self.error = (error as? LocalizedError)?.errorDescription
                    ?? "Couldn't confirm booking"
            }
        }
    }
}
