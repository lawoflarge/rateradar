import SwiftUI

/// App shell mirroring the WebView host: persistent NavBar on top (web sticky
/// nav), routed content, anchored AdMob banner at the bottom (App.tsx layout).
struct RootView: View {
    @Environment(AppDataStore.self) private var store
    @State private var router = Router()
    @State private var deepLink = DeepLinkCenter.shared

    var body: some View {
        VStack(spacing: 0) {
            NavBarView()

            NavigationStack(path: $router.path) {
                DashboardView()
                    .toolbar(.hidden, for: .navigationBar)
                    .navigationDestination(for: Route.self) { route in
                        destination(for: route)
                            .toolbar(.hidden, for: .navigationBar)
                    }
            }

            BannerAdSlot()
        }
        .background(RR.cream.ignoresSafeArea())
        .environment(router)
        .onChange(of: router.path) { oldPath, newPath in
            // Web NativeNavBridge parity: each navigation TO /meeting/* or
            // /compare is one qualifying interstitial event.
            guard newPath.count > oldPath.count, let pushed = newPath.last else { return }
            if pushed.isQualifyingEvent {
                AdsManager.shared.onQualifyingEvent()
            }
        }
        .onChange(of: deepLink.pendingMeetingId) { _, id in
            consumeDeepLink(id)
        }
        .task {
            consumeDeepLink(deepLink.pendingMeetingId)
            // Covers the new-user path: permission was just granted in onboarding,
            // so (re)schedule reminders now that RootView is on screen.
            if store.hasLoaded {
                await AlertScheduler.rescheduleMeetingReminders(meetings: store.all)
                AlertScheduler.recordSnapshots(meetings: store.all)
            }
        }
    }

    /// A tapped notification routes to its meeting detail, then clears the flag.
    private func consumeDeepLink(_ id: String?) {
        guard let id else { return }
        if router.path.last != .meeting(id) {
            router.navigate(.meeting(id))
        }
        deepLink.pendingMeetingId = nil
    }

    @ViewBuilder
    private func destination(for route: Route) -> some View {
        switch route {
        case .fed: FedHubView()
        case .ecb: ECBHubView()
        case .meeting(let id): MeetingDetailView(meetingId: id)
        case .compare: CompareView()
        case .scenarios: ScenariosView()
        case .methodology: MethodologyView()
        case .glossary: GlossaryView()
        case .glossaryTerm(let slug): GlossaryTermView(slug: slug)
        case .brokers: BrokersView()
        case .about: AboutView()
        case .privacy: PrivacyView()
        case .alerts: AlertsView()
        }
    }
}
