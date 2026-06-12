import SwiftUI

/// Port of apps/web/src/components/MethodologyBadge.tsx.
///
/// Visible trust signal: methodology version + last calculation time. The web
/// receives version/snapshotAt/source as server props derived from the FED
/// JSON snapshot meta (apps/web/src/app/page.tsx); natively we fetch
/// GET /api/status once in `.task` and derive the same three values. The
/// whole chip navigates to the methodology screen.
struct MethodologyBadgeView: View {
    @Environment(Router.self) private var router
    @State private var status: APIStatus?

    private enum Source { case supabase, json, mock }

    private var version: String {
        status?.snapshots?.fed?.version ?? "1.0.0"
    }

    private var snapshotAt: String? {
        status?.snapshots?.fed?.at ?? status?.latestSnapshotAt
    }

    /// Mirrors the home page's dataSource derivation: json when the JSON
    /// snapshot meta exists, supabase when the DB answered, mock otherwise.
    private var source: Source? {
        guard let status else { return nil }
        switch status.dataSource {
        case "supabase": return .supabase
        case "json_snapshots": return .json
        default: return .mock
        }
    }

    var body: some View {
        Button {
            router.navigate(.methodology)
        } label: {
            HStack(spacing: 8) {
                Circle()
                    .fill(RR.cut)
                    .frame(width: 6, height: 6)
                Text("methodology v\(version)")
                if let snapshotAt, let relative = Self.relativeTime(snapshotAt) {
                    Text("·")
                        .foregroundStyle(RR.inkMute.opacity(0.5))
                    Text(relative)
                }
                if let source, source != .supabase {
                    Text("·")
                        .foregroundStyle(RR.inkMute.opacity(0.5))
                    Text(source == .json ? "git" : "sample")
                }
            }
            .font(.rrMono(11))
            .tracking(11 * 0.05)
            .textCase(.uppercase)
            .foregroundStyle(RR.inkMute)
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(RR.creamSoft)
            .overlay(Rectangle().strokeBorder(RR.ink.opacity(0.15), lineWidth: 1))
        }
        .buttonStyle(.plain)
        .accessibilityHint("View the open methodology")
        .task {
            status = try? await APIClient.shared.getStatus()
        }
    }

    /// relativeTime from MethodologyBadge.tsx: "just now" / "Nm ago" /
    /// "Nh ago" / "Nd ago".
    static func relativeTime(_ iso: String, now: Date = Date()) -> String? {
        guard let then = parseISO(iso) else { return nil }
        let diff = max(0, now.timeIntervalSince(then))
        let m = Int((diff / 60).rounded())
        if m < 1 { return "just now" }
        if m < 60 { return "\(m)m ago" }
        let h = Int((Double(m) / 60).rounded())
        if h < 24 { return "\(h)h ago" }
        let d = Int((Double(h) / 24).rounded())
        return "\(d)d ago"
    }

    private static func parseISO(_ iso: String) -> Date? {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = f.date(from: iso) { return d }
        f.formatOptions = [.withInternetDateTime]
        return f.date(from: iso)
    }
}

#Preview {
    VStack(alignment: .leading, spacing: 24) {
        MethodologyBadgeView()
    }
    .padding(24)
    .frame(maxWidth: .infinity, alignment: .leading)
    .background(RR.cream)
    .environment(Router())
}
