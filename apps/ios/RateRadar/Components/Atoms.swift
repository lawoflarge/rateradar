import SwiftUI

// MARK: - Rule (Rule.tsx): full-width hairline, strong ink/80 or soft.

struct RRRule: View {
    enum RuleTone { case ink, soft }
    var tone: RuleTone = .ink

    var body: some View {
        Rectangle()
            .fill(tone == .ink ? RR.ink.opacity(0.8) : RR.ruleSoft)
            .frame(height: 1)
    }
}

// MARK: - SectionLabel (SectionLabel.tsx): small-caps xs medium ink-mute.

struct SectionLabel: View {
    let text: String
    init(_ text: String) { self.text = text }

    var body: some View {
        Text(text)
            .rrSectionLabelStyle(size: 12)
    }
}

// MARK: - BrandMark (BrandMark.tsx): radar circles + amber needle, 36x36 viewBox.

struct BrandMarkView: View {
    var size: CGFloat = 36

    var body: some View {
        Canvas { context, canvasSize in
            let s = canvasSize.width / 36
            let center = CGPoint(x: 18 * s, y: 18 * s)

            for (r, w) in [(16.0, 1.5), (10.0, 0.75), (4.0, 0.75)] {
                let rect = CGRect(
                    x: center.x - r * s, y: center.y - r * s,
                    width: 2 * r * s, height: 2 * r * s
                )
                context.stroke(
                    Path(ellipseIn: rect),
                    with: .color(RR.ink),
                    lineWidth: w * s
                )
            }

            var needle = Path()
            needle.move(to: center)
            needle.addLine(to: CGPoint(x: 31 * s, y: 12 * s))
            context.stroke(
                needle, with: .color(RR.cut),
                style: StrokeStyle(lineWidth: 2 * s, lineCap: .round)
            )

            let tip = CGRect(
                x: (31 - 1.6) * s, y: (12 - 1.6) * s,
                width: 3.2 * s, height: 3.2 * s
            )
            context.fill(Path(ellipseIn: tip), with: .color(RR.cut))
        }
        .frame(width: size, height: size)
        .accessibilityLabel("RateRadar")
    }
}

// MARK: - NavBar (NavBar.tsx): sticky top bar, brand left, wrapping links right.

struct NavBarView: View {
    @Environment(Router.self) private var router

    private static let links: [(route: Route, label: String)] = [
        (.fed, "Fed"),
        (.ecb, "ECB"),
        (.compare, "Fed vs ECB"),
        (.scenarios, "Scenarios"),
        (.methodology, "Methodology"),
        (.glossary, "Glossary"),
        (.brokers, "Brokers"),
        (.about, "About"),
        (.alerts, "Alerts"),
    ]

    var body: some View {
        HStack(alignment: .center, spacing: 16) {
            Button {
                router.popToRoot()
            } label: {
                HStack(spacing: 8) {
                    BrandMarkView(size: 20)
                    Text("RateRadar")
                        .font(.rrSans(14, weight: .semibold))
                        .tracking(-0.2)
                        .foregroundStyle(RR.ink)
                }
            }
            .buttonStyle(.plain)

            Spacer(minLength: 8)

            WrappingHStack(spacing: 20, lineSpacing: 6) {
                ForEach(Self.links, id: \.label) { link in
                    Button(link.label) {
                        router.navigate(link.route)
                    }
                    .buttonStyle(.plain)
                    .font(.rrSans(14))
                    .foregroundStyle(RR.inkSoft)
                }
            }
        }
        .padding(.horizontal, 24)
        .padding(.vertical, 12)
        .background(RR.cream.opacity(0.95))
        .overlay(alignment: .bottom) {
            Rectangle().fill(RR.ink.opacity(0.15)).frame(height: 1)
        }
    }
}

/// Minimal wrapping layout for the nav links (web: flex-wrap gap-5).
struct WrappingHStack: Layout {
    var spacing: CGFloat = 8
    var lineSpacing: CGFloat = 4

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let maxWidth = proposal.width ?? .infinity
        var x: CGFloat = 0, y: CGFloat = 0, lineHeight: CGFloat = 0, width: CGFloat = 0
        for sub in subviews {
            let size = sub.sizeThatFits(.unspecified)
            if x > 0, x + size.width > maxWidth {
                x = 0
                y += lineHeight + lineSpacing
                lineHeight = 0
            }
            x += size.width + spacing
            lineHeight = max(lineHeight, size.height)
            width = max(width, x - spacing)
        }
        return CGSize(width: width, height: y + lineHeight)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let maxWidth = bounds.width
        var x: CGFloat = 0, y: CGFloat = 0, lineHeight: CGFloat = 0
        for sub in subviews {
            let size = sub.sizeThatFits(.unspecified)
            if x > 0, x + size.width > maxWidth {
                x = 0
                y += lineHeight + lineSpacing
                lineHeight = 0
            }
            sub.place(
                at: CGPoint(x: bounds.minX + x, y: bounds.minY + y),
                proposal: ProposedViewSize(size)
            )
            x += size.width + spacing
            lineHeight = max(lineHeight, size.height)
        }
    }
}
