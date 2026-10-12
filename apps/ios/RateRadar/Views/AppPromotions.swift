import CrossPromotionCore
import CrossPromotionUI
import SwiftUI

@MainActor
enum AppPromotions {
    static let title = String(localized: "moreApps", defaultValue: "More apps", table: "Promotions")
    static func makeStore() -> PromotionStore? {
        guard let value = Bundle.main.object(forInfoDictionaryKey: "CrossPromotionBaseURL") as? String,
              let url = URL(string: value), url.scheme == "https", url.host != nil,
              url.user == nil, url.password == nil else { return nil }
        return PromotionStore(
            source: PromotionIdentity(appStoreID: "6768628917", bundleID: "com.lawoflarge.rateradar"),
            baseURL: url,
            eventsEnabled: true
        )
    }
}

@MainActor
struct AppPromotionSection: View {
    let store: PromotionStore
    let viewport: CGRect
    @Environment(\.openURL) private var openURL
    @State private var showsStoreError = false

    var body: some View {
        Group {
            if !store.promotions.isEmpty {
                VStack(alignment: .leading, spacing: 16) {
                    Text(AppPromotions.title).font(.custom("IBMPlexSerif-Medium", size: 24, relativeTo: .title2)).foregroundStyle(RR.ink).accessibilityAddTraits(.isHeader)
                    rows
                }.padding(.top, 48)
            }
        }
        .tint(RR.cutDeep)
        .alert(String(localized: "storeUnavailableTitle", defaultValue: "App Store unavailable", table: "Promotions"), isPresented: $showsStoreError) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(String(localized: "storeUnavailableMessage", defaultValue: "Please try again in a moment.", table: "Promotions"))
        }
    }

    private var rows: some View {
        ForEach(store.promotions.prefix(3)) { promotion in
            CrossPromotionRow(
                promotion: promotion,
                appStoreActionTitle: String(localized: "openAppStore", defaultValue: "View in App Store", table: "Promotions"),
                style: .init(titleFont: .custom("IBMPlexSerif-Medium", size: 18, relativeTo: .headline), benefitFont: .custom("Inter-Regular", size: 16, relativeTo: .subheadline), actionFont: .custom("Inter-SemiBold", size: 13, relativeTo: .caption), titleColor: RR.ink, benefitColor: RR.inkSoft)
            ) {
                CrossPromotionIcon(promotion.iconURL)
            } onSelect: { selected in
                openURL(selected.appStoreURL) { accepted in
                    if accepted { store.recordClick(selected) }
                    else { showsStoreError = true }
                }
            }
            .promotionImpression(promotion, store: store, viewport: showsStoreError ? .zero : viewport)
        }
    }
}
