import Charts
import SwiftUI

/// Port of apps/web/src/components/ImpliedRateCurve.tsx.
///
/// Market-implied expected policy rate at each upcoming meeting, starting
/// from the current policy rate and chaining per-meeting expected changes
/// (Σ p_i · Δ_i) via `RateMath.curvePoints`.
struct ImpliedRateCurveView: View {
    let snapshots: [MeetingProbabilities]
    let startingRate: Double
    let bankLabel: String
    var anchorLabel: String = "Now"

    var body: some View {
        // Web: `if (snapshots.length === 0) return null;`
        if !snapshots.isEmpty {
            card
        }
    }

    private var card: some View {
        let points = RateMath.curvePoints(
            snapshots, startingRate: startingRate, anchorLabel: anchorLabel
        )
        let minRate = (points.map(\.rate).min() ?? startingRate) - 0.25
        let maxRate = (points.map(\.rate).max() ?? startingRate) + 0.25

        // rounded-none border border-ink/15 bg-cream-soft p-6
        return VStack(alignment: .leading, spacing: 0) {
            VStack(alignment: .leading, spacing: 0) {
                Text("Implied policy-rate path")
                    .font(.rrSans(12))
                    .textCase(.uppercase)
                    .tracking(0.4)
                    .foregroundStyle(RR.inkMute)

                Text("\(bankLabel). Expected rate at each upcoming meeting, derived from today's probability distribution.")
                    .font(.rrSans(14))
                    .foregroundStyle(RR.inkMute)
                    .padding(.top, 4)
            }
            .padding(.bottom, 16)

            chart(points: points, domain: minRate...maxRate)
                .frame(height: 256)
                .frame(maxWidth: .infinity)
        }
        .padding(24)
        .background(RR.creamSoft)
        .overlay(Rectangle().stroke(RR.ink.opacity(0.15), lineWidth: 1))
    }

    private func chart(
        points: [RateMath.CurvePoint], domain: ClosedRange<Double>
    ) -> some View {
        Chart {
            ForEach(Array(points.enumerated()), id: \.offset) { index, point in
                LineMark(
                    x: .value("Meeting", index),
                    y: .value("Rate", point.rate)
                )
                .interpolationMethod(.monotone)
                .lineStyle(StrokeStyle(lineWidth: 2.5))
                .foregroundStyle(RR.cut)

                PointMark(
                    x: .value("Meeting", index),
                    y: .value("Rate", point.rate)
                )
                .symbolSize(CGSize(width: 6, height: 6))
                .foregroundStyle(RR.cut)
            }
        }
        .chartXScale(domain: 0...(points.count - 1))
        .chartYScale(domain: domain)
        // Recharts draws the X/Y axis lines at ink 25% (stroke + strokeOpacity).
        .chartPlotStyle { plot in
            plot
                .overlay(alignment: .bottom) {
                    Rectangle().fill(RR.rule.opacity(0.25)).frame(height: 1)
                }
                .overlay(alignment: .leading) {
                    Rectangle().fill(RR.rule.opacity(0.25)).frame(width: 1)
                }
        }
        .chartXAxis {
            AxisMarks(values: Array(points.indices)) { value in
                AxisGridLine(stroke: StrokeStyle(lineWidth: 1, dash: [3, 3]))
                    .foregroundStyle(RR.rule.opacity(0.12))
                AxisTick(stroke: StrokeStyle(lineWidth: 1))
                    .foregroundStyle(RR.rule.opacity(0.25))
                AxisValueLabel {
                    if let index = value.as(Int.self), points.indices.contains(index) {
                        Text(points[index].label)
                            .font(.rrMono(11))
                            .foregroundStyle(RR.rule.opacity(0.55))
                    }
                }
            }
        }
        .chartYAxis {
            AxisMarks(position: .leading) { value in
                AxisGridLine(stroke: StrokeStyle(lineWidth: 1, dash: [3, 3]))
                    .foregroundStyle(RR.rule.opacity(0.12))
                AxisTick(stroke: StrokeStyle(lineWidth: 1))
                    .foregroundStyle(RR.rule.opacity(0.25))
                AxisValueLabel {
                    if let rate = value.as(Double.self) {
                        Text(String(format: "%.2f%%", rate))
                            .font(.rrMono(11))
                            .foregroundStyle(RR.rule.opacity(0.55))
                    }
                }
            }
        }
    }
}

#Preview {
    let june = MeetingProbabilities(
        meeting: Meeting(
            id: "FED-2026-06-17", bankCode: .fed,
            meetingDate: "2026-06-17", status: .scheduled
        ),
        outcomes: [
            Outcome(id: "o1", label: "-25 bps", deltaBps: -25, probability: 0.62, postMeetingRate: 3.375),
            Outcome(id: "o2", label: "Hold", deltaBps: 0, probability: 0.38, postMeetingRate: 3.625),
        ],
        snapshotAt: "2026-06-12T12:00:00Z"
    )
    let july = MeetingProbabilities(
        meeting: Meeting(
            id: "FED-2026-07-29", bankCode: .fed,
            meetingDate: "2026-07-29", status: .scheduled
        ),
        outcomes: [
            Outcome(id: "o3", label: "-25 bps", deltaBps: -25, probability: 0.44, postMeetingRate: 3.125),
            Outcome(id: "o4", label: "Hold", deltaBps: 0, probability: 0.56, postMeetingRate: 3.375),
        ],
        snapshotAt: "2026-06-12T12:00:00Z"
    )
    let september = MeetingProbabilities(
        meeting: Meeting(
            id: "FED-2026-09-16", bankCode: .fed,
            meetingDate: "2026-09-16", status: .scheduled
        ),
        outcomes: [
            Outcome(id: "o5", label: "-25 bps", deltaBps: -25, probability: 0.51, postMeetingRate: 2.875),
            Outcome(id: "o6", label: "Hold", deltaBps: 0, probability: 0.49, postMeetingRate: 3.125),
        ],
        snapshotAt: "2026-06-12T12:00:00Z"
    )

    ScrollView {
        ImpliedRateCurveView(
            snapshots: [june, july, september],
            startingRate: 3.625,
            bankLabel: "Fed Funds target range 3.50–3.75%"
        )
        .padding(24)
    }
    .background(RR.cream)
}
