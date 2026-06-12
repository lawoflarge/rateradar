# SwiftUI Rebuild — Implementation Contract

You are one of several agents porting the RateRadar web app (apps/web) into native SwiftUI (apps/ios). The mandate from the user: **design and functionality exactly identical** to what users see today inside the iOS WebView (an iPhone-width rendering of rateradar-web.vercel.app).

## Non-negotiable rules

1. **SwiftUI only, `@Observable` (never ObservableObject), async/await (never Combine).** iOS 17.0 target, Swift 5.10.
2. **Use ONLY the Theme tokens** in `RateRadar/Theme/Theme.swift`: colors `RR.cream/.creamSoft/.ink/.inkSoft/.inkMute/.rule/.ruleSoft/.cut/.cutSoft/.cutDeep/.hike/.hikeSoft/.hikeDeep/.hold/.tooltipBg`, fonts `Font.rrSans(_:weight:)`, `Font.rrSerif(_:weight:)`, `Font.rrMono(_:weight:)`, `Tone(label:)`/`Tone(deltaBps:)` (+ `.color`), `RR.outcomeColor(deltaBps:)`. Never invent hex values or use system fonts.
3. **Port the MOBILE rendering**: use the BASE Tailwind classes from the web source. `sm:`/`md:`/`lg:` variants do NOT apply (the WebView is iPhone-width) — grids like `lg:grid-cols-2` render STACKED single-column. Exception: an explicit `sm:` class applies on iPhone widths ≥640px only — ignore those too.
4. **Tailwind → SwiftUI mapping**: spacing scale ×4 (p-6=24pt, py-16=64pt, gap-5=20pt, mt-14=56pt). Text: xs=12, sm=14, base=16, lg=18, xl=20, 2xl=24, 3xl=30, 4xl=36, 5xl=48, 6xl=60 (web H1 `text-5xl sm:text-6xl` → 48pt). `font-serif`→rrSerif, `font-mono`→rrMono, default→rrSans. `font-medium`→.medium, `font-semibold`→.semibold. `border-ink/15`→`RR.ink.opacity(0.15)` 1pt. `rounded-none`=square, `rounded-lg`=8pt. `tracking-tight`≈-0.5, `tracking-wide`≈+0.4, `uppercase`→`.textCase(.uppercase)`. `max-w-*` + `px-6 py-16` → `.padding(.horizontal, 24).padding(.vertical, 64)` inside a ScrollView; iPhone is narrower than every max-w so full width.
5. **Page skeleton**: every screen = `ScrollView { VStack(alignment: .leading, spacing: 0) { … } .padding(...) }.background(RR.cream)`. Section separators: `RRRule()` (strong) / `RRRule(tone: .soft)` — from `Components/Atoms.swift`. Section labels: `SectionLabel("…")`.
6. **Navigation**: web `<Link href="/x">` → `Button { router.navigate(.x) }` with `@Environment(Router.self) private var router`. Routes: `.fed .ecb .meeting(String) .compare .scenarios .methodology .glossary .glossaryTerm(String) .brokers .about .privacy`. In-page back-links (e.g. "← Back to all meetings") → `dismiss()` via `@Environment(\.dismiss)`. External URLs → `Link(destination:)`.
7. **Data**: `@Environment(AppDataStore.self) private var store` — `store.fed`, `store.ecb`, `store.all`, `store.meeting(id:)`, `await store.history(meetingId:windowDays:)`, `store.isLoading`, `store.errorMessage`, `await store.loadAll()`. Math/date helpers: `RateMath.*` (expectedDeltaBps, pathEntries, curvePoints, buildConditional, computeMovements, formatDelta, currentPolicyRates, shortDate, longDate, mediumDate, weekdayShortDate, countdownText). Models: `MeetingProbabilities` (`.meeting.id/.meeting.meetingDate/.meeting.bankCode`, `.outcomes`, `.snapshotAt`, `.topOutcome`), `Outcome` (`.label/.deltaBps/.probability/.postMeetingRate`), `ProbabilitySeries`, `APIStatus`.
8. **Omit**: AdSlot/StickyAnchorAd (render nothing in the native app today), JsonLd/SEO/meta, NativeNavBridge (handled by RootView), AdSense scripts.
9. **Numbers**: probabilities stored 0–1, rendered % — 0 decimals in chips/headlines, 1 decimal in tables/charts (`String(format: "%.1f%%", p*100)`). Rates: 2–3 decimals per web source. Always rrMono.
10. **Every view file ends with a `#Preview`** using inline sample data (build a small `MeetingProbabilities` fixture by hand).
11. **File ownership**: write ONLY the files assigned to you. Never edit Theme/Atoms/Route/RootView/App/Services — code against them. If a contract signature seems wrong, implement to the contract anyway and note it in your final report.
12. **Write-tool gate**: the FIRST Write to each new file is blocked by a hook demanding 4 facts. Respond by writing the 4 facts as plain text (caller file, no-duplicate confirmation, data formats, the user instruction "design funktionalität soll exakt gleich bleiben btw"), then retry the IDENTICAL Write — it passes the second time.

