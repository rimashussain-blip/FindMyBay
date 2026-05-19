// QRCodeView.swift
//
// CoreImage-backed QR generator. Returns a SwiftUI `Image` rendered from
// `CIFilter.qrCodeGenerator()` — the iOS equivalent of Android's
// `feature/bookings/QrBitmap.kt`.

import SwiftUI
import CoreImage.CIFilterBuiltins

struct QRCodeView: View {
    let payload: String
    var sizePx: CGFloat = 240

    var body: some View {
        if let img = Self.makeImage(payload: payload, sizePx: sizePx) {
            Image(uiImage: img)
                .interpolation(.none)
                .resizable()
                .scaledToFit()
        } else {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(.red)
        }
    }

    static func makeImage(payload: String, sizePx: CGFloat) -> UIImage? {
        let context = CIContext()
        let filter = CIFilter.qrCodeGenerator()
        filter.message = Data(payload.utf8)
        filter.correctionLevel = "M"
        guard let output = filter.outputImage else { return nil }
        let target = CGSize(width: sizePx, height: sizePx)
        let scaleX = target.width / output.extent.size.width
        let scaleY = target.height / output.extent.size.height
        let scaled = output.transformed(by: CGAffineTransform(scaleX: scaleX, y: scaleY))
        guard let cg = context.createCGImage(scaled, from: scaled.extent) else { return nil }
        return UIImage(cgImage: cg)
    }
}
