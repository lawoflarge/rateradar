import SwiftUI

/// 1:1 port of apps/ios-expo/src/components/OnboardingScreen.tsx.
struct OnboardingView: View {
    let onDone: () -> Void

    @State private var busy = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Brand row: concentric-circle radar mark + wordmark.
            HStack(spacing: 12) {
                OnboardingRadarMark()
                Text("RateRadar")
                    .font(.rrSans(18, weight: .semibold))
                    .tracking(-0.2)
                    .foregroundStyle(RR.ink)
            }

            Text("When will they cut?")
                .font(.rrSans(40, weight: .medium))
                .tracking(-0.6)
                .lineSpacing(4)
                .foregroundStyle(RR.ink)
                .padding(.top, 56)

            Text("Market-implied probabilities for Fed and ECB rate decisions, with historical tracking over days and weeks.")
                .font(.rrSans(17))
                .lineSpacing(9)
                .foregroundStyle(RR.inkMute)
                .padding(.top, 16)

            Spacer(minLength: 0)

            Text("Get a heads-up when odds move sharply.")
                .font(.rrSans(13))
                .textCase(.uppercase)
                .tracking(1.2)
                .foregroundStyle(RR.inkMute)
                .padding(.top, 64)

            Button {
                guard !busy else { return }
                busy = true
                Task {
                    _ = await NotificationsManager.requestPushPermission()
                    complete()
                }
            } label: {
                Text("Enable rate-shift alerts")
                    .font(.rrSans(16, weight: .semibold))
                    .tracking(0.2)
                    .foregroundStyle(RR.cream)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 16)
            }
            .buttonStyle(OnboardingCTAStyle())
            .padding(.top, 24)
            .accessibilityIdentifier("rr-onboarding-enable")

            Button {
                guard !busy else { return }
                busy = true
                complete()
            } label: {
                Text("Not now")
                    .font(.rrSans(14))
                    .foregroundStyle(RR.inkMute)
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.plain)
            .padding(.top, 16)
            .accessibilityIdentifier("rr-onboarding-skip")
        }
        .padding(.horizontal, 24)
        .padding(.top, 96)
        .padding(.bottom, 48)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(RR.cream.ignoresSafeArea())
        .accessibilityIdentifier("rr-onboarding")
    }

    private func complete() {
        OnboardingStore.markCompleted()
        onDone()
    }
}

/// Square-cornered black CTA; pressed state turns amber (#C8841C).
private struct OnboardingCTAStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .background(configuration.isPressed ? RR.cut : RR.ink)
    }
}

/// Onboarding brand mark: 3 nested ink circles (32/20/8 pt, borders 1.5/0.75/0.75).
private struct OnboardingRadarMark: View {
    var body: some View {
        ZStack {
            Circle().strokeBorder(RR.ink, lineWidth: 1.5).frame(width: 32, height: 32)
            Circle().strokeBorder(RR.ink, lineWidth: 0.75).frame(width: 20, height: 20)
            Circle().strokeBorder(RR.ink, lineWidth: 0.75).frame(width: 8, height: 8)
        }
    }
}

#Preview {
    OnboardingView(onDone: {})
}
