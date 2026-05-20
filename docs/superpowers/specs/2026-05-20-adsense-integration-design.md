# AdSense integration — design spec

**Date:** 2026-05-20
**Owner:** Levin Schwab
**Status:** Approved, pending implementation
**Publisher ID:** `ca-pub-6563643868702361` (Google account: `schwablevin@gmail.com`)

## Goal

Add Google AdSense to the RateRadar web app and inherit ad serving into the iOS app via the WebView shell. EU/EEA/UK consent handled via Google Funding Choices (IAB TCF v2.2). Privacy policy rewritten to match the new data flows.

## Why

Per `docs/PRD.md` §6, ads are the day-1 revenue stream. Pro tier (ad-free) is roadmap month 2-3. This spec covers the ads-day-1 commitment.

## Non-goals

- Content strategy / new explainer pages — separate spec
- PostHog `ad_clicked` event — deferred
- Custom apex domain — separate decision
- Pro tier (ad-free) — PRD roadmap
- Broker affiliate placements — separate work
- Native AdMob banner on top of the iOS WebView — explicitly rejected (architectural mismatch with the WebView-shell shipping pattern)

## Architecture

The iOS app at `apps/ios-expo` is a WebView shell over `rateradar-web.vercel.app` (see `apps/ios-expo/App.tsx`). Any web change in `apps/web` is automatically inherited at runtime — no IPA rebuild. AdSense is a web SDK, so a single web integration covers both platforms.

Two `<Script>` tags in `apps/web/src/app/layout.tsx`:

1. **AdSense loader**
   - `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6563643868702361`
   - `async`, `crossorigin="anonymous"`
   - Next.js `<Script>` strategy: `afterInteractive`
   - Client ID source: `process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID`

2. **Funding Choices CMP loader**
   - `https://fundingchoicesmessages.google.com/i/pub-6563643868702361?ers=1`
   - `async`
   - Strategy: `beforeInteractive` so consent state lands before AdSense reads it

That is the entirety of the frontend ad infrastructure. Auto Ads handles placement; Funding Choices handles consent. No bespoke ad-slot React components.

## AdSense console config (manual)

- **Site:** `rateradar-web.vercel.app` added 2026-05-20
- **Auto Ads:** enabled (done 2026-05-20)
- **Formats:** in-page ON, anchor ON, side rail ON, vignette OFF, multiplex ON
- **Density:** medium
- **Page exclusions:** `/privacy`, `/methodology`, `/brokers`
- **Funding Choices:** create EU/EEA/UK consent message under Privacy & messaging → European regulations, IAB TCF v2.2, publish

## Consent flow

- EU/EEA/UK user lands → Funding Choices overlay → consent or manage options → consent state written to TCF storage → AdSense reads → serves personalized or non-personalized accordingly.
- Non-EU user lands → no overlay → AdSense serves personalized.

## Privacy / legal changes

### Web (`apps/web/src/app/privacy/page.tsx`)

Full rewrite. Specifically:

- Remove all "we do not advertise / no ad measurement / no IDFA" claims
- Add an "Advertising" section that says:
  - We use Google AdSense to serve ads
  - In the EU/EEA/UK, consent is collected via Google's Funding Choices CMP (IAB TCF v2.2)
  - Cookies and similar identifiers may be set by Google for ad delivery and measurement
  - Users can withdraw consent any time and opt out at `https://adssettings.google.com`
- Add Google LLC to the "Service providers" list with purpose "advertising"
- Update "What we don't do": remove "we do not use any data for advertising"
- Bump `LAST_UPDATED`

### iOS (App Store Connect privacy nutrition label)

Manual ASC web action on launch day (Playwright-driven):

- Data type "Identifiers" → Linked to user → Purpose "Third-party advertising"
- Data type "Usage Data" → Linked to user → Purpose "Third-party advertising"

No binary resubmit; the IPA in `apps/ios-expo` does not change.

## Implementation phases

To unblock AdSense site verification ASAP without leaving the privacy policy in a false state:

**Phase 1 — verification unblock (this PR):**

1. Add `NEXT_PUBLIC_ADSENSE_CLIENT_ID=ca-pub-6563643868702361` to Vercel env (manual)
2. Document the env var in `apps/web/.env.example`
3. Add AdSense `<Script>` tag to `apps/web/src/app/layout.tsx`
4. Rewrite `apps/web/src/app/privacy/page.tsx`
5. After merge + Vercel deploy → Levin clicks "Überprüfung beantragen" in AdSense

**Phase 2 — consent + serving (follow-up PR before AdSense approval lands):**

1. Create + publish Funding Choices console message
2. Add Funding Choices `<Script>` tag to `layout.tsx`
3. Update ASC privacy nutrition label (Playwright)

Phase 2 must ship before AdSense approval lands (1-14 day window) so EU consent UX is in place before ads start serving.

## Error handling

- Ad blockers: site renders normally; no fallback content
- Funding Choices script fails: AdSense falls back to non-personalized — acceptable
- AdSense approval pending: Auto Ads serves nothing, slots stay blank, no broken UI
- Lighthouse perf regression below 85: revert Auto Ads density to "low" in console; if still bad, disable anchor format

## Testing

- Lighthouse mobile before/after on `/` and `/meeting/[id]`; fail if perf < 85
- Manual EU simulation (Chrome DevTools geo Berlin) → consent banner appears (Phase 2 onwards)
- Manual US simulation → no banner; ads load when approved
- Manual iOS simulator → consent banner renders inside WebView; ads serve

## Files touched

- `apps/web/src/app/layout.tsx` — Script tags
- `apps/web/src/app/privacy/page.tsx` — full rewrite
- `apps/web/.env.example` — document `NEXT_PUBLIC_ADSENSE_CLIENT_ID` (created if missing)
- Vercel env (manual): `NEXT_PUBLIC_ADSENSE_CLIENT_ID=ca-pub-6563643868702361`

## Context / known facts

- AdSense publisher ID: `ca-pub-6563643868702361`
- AdSense Google account: `schwablevin@gmail.com`
- AdSense site status 2026-05-20 21:43 CEST: "Überprüfung erforderlich" — Google has not yet found the AdSense tag on the site
- Auto Ads enabled in console for `rateradar-web.vercel.app` (done 2026-05-20)
- iOS app architecture: WebView shell over `rateradar-web.vercel.app` (`apps/ios-expo/App.tsx`; `webapp-shell-shipping-pattern` memory)
- Privacy policy currently promises "no advertising" — must be rewritten in the same PR as the script tag
- Branch policy: per `feedback_agent_git_guardrail`, agent app-code changes go to a feature branch + PR for Levin to merge, never directly to master
