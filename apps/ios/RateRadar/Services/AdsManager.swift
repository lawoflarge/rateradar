import SwiftUI
import Observation
import GoogleMobileAds
import UserMessagingPlatform
import AppTrackingTransparency

/// Native port of apps/ios-expo/src/lib/{ads,interstitial}.ts.
///
/// Init ordering is load-bearing (Guideline 2.1 rejection 50741e54): the ATT
/// prompt MUST be requested only after the app is foreground-active (+600ms),
/// never during launch — iOS silently drops it otherwise. Order:
/// active → +600ms → ATT (if undetermined) → UMP consent → SDK start → preload.
@MainActor
@Observable
final class AdsManager {
    static let shared = AdsManager()

    #if DEBUG
    static let bannerUnitId = "ca-app-pub-3940256099942544/2934735716" // Google test
    static let interstitialUnitId = "ca-app-pub-3940256099942544/4411468910" // Google test
    #else
    static let bannerUnitId = "ca-app-pub-6563643868702361/6751953637"
    static let interstitialUnitId = "ca-app-pub-6563643868702361/7124163774"
    #endif

    private static let lastShownKey = "rr.interstitial.lastShownTs.v1"

    private var initStarted = false
    private(set) var sdkReady = false
    private var interstitial: InterstitialAd?
    private var policyState = InterstitialPolicy.State()
    private let interstitialDelegate = InterstitialDelegate()

    private init() {
        policyState.lastShownTs = UserDefaults.standard.double(forKey: Self.lastShownKey)
        interstitialDelegate.manager = self
    }

    /// One-shot. Call from the first scenePhase == .active, after a ~600ms delay.
    func initAds() async {
        guard !initStarted else { return }
        initStarted = true

        // 1. ATT — only when undetermined; failures never block the app.
        if ATTrackingManager.trackingAuthorizationStatus == .notDetermined {
            _ = await ATTrackingManager.requestTrackingAuthorization()
        }

        // 2. UMP consent (GDPR) — best-effort, mirrors the try/catch-ignored TS block.
        await requestConsentIfRequired()

        // 3. Mobile Ads SDK configuration + start.
        MobileAds.shared.requestConfiguration.maxAdContentRating = GADMaxAdContentRating.parentalGuidance
        MobileAds.shared.requestConfiguration.tagForChildDirectedTreatment = NSNumber(value: false)
        MobileAds.shared.requestConfiguration.tagForUnderAgeOfConsent = NSNumber(value: false)
        await MobileAds.shared.start()
        sdkReady = true

        // 4. Preload the first interstitial.
        await preloadInterstitial()
    }

    private func requestConsentIfRequired() async {
        let parameters = UMPRequestParameters()
        parameters.tagForUnderAgeOfConsent = false
        do {
            try await UMPConsentInformation.sharedInstance.requestConsentInfoUpdate(with: parameters)
            if UMPConsentInformation.sharedInstance.formStatus == .available,
               UMPConsentInformation.sharedInstance.consentStatus == .required,
               let root = Self.rootViewController() {
                try await UMPConsentForm.loadAndPresentIfRequired(from: root)
            }
        } catch {
            // Consent failure must never block the app (parity with ads.ts).
        }
    }

    // MARK: - Interstitial lifecycle (interstitial.ts)

    func preloadInterstitial() async {
        guard sdkReady, interstitial == nil else { return }
        do {
            let ad = try await InterstitialAd.load(
                with: Self.interstitialUnitId, request: Request()
            )
            ad.fullScreenContentDelegate = interstitialDelegate
            interstitial = ad
            policyState.adLoaded = true
        } catch {
            policyState.adLoaded = false
        }
    }

    /// Qualifying events: navigation to meeting detail or compare
    /// (web NativeNavBridge → App.tsx onQualifyingEvent parity).
    func onQualifyingEvent() {
        policyState.count += 1
        let nowMs = Date().timeIntervalSince1970 * 1000
        if InterstitialPolicy.shouldShow(policyState, nowMs: nowMs),
           let ad = interstitial, let root = Self.rootViewController() {
            ad.present(from: root)
        } else if interstitial == nil {
            Task { await preloadInterstitial() }
        }
    }

    fileprivate func interstitialDismissed() {
        interstitial = nil
        policyState.adLoaded = false
        policyState.shownThisSession += 1
        policyState.lastShownTs = Date().timeIntervalSince1970 * 1000
        UserDefaults.standard.set(policyState.lastShownTs, forKey: Self.lastShownKey)
        Task { await preloadInterstitial() }
    }

    fileprivate func interstitialFailedToPresent() {
        interstitial = nil
        policyState.adLoaded = false
        Task { await preloadInterstitial() }
    }

    static func rootViewController() -> UIViewController? {
        UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap(\.windows)
            .first(where: \.isKeyWindow)?
            .rootViewController
    }
}

private final class InterstitialDelegate: NSObject, FullScreenContentDelegate {
    weak var manager: AdsManager?

    func adDidDismissFullScreenContent(_ ad: FullScreenPresentingAd) {
        Task { @MainActor in manager?.interstitialDismissed() }
    }

    func ad(_ ad: FullScreenPresentingAd, didFailToPresentFullScreenContentWithError error: Error) {
        Task { @MainActor in manager?.interstitialFailedToPresent() }
    }
}

// MARK: - Anchored adaptive banner (BannerAdSlot.tsx parity)

struct BannerAdSlot: View {
    // Reserve the adaptive height up front (RNGMA parity) — a zero-height
    // banner view fails to load with "Invalid ad width or height".
    @State private var bannerHeight: CGFloat = currentOrientationAnchoredAdaptiveBanner(
        width: UIScreen.main.bounds.width
    ).size.height

    var body: some View {
        // Mount the banner only once the Mobile Ads SDK has started —
        // loading earlier fails permanently (no retry on GADBannerView).
        Group {
            if AdsManager.shared.sdkReady {
                BannerAdView(height: $bannerHeight)
                    .frame(height: bannerHeight)
                    .frame(maxWidth: .infinity)
            } else {
                Color.clear.frame(height: 0)
            }
        }
        .background(RR.cream)
    }
}

private struct BannerAdView: UIViewRepresentable {
    @Binding var height: CGFloat

    func makeUIView(context: Context) -> BannerView {
        let width = UIScreen.main.bounds.width
        let adSize = currentOrientationAnchoredAdaptiveBanner(width: width)
        let banner = BannerView(adSize: adSize)
        // Give the view concrete bounds before load() — the SDK validates the
        // view size, and SwiftUI has not laid the representable out yet.
        banner.frame = CGRect(origin: .zero, size: adSize.size)
        banner.adUnitID = AdsManager.bannerUnitId
        banner.rootViewController = AdsManager.rootViewController()
        banner.delegate = context.coordinator
        banner.load(Request())
        return banner
    }

    func updateUIView(_ uiView: BannerView, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(height: $height) }

    final class Coordinator: NSObject, BannerViewDelegate {
        @Binding var height: CGFloat
        private var retries = 0
        init(height: Binding<CGFloat>) { _height = height }

        func bannerViewDidReceiveAd(_ bannerView: BannerView) {
            height = bannerView.adSize.size.height
        }

        func bannerView(_ bannerView: BannerView, didFailToReceiveAdWithError error: Error) {
            // The first load can race SwiftUI layout ("Invalid ad width or
            // height" while bounds are still zero) — retry once laid out.
            guard retries < 5 else {
                height = 0
                return
            }
            retries += 1
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                bannerView.load(Request())
            }
        }
    }
}
