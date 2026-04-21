import SwiftUI

struct ProbabilityBars: View {
    let outcomes: [Outcome]

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            ForEach(outcomes.sorted(by: { $0.deltaBps < $1.deltaBps })) { o in
                HStack(spacing: 8) {
                    Text(o.label)
                        .font(.caption.monospaced())
                        .frame(width: 56, alignment: .leading)
                        .foregroundStyle(color(for: o.deltaBps))
                    GeometryReader { geo in
                        RoundedRectangle(cornerRadius: 3)
                            .fill(color(for: o.deltaBps).opacity(0.6))
                            .frame(width: geo.size.width * CGFloat(max(0.005, o.probability)))
                    }
                    .frame(height: 6)
                    Text(formatted(o.probability))
                        .font(.caption.monospacedDigit())
                        .frame(width: 48, alignment: .trailing)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }

    private func formatted(_ p: Double) -> String {
        String(format: "%.1f%%", p * 100)
    }

    private func color(for delta: Int) -> Color {
        if delta < 0 { return .green }
        if delta > 0 { return .red }
        return .blue
    }
}

struct ProbabilityTableView: View {
    let data: MeetingProbabilities

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Outcome probabilities")
                    .font(.headline)
                Spacer()
                Text(data.meeting.meetingDate)
                    .font(.subheadline.monospacedDigit())
                    .foregroundStyle(.secondary)
            }
            ProbabilityBars(outcomes: data.outcomes)
        }
        .padding()
        .background(Color(white: 0.08))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color(white: 0.2), lineWidth: 1)
        )
    }
}
