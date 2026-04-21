# Methodology — How RateRadar Calculates Probabilities

This document is the source of truth for how every number on RateRadar is derived. Transparency matters in finance — if you can't trust the math, you can't trust the product.

## 1. What we're computing

For each upcoming FOMC (Fed) or ECB Governing Council meeting, we publish the **market-implied probability of each possible rate outcome**:
- No change (hold)
- ±25 bps
- ±50 bps
- ±75 bps (included when priced > 1%)

We also publish:
- **Conditional probabilities** — "given outcome A at meeting X, probability of outcome B at meeting Y"
- **Implied forward rate path** — the expected policy rate at each future point in time
- **Historical snapshots** — the above values captured daily, forming a time series

## 2. Data sources

### Fed (Federal Open Market Committee)

- **30-Day Fed Funds Futures** (contract symbol: `ZQ`), quoted daily on the CME Globex platform
- Source: Yahoo Finance via the `yfinance` Python library — free, redistributable market data
- Contracts pulled: the front-month plus all active listings (typically 8-12 months forward)
- Fallbacks (if yfinance fails or rate-limits): Stooq.com daily bars, FRED API (Federal Reserve economic data)

### ECB (European Central Bank)

- **€STR OIS (Euro Short-Term Rate Overnight Index Swap) quotes** by maturity
- Source: Stooq.com daily data, Investing.com RSS feeds
- Fallback: ECB Statistical Data Warehouse (SDW) for policy rate and €STR history
- We derive implied rates from OIS forward curves, pinned to the published €STR fixing

### Meeting calendars

- Fed: [federalreserve.gov/monetarypolicy/fomccalendars.htm](https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm) — hard-coded at release each December, validated by automated cross-check
- ECB: [ecb.europa.eu/press/calendars/mgcgc](https://www.ecb.europa.eu/press/calendars/mgcgc) — same process

## 3. From futures prices to implied rates

The Fed Funds Futures contract settles to the **arithmetic average of daily effective Fed Funds rates during the contract month**. The CME-standard transformation is:

```
implied_monthly_average_rate = 100 − contract_price
```

For a month with a single FOMC meeting on day *d* of *N* days, if *r_before* is the rate heading into the meeting and *r_after* is the new target, the monthly average is:

```
monthly_avg = (d / N) × r_before + ((N − d) / N) × r_after
```

Solving for *r_after* from the observed `monthly_avg` gives us the market-implied post-meeting rate.

## 4. From implied rates to outcome probabilities

We don't observe *r_after* directly — we observe *E[r_after]*, the expected value across all possible outcomes weighted by probability.

Given a finite set of possible outcomes {*o_1*, *o_2*, ..., *o_k*} (each corresponding to a specific post-meeting target-rate midpoint), and the implied *E[r_after]*:

```
E[r_after] = Σ p_i × o_i        subject to Σ p_i = 1, p_i ≥ 0
```

For a two-outcome scenario (the simplest case), probabilities are uniquely determined:

```
p_cut = (o_hold − E[r_after]) / (o_hold − o_cut)
p_hold = 1 − p_cut
```

For three+ outcomes, we use the CME's **step-function decomposition**: compute probabilities using consecutive pairs of adjacent meetings, anchored to known current and expected terminal rates.

Full derivation: see the CME Group public whitepaper ["FedWatch Tool: Probability of Fed Funds Target Rate Changes"](https://www.cmegroup.com/articles/2023/fedwatch-tool-probability-of-fed-funds-target-rate-changes.html).

## 5. Handling multiple meetings in one contract month

When a contract month contains two FOMC meetings (rare but does happen), we use time-weighted averaging:

```
monthly_avg = (d1 / N) × r_pre_first
            + ((d2 − d1) / N) × r_mid
            + ((N − d2) / N) × r_after_second
```

where *d1* and *d2* are the meeting days. We pin *r_mid* and *r_after_second* using the subsequent contracts in the forward curve and solve for each sequentially.

## 6. ECB-specific considerations

The ECB sets three policy rates (Deposit Facility Rate / DFR, Main Refinancing Operations / MRO, Marginal Lending Facility / MLF). We track the **Deposit Facility Rate** as the primary — it's the current operational floor and what the market prices. The spread between them is currently fixed.

€STR OIS captures expectations of the ECB's DFR path with high fidelity because €STR closely tracks the DFR (typically ~5-10 bps below it). We apply the same step-function decomposition as for the Fed, substituting €STR OIS rates for Fed Funds Futures.

## 7. Update cadence

| Event | Cadence |
| --- | --- |
| **Daily snapshots** | Twice per business day — after US close (22:00 UTC) and after EU close (18:00 UTC) |
| **Meeting-day refreshes** | Every 15 min from 08:00-22:00 UTC on FOMC / ECB decision days |
| **Historical retention** | All snapshots kept indefinitely — history *is* the product |

## 8. Validation & accuracy

Every snapshot is validated against the live CME FedWatch page at capture time. The divergence for each outcome's probability must be **< 2% absolute**; larger deltas are logged and trigger an alert.

We also run weekly regression checks against CME's published historical archive (where available) to detect calculation drift.

**What we don't promise:** tick-level freshness. Our numbers reflect end-of-session pricing plus intraday refreshes on meeting days — sufficient for informed decision-making, not for sub-second trading.

## 9. Caveats & limitations

- **Liquidity:** far-dated contracts are thinly traded; probabilities for meetings more than 6-8 months out are noisier.
- **Effective Fed Funds drift:** the daily effective rate can briefly diverge from target (e.g., month-end), adding a few bps of noise to near-term contracts.
- **Non-25bp moves:** when markets price unusual outcomes (e.g., +50 bps), the three-outcome decomposition can produce sign-flipped probabilities during transitions. We clamp to [0, 1] and re-normalize.
- **ECB between-meeting decisions:** historically rare but possible; we flag these in the UI when detected.

## 10. Known limitations (MVP scaffold, pre-production)

The initial implementation in `services/data-pipeline` uses **a single contract per
meeting** to solve for the implied post-meeting rate. This works accurately when the
meeting falls near the start or middle of its month (plenty of post-meeting days to
average over), but **amplifies small noise into large rate deltas** for meetings that
land near the end of a month (2-5 days remaining).

**Example.** A meeting on July 29 leaves only 2 days of post-meeting effective rate
baked into the July contract. A 1 bp error in the contract price produces a ~15 bp
error in the solved post-meeting rate.

**Production fix (tracked as a Phase 2 task):** Use the CME methodology's
cross-contract approach — anchor the pre-meeting rate with the *prior* month's
contract (which mostly reflects pre-decision rates when the meeting is late in its
own month), and the post-meeting rate with the *next* month's contract. Solve the
resulting system of equations iteratively.

Until that lands, production deployment should either (a) skip meetings that fall
in the last 7 days of their month, or (b) validate solved rates against the live
FedWatch snapshot and flag divergences > 5 bp.

## 11. Changelog

Material changes to this methodology are recorded here with date and reason. Consumers who rely on historical comparability can pin to a specific methodology version.

- **v0.1** — Initial release. Fed + ECB coverage via yfinance / stooq, daily + meeting-day cadence, step-function decomposition.
