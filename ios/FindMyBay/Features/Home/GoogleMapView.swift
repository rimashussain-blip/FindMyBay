// GoogleMapView.swift
//
// SwiftUI wrapper around `GMSMapView`. Bridges:
//   • Camera centred on (lat, lng) via `cameraTarget`
//   • A list of vendors → markers
//   • Tap → calls `onVendorTap` so the host can push VendorDetail
//
// We don't try to make the map a SwiftUI value type — `GMSMapView` is a
// stateful UIKit view and animating it via SwiftUI re-creation would lag
// and lose state. Instead we update the existing instance in `updateUIView`.

import SwiftUI
import GoogleMaps

struct GoogleMapView: UIViewRepresentable {

    /// Centre point + zoom. `nil` = let the map use its default world view.
    var cameraTarget: CLLocationCoordinate2D?
    var zoom: Float = 13

    /// Vendors to render as markers.
    var vendors: [Vendor]

    /// Picked from the current SwiftUI environment so the map's branded
    /// style flips with the system appearance (warm cream tiles in light,
    /// deep teal tiles in dark). Loaded from `Resources/MapStyles/*.json`.
    var colorScheme: ColorScheme = .light

    /// Called on marker tap.
    var onVendorTap: (Vendor) -> Void = { _ in }

    func makeCoordinator() -> Coordinator { Coordinator(parent: self) }

    func makeUIView(context: Context) -> GMSMapView {
        let camera = GMSCameraPosition(
            latitude: cameraTarget?.latitude ?? 25.1972,
            longitude: cameraTarget?.longitude ?? 55.2744,
            zoom: zoom
        )
        let mapView = GMSMapView(frame: .zero, camera: camera)
        mapView.isMyLocationEnabled = true
        // The mocks deliberately don't render Google's default UI chrome
        // (compass, my-location button, toolbar) so the branded layer can
        // float over a cleaner canvas. Match that here.
        mapView.settings.myLocationButton = false
        mapView.settings.compassButton = false
        mapView.settings.indoorPicker = false
        mapView.delegate = context.coordinator
        applyBrandStyle(to: mapView, scheme: colorScheme)
        return mapView
    }

    func updateUIView(_ map: GMSMapView, context: Context) {
        // Re-centre if the host gave us a fresh location.
        if let target = cameraTarget {
            let newCamera = GMSCameraPosition(target: target, zoom: zoom)
            // Only animate if the camera is materially different — avoids
            // jittering on every state push.
            let old = map.camera.target
            if abs(old.latitude - target.latitude) > 0.0001 ||
                abs(old.longitude - target.longitude) > 0.0001 {
                map.animate(to: newCamera)
            }
        }

        // Re-apply branded style if the appearance flipped since the last
        // update (e.g. iOS dark mode toggle while the map's onscreen).
        if context.coordinator.appliedScheme != colorScheme {
            applyBrandStyle(to: map, scheme: colorScheme)
            context.coordinator.appliedScheme = colorScheme
        }

        // Diff markers — Coordinator owns the cache so we don't redraw on
        // every state change.
        context.coordinator.sync(map: map, vendors: vendors)
    }

    /// Loads `map_style_warm.json` (light) or `map_style_dark.json` (dark)
    /// from the bundle and applies it. Silent no-op if the file isn't
    /// present — the map just renders Google's default tiles.
    private func applyBrandStyle(to map: GMSMapView, scheme: ColorScheme) {
        let name = (scheme == .dark) ? "map_style_dark" : "map_style_warm"
        guard let url = Bundle.main.url(forResource: name, withExtension: "json") else {
            print("⚠️ GoogleMapView: \(name).json not in bundle — using default style.")
            return
        }
        do {
            let style = try GMSMapStyle(contentsOfFileURL: url)
            map.mapStyle = style
        } catch {
            print("⚠️ GoogleMapView: failed to apply \(name): \(error.localizedDescription)")
        }
    }

    // MARK: - Coordinator

    final class Coordinator: NSObject, GMSMapViewDelegate {
        var parent: GoogleMapView
        private var markers: [String: GMSMarker] = [:]
        private var lastVendorIDs: Set<String> = []
        /// Tracks which appearance the map's current style was loaded for so
        /// we know when to re-apply on `updateUIView`.
        var appliedScheme: ColorScheme = .light

        init(parent: GoogleMapView) { self.parent = parent }

        func sync(map: GMSMapView, vendors: [Vendor]) {
            let incomingIDs = Set(vendors.map(\.id))

            // Remove markers that aren't in the new set.
            for (id, marker) in markers where !incomingIDs.contains(id) {
                marker.map = nil
                markers.removeValue(forKey: id)
            }

            // Add or update markers for vendors in the new set.
            for v in vendors {
                if let existing = markers[v.id] {
                    existing.position = CLLocationCoordinate2D(latitude: v.lat, longitude: v.lng)
                    existing.title = v.brandName
                    existing.snippet = "\(v.freeBays) free · \(v.city)"
                } else {
                    let m = GMSMarker(position: CLLocationCoordinate2D(latitude: v.lat, longitude: v.lng))
                    m.title = v.brandName
                    m.snippet = "\(v.freeBays) free · \(v.city)"
                    m.userData = v
                    m.icon = GMSMarker.markerImage(with: markerColor(for: v))
                    m.map = map
                    markers[v.id] = m
                }
            }

            lastVendorIDs = incomingIDs
        }

        private func markerColor(for v: Vendor) -> UIColor {
            // Aqua for free, coral for busy. Matches the Android map style.
            v.freeBays > 0 ? UIColor(red: 0.078, green: 0.722, blue: 0.651, alpha: 1)   // #14B8A6
                           : UIColor(red: 1.000, green: 0.545, blue: 0.420, alpha: 1) // #FF8B6B
        }

        // MARK: GMSMapViewDelegate

        func mapView(_ map: GMSMapView, didTap marker: GMSMarker) -> Bool {
            if let vendor = marker.userData as? Vendor {
                parent.onVendorTap(vendor)
                return true   // we handled it; don't show default info window
            }
            return false
        }
    }
}
