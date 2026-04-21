import SwiftUI

@MainActor
final class MeetingDetailViewModel: ObservableObject {
    @Published var history: [ProbabilitySeries] = []
    @Published var isLoading = false
    @Published var errorMessage: String?

    private let meetingId: String

    init(meetingId: String) {
        self.meetingId = meetingId
    }

    func load() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            history = try await APIClient.shared.getHistory(meetingId: meetingId, windowDays: 60)
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

struct MeetingDetailView: View {
    let data: MeetingProbabilities
    @StateObject private var vm: MeetingDetailViewModel

    init(data: MeetingProbabilities) {
        self.data = data
        _vm = StateObject(
            wrappedValue: MeetingDetailViewModel(meetingId: data.meeting.id)
        )
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                headerView
                ProbabilityTableView(data: data)
                if vm.isLoading && vm.history.isEmpty {
                    ProgressView().frame(maxWidth: .infinity).padding()
                } else {
                    HistoricalChartView(series: vm.history)
                }
                shareSection
            }
            .padding()
        }
        .background(Color(white: 0.05))
        .navigationTitle(data.meeting.bankCode.shortName)
        .navigationBarTitleDisplayMode(.inline)
        .task { await vm.load() }
    }

    private var headerView: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(data.meeting.bankCode.displayName)
                .font(.caption)
                .foregroundStyle(.green)
                .textCase(.uppercase)
                .tracking(1)
            Text(data.meeting.meetingDate)
                .font(.largeTitle.bold())
            if let top = data.topOutcome {
                HStack(alignment: .firstTextBaseline) {
                    Text("\(Int(round(top.probability * 100)))%")
                        .font(.system(size: 40, weight: .semibold, design: .rounded))
                        .foregroundStyle(.green)
                    Text(top.label == "Hold" ? "holds rates" : "moves \(top.label)")
                        .font(.title3)
                }
            }
        }
    }

    private var shareSection: some View {
        ShareLink(
            item: URL(
                string: "\(Config.apiHost)/meeting/\(data.meeting.id)"
            )!,
            subject: Text("RateRadar — \(data.meeting.bankCode.shortName) \(data.meeting.meetingDate)")
        ) {
            Label("Share meeting", systemImage: "square.and.arrow.up")
                .font(.subheadline)
                .padding()
                .frame(maxWidth: .infinity)
                .background(Color(white: 0.08))
                .clipShape(RoundedRectangle(cornerRadius: 12))
        }
        .foregroundStyle(.primary)
    }
}
