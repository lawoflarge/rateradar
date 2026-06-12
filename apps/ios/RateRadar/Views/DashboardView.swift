import SwiftUI

/// Homepage — 1:1 port of apps/web/src/app/page.tsx (mobile rendering).
/// Loading skeleton mirrors app/loading.tsx; error state mirrors app/error.tsx.
struct DashboardView: View {
    @Environment(AppDataStore.self) private var store

    var body: some View {
        ScrollView {
            if store.isLoading && !store.hasLoaded {
                LoadingSkeleton()
            } else if let message = store.errorMessage, !store.hasLoaded {
                ErrorState(message: message) {
                    await store.loadAll()
                }
            } else {
                DashboardContent(fed: store.fed, ecb: store.ecb)
            }
        }
        .background(RR.cream)
        .refreshable { await store.loadAll() }
    }
}

// MARK: - Content (page.tsx <main className="mx-auto max-w-5xl px-6 py-16">)

private struct DashboardContent: View {
    let fed: [MeetingProbabilities]
    let ecb: [MeetingProbabilities]

    /// soonestMeeting(): earliest meeting_date across both banks (string compare,
    /// first-encountered wins on ties — fed before ecb, like the web reduce).
    private var next: MeetingProbabilities? {
        (fed + ecb).min { $0.meeting.meetingDate < $1.meeting.meetingDate }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            header

            RRRule()

            if let next, let nextTop = next.topOutcome {
                nextDecision(next: next, top: nextTop)
            }

            RRRule(tone: .soft)

            mostLikelyPath

            RRRule(tone: .soft)

            // AdSlot section omitted in the native app (contract rule 8).

            impliedRateCurves

            if !fed.isEmpty {
                RRRule(tone: .soft)
                perMeeting(label: "Per-meeting probabilities · Fed", snapshots: fed)
            }

            if !ecb.isEmpty {
                RRRule(tone: .soft)
                perMeeting(label: "Per-meeting probabilities · ECB", snapshots: ecb)
            }

            if fed.isEmpty && ecb.isEmpty {
                Text("No upcoming meetings found. Check back soon.")
                    .font(.rrSans(16))
                    .foregroundStyle(RR.inkMute)
                    .padding(.vertical, 48)
            }

            RRRule()

            footer
        }
        .padding(.horizontal, 24)
        .padding(.vertical, 64)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: Header (hero)

    private var header: some View {
        VStack(alignment: .leading, spacing: 0) {
            SectionLabel("Real-time market-implied odds")

            // h1: font-serif text-5xl font-medium leading-[1.05] tracking-tight
            VStack(alignment: .leading, spacing: 0) {
                Text("See where rates are headed.")
                    .foregroundStyle(RR.ink)
                Text("Before the meeting.")
                    .foregroundStyle(RR.inkMute)
            }
            .font(.rrSerif(48, weight: .medium))
            .tracking(-0.5)
            .padding(.top, 16)

            Text("Market-implied probabilities for Fed and ECB interest-rate decisions, with historical tracking over days and weeks. Computed from Fed Funds Futures and €STR OIS. Never scraped.")
                .font(.rrSans(18))
                .lineSpacing(7)
                .foregroundStyle(RR.inkSoft)
                .padding(.top, 24)

            MethodologyBadgeView()
                .padding(.top, 24)
        }
        .padding(.bottom, 64)
    }

    // MARK: Next decision

    private func nextDecision(next: MeetingProbabilities, top: Outcome) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            SectionLabel("Next decision")

