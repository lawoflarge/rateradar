import SwiftUI
import UIKit

/// Port of apps/web/src/components/ShareButtons.tsx.
///
/// The web renders Twitter/X + LinkedIn intent anchors plus a clipboard
/// button. Natively the two network anchors are replaced by ONE ShareLink
/// that opens the system share sheet (same pill style); the copy button is
/// kept 1:1 ("Copy link" → "Copied!" for 1.5s). Share text matches the web
/// tweet text: "{title} · via RateRadar", where the title is built exactly as
/// on the meeting detail page.
struct ShareButtonsView: View {
    let meetingId: String
    let meetingDate: String
    let bank: BankCode

    @Environment(AppDataStore.self) private var store
    @State private var copied = false
    @State private var resetTask: Task<Void, Never>?

    private var url: URL {
        URL(string: "https://rateradar-web.vercel.app/meeting/\(meetingId)")!
    }

    /// Title as built by apps/web/src/app/meeting/[id]/page.tsx:
    /// "{BANK} {MMM d} · {NN}% {hold|move {label}}".
    private var title: String {
        let base = "\(bank.rawValue) \(RateMath.shortDate(meetingDate))"
        guard let top = store.meeting(id: meetingId)?.topOutcome else { return base }
        let pct = Int((top.probability * 100).rounded())
        let action = top.label == "Hold" ? "hold" : "move \(top.label)"
        return "\(base) · \(pct)% \(action)"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Share this meeting")
                .font(.rrSans(12))
                .tracking(0.4)
                .textCase(.uppercase)
                .foregroundStyle(RR.inkMute)
                .padding(.bottom, 12)

            WrappingHStack(spacing: 8, lineSpacing: 8) {
                ShareLink(item: url, message: Text("\(title) · via RateRadar")) {
                    pill("Share")
                }
                .buttonStyle(.plain)

                Button {
                    copyLink()
                } label: {
                    pill(copied ? "Copied!" : "Copy link")
                }
                .buttonStyle(.plain)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(20)
        .background(RR.creamSoft)
        .overlay(Rectangle().strokeBorder(RR.ink.opacity(0.15), lineWidth: 1))
    }

    private func pill(_ label: String) -> some View {
        Text(label)
            .font(.rrSans(14))
            .foregroundStyle(RR.ink)
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(RR.creamSoft)
            .overlay(
                RoundedRectangle(cornerRadius: 6)
                    .strokeBorder(RR.ink.opacity(0.25), lineWidth: 1)
            )
    }

    private func copyLink() {
        UIPasteboard.general.string = url.absoluteString
        copied = true
        resetTask?.cancel()
        resetTask = Task {
            try? await Task.sleep(nanoseconds: 1_500_000_000)
            guard !Task.isCancelled else { return }
            copied = false
        }
    }
}

#Preview {
    ShareButtonsView(
        meetingId: "FED-2026-06-17",
        meetingDate: "2026-06-17",
        bank: .fed
    )
    .padding(24)
    .background(RR.cream)
    .environment(AppDataStore())
}
