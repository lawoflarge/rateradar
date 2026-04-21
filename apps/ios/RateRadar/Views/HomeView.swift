import SwiftUI

@MainActor
final class HomeViewModel: ObservableObject {
    @Published var fed: [MeetingProbabilities] = []
    @Published var ecb: [MeetingProbabilities] = []
    @Published var isLoading = false
    @Published var errorMessage: String?

    func load() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            async let fedTask = APIClient.shared.getProbabilities(bank: .fed)
            async let ecbTask = APIClient.shared.getProbabilities(bank: .ecb)
            (fed, ecb) = try await (fedTask, ecbTask)
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

struct HomeView: View {
    @StateObject private var vm = HomeViewModel()

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    HeaderView()

                    if vm.isLoading && vm.fed.isEmpty && vm.ecb.isEmpty {
                        ProgressView().frame(maxWidth: .infinity).padding()
                    }

                    if let err = vm.errorMessage {
                        Text("Could not load data: \(err)")
                            .foregroundStyle(.red)
                            .padding(.horizontal)
                    }

                    if let next = soonestMeeting() {
                        NextDecisionCard(data: next)
                            .padding(.horizontal)
                    }

                    if !vm.fed.isEmpty {
                        MeetingSection(title: "Upcoming Fed meetings", items: vm.fed)
                    }
                    if !vm.ecb.isEmpty {
                        MeetingSection(title: "Upcoming ECB meetings", items: vm.ecb)
                    }
                }
                .padding(.vertical, 16)
            }
            .background(Color(white: 0.05))
            .navigationTitle("RateRadar")
            .navigationBarTitleDisplayMode(.inline)
            .task { await vm.load() }
            .refreshable { await vm.load() }
        }
    }

    private func soonestMeeting() -> MeetingProbabilities? {
        let all = vm.fed + vm.ecb
        return all.min(by: { $0.meeting.meetingDate < $1.meeting.meetingDate })
    }
}

private struct HeaderView: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("See where rates are headed")
                .font(.largeTitle.bold())
            Text("— before the meeting.")
                .font(.largeTitle.bold())
                .foregroundStyle(.secondary)
        }
        .padding(.horizontal)
    }
}

private struct NextDecisionCard: View {
    let data: MeetingProbabilities

    var body: some View {
        let top = data.topOutcome
        VStack(alignment: .leading, spacing: 8) {
            Text("Next \(data.meeting.bankCode.shortName) decision")
                .font(.caption)
                .foregroundStyle(.green)
                .textCase(.uppercase)
                .tracking(1)
            Text(formatted(data.meeting.meetingDate))
                .font(.title2.bold())
            if let top = top {
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text("\(Int(round(top.probability * 100)))%")
                        .font(.system(size: 44, weight: .semibold, design: .rounded))
                        .foregroundStyle(.green)
                    Text(top.label == "Hold" ? "holds rates" : "moves \(top.label)")
                        .font(.title3)
                        .foregroundStyle(.primary)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(
            LinearGradient(
                colors: [Color.green.opacity(0.15), Color(white: 0.08)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        )
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(Color(white: 0.2), lineWidth: 1)
        )
    }

    private func formatted(_ iso: String) -> String {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.timeZone = TimeZone(identifier: "UTC")
        guard let d = f.date(from: iso) else { return iso }
        let out = DateFormatter()
        out.dateFormat = "EEEE, MMMM d, yyyy"
        return out.string(from: d)
    }
}

private struct MeetingSection: View {
    let title: String
    let items: [MeetingProbabilities]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title)
                .font(.title3.bold())
                .padding(.horizontal)
            ForEach(items) { item in
                NavigationLink(value: item) {
                    MeetingCardView(data: item)
                        .padding(.horizontal)
                }
                .buttonStyle(.plain)
            }
        }
        .navigationDestination(for: MeetingProbabilities.self) { item in
            MeetingDetailView(data: item)
        }
    }
}

private struct MeetingCardView: View {
    let data: MeetingProbabilities

    var body: some View {
        let top = data.topOutcome
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(data.meeting.meetingDate)
                    .font(.headline)
                Spacer()
                Text(data.meeting.bankCode.shortName)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            if let top = top {
                HStack {
                    Text(top.label)
                        .font(.subheadline.bold())
                        .foregroundStyle(colorForDelta(top.deltaBps))
                    Spacer()
                    Text("\(Int(round(top.probability * 100)))%")
                        .font(.subheadline.monospacedDigit())
                }
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

    private func colorForDelta(_ delta: Int) -> Color {
        if delta < 0 { return .green }
        if delta > 0 { return .red }
        return .blue
    }
}
