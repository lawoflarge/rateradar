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
                // Refresh meeting reminders with the latest odds, mark the current
                // values as "seen" (so background alerts only fire on later moves),
                // and queue the next background shift check.
                await AlertScheduler.rescheduleMeetingReminders(meetings: store.all)
                AlertScheduler.recordSnapshots(meetings: store.all)
                AlertScheduler.scheduleBackgroundRefresh()
            }
        }
        .onChange(of: scenePhase) { _, newPhase in
            // ATT/ads init only once the scene is foreground-active, +600ms —
            // never earlier (Guideline 2.1 lesson, see AdsManager).
            if newPhase == .active, !adsInitScheduled {
                adsInitScheduled = true
                Task {
                    try? await Task.sleep(for: .milliseconds(600))
                    await AdsManager.shared.initAds()
                }
            }
            if newPhase == .background {
                AlertScheduler.scheduleBackgroundRefresh()
            }
        }
    }
}
