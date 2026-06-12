import SwiftUI

/// App shell mirroring the WebView host: persistent NavBar on top (web sticky
/// nav), routed content, anchored AdMob banner at the bottom (App.tsx layout).
struct RootView: View {
    @State private var router = Router()

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
        }
    }
}
