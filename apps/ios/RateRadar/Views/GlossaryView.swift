import SwiftUI

/// 1:1 port of apps/web/src/app/glossary/page.tsx (mobile rendering).
/// JsonLd / metadata / AdSlot are omitted per the rebuild contract.
struct GlossaryView: View {
    @Environment(Router.self) private var router

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                header

                termsList
                    .padding(.top, 40) // header mb-10

                // Ad section (my-10) renders nothing natively.
            }
            .padding(.horizontal, 24)
            .padding(.vertical, 64)
        }
        .background(RR.cream)
    }

    // MARK: - Header

    @ViewBuilder private var header: some View {
        Text("Glossary")
            .font(.rrSerif(48, weight: .medium))
            .tracking(-0.5)
            .foregroundStyle(RR.ink)

        Text("Plain-English definitions for the terms you'll see on RateRadar. No Bloomberg terminal required.")
            .font(.rrSans(18))
            .lineSpacing(8) // leading-relaxed
            .foregroundStyle(RR.inkSoft)
            .padding(.top, 24) // mt-6
    }

    // MARK: - <dl> term list

    private var termsList: some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(Array(GlossaryTerms.all.enumerated()), id: \.element.slug) { index, t in
                // <dt> — mono sm uppercase tracking-wider link
                Button {
                    router.navigate(.glossaryTerm(t.slug))
                } label: {
                    Text(t.term)
                        .font(.rrMono(14))
                        .textCase(.uppercase)
                        .tracking(0.7) // tracking-wider (0.05em × 14)
                        .multilineTextAlignment(.leading)
                        .foregroundStyle(RR.ink)
                }
                .buttonStyle(.plain)

                // <dd> — lg ink-soft definition
                Text(t.def)
                    .font(.rrSans(18))
                    .lineSpacing(8) // leading-relaxed
                    .foregroundStyle(RR.inkSoft)
                    .padding(.top, 4) // mt-1
                    .padding(.bottom, 24) // mb-6

                if index < GlossaryTerms.all.count - 1 {
                    RRRule(tone: .soft)
                }
            }
        }
    }
}

#Preview {
    NavigationStack {
        GlossaryView()
    }
    .environment(Router())
    .environment(AppDataStore())
}