            // grid gap-8 (sm: variant ignored → stacked single column)
            VStack(alignment: .leading, spacing: 32) {
                VStack(alignment: .leading, spacing: 0) {
                    Text("\(next.meeting.bankCode == .fed ? "Federal Reserve" : "European Central Bank") · \(RateMath.mediumDate(next.meeting.meetingDate))")
                        .font(.rrSans(14))
                        .textCase(.uppercase)
                        .tracking(0.7)
                        .foregroundStyle(RR.cut)

                    Text(top.label == "Hold" ? "Hold rates" : "Move \(top.label)")
                        .font(.rrSerif(30, weight: .medium))
                        .foregroundStyle(RR.ink)
                        .padding(.top, 8)

                    summarySentence(bank: next.meeting.bankCode, top: top)
                        .padding(.top, 8)
                }

                MeetingCountdownView(meetingDate: next.meeting.meetingDate)
            }
            .padding(.top, 16)
        }
        .padding(.vertical, 48)
    }

    /// "Current policy rate {rate}%. Market puts {NN}% on this outcome."
    private func summarySentence(bank: BankCode, top: Outcome) -> some View {
        let rate = RateMath.currentPolicyRates[bank] ?? 0
        return (
            Text("Current policy rate ")
                + Text("\(jsNumber(rate))%")
                    .font(.rrMono(16))
                + Text(". Market puts ")
                + Text(String(format: "%.0f%%", top.probability * 100))
                    .font(.rrMono(16, weight: .semibold))
                    .foregroundStyle(RR.ink)
                + Text(" on this outcome.")
        )
        .font(.rrSans(16))
        .foregroundStyle(RR.inkSoft)
    }

    /// JS template-literal number rendering: 3.625 → "3.625", 2.0 → "2".
    private func jsNumber(_ value: Double) -> String {
        String(format: "%g", value)
    }

    // MARK: Most likely path · cumulative

    private var mostLikelyPath: some View {
        VStack(alignment: .leading, spacing: 0) {
            SectionLabel("Most likely path · cumulative")

            // grid gap-8 lg:grid-cols-2 → stacked on iPhone
            VStack(alignment: .leading, spacing: 32) {
                if !fed.isEmpty {
                    MostLikelyPathView(snapshots: fed, label: "Fed path")
                }
                if !ecb.isEmpty {
                    MostLikelyPathView(snapshots: ecb, label: "ECB path")
                }
            }
            .padding(.top, 16)
        }
        .padding(.vertical, 48)
    }

    // MARK: Implied rate curves

    private var impliedRateCurves: some View {
        VStack(alignment: .leading, spacing: 0) {
            SectionLabel("Implied rate curves")

            VStack(alignment: .leading, spacing: 32) {
                if !fed.isEmpty {
                    ImpliedRateCurveView(
                        snapshots: fed,
                        startingRate: RateMath.currentPolicyRates[.fed] ?? 0,
                        bankLabel: "Federal Reserve"
                    )
                }
                if !ecb.isEmpty {
                    ImpliedRateCurveView(
                        snapshots: ecb,
                        startingRate: RateMath.currentPolicyRates[.ecb] ?? 0,
                        bankLabel: "European Central Bank"
                    )
                }
            }
            .padding(.top, 16)
        }
        .padding(.vertical, 48)
    }

    // MARK: Per-meeting probabilities

    private func perMeeting(label: String, snapshots: [MeetingProbabilities]) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            SectionLabel(label)

            // mt-6 space-y-12
            VStack(alignment: .leading, spacing: 48) {
                ForEach(Array(snapshots.prefix(3))) { s in
                    ProbabilityTableView(snapshot: s)
                }
            }
            .padding(.top, 24)
        }
        .padding(.vertical, 48)
    }

    // MARK: Footer

    private var footer: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Data computed in-house from Fed Funds Futures (Yahoo Finance) and €STR OIS quotes using the public CME methodology. Not financial advice.")
                .font(.rrSans(14))
                .foregroundStyle(RR.inkMute)

            HStack(spacing: 0) {
                Text("Built by ")
                    .foregroundStyle(RR.inkMute)
                Link("lawoflarge", destination: URL(string: "https://github.com/lawoflarge")!)
                    .foregroundStyle(RR.cut)
            }
            .font(.rrSans(12))
            .padding(.top, 12)
        }
        .padding(.top, 80) // mt-12 + pt-8
    }
}

// MARK: - Loading skeleton (app/loading.tsx)

