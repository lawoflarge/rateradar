import Charts
import SwiftUI

struct HistoricalChartView: View {
    let series: [ProbabilitySeries]

    var body: some View {
        if series.isEmpty {
            Text("No history available")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity)
                .padding()
        } else {
            Chart {
                ForEach(series) { s in
                    ForEach(Array(s.series.enumerated()), id: \.offset) { _, point in
                        if let d = point.date {
                            LineMark(
                                x: .value("Date", d),
                                y: .value("Probability", point.probability * 100)
                            )
                            .foregroundStyle(by: .value("Outcome", s.label))
                        }
                    }
                }
            }
            .chartYAxis {
                AxisMarks(format: .percent.scale(1).precision(.fractionLength(0)))
            }
            .chartForegroundStyleScale([
                "-50bp": Color.green,
                "-25bp": Color.green.opacity(0.7),
                "Hold": Color.blue,
                "+25bp": Color.red.opacity(0.7),
                "+50bp": Color.red,
            ])
            .frame(height: 220)
            .padding()
            .background(Color(white: 0.08))
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(Color(white: 0.2), lineWidth: 1)
            )
        }
    }
}
