import SwiftUI

/// 1:1 port of apps/web/src/app/glossary/[term]/page.tsx (mobile rendering).
/// JsonLd / metadata / AdSlot are omitted per the rebuild contract.
struct GlossaryTermView: View {
    @Environment(Router.self) private var router
    @Environment(\.dismiss) private var dismiss

    let slug: String

    private var term: GlossaryTerm? { GlossaryTerms.term(slug: slug) }

    /// 4 sibling terms (next ones, wrapping) as related links.
    private func related(for t: GlossaryTerm) -> [GlossaryTerm] {
        let all = GlossaryTerms.all
        guard let idx = all.firstIndex(where: { $0.slug == t.slug }) else { return [] }
        return (1...4).map { all[(idx + $0) % all.count] }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                if let t = term {
                    content(t)
                } else {
                    // Web: notFound(). Unreachable via in-app links.
                    Text("Term not found")
                        .font(.rrSans(18))
                        .foregroundStyle(RR.inkSoft)
                }
            }
            .padding(.horizontal, 24)
            .padding(.vertical, 64)
        }
        .background(RR.cream)
    }

    // MARK: - Page content

    @ViewBuilder private func content(_ t: GlossaryTerm) -> some View {
        breadcrumb(t)

        // Header
        SectionLabel("Glossary")
            .padding(.top, 32) // nav mb-8

        Text(t.term)
            .font(.rrSerif(36, weight: .medium)) // text-4xl (sm:text-5xl ignored)
            .tracking(-0.5)
            .foregroundStyle(RR.ink)
            .padding(.top, 12) // mt-3

        // Definition
        Text(t.def)
            .font(.rrSans(18))
            .lineSpacing(8) // leading-relaxed
            .foregroundStyle(RR.inkSoft)
            .padding(.top, 32) // header mb-8

        // Tracker + methodology links
        Text(Self.seeItInActionText)
            .font(.rrSans(14))
            .foregroundStyle(RR.inkMute)
            .padding(.top, 32) // mt-8
            .environment(\.openURL, OpenURLAction { url in
                if url.absoluteString == "rateradar://home" {
                    router.popToRoot()
                } else {
                    router.navigate(.methodology)
                }
                return .handled
            })

        RRRule(tone: .soft)

        // Related terms
        SectionLabel("Related terms")
            .padding(.top, 32) // section my-8

        WrappingHStack(spacing: 8, lineSpacing: 8) { // flex-wrap gap-2
            ForEach(related(for: t)) { r in
                Button {
                    router.navigate(.glossaryTerm(r.slug))
                } label: {
                    Text(r.term)
                        .font(.rrMono(12))
                        .foregroundStyle(RR.inkMute)
                        .padding(.horizontal, 10) // px-2.5
                        .padding(.vertical, 4) // py-1
                        .border(RR.ink.opacity(0.15), width: 1)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.top, 16) // mt-4

        // Ad section (my-10) renders nothing natively; margins collapse.
        // Web links to /glossary (the index) — after term → related-term
        // chains a plain dismiss() would return to the previous term instead.
        Button {
            router.navigate(.glossary)
        } label: {
            Text("← All glossary terms")
                .font(.rrSans(14))
                .foregroundStyle(RR.cut)
        }
        .buttonStyle(.plain)
        .padding(.top, 40) // section mb-8 + ad my-10 collapsed
    }

    // MARK: - Breadcrumb (Home / Glossary / {term})

    private func breadcrumb(_ t: GlossaryTerm) -> some View {
        Text(Self.breadcrumbText(t))
            .font(.rrSans(14))
            .foregroundStyle(RR.inkMute)
            .environment(\.openURL, OpenURLAction { url in
                if url.absoluteString == "rateradar://home" {
                    router.popToRoot()
                } else {
                    router.navigate(.glossary)
                }
                return .handled
            })
    }

    private static func breadcrumbText(_ t: GlossaryTerm) -> AttributedString {
        var home = AttributedString("Home")
        home.link = URL(string: "rateradar://home")
        home.foregroundColor = RR.inkMute
        var glossary = AttributedString("Glossary")
        glossary.link = URL(string: "rateradar://glossary")
        glossary.foregroundColor = RR.inkMute
        var name = AttributedString(t.term)
        name.foregroundColor = RR.ink
        return home + AttributedString(" / ") + glossary + AttributedString(" / ") + name
    }

    private static var seeItInActionText: AttributedString {
        var s = AttributedString("See it in action on the ")
        var tracker = AttributedString("live probability tracker")
        tracker.link = URL(string: "rateradar://home")
        tracker.foregroundColor = RR.cut
        s += tracker
        s += AttributedString(" or read the ")
        var methodology = AttributedString("full methodology")
        methodology.link = URL(string: "rateradar://methodology")
        methodology.foregroundColor = RR.cut
        s += methodology
        s += AttributedString(".")
        return s
    }
}

#Preview {
    NavigationStack {
        GlossaryTermView(slug: "basis-points")
    }
    .environment(Router())
    .environment(AppDataStore())
}
