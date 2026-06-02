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

## 10. Cross-contract post-meeting-rate solve

The implied monthly-average rate from a single contract (`100 − price`) blends
the pre- and post-meeting rates weighted by the meeting's position in the month
(§3, §5). Inverting that for a *single* contract divides by the post-meeting
weight `(N − meeting_day) / N`. For a meeting late in its month that weight is
tiny — a July 29 meeting leaves only `2/31 ≈ 0.0645` of the month after the
decision — so a ~1 bp wobble in the contract price is divided by ~0.0645 and
explodes into ~15 bp of solved-rate error. Chaining that error into the next
meeting compounds it into implausible multi-hundred-bp swings and 100%
alternating outcome spikes.

We therefore isolate each meeting's expected post-meeting rate using the
contracts that **bracket** the meeting, following the CME methodology:

1. **Bracket identity (preferred).** If the calendar month *after* the meeting
   contains no FOMC meeting, that next month's contract settles to the constant
   post-meeting rate for the whole month, so its implied monthly-average **is**
   the post-meeting rate directly — no division by a tiny tail. Example: the
   August contract gives the post-July-29 rate exactly.

2. **Guarded in-month solve (fallback).** If the next month also holds a meeting
   (consecutive-month meetings), we invert the meeting month's own average, but
   only when the post-meeting weight is at least `min_post_weight` (0.20). Below
   that, the solve would amplify noise and we do not perform it.

3. **Pre-meeting rate / outcome center.** A meeting's pre-meeting rate is the
   *validated* post-meeting rate of the previous meeting (or the current target
   for the first meeting), never a previously-amplified solved value — so one
   bad meeting cannot poison its successors.

4. **Validation & flagging.** Every solved post-meeting rate is checked against
   a one-meeting plausibility bound (default 75 bp from the pre-meeting rate).
   Meetings that cannot be bracketed or solved, or whose solved rate is
   implausible, are **flagged in the logs and skipped** — RateRadar emits no
   probabilities for them rather than publishing a known artifact. Operators may
   additionally cross-check solved rates against the live FedWatch snapshot
   (§8) and alert on divergence.

This replaces the earlier single-contract MVP solve, which was accurate only
for meetings near the start or middle of their month.

## 11. Changelog

Material changes to this methodology are recorded here with date and reason. Consumers who rely on historical comparability can pin to a specific methodology version.

- **v1.1.0** — Fed post-meeting-rate solve rewritten from single-contract to
  cross-contract bracketing (§10): the month after a meeting (when meeting-free)
  yields the post-meeting rate directly; consecutive-month meetings use a
  noise-guarded in-month solve; solved rates are validated and implausible /
  unbracketable meetings are flagged and skipped instead of emitting degenerate
  100% alternating outcomes. Fixes the late-month-meeting noise amplification.
- **v0.1** — Initial release. Fed + ECB coverage via yfinance / stooq, daily + meeting-day cadence, step-function decomposition.
