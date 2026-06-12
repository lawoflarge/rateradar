import SwiftUI

@main
struct RateRadarApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @Environment(\.scenePhase) private var scenePhase

    @State private var store = AppDataStore()
    @State private var showOnboarding = !OnboardingStore.hasCompleted
    @State private var adsInitScheduled = false

    var body: some Scene {
        WindowGroup {
            Group {
                if showOnboarding {
                    OnboardingView {
                        showOnboarding = false
                    }
                } else {
                    RootView()
                }
            }
            .environment(store)
            .preferredColorScheme(.light)
            .task {
                // Keep-awake parity (expo-keep-awake for the app lifetime).
                UIApplication.shared.isIdleTimerDisabled = true
                await store.loadAll()
            }
        }
        .onChange(of: scenePhase) { _, newPhase in
            // ATT/ads init only once the scene is foreground-active, +600ms —
            // never earlier (Guideline 2.1 lesson, see AdsManager).
            guard newPhase == .active, !adsInitScheduled else { return }
            adsInitScheduled = true
            Task {
                try? await Task.sleep(for: .milliseconds(600))
                await AdsManager.shared.initAds()
            }
        }
    }
}
