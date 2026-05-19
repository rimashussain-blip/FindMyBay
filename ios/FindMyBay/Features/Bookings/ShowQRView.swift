// ShowQRView.swift
//
// Mirrors design handoff screen #9:
//   • Top half has a mint→cream gradient background with three concentric
//     mintEdge rings as decoration.
//   • Header row: "Bookings" back link / "Show QR" title / settings icon.
//   • Hero card with QR centred, brightness +max badge, vendor + bay row,
//     "Waiting for scan" status pill or in-progress confirmation, plus
//     car details strip when available.

import SwiftUI

struct ShowQRView: View {

    let bookingId: String
    @Environment(\.fmbScheme) private var scheme
    @Environment(\.appEnvironment) private var env
    @State private var vm: ShowQRViewModel?
    @Environment(\.dismiss) private var dismiss

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
                let new = ShowQRViewModel(bookingId: bookingId, repo: env.bookingRepo)
                vm = new
                new.start()
            }
        }
        .onDisappear { vm?.stop() }
        .navigationBarBackButtonHidden(true)
    }

    @ViewBuilder
    private func content(vm: ShowQRViewModel) -> some View {
        ZStack(alignment: .top) {
            // Background gradient + concentric rings
            VStack(spacing: 0) {
                LinearGradient(
                    colors: [scheme.surfaceVariant, scheme.background],
                    startPoint: .top, endPoint: .bottom
                )
                .frame(height: 360)
                scheme.background
            }
            .ignoresSafeArea()
            .overlay(
                ZStack {
                    Circle().stroke(scheme.outline, lineWidth: 1).frame(width: 220, height: 220)
                    Circle().stroke(scheme.outline, lineWidth: 1).frame(width: 320, height: 320)
                    Circle().stroke(scheme.outline, lineWidth: 1).frame(width: 420, height: 420)
                }
                .opacity(0.5)
                .frame(maxHeight: 360, alignment: .center)
                .frame(maxWidth: .infinity)
            , alignment: .top)

            VStack(spacing: 0) {
                headerBar
                Spacer().frame(height: 20)
                if vm.loading {
                    ProgressView().padding(40)
                } else if let qr = vm.qr {
                    heroCard(qr: qr)
                        .padding(.horizontal, 22)
                    Spacer().frame(height: 16)
                    statusPill(qr.status)
                    if let car = formattedCar(qr) {
                        Spacer().frame(height: 12)
                        // Vendor/car pill — background is hard-coded white
                        // (the receipt sheet stays white in both modes for
                        // scanner contrast), so the text is hard-coded ink.
                        Text(car)
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(Fmb.ink)                    // pinned
                            .padding(.horizontal, 14).padding(.vertical, 8)
                            .background(Color.white)                     // pinned
                            .clipShape(Capsule())
                            .overlay(Capsule().strokeBorder(Fmb.mintEdge, lineWidth: 1))
                    }
                    if let invoice = qr.invoiceNumber {
                        Spacer().frame(height: 12)
                        taxInvoiceStrip(qr: qr, invoice: invoice)
                            .padding(.horizontal, 22)
                    }
                    Spacer().frame(height: 18)
                    brightnessTip
                    Spacer()
                } else if let err = vm.error {
                    Text(err).foregroundStyle(scheme.error).padding(40)
                }
            }
            .padding(.top, 8)
        }
    }

    // MARK: - Header

    private var headerBar: some View {
        HStack {
            Button { dismiss() } label: {
                HStack(spacing: 2) {
                    Image(systemName: "chevron.left")
                        .font(.system(size: 12, weight: .heavy))
                    Text("Bookings")
                        .font(.system(size: 15, weight: .medium))
                }
                .foregroundStyle(Fmb.deep)
            }
            Spacer()
            Text("Show QR")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(scheme.onBackground)
            Spacer()
            Image(systemName: "ellipsis")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Fmb.deep)
        }
        .padding(.horizontal, 16)
    }

    // MARK: - Hero card
    //
    // The QR card and the text on top of it are **pinned to a white sheet
    // with dark-ink ink** in both light and dark modes. This is the bug-fix
    // version of the screen — if we let `scheme.surface` flip in dark mode,
    // the QR modules (always black) end up on a dark teal background and
    // the scanner can't read them. So everything inside the hero card uses
    // literal white + Fmb.ink, never the system colour scheme.

    private func heroCard(qr: BookingQr) -> some View {
        VStack(spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(qr.vendorName ?? "Find My Bay")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(Fmb.ink)                       // pinned
                    HStack(spacing: 6) {
                        if let bay = qr.bayName {
                            Text("Bay \(bay)")
                                .font(.system(size: 11))
                                .foregroundStyle(Fmb.neutral700)        // pinned
                        }
                        Text("·")
                            .font(.system(size: 11))
                            .foregroundStyle(Fmb.neutral700)
                        Text(FmbTime.clock12(qr.slotStart))
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(Fmb.deep)                   // brand
                    }
                }
                Spacer()
                Label("Auto bright", systemImage: "sun.max.fill")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(Fmb.deep)
                    .padding(.horizontal, 8).padding(.vertical, 4)
                    .background(Fmb.mint)
                    .clipShape(Capsule())
            }

            QRCodeView(payload: qr.qr, sizePx: 240)
                .padding(20)
                .background(Color.white)                                 // pinned
                .clipShape(RoundedRectangle(cornerRadius: 16))
                .shadow(color: Color.black.opacity(0.10), radius: 18, x: 0, y: 12)

            VStack(spacing: 2) {
                Text("BOOKING CODE")
                    .font(.system(size: 9, weight: .heavy))
                    .kerning(0.8)
                    .foregroundStyle(Fmb.neutral700)                     // pinned
                Text("FMB-\(String(qr.bookingId.prefix(8)).uppercased())")
                    .font(.system(size: 12, weight: .semibold, design: .monospaced))
                    .foregroundStyle(Fmb.ink)                            // pinned
            }
        }
        .padding(.horizontal, 18).padding(.vertical, 18)
        .background(Color.white)                                         // pinned
        .clipShape(RoundedRectangle(cornerRadius: 24))
        .overlay(
            RoundedRectangle(cornerRadius: 24)
                .strokeBorder(Fmb.mintEdge, lineWidth: 1)
        )
        .shadow(color: Color.black.opacity(0.10), radius: 24, x: 0, y: 12)
    }

    // MARK: - Status

    @ViewBuilder
    private func statusPill(_ status: String) -> some View {
        if status == "in_progress" {
            Label("Scanned — your wash is in progress", systemImage: "checkmark.seal.fill")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(.white)
                .padding(.horizontal, 14).padding(.vertical, 8)
                .background(Fmb.aqua)
                .clipShape(Capsule())
        } else {
            HStack(spacing: 6) {
                Circle().fill(Fmb.aqua).frame(width: 8, height: 8)
                    .opacity(0.8)
                Text("Waiting for the attendant to scan")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Fmb.deep)
            }
            .padding(.horizontal, 14).padding(.vertical, 8)
            .background(scheme.surfaceContainer)
            .clipShape(Capsule())
            .overlay(Capsule().strokeBorder(scheme.outline, lineWidth: 1))
        }
    }

    private var brightnessTip: some View {
        Text("Tip: hold this screen at the scanner for a clean read.")
            .font(.system(size: 11))
            .foregroundStyle(scheme.onSurfaceVariant)
            .multilineTextAlignment(.center)
            .padding(.horizontal, 32)
    }

    // MARK: - Tax invoice strip
    //
    // Renders only when the backend has assigned an FTA invoice number to
    // the booking. 1px-bordered rounded pill matching the Android v2
    // handoff: "TAX INVOICE" eyebrow → invoice number → "AED N · incl.
    // AED M VAT" on the right.
    private func taxInvoiceStrip(qr: BookingQr, invoice: String) -> some View {
        HStack(alignment: .center, spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text("TAX INVOICE")
                    .font(.system(size: 9, weight: .heavy))
                    .kerning(0.8)
                    .foregroundStyle(Fmb.neutral700)
                Text(invoice)
                    .font(.system(size: 13, weight: .semibold, design: .monospaced))
                    .foregroundStyle(Fmb.ink)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                if let total = qr.totalAed {
                    Text("AED \(total)")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(Fmb.ink)
                }
                if let vat = qr.vatAed {
                    Text("incl. AED \(vat) VAT")
                        .font(.system(size: 10))
                        .foregroundStyle(Fmb.neutral700)
                }
            }
        }
        .padding(.horizontal, 14).padding(.vertical, 10)
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .strokeBorder(Color.black.opacity(0.08), lineWidth: 1)
        )
    }

    // MARK: -

    private func formattedCar(_ qr: BookingQr) -> String? {
        let parts = [qr.carColor, qr.carMake, qr.carPlate].compactMap { $0?.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
        guard !parts.isEmpty else { return nil }
        return parts.joined(separator: " · ")
    }
}
