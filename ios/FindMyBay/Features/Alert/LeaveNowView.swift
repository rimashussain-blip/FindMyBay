// LeaveNowView.swift
//
// Mirrors design handoff screen #7:
//   • Full-screen aqua → ink gradient background with sand + aqua glow blobs
//   • "SMART LEAVE ALERT" eyebrow (white 70% opacity, 1.5 letter-spacing)
//   • Pulsing sand halo behind a 26px-radius card holding the 🚗 emoji
//   • "Leave now" headline 36px white -1
//   • Subtitle "Heading to <Vendor> for your 10:00 wash"
//   • Glass card with two stats: Drive (12 min, +3 traffic) | Slot (10:00, Bay 1 · Tue)
//   • Sand → sand-deep gradient primary CTA "I'm leaving now"
//   • Outlined ghost "Snooze 5 min"

import SwiftUI

struct LeaveNowView: View {

    let vendorName: String
    let etaMin: Int
    let slotTime: String
    var onDismiss: () -> Void

    @Environment(\.fmbScheme) private var scheme
    @State private var halo = false

    var body: some View {
        ZStack {
            // Always the deep aqua → ink gradient — the LeaveNow alert is its
            // own immersive dark surface regardless of system appearance, so
            // this stays explicit rather than scheme-driven.
            LinearGradient(
                colors: [Fmb.aquaBright, Fmb.deep, Fmb.ink],
                startPoint: .topLeading, endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            // Decorative blobs
            Circle()
                .fill(RadialGradient(
                    colors: [Fmb.sandDeep.opacity(0.45), Fmb.sandDeep.opacity(0)],
                    center: .center, startRadius: 0, endRadius: 100
                ))
                .frame(width: 200, height: 200)
                .offset(x: -120, y: -250)

            Circle()
                .fill(RadialGradient(
                    colors: [Fmb.aquaBright.opacity(0.5), Fmb.aquaBright.opacity(0)],
                    center: .center, startRadius: 0, endRadius: 110
                ))
                .frame(width: 220, height: 220)
                .offset(x: 130, y: 220)

            VStack(alignment: .center, spacing: 0) {
                Text("SMART LEAVE ALERT")
                    .font(.system(size: 11, weight: .semibold))
                    .kerning(1.5)
                    .foregroundStyle(.white.opacity(0.7))
                    .padding(.top, 14)

                Spacer().frame(height: 26)

                ZStack {
                    Circle()
                        .fill(Fmb.sandDeep.opacity(0.25))
                        .frame(width: 112, height: 112)
                        .scaleEffect(halo ? 1.15 : 1)
                        .opacity(halo ? 0.25 : 0.55)
                    RoundedRectangle(cornerRadius: 26)
                        .fill(LinearGradient(
                            colors: [Fmb.sand, Fmb.sandDeep],
                            startPoint: .topLeading, endPoint: .bottomTrailing
                        ))
                        .frame(width: 96, height: 96)
                        .shadow(color: Color.black.opacity(0.25), radius: 20, x: 0, y: 14)
                    FmbBrandCar(width: 72)
                        .padding(.top, 4) // visually centre the car body inside the rounded square
                }
                .onAppear {
                    withAnimation(.easeInOut(duration: 2).repeatForever(autoreverses: true)) {
                        halo.toggle()
                    }
                }

                Spacer().frame(height: 24)

                Text("Leave now")
                    .font(.system(size: 36, weight: .heavy))
                    .kerning(-1)
                    .foregroundStyle(.white)

                Spacer().frame(height: 6)

                VStack(spacing: 0) {
                    Text("Heading to ")
                        .font(.system(size: 13))
                        .foregroundStyle(.white.opacity(0.85)) +
                    Text(vendorName)
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(Fmb.sand)
                    Text("for your ")
                        .font(.system(size: 13))
                        .foregroundStyle(.white.opacity(0.85)) +
                    Text(slotTime)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(.white) +
                    Text(" wash")
                        .font(.system(size: 13))
                        .foregroundStyle(.white.opacity(0.85))
                }

                Spacer().frame(height: 28)

                statsCard

                Spacer()

                FmbPrimaryButton(
                    title: "I'm leaving now",
                    action: onDismiss
                )
                .background(
                    LinearGradient(
                        colors: [Fmb.sand, Fmb.sandDeep],
                        startPoint: .top, endPoint: .bottom
                    )
                    .cornerRadius(14)
                )
                .colorMultiply(.white)
                .overlay(
                    Text("I'm leaving now")
                        .font(.system(size: 16, weight: .bold))
                        .kerning(-0.3)
                        .foregroundStyle(Fmb.deep)
                )

                Button {
                    // Snooze 5 min — placeholder, persists local nudge later.
                } label: {
                    Text("Snooze 5 min")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .frame(height: 44)
                        .overlay(
                            RoundedRectangle(cornerRadius: 12)
                                .strokeBorder(Color.white.opacity(0.35), lineWidth: 1)
                        )
                }
                .padding(.top, 8)
                .padding(.bottom, 24)
            }
            .padding(.horizontal, 22)
        }
        .navigationBarHidden(true)
    }

    private var statsCard: some View {
        HStack(spacing: 0) {
            VStack(spacing: 4) {
                Text("Drive")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(scheme.onSurfaceVariant)
                HStack(alignment: .firstTextBaseline, spacing: 2) {
                    Text("\(max(1, etaMin))")
                        .font(.system(size: 30, weight: .heavy))
                        .kerning(-1)
                        .foregroundStyle(scheme.onBackground)
                    Text("min")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(scheme.onSurfaceVariant)
                }
                Text("+3 traffic")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(Fmb.coral)
            }
            .frame(maxWidth: .infinity)

            Rectangle()
                .fill(Color.black.opacity(0.08))
                .frame(width: 1)
                .padding(.vertical, 4)

            VStack(spacing: 4) {
                Text("Slot")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(scheme.onSurfaceVariant)
                Text(slotTime.isEmpty ? "10:00" : slotTime)
                    .font(.system(size: 30, weight: .heavy))
                    .kerning(-1)
                    .foregroundStyle(Fmb.deep)
                Text("Bay 1 · Today")
                    .font(.system(size: 10))
                    .foregroundStyle(scheme.onSurfaceVariant)
            }
            .frame(maxWidth: .infinity)
        }
        .padding(16)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 22))
        .background(Color.white.opacity(0.95), in: RoundedRectangle(cornerRadius: 22))
        .shadow(color: Color.black.opacity(0.18), radius: 24, x: 0, y: 12)
    }
}