private struct LoadingSkeleton: View {
    @State private var pulsing = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header skeleton
            block.frame(width: 32, height: 32)
            block
                .frame(maxWidth: .infinity)
                .frame(height: 48)
                .padding(.top, 40)
            block
                .frame(height: 24)
                .containerRelativeFrame(.horizontal, count: 4, span: 3, spacing: 0, alignment: .leading)
                .padding(.top, 16)

            // Hero skeleton
            card.frame(height: 160).padding(.top, 64)

            // Most-likely path skeleton
            card.frame(height: 160).padding(.top, 48)

            // Section skeletons
            VStack(spacing: 24) {
                ForEach(0..<3, id: \.self) { _ in
                    card.frame(height: 320)
                }
            }
            .padding(.top, 24)
        }
        .padding(.horizontal, 24)
        .padding(.vertical, 64)
        .opacity(pulsing ? 0.5 : 1)
        .animation(.easeInOut(duration: 1).repeatForever(autoreverses: true), value: pulsing)
        .onAppear { pulsing = true }
    }

    private var block: some View {
        Rectangle().fill(RR.creamSoft)
    }

    private var card: some View {
        Rectangle()
            .fill(RR.creamSoft)
            .overlay(Rectangle().stroke(RR.ink.opacity(0.15), lineWidth: 1))
    }
}

// MARK: - Error state (app/error.tsx semantics)

private struct ErrorState: View {
    let message: String
    let retry: () async -> Void

    var body: some View {
        VStack(spacing: 0) {
            Text("Something went wrong")
                .font(.rrSerif(48, weight: .medium))
                .tracking(-0.5)
                .foregroundStyle(RR.ink)
                .multilineTextAlignment(.center)

            Text("We've logged the error and will investigate. In the meantime, try refreshing or head back to the dashboard.")
                .font(.rrSans(18))
                .lineSpacing(7)
                .foregroundStyle(RR.inkSoft)
                .multilineTextAlignment(.center)
                .padding(.top, 24)

            Text("ref: \(message)")
                .font(.rrMono(12))
                .foregroundStyle(RR.inkMute)
                .multilineTextAlignment(.center)
                .padding(.top, 8)

            Button {
                Task { await retry() }
            } label: {
                Text("Try again")
                    .font(.rrSans(14))
                    .foregroundStyle(RR.ink)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
                    .background(RR.creamSoft)
                    .overlay(Rectangle().stroke(RR.ink.opacity(0.25), lineWidth: 1))
            }
            .buttonStyle(.plain)
            .padding(.top, 40)
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, 24)
        .padding(.vertical, 96)
    }
}

// MARK: - Preview

private func previewSnapshot(
    id: String,
    bank: BankCode,
    date: String,
    cutProbability: Double,
    currentRate: Double
) -> MeetingProbabilities {
    MeetingProbabilities(
        meeting: Meeting(id: id, bankCode: bank, meetingDate: date, status: .scheduled),
        outcomes: [
            Outcome(
                id: "\(id)-cut25", label: "-25 bps", deltaBps: -25,
                probability: cutProbability, postMeetingRate: currentRate - 0.25
            ),
            Outcome(
                id: "\(id)-hold", label: "Hold", deltaBps: 0,
                probability: 1 - cutProbability, postMeetingRate: currentRate
            ),
        ],
        snapshotAt: "2026-06-10T12:00:00Z"
    )
}

#Preview {
    ScrollView {
        DashboardContent(
            fed: [
                previewSnapshot(
                    id: "FED-2026-06-17", bank: .fed, date: "2026-06-17",
                    cutProbability: 0.62, currentRate: 3.625
                ),
                previewSnapshot(
                    id: "FED-2026-07-29", bank: .fed, date: "2026-07-29",
                    cutProbability: 0.48, currentRate: 3.375
                ),
            ],
            ecb: [
                previewSnapshot(
                    id: "ECB-2026-07-23", bank: .ecb, date: "2026-07-23",
                    cutProbability: 0.18, currentRate: 2.0
                ),
            ]
        )
    }
    .background(RR.cream)
    .environment(AppDataStore())
    .environment(Router())
}
