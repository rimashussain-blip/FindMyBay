// SafariSheet.swift
//
// SwiftUI wrapper around `SFSafariViewController`. Used to open the payment
// hosted page without leaving the app — when the page redirects to
// `findmybay://payment/return?…`, iOS routes that custom URL back to us via
// `onOpenURL`, where `PaymentReturnBus` picks it up.

import SwiftUI
import SafariServices

struct SafariSheet: UIViewControllerRepresentable {
    let url: URL

    func makeUIViewController(context: Context) -> SFSafariViewController {
        let cfg = SFSafariViewController.Configuration()
        cfg.entersReaderIfAvailable = false
        cfg.barCollapsingEnabled = false
        let vc = SFSafariViewController(url: url, configuration: cfg)
        vc.preferredBarTintColor  = UIColor.systemBackground
        vc.preferredControlTintColor = UIColor(Fmb.deep)
        vc.dismissButtonStyle = .close
        return vc
    }

    func updateUIViewController(_ uiViewController: SFSafariViewController, context: Context) {}
}
