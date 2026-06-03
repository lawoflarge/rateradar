# RateRadar v1.0.3 — ASO metadata (staged for App Store Connect)

Drafted 2026-06-03. Ready to push via `asc-fill-metadata.mjs` once `ASC_ISSUER_ID` is set.
Rules honored: Title unchanged · subtitle ≤30 · keyword field ≤100, singular, comma-no-space, **no word duplicated from title/subtitle** · **"ECB" stays visible** (English, in the title — kept in DE too) · hidden **"ezb" ONLY in the DE keyword field**.

Reserved words (already in the **title** `RateRadar: Fed & ECB`, so NOT reused anywhere else): `rateradar`, `fed`, `ecb`.

---

## English (en-US) — primary

- **Title** (unchanged): `RateRadar: Fed & ECB`  (20)
- **Subtitle** (28): `Rate decision odds & history`
- **Keyword field** (95): `interest,cut,hike,fomc,future,probability,forecast,policy,bps,easing,tracker,monetary,inflation`
- **Promotional text** (optional, ≤170): `Real, market-implied odds for every upcoming Fed and ECB rate decision — recomputed daily from futures, with the full 60-day history. Never scraped.`
- **Description** (rewrite, lead with value):
```
RateRadar tracks the market-implied probability of every upcoming Federal Reserve (Fed) and European Central Bank (ECB) interest-rate decision — and how those odds have moved over the last 60 days.

WHAT YOU GET
- Every outcome, every meeting: hold, cut, or hike, with a clean probability for each.
- The most-likely rate path, chained meeting by meeting.
- The implied forward-rate curve, priced from real market data.
- Fed vs ECB divergence at a glance.
- Historical tracking: odds snapshotted daily and kept, so you see the shift, not just today.

HOW IT WORKS
We compute our own numbers from 30-Day Fed Funds Futures and STR/DFR data using the published step-function decomposition. We never scrape CME FedWatch or ECB Watch. The full method is in the app (Methodology), versioned so you can trust the history.

Built for retail first: finance terms are explained, not assumed.
```

---

## German (de-DE) — localization

- **Title** (kept): `RateRadar: Fed & ECB`  (ECB visible — English, per directive)
- **Subtitle** (23): `Zins-Prognose & Verlauf`
- **Keyword field** (93, hidden `ezb` lives ONLY here): `ezb,leitzins,zinssenkung,zinserhöhung,fomc,notenbank,geldpolitik,wahrscheinlichkeit,inflation`
- **Promotional text** (optional): `Echte, marktbasierte Wahrscheinlichkeiten für jede anstehende Fed- und ECB-Zinsentscheidung — täglich neu berechnet, mit 60-Tage-Verlauf. Nie gescrapt.`
- **Description** (visible text uses "ECB", not "EZB"):
```
RateRadar zeigt die marktbasierte Wahrscheinlichkeit jeder anstehenden Zinsentscheidung der US-Notenbank (Fed) und der Europäischen Zentralbank (ECB) — und wie sich diese Chancen über die letzten 60 Tage verschoben haben.

DAS BIETET DIE APP
- Jedes Ergebnis, jede Sitzung: halten, senken oder erhöhen, mit klarer Wahrscheinlichkeit.
- Der wahrscheinlichste Zinspfad, Sitzung für Sitzung verkettet.
- Die implizite Zinskurve, aus echten Marktdaten abgeleitet.
- Fed vs. ECB: die Divergenz auf einen Blick.
- Historischer Verlauf: Wahrscheinlichkeiten werden täglich gespeichert.

SO FUNKTIONIERT ES
Wir berechnen alle Zahlen selbst aus Fed-Funds-Futures und STR/DFR-Daten mit der veröffentlichten Step-Function-Methode. Wir scrapen niemals CME FedWatch oder ECB Watch. Die vollständige Methodik ist in der App hinterlegt und versioniert.
```

> Note: ECB stays "Europäische Zentralbank (ECB)" in the visible DE description — the acronym is **ECB**, never "EZB", in any visible field. "ezb" appears ONLY in the DE keyword field above (hidden, for German search coverage).

---

## In-app event

Target the next decision. Soonest = **ECB Governing Council, 2026-06-11**; then **FOMC, 2026-06-17**. Recommend one event for each as it approaches (Apple needs the event submitted a few days ahead). Primary draft (FOMC, the bigger draw):

- **Event name** (≤30): `FOMC Decision Day`  /  DE: `Fed-Zinsentscheid`
- **Short description** (≤50): `See the live, market-implied odds.`  /  DE: `Die marktbasierten Odds — live.`
- **Long description**: `The Fed announces its rate decision today. Open RateRadar to see the market-implied probability of each outcome and how it shifted into the meeting.`  / DE: `Die Fed verkündet heute ihren Zinsentscheid. Öffne RateRadar für die marktbasierten Wahrscheinlichkeiten und ihren Verlauf bis zur Sitzung.`
- **Badge:** Live Event · **Start:** 2026-06-17 (FOMC) or 2026-06-11 (ECB) · deep-link to the relevant meeting page.

---

## How to apply (once `ASC_ISSUER_ID` is provided)
```bash
cd ~/Data/Claude/rateradar/apps/ios-expo
export ASC_KEY_ID=8XWLD2B2RQ ASC_ISSUER_ID=<issuer UUID>
# create v1.0.3 (reuse build 4) + push en-US + de-DE metadata above:
node scripts/asc-fill-metadata.mjs        # then finalize -> set MANUAL release -> submit
```
