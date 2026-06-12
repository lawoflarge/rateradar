import SwiftUI
import Charts

/// Port of apps/web/src/components/HistoricalChart.tsx (mobile rendering).
/// Multi-line probability-history card: one pivoted point per day per outcome,
/// Y fixed 0–100 with % ticks, X short dates, dashed grid, legend in the header.
struct HistoricalChartView: View {
    let history: [ProbabilitySeries]?
    var isLoading: Bool = false

    /// Web default windowDays = 60 (the decreed signature carries no window param).
    private let windowDays = 60

    // Pivoted like the web's chartData: one value per calendar day per label,
    // percent rounded to 1dp (Math.round(p * 1000) / 10).
    private struct DayPoint: Identifiable {
        let dayKey: String // "yyyy-MM-dd"
        let date: Date
        let label: String
        let deltaBps: Int
        let value: Double // percent, 1dp
        var id: String { "\(dayKey)|\(label)" }
    }

    private var populatedSeries: [ProbabilitySeries] {
        (history ?? []).filter { !$0.series.isEmpty }
    }

    private func dayPoints(for s: ProbabilitySeries) -> [DayPoint] {
        var byDay: [String: Double] = [:]
        for pt in s.series {
            let dayKey = String(pt.snapshotAt.prefix(10))
            byDay[dayKey] = (pt.probability * 1000).rounded() / 10
        }
        return byDay.keys.sorted().compactMap { key in
            guard let date = RateMath.parseISODay(key) else { return nil }
            return DayPoint(
                dayKey: key, date: date,
                label: s.label, deltaBps: s.deltaBps,
                value: byDay[key] ?? 0
            )
        }
    }

    private var allPoints: [[DayPoint]] {
        populatedSeries.map { dayPoints(for: $0) }
    }

    var body: some View {
        let pointsBySeries = allPoints
        let hasData = pointsBySeries.contains { !$0.isEmpty }

        if isLoading, !hasData {
            stateCard(text: "Loading history…", dashed: false)
        } else if !hasData {
            stateCard(
                text: "No history yet. Come back after we capture more snapshots.",
                dashed: true
            )
        } else {
            chartCard(pointsBySeries: pointsBySeries)
        }
    }

    // MARK: - Loading / empty cards (web: h-40 rounded-lg border bg-cream-soft)

    private func stateCard(text: String, dashed: Bool) -> some View {
        Text(text)
            .font(.rrSans(14))
            .foregroundStyle(RR.inkMute)
            .frame(maxWidth: .infinity)
            .frame(height: 160)
            .background(RR.creamSoft)
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(
                        RR.ink.opacity(0.15),
                        style: StrokeStyle(lineWidth: 1, dash: dashed ? [4, 4] : [])
                    )
            )
    }

    // MARK: - Chart card (web: rounded-lg border border-ink/15 bg-cream-soft p-4)

    private func chartCard(pointsBySeries: [[DayPoint]]) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            header
                .padding(.bottom, 12) // mb-3

            chart(pointsBySeries: pointsBySeries)
                .padding(.top, 8)
                .padding(.trailing, 12)
                .padding(.bottom, 4)
                .frame(height: 224) // h-56
        }
        .padding(16) // p-4
        .background(RR.creamSoft)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(RR.ink.opacity(0.15), lineWidth: 1)
        )
    }

    private var header: some View {
        HStack(alignment: .center, spacing: 8) {
            Text("Probability history · last \(windowDays) days")
                .font(.rrSans(12))
                .textCase(.uppercase)
                .tracking(0.4)
                .foregroundStyle(RR.inkMute)

            Spacer(minLength: 8)

            WrappingHStack(spacing: 8, lineSpacing: 8) {
                ForEach(populatedSeries) { s in
                    HStack(spacing: 6) {
                        Circle()
                            .fill(RR.outcomeColor(deltaBps: s.deltaBps))
                            .frame(width: 8, height: 8)
                            .accessibilityHidden(true)
                        Text(s.label)
                            .font(.rrMono(12))
                            .foregroundStyle(RR.inkMute)
                    }
                }
            }
        }
    }

    private func chart(pointsBySeries: [[DayPoint]]) -> some View {
        Chart {
            ForEach(pointsBySeries.indices, id: \.self) { idx in
                let points = pointsBySeries[idx]
                ForEach(points) { point in
                    LineMark(
                        x: .value("Date", point.date),
                        y: .value("Probability", point.value),
                        series: .value("Outcome", point.label)
                    )
                    .foregroundStyle(RR.outcomeColor(deltaBps: point.deltaBps))
                    .interpolationMethod(.monotone)
                    .lineStyle(StrokeStyle(lineWidth: 2))
                }
            }
        }
        .chartYScale(domain: 0...100)
        .chartXAxis {
            AxisMarks(values: .automatic) { value in
                AxisGridLine(stroke: StrokeStyle(lineWidth: 1, dash: [3, 3]))
                    .foregroundStyle(RR.rule.opacity(0.12))
                AxisTick(stroke: StrokeStyle(lineWidth: 1))
                    .foregroundStyle(RR.rule.opacity(0.25))
                AxisValueLabel {
                    if let date = value.as(Date.self) {
                        Text(Self.tickDateFormatter.string(from: date))
                            .font(.rrMono(11))
                            .foregroundStyle(RR.ink.opacity(0.55))
                    }
                }
            }
        }
        .chartYAxis {
            AxisMarks(position: .leading, values: [0, 25, 50, 75, 100]) { value in
                AxisGridLine(stroke: StrokeStyle(lineWidth: 1, dash: [3, 3]))
                    .foregroundStyle(RR.rule.opacity(0.12))
                AxisTick(stroke: StrokeStyle(lineWidth: 1))
                    .foregroundStyle(RR.rule.opacity(0.25))
                AxisValueLabel {
                    if let v = value.as(Int.self) {
                        Text("\(v)%")
                            .font(.rrMono(11))
                            .foregroundStyle(RR.ink.opacity(0.55))
                    }
                }
            }
        }
    }

    /// "Jun 17" — en-US short date like the web's formatDateLabel.
    private static let tickDateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US")
        f.timeZone = TimeZone(identifier: "UTC")
        f.dateFormat = "MMM d"
        return f
    }()
}

#Preview {
    let days = ["2026-04-20", "2026-04-27", "2026-05-04", "2026-05-11",
                "2026-05-18", "2026-05-25", "2026-06-01", "2026-06-08"]

    func points(_ probs: [Double]) -> [ProbabilityPoint] {
        zip(days, probs).map {
            ProbabilityPoint(snapshotAt: "\($0)T16:00:00Z", probability: $1)
        }
    }

    let history: [ProbabilitySeries] = [
        ProbabilitySeries(
            outcomeId: "o-cut50", label: "-50bp", deltaBps: -50,
            series: points([0.02, 0.02, 0.03, 0.04, 0.03, 0.05, 0.04, 0.05])
        ),
        ProbabilitySeries(
            outcomeId: "o-cut25", label: "-25bp", deltaBps: -25,
            series: points([0.48, 0.52, 0.55, 0.61, 0.58, 0.63, 0.66, 0.68])
        ),
        ProbabilitySeries(
            outcomeId: "o-hold", label: "hold", deltaBps: 0,
            series: points([0.50, 0.46, 0.42, 0.35, 0.39, 0.32, 0.30, 0.27])
        ),
    ]

    return ScrollView {
        VStack(alignment: .leading, spacing: 24) {
            HistoricalChartView(history: history)
            HistoricalChartView(history: [], isLoading: true)
            HistoricalChartView(history: nil)
        }
        .padding(24)
    }
    .background(RR.cream)
}
