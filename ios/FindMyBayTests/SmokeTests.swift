`// SmokeTests.swift
//
// Tiny test target so XcodeGen has a target to wire up and `xcodebuild test`
// runs successfully on a fresh checkout.

import XCTest
@testable import FindMyBay

final class SmokeTests: XCTestCase {

    func testColorTokensConstructable() {
        // If the color initializer compiles and returns sensible values, the
        // theme module is properly linked.
        let aqua = Fmb.aqua
        XCTAssertNotNil(aqua)
    }

    func testUserProfileInitials() {
        let p = UserProfile(id: "u1", phone: "+971501234567", email: nil, fullName: "Rimas Hussain", role: "customer")
        XCTAssertEqual(p.initials, "RH")
    }
}