## Decreed component signatures (Phase-1 agents implement, screens consume)

```swift
HistoricalChartView(history: [ProbabilitySeries]?, isLoading: Bool = false)
// 224pt Swift Charts multi-line card: header "PROBABILITY HISTORY · LAST 60 DAYS" + legend,
// Y fixed 0–100 with % labels, X short dates, line color RR.outcomeColor(deltaBps:),
// dashed grid RR.rule 12%, bg RR.creamSoft, border ink/15, rounded 8.
// nil/[] + isLoading=false → dashed-border empty card "No history yet. Come back after we capture more snapshots."
// isLoading=true → "Loading history…" card.

ProbabilityTableView(snapshot: MeetingProbabilities, showDetailLink: Bool = true)
// Full card port of ProbabilityTable.tsx: header (long date + "FOMC meeting · FED"/"Governing Council · ECB",
// right "MOST LIKELY" + top outcome "label · NN%"), table rows (Outcome | Probability | Moved last 7d |
// Post-meeting rate | bar), MovementChip, embedded HistoricalChartView, share/download via ShareLink (CSV).
// Fetches its own history: .task { await store.history(meetingId:) } + computes RateMath.computeMovements.
// showDetailLink → "Full history & detail →" Button → router.navigate(.meeting(id)).

ImpliedRateCurveView(snapshots: [MeetingProbabilities], startingRate: Double, bankLabel: String, anchorLabel: String = "Now")
// Port of ImpliedRateCurve.tsx via RateMath.curvePoints: single amber line 2.5pt WITH 3pt dots,
// Y domain [min-0.25, max+0.25] "%.2f%%", 256pt height, card chrome like above.

MostLikelyPathView(snapshots: [MeetingProbabilities], label: String = "Most-likely path", maxMeetings: Int = 8)
// Port of MostLikelyPath.tsx via RateMath.pathEntries: header + "Cumulative pricing +N bps by MMM d" (amber mono),
// wrapping 104pt chips (bank, short date, top label, %, Σ cumulative) joined by "→"; chip border/text by tone,
// faded (border ink/25, color 70%) when top probability < 0.5; chips navigate to .meeting(id).

MeetingCountdownView(meetingDate: String) // port MeetingCountdown.tsx EXACTLY (strings/refresh 60s timer)
MeetingContextView(current: MeetingProbabilities, all: [MeetingProbabilities]) // port MeetingContext.tsx (prior/next MiniCards)
MethodologyBadgeView() // port MethodologyBadge.tsx; fetches APIClient.shared.getStatus() in .task; tap → router.navigate(.methodology)
ShareButtonsView(meetingId: String, meetingDate: String, bank: BankCode) // port ShareButtons.tsx: share/copy of https://rateradar-web.vercel.app/meeting/{id}
MovementChip(deltaPp: Double?) // "▲ +4.2pp" hold-green / "▼ -3.1pp" cut-amber / "· flat" mute; nil → "—" (defined in ProbabilityTableView.swift)
```

## Reference sources

Web design system: `apps/web/src/app/globals.css` (palette), components in `apps/web/src/components/`, pages in `apps/web/src/app/`. Read YOUR assigned web sources fully before writing Swift. Quote-faithful copy: all user-visible strings must match the web 1:1 (including punctuation like "·" and "→").
