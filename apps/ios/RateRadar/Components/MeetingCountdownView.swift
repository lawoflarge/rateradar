import SwiftUI

/// Port of apps/web/src/components/MeetingCountdown.tsx.
///
/// Countdown to a meeting date, anchored to UTC midnight so the day-count is
/// identical for every viewer regardless of their local timezone (Fed/ECB
/// dates are calendar dates). The web refreshes on a 60s interval — mirrored
/// here with `TimelineView(.periodic)`. Color is inherited from the parent
/// (the web span carries no color class; every usage wraps it in
/// `text-ink-mute`).
struct MeetingCountdownView: View {
    let meetingDate: String // ISO date (YYYY-MM-DD)

    var body: some View {
        TimelineView(.periodic(from: .now, by: 60)) { context in
            let parts = Self.computeLabel(meetingDate: meetingDate, now: context.date)
            Text(parts.prefix).font(.rrSans(16))
                + Text(parts.value).font(.rrMono(16))
                + Text(parts.suffix).font(.rrSans(16))
        }
    }

    struct LabelParts: Equatable {
        let prefix: String
        let value: String
        let suffix: String
    }

    /// computeLabel from MeetingCountdown.tsx:
    /// `days = max(0, ceil((target − now) / 1 day))` against UTC midnight.
    static func computeLabel(meetingDate: String, now: Date = Date()) -> LabelParts {
        guard let target = RateMath.parseISODay(meetingDate) else {
            return LabelParts(prefix: "", value: "", suffix: "")
        }
        let days = max(0, Int(ceil(target.timeIntervalSince(now) / 86_400)))
        if days == 0 { return LabelParts(prefix: "", value: "", suffix: "Today") }
        if days == 1 { return LabelParts(prefix: "", value: "", suffix: "Tomorrow") }
        return LabelParts(prefix: "in ", value: String(days), suffix: " days")
    }
}

#Preview {
    VStack(alignment: .leading, spacing: 12) {
        MeetingCountdownView(meetingDate: "2026-07-29")
        MeetingCountdownView(meetingDate: "2026-06-13")
        MeetingCountdownView(meetingDate: "2026-06-12")
    }
    .foregroundStyle(RR.inkMute)
    .padding(24)
    .frame(maxWidth: .infinity, alignment: .leading)
    .background(RR.cream)
}
