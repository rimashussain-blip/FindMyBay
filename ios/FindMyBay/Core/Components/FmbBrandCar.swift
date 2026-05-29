// FmbBrandCar.swift
//
// One-liner wrapper that renders the brand-approved teal car illustration
// (sourced from the design handoff — `car-teal-fixed.png`) at any width.
//
// Replaces the red 🚗 emoji that iOS otherwise renders for vendor logos and
// the LeaveNow / VendorDetail hero. Keeping the call sites short means we
// can drop in a refreshed illustration later by swapping the asset only.

import SwiftUI

struct FmbBrandCar: View {
    /// Width of the car. The native PNG is 607×187 — ~3.25:1 ratio. Height
    /// scales automatically to maintain aspect.
    var width: CGFloat = 40

    var body: some View {
        Image("BrandCar")
            .resizable()
            .scaledToFit()
            .frame(width: width)
            .accessibilityLabel("Car")
    }
}
