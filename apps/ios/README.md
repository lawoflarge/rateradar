# RateRadar iOS

Native iOS app for RateRadar, scaffolded for SwiftUI + Swift Charts (iOS 17+).

This folder contains the Swift source code plus an
[XcodeGen](https://github.com/yonaskolb/XcodeGen) spec so you can generate a
working `.xcodeproj` without it living in Git as a messy binary-ish blob.

## Requirements

- macOS with Xcode 15+
- [Homebrew](https://brew.sh) + [XcodeGen](https://github.com/yonaskolb/XcodeGen):
  ```bash
  brew install xcodegen
  ```

## Generating the Xcode project

From this directory:

```bash
xcodegen generate
open RateRadar.xcodeproj
```

XcodeGen reads `project.yml` and regenerates `RateRadar.xcodeproj/` from the
Swift sources + resources in `RateRadar/`. Re-run whenever you add new files.

## Running

Select the `RateRadar` scheme + a simulator (iPhone 15 Pro recommended) and
press ⌘R. The app fetches live data from the RateRadar web API at
`https://rateradar-web.vercel.app`.

To override the API host (e.g. point at localhost during dev), set
`RATERADAR_API_HOST` in the scheme's environment variables:

```
RATERADAR_API_HOST=http://localhost:3000
```

## Layout

```
RateRadar/
├── App.swift                      # @main entry point
├── Views/
│   ├── HomeView.swift             # dashboard: Fed + ECB meeting lists
│   ├── MeetingDetailView.swift    # per-meeting detail with chart
│   ├── HistoricalChartView.swift  # Swift Charts line chart of probabilities
│   ├── ProbabilityTableView.swift # outcome rows with % bars
│   └── SettingsView.swift         # TODO
├── Services/
│   ├── APIClient.swift            # URLSession + Codable fetch
│   └── Config.swift               # API host env + constants
├── Models/
│   ├── MeetingProbability.swift   # Codable mirror of /api/:bank/probabilities
│   └── ProbabilitySeries.swift    # Codable mirror of /api/meetings/:id/history
└── Resources/
    ├── Info.plist
    └── Assets.xcassets            # (created by Xcode on first build)
```

## Status

Scaffold only. Not submitted to the App Store yet. The plan:

1. Get running locally against the prod API
2. Add TestFlight builds (see `docs/DEPLOYMENT.md` §3)
3. WidgetKit home-screen widgets (starter in `Widgets/`)
4. Apple Watch complication (future)
5. Push notifications via APNs (future)
