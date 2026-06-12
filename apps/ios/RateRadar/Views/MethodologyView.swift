import SwiftUI

/// Full text port of apps/web/src/app/methodology/page.tsx (mobile rendering).
/// Static editorial page: serif H1/H2s, lg body copy, mono formula blocks in
/// cream-soft boxes with ink/15 borders and square corners.
struct MethodologyView: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                header
                section1
                section2
                section3
                section4
                section5
                section6
                section7
                section8
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 24)
            .padding(.vertical, 64)
        }
        .background(RR.cream)
    }

    // MARK: - Header (mb-10; h1 text-5xl serif medium tracking-tight, p mt-6 lg ink-soft)

    private var header: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Methodology")
                .font(.rrSerif(48, weight: .medium))
                .tracking(-0.5)
                .foregroundStyle(RR.ink)
            Text("How every probability on RateRadar is derived. If you can't trust the math, you can't trust the product.")
                .font(.rrSans(18))
                .lineSpacing(7)
                .foregroundStyle(RR.inkSoft)
                .padding(.top, 24)
        }
    }

    // MARK: - Sections

    private var section1: some View {
        Group {
            h2("1. What we're computing")
            paragraph(plain("For each upcoming FOMC (Fed) and ECB Governing Council meeting, we publish the market-implied probability of each possible rate outcome (hold, ±25 bps, ±50 bps, and larger moves when priced). We also publish conditional probabilities, an implied forward rate path, and daily historical snapshots that form a time series."))
        }
    }

    private var section2: some View {
        Group {
            h2("2. Data sources")
            bulletList([
                strong("Fed:") + plain(" 30-Day Fed Funds Futures (symbol ") + codeSpan("ZQ") + plain("), quoted on CME Globex. Pulled via free market-data providers; fallbacks include Stooq and FRED."),
                strong("ECB:") + plain(" €STR OIS (Overnight Index Swap) quotes by maturity. Derived implied rates are anchored to the published €STR fixing."),
                strong("Meeting calendars:") + plain(" sourced from ") + cutLink("federalreserve.gov", "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm") + plain(" and ") + cutLink("ecb.europa.eu", "https://www.ecb.europa.eu/press/calendars/mgcgc/html/index.en.html") + plain(". Validated annually."),
            ])
        }
    }

    private var section3: some View {
        Group {
            h2("3. Futures → implied rate")
            paragraph(plain("The Fed Funds Futures contract settles to the arithmetic average of daily effective Fed Funds rates during its contract month. The CME-standard transformation is:"))
            formulaBlock("implied_monthly_average_rate = 100 − contract_price")
            paragraph(plain("For a month with a single FOMC meeting on day ") + em("d") + plain(" of ") + em("N") + plain(" days:"))
            formulaBlock("monthly_avg = (d/N) · r_before + ((N−d)/N) · r_after")
            paragraph(plain("Solving for ") + em("r_after") + plain(" from the observed monthly-average gives the market-implied post-meeting rate."))
        }
    }

    private var section4: some View {
        Group {
            h2("4. Implied rate → outcome probabilities")
            paragraph(plain("We use the CME's standard step-function decomposition. Given a finite set of possible outcomes with post-meeting rates {o₁, o₂, ..., oₖ} and the observed expected post-meeting rate ") + em("E[r]") + plain(", we distribute probability mass over the two outcomes adjacent to ") + em("E[r]") + plain(" via linear interpolation, clamped and renormalized:"))
            formulaBlock("p_cut  = (r_hold − E[r]) / (r_hold − r_cut)\np_hold = 1 − p_cut")
            paragraph(plain("Three+ outcomes extend the same principle using consecutive adjacent-pair decomposition."))
        }
    }

    private var section5: some View {
        Group {
            h2("5. Update cadence")
            bulletList([
                plain("Daily snapshots: twice per business day (after US close and after European close)."),
                plain("Meeting-day refreshes: every 15 minutes during the decision window."),
                plain("Historical retention: all snapshots kept indefinitely."),
            ])
        }
    }

    private var section6: some View {
        Group {
            h2("6. Validation")
            paragraph(plain("Every snapshot is cross-checked against the live CME FedWatch page at capture time. Any outcome diverging more than 2% absolute triggers an alert. Weekly regression checks against CME's published historical archive catch long-term drift."))
        }
    }

    private var section7: some View {
        Group {
            h2("7. Known MVP limitations")
            paragraph(plain("The scaffold uses a single contract per meeting, which amplifies noise when the meeting falls within 5 days of the month-end. A Phase 2 release will cross-anchor with adjacent contracts. See ") + codeSpan("docs/METHODOLOGY.md §10") + plain(" for details."))
        }
    }

    private var section8: some View {
        Group {
            h2("8. Not financial advice")
            paragraph(plain("RateRadar shows what the market is pricing. It doesn't predict what central banks will actually decide. Nothing here is a recommendation to trade, invest, or change your financial plans."))
                .padding(.bottom, 16)
        }
    }

    // MARK: - Block helpers (web: h2 mt-12 mb-4 serif 2xl; p/ul/pre my-4 lg leading-relaxed;
    // adjacent vertical margins collapse, so blocks carry only their collapsed TOP gap)

    private func h2(_ text: String) -> some View {
        Text(text)
            .font(.rrSerif(24, weight: .medium))
            .foregroundStyle(RR.ink)
            .padding(.top, 48)
    }

    private func paragraph(_ content: AttributedString) -> some View {
        Text(content)
            .font(.rrSans(18))
            .lineSpacing(7)
            .foregroundStyle(RR.inkSoft)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.top, 16)
    }

    /// list-disc space-y-2 pl-6 → bullet gutter 24pt, 8pt item spacing.
    private func bulletList(_ items: [AttributedString]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            ForEach(Array(items.enumerated()), id: \.offset) { _, item in
                HStack(alignment: .top, spacing: 0) {
                    Text("•")
                        .font(.rrSans(18))
                        .foregroundStyle(RR.inkSoft)
                        .frame(width: 24, alignment: .center)
                    Text(item)
                        .font(.rrSans(18))
                        .lineSpacing(7)
                        .foregroundStyle(RR.inkSoft)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }
        .padding(.top, 16)
    }

    /// pre: overflow-x-auto rounded-none border-ink/15 bg-cream-soft p-4 mono sm.
    private func formulaBlock(_ code: String) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            Text(code)
                .font(.rrMono(14))
                .foregroundStyle(RR.ink)
                .padding(16)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RR.creamSoft)
        .overlay(Rectangle().strokeBorder(RR.ink.opacity(0.15), lineWidth: 1))
        .padding(.top, 16)
    }

    // MARK: - Inline-run helpers

    private func plain(_ s: String) -> AttributedString {
        AttributedString(s)
    }

    private func strong(_ s: String) -> AttributedString {
        var a = AttributedString(s)
        a.font = .rrSans(18, weight: .semibold)
        a.foregroundColor = RR.ink
        return a
    }

    private func em(_ s: String) -> AttributedString {
        var a = AttributedString(s)
        a.font = Font.rrSans(18).italic()
        return a
    }

    /// Inline <code>: mono text-sm on bg-cream-soft (inline border not renderable in-run).
    private func codeSpan(_ s: String) -> AttributedString {
        var a = AttributedString(s)
        a.font = .rrMono(14)
        a.foregroundColor = RR.ink
        a.backgroundColor = RR.creamSoft
        return a
    }

    /// Inline external link: text-cut, underline only on hover (none on touch).
    private func cutLink(_ s: String, _ url: String) -> AttributedString {
        var a = AttributedString(s)
        a.foregroundColor = RR.cut
        a.link = URL(string: url)
        return a
    }
}

#Preview {
    MethodologyView()
}
