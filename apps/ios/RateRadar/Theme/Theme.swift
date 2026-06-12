import SwiftUI

// MARK: - Wire Room palette (mirrors apps/web/src/app/globals.css)

enum RR {
    static let cream = Color(hex: 0xF5F1E8)
    static let creamSoft = Color(hex: 0xEFEADD)
    static let ink = Color(hex: 0x0E0E0E)
    static let inkSoft = Color(hex: 0x2B2B2B)
    static let inkMute = Color(hex: 0x6F6A60)
    static let rule = Color(hex: 0x1A1A1A)
    static let ruleSoft = Color(hex: 0xC9C2B0)
    static let cut = Color(hex: 0xC8841C)
    static let cutSoft = Color(hex: 0xE9C281)
    static let cutDeep = Color(hex: 0xA06208)
    static let hike = Color(hex: 0xA8312A)
    static let hikeSoft = Color(hex: 0xD88983)
    static let hikeDeep = Color(hex: 0x7A1F1B)
    static let hold = Color(hex: 0x3E5640)
    static let tooltipBg = Color(hex: 0xF5EFE3)

    /// Chart line colors keyed by delta_bps (HistoricalChart.tsx OUTCOME_COLORS).
    static func outcomeColor(deltaBps: Int) -> Color {
        switch deltaBps {
        case -50: return cutDeep
        case -25: return cut
        case 0: return hold
        case 25: return hike
        case 50: return hikeDeep
        default: return rule
        }
    }
}

// MARK: - Semantic tone (ProbabilityTable.tsx actionTone — substring match on label)

enum Tone {
    case cut, hike, hold, neutral

    init(label: String) {
        let l = label.lowercased()
        if l.contains("-") || l.contains("cut") { self = .cut }
        else if l.contains("+") || l.contains("hike") { self = .hike }
        else if l.contains("hold") { self = .hold }
        else { self = .neutral }
    }

    init(deltaBps: Int) {
        if deltaBps < 0 { self = .cut } else if deltaBps > 0 { self = .hike } else { self = .hold }
    }

    var color: Color {
        switch self {
        case .cut: return RR.cut
        case .hike: return RR.hike
        case .hold: return RR.hold
        case .neutral: return RR.ink
        }
    }
}

// MARK: - Typography (web: Inter body, IBM Plex Serif headlines, JetBrains Mono numerals)

extension Font {
    /// Body/sans — Inter. Weights: .regular, .medium, .semibold.
    static func rrSans(_ size: CGFloat, weight: Font.Weight = .regular) -> Font {
        .custom(interName(for: weight), size: size)
    }

    /// Display/headlines — IBM Plex Serif. Web H1s are font-medium.
    static func rrSerif(_ size: CGFloat, weight: Font.Weight = .regular) -> Font {
        .custom(plexName(for: weight), size: size)
    }

    /// Numerals/labels — JetBrains Mono (tabular by design).
    static func rrMono(_ size: CGFloat, weight: Font.Weight = .regular) -> Font {
        .custom(monoName(for: weight), size: size)
    }

    private static func interName(for weight: Font.Weight) -> String {
        switch weight {
        case .semibold, .bold, .heavy, .black: return "Inter-SemiBold"
        case .medium: return "Inter-Medium"
        default: return "Inter-Regular"
        }
    }

    private static func plexName(for weight: Font.Weight) -> String {
        switch weight {
        case .semibold, .bold, .heavy, .black: return "IBMPlexSerif-SemiBold"
        case .medium: return "IBMPlexSerif-Medium"
        default: return "IBMPlexSerif-Regular"
        }
    }

    private static func monoName(for weight: Font.Weight) -> String {
        switch weight {
        case .semibold, .bold, .heavy, .black: return "JetBrainsMono-SemiBold"
        case .medium: return "JetBrainsMono-Medium"
        default: return "JetBrainsMono-Regular"
        }
    }
}

extension View {
    /// Web .small-caps utility (SectionLabel): all-small-caps + 0.12em tracking.
    func rrSectionLabelStyle(size: CGFloat = 12) -> some View {
        font(.rrSans(size, weight: .medium).smallCaps())
            .textCase(.lowercase)
            .tracking(size * 0.12)
            .foregroundStyle(RR.inkMute)
    }
}

extension Color {
    init(hex: UInt32, opacity: Double = 1) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: opacity
        )
    }
}
