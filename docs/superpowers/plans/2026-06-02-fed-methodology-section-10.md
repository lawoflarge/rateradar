# FED Methodology §10 Rewrite — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-contract-per-meeting post-meeting-rate solve in the Fed pipeline with a CME-style cross-contract solve, so multi-meeting FED probabilities stop degenerating into a 100% alternating ±50bp sawtooth (which currently happens even on real, near-flat data because of a tiny late-month post-meeting weight that gets divided into).

**Architecture:** The fix lives in the pure math module (`probability_calc.py`) plus the orchestration that calls it (`fed_fetcher.py`). Per `METHODOLOGY.md` §10, instead of dividing a single month's implied average by a tiny post-meeting tail, we isolate each meeting's expected post-meeting rate using the contracts that *bracket* the meeting: when the month *after* a meeting contains no FOMC meeting, that next-month contract's implied average **is** the post-meeting rate directly (no tail division). When the next month also holds a meeting, we still solve within that month but anchor `rate_before` from the bracketing structure, never from a previously-amplified value. Meetings we cannot bracket from the available contracts, or whose solved rate diverges implausibly from the pre-meeting rate, are **flagged and skipped** — we never emit garbage. The chaining bug (feeding an amplified `rate_before` into the next meeting) is removed: each meeting's pre-rate comes from the *validated* prior post-rate, and an unsolved meeting does not poison its successors.

**Tech Stack:** Python ≥3.11, `pytest`, `black`, `ruff`, type annotations. Pure-math changes in `probability_calc.py` (no I/O, per `CLAUDE.md`). No new third-party dependencies (free-data constraint).

---

## Background — the confirmed bug (read before starting)

`solve_post_meeting_rate(observed_monthly_avg, rate_before_meeting, meeting_day, days_in_month)` computes:

```
post = (observed_monthly_avg - (meeting_day/N) * rate_before) / ((N - meeting_day)/N)
```

For a late-month meeting the post-weight `(N - meeting_day)/N` is tiny (Jul-29 → `2/31 ≈ 0.0645`). A ~1bp gap between the implied monthly average and the pre-meeting rate is divided by ~0.0645 and explodes into ~15bp of solved-rate error. `compute_meeting_probabilities` then **chains** that bad `post` into the next meeting as `rate_before` (`fed_fetcher.py:144`), so the error compounds.

**Reproduced numerically** from a *realistic* near-flat easing curve (implied averages declining ~1.5bp/month), current code produces:

| Meeting | days | post-weight | solved post | Δ vs before | dominant outcome |
| --- | --- | --- | --- | --- | --- |
| Jun-17 | 30 | 0.433 | 3.590 | −3.5 bp | Hold (0.86) |
| Jul-29 | 31 | 0.065 | 3.871 | +28.1 bp | **+25bp (0.88)** |
| Sep-16 | 30 | 0.467 | 3.279 | −59.2 bp | **−50bp (1.00)** |
| Oct-28 | 31 | 0.097 | 6.365 | **+308.6 bp** | **+50bp (1.00)** |
| Dec-09 | 31 | 0.710 | 2.412 | −395.3 bp | **−50bp (1.00)** |

That `Hold → +25bp → −50bp → +50bp → −50bp` is the 100% alternating sawtooth from the spec.

**The fix (METHODOLOGY §10 direction).** Isolate each meeting's post-rate from the bracketing contracts:
- The month *after* Jul-29 is August, which has **no FOMC meeting**, so the August contract's whole monthly average reflects the post-July-meeting rate. Therefore `post_july = implied_avg(Aug)` — directly, with no tail division. A 1bp data wobble stays a 1bp wobble.
- For the *outcome center / pre-rate*: a meeting's `rate_before` is the previous meeting's **validated** post-rate (or the current target for the first meeting), never an amplified solved value.

All fixture numbers below are pre-computed from the actual formulas (`100 − price`, the monthly-average identity, and the existing two-point `decompose_probabilities`). They are exact — do not round differently.

---

## File Structure

| File | Create / Modify | Responsibility |
| --- | --- | --- |
| `services/data-pipeline/src/probability_calc.py` | Modify | Add the pure cross-contract primitives: `post_rate_from_bracketing_contract(...)`, `solve_post_meeting_rate_in_month(...)` (renamed-intent wrapper kept pure), and a pure validator `is_plausible_post_rate(...)`. No I/O. Keep all existing functions intact (other code + tests depend on them). |
| `services/data-pipeline/src/fed_fetcher.py` | Modify | Replace the body of `compute_meeting_probabilities` to: (1) build a per-month implied-average map, (2) classify each meeting month's bracketing structure, (3) call the new pure solver, (4) validate + flag/skip, (5) chain only validated pre-rates. Add a small `MeetingDiagnostics`-free skip path (log + continue). |
| `services/data-pipeline/src/main.py` | Modify | Remove the stale `4.375` FED default; make `--current-rate` required for FED unless `RR_FED_CURRENT_RATE` env is set (dynamic). Keep ECB default. |
| `services/data-pipeline/tests/test_probability_calc.py` | Modify | Unit tests for the new pure primitives + validator (flat, easing, late-month, bracketing-with-meeting, divergence). |
| `services/data-pipeline/tests/test_fed_fetcher.py` | Modify | Integration tests for the rewritten `compute_meeting_probabilities`: FLAT-futures → Hold≈1.0 every meeting (no sawtooth); easing → smooth cut-skew; the Jul-29 regression with corrected behavior; skip/flag path. |
| `services/data-pipeline/tests/test_main_current_rate.py` | Create | Tests that the FED `--current-rate` is required/dynamic and the stale default is gone. |
| `docs/METHODOLOGY.md` | Modify | Rewrite §10 to describe the implemented cross-contract solve (was "MVP scaffold / planned fix"); add a §11 changelog entry; bump methodology version. |
| `services/data-pipeline/src/main.py` (`METHODOLOGY_VERSION`) | Modify | Bump `1.0.0` → `1.1.0` in the same change as the doc. |

**Note on naming consistency:** the new pure functions are `post_rate_from_bracketing_contract`, `solve_post_meeting_rate_in_month`, and `is_plausible_post_rate`. These exact names are used in every task below.

---

## Task 1: Pure primitive — `post_rate_from_bracketing_contract`

The core §10 move: when the post-meeting month's contract has **no meeting of its own**, its implied average equals the post-meeting rate. This is the trivial-but-correct identity that removes the tiny-tail division.

**Files:**
- Modify: `services/data-pipeline/src/probability_calc.py`
- Test: `services/data-pipeline/tests/test_probability_calc.py`

- [ ] **Step 1: Write the failing test**

Append to `services/data-pipeline/tests/test_probability_calc.py`:

```python
def test_post_rate_from_bracketing_contract_is_identity():
    # When the month AFTER the meeting holds no FOMC meeting, that month's
    # implied monthly-average IS the post-meeting rate (no tail division).
    from src.probability_calc import post_rate_from_bracketing_contract

    # Aug 2026 has no meeting; its implied average 3.620 -> post-July rate 3.620.
    post = post_rate_from_bracketing_contract(next_month_implied_avg=3.620)
    assert post == pytest.approx(3.620)


def test_post_rate_from_bracketing_contract_stable_to_noise():
    # A 1bp wobble in the bracketing contract stays a 1bp wobble in the post rate
    # (this is the whole point of the cross-contract fix vs the tail division).
    from src.probability_calc import post_rate_from_bracketing_contract

    base = post_rate_from_bracketing_contract(next_month_implied_avg=3.625)
    wobbled = post_rate_from_bracketing_contract(next_month_implied_avg=3.615)
    assert abs(wobbled - base) == pytest.approx(0.010)  # 1.0 bp, not ~15 bp
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/data-pipeline && .venv/bin/python -m pytest tests/test_probability_calc.py::test_post_rate_from_bracketing_contract_is_identity tests/test_probability_calc.py::test_post_rate_from_bracketing_contract_stable_to_noise -v`
Expected: FAIL — `ImportError: cannot import name 'post_rate_from_bracketing_contract'`.

- [ ] **Step 3: Write minimal implementation**

Append to `services/data-pipeline/src/probability_calc.py`:

```python
def post_rate_from_bracketing_contract(next_month_implied_avg: float) -> float:
    """Post-meeting rate when the *next* month holds no FOMC meeting.

    Per METHODOLOGY.md §10: if the month after a meeting contains no meeting,
    that month's contract settles to the (constant) post-meeting rate for the
    whole month, so its implied monthly-average equals the post-meeting rate
    directly. This avoids dividing the meeting-month's average by the tiny
    post-meeting weight (the late-month-meeting noise-amplification bug).
    """
    return next_month_implied_avg
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd services/data-pipeline && .venv/bin/python -m pytest tests/test_probability_calc.py::test_post_rate_from_bracketing_contract_is_identity tests/test_probability_calc.py::test_post_rate_from_bracketing_contract_stable_to_noise -v`
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**

```bash
git add services/data-pipeline/src/probability_calc.py services/data-pipeline/tests/test_probability_calc.py
git commit -m "feat(pipeline): add cross-contract post-rate primitive (METHODOLOGY §10)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Pure primitive — `solve_post_meeting_rate_in_month` (bracketing-month-has-a-meeting case)

When the *next* month also has a meeting, we cannot use the identity. We still solve within the meeting month, but the post-meeting tail must be large enough to be numerically safe; otherwise the caller will skip. This function is the same algebra as the existing `solve_post_meeting_rate` but with an explicit minimum-post-weight guard so the math module itself refuses to amplify noise.

**Files:**
- Modify: `services/data-pipeline/src/probability_calc.py`
- Test: `services/data-pipeline/tests/test_probability_calc.py`

- [ ] **Step 1: Write the failing test**

Append to `services/data-pipeline/tests/test_probability_calc.py`:

```python
def test_solve_post_meeting_rate_in_month_mid_month_ok():
    # Mid-month meeting: post-weight is large, solve is well-conditioned.
    # Jun-17 of 30: pre_w = 17/30, post_w = 13/30.
    # implied_avg 3.5968 with before 3.625 -> after = (avg - pre_w*before)/post_w
    from src.probability_calc import solve_post_meeting_rate_in_month

    after = solve_post_meeting_rate_in_month(
        observed_monthly_avg=3.5968,
        rate_before_meeting=3.625,
        meeting_day=17,
        days_in_month=30,
        min_post_weight=0.20,
    )
    assert after == pytest.approx(3.560, abs=1e-3)


def test_solve_post_meeting_rate_in_month_rejects_tiny_tail():
    # Jul-29 of 31: post_weight = 2/31 ~ 0.0645 < min_post_weight -> refuse.
    # This is the bug condition: the function must NOT return an amplified value.
    from src.probability_calc import solve_post_meeting_rate_in_month

    with pytest.raises(ValueError, match="post-meeting weight"):
        solve_post_meeting_rate_in_month(
            observed_monthly_avg=3.620,
            rate_before_meeting=3.625,
            meeting_day=29,
            days_in_month=31,
            min_post_weight=0.20,
        )
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/data-pipeline && .venv/bin/python -m pytest tests/test_probability_calc.py::test_solve_post_meeting_rate_in_month_mid_month_ok tests/test_probability_calc.py::test_solve_post_meeting_rate_in_month_rejects_tiny_tail -v`
Expected: FAIL — `ImportError: cannot import name 'solve_post_meeting_rate_in_month'`.

- [ ] **Step 3: Write minimal implementation**

Append to `services/data-pipeline/src/probability_calc.py`:

```python
def solve_post_meeting_rate_in_month(
    observed_monthly_avg: float,
    rate_before_meeting: float,
    meeting_day: int,
    days_in_month: int,
    min_post_weight: float = 0.20,
) -> float:
    """Invert the monthly-average formula for a meeting, refusing tiny tails.

    Same algebra as `solve_post_meeting_rate`, but raises if the post-meeting
    weight `(N - meeting_day)/N` is below `min_post_weight`. A tiny tail is the
    exact condition under which a ~1bp price wobble explodes into a multi-bp
    solved-rate error (METHODOLOGY.md §10). The caller is expected to fall back
    to the bracketing-contract identity, or to flag/skip the meeting.
    """
    if days_in_month <= 0:
        raise ValueError(f"days_in_month must be > 0, got {days_in_month}")
    if not 0 <= meeting_day <= days_in_month:
        raise ValueError(
            f"meeting_day {meeting_day} out of range for month of {days_in_month}"
        )
    post_weight = (days_in_month - meeting_day) / days_in_month
    if post_weight < min_post_weight:
        raise ValueError(
            f"post-meeting weight {post_weight:.4f} below minimum {min_post_weight} "
            f"(meeting_day={meeting_day}, days_in_month={days_in_month}); "
            "solve would amplify noise — use a bracketing contract or skip"
        )
    pre_weight = meeting_day / days_in_month
    return (observed_monthly_avg - pre_weight * rate_before_meeting) / post_weight
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd services/data-pipeline && .venv/bin/python -m pytest tests/test_probability_calc.py::test_solve_post_meeting_rate_in_month_mid_month_ok tests/test_probability_calc.py::test_solve_post_meeting_rate_in_month_rejects_tiny_tail -v`
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**

```bash
git add services/data-pipeline/src/probability_calc.py services/data-pipeline/tests/test_probability_calc.py
git commit -m "feat(pipeline): guarded in-month post-rate solve (rejects tiny tail)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Pure validator — `is_plausible_post_rate`

A defensive gate (spec: "Validate solved rates and flag implausible divergence"). A single FOMC meeting moves the target by at most a few 25bp steps; a one-meeting jump beyond a sane bound is a data/solve artifact and must be flagged, not emitted.

**Files:**
- Modify: `services/data-pipeline/src/probability_calc.py`
- Test: `services/data-pipeline/tests/test_probability_calc.py`

- [ ] **Step 1: Write the failing test**

Append to `services/data-pipeline/tests/test_probability_calc.py`:

```python
def test_is_plausible_post_rate_accepts_normal_moves():
    from src.probability_calc import is_plausible_post_rate

    # Hold, a 25bp cut, and a 50bp cut are all plausible from 3.625.
    assert is_plausible_post_rate(3.625, rate_before=3.625, max_move_bps=75)
    assert is_plausible_post_rate(3.375, rate_before=3.625, max_move_bps=75)
    assert is_plausible_post_rate(3.125, rate_before=3.625, max_move_bps=75)


def test_is_plausible_post_rate_rejects_implausible_swing():
    from src.probability_calc import is_plausible_post_rate

    # The bug produced jumps like +308bp / -395bp in one meeting — reject.
    assert not is_plausible_post_rate(6.365, rate_before=3.279, max_move_bps=75)
    assert not is_plausible_post_rate(2.412, rate_before=6.365, max_move_bps=75)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/data-pipeline && .venv/bin/python -m pytest tests/test_probability_calc.py::test_is_plausible_post_rate_accepts_normal_moves tests/test_probability_calc.py::test_is_plausible_post_rate_rejects_implausible_swing -v`
Expected: FAIL — `ImportError: cannot import name 'is_plausible_post_rate'`.

- [ ] **Step 3: Write minimal implementation**

Append to `services/data-pipeline/src/probability_calc.py`:

```python
def is_plausible_post_rate(
    post_rate: float,
    rate_before: float,
    max_move_bps: float = 75.0,
) -> bool:
    """True if a one-meeting move from `rate_before` to `post_rate` is plausible.

    A single meeting moves the target by at most a handful of 25bp steps. A
    larger implied jump indicates a data wobble amplified by a bad solve
    (METHODOLOGY.md §10) — the caller flags and skips rather than emitting it.
    `max_move_bps` is the absolute one-meeting bound, in basis points.
    """
    return abs(post_rate - rate_before) * 100.0 <= max_move_bps
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd services/data-pipeline && .venv/bin/python -m pytest tests/test_probability_calc.py::test_is_plausible_post_rate_accepts_normal_moves tests/test_probability_calc.py::test_is_plausible_post_rate_rejects_implausible_swing -v`
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**

```bash
git add services/data-pipeline/src/probability_calc.py services/data-pipeline/tests/test_probability_calc.py
git commit -m "feat(pipeline): add one-meeting plausibility gate for solved rates

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: `fed_fetcher` — bracketing classification helper

Before rewriting the main loop, add a small pure-ish helper that, given the ordered meeting list, tells us for each meeting whether the *next calendar month* contains another meeting. This drives the "identity vs in-month-solve vs skip" decision.

**Files:**
- Modify: `services/data-pipeline/src/fed_fetcher.py`
- Test: `services/data-pipeline/tests/test_fed_fetcher.py`

- [ ] **Step 1: Write the failing test**

Append to `services/data-pipeline/tests/test_fed_fetcher.py`:

```python
def test_next_month_has_meeting_flags_consecutive_month_meetings():
    from src.fed_fetcher import next_month_has_meeting

    meetings = [
        date(2026, 6, 17),
        date(2026, 7, 29),
        date(2026, 9, 16),
        date(2026, 10, 28),
        date(2026, 12, 9),
    ]
    # July's next month (Aug) has no meeting -> False (bracketing identity usable).
    assert next_month_has_meeting(date(2026, 7, 29), meetings) is False
    # Sep's next month (Oct) HAS a meeting -> True.
    assert next_month_has_meeting(date(2026, 9, 16), meetings) is True
    # June's next month (July) HAS a meeting -> True.
    assert next_month_has_meeting(date(2026, 6, 17), meetings) is True
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/data-pipeline && .venv/bin/python -m pytest tests/test_fed_fetcher.py::test_next_month_has_meeting_flags_consecutive_month_meetings -v`
Expected: FAIL — `ImportError: cannot import name 'next_month_has_meeting'`.

- [ ] **Step 3: Write minimal implementation**

Add to `services/data-pipeline/src/fed_fetcher.py` (after `contracts_covering_meetings`):

```python
def next_month_has_meeting(meeting: date, meetings: list[date]) -> bool:
    """True if the calendar month immediately after `meeting`'s month holds a meeting.

    Drives the §10 bracketing decision: if the next month has NO meeting, that
    month's contract average is the post-meeting rate (identity solve); if it
    does, we must solve within the meeting's own month (and may have to skip a
    late-month meeting whose tail is too small).
    """
    if meeting.month == 12:
        nxt_year, nxt_month = meeting.year + 1, 1
    else:
        nxt_year, nxt_month = meeting.year, meeting.month + 1
    return any(m.year == nxt_year and m.month == nxt_month for m in meetings)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd services/data-pipeline && .venv/bin/python -m pytest tests/test_fed_fetcher.py::test_next_month_has_meeting_flags_consecutive_month_meetings -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/data-pipeline/src/fed_fetcher.py services/data-pipeline/tests/test_fed_fetcher.py
git commit -m "feat(pipeline): add next-month-has-meeting bracketing classifier

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Rewrite `compute_meeting_probabilities` — FLAT futures must give Hold≈1.0 (no sawtooth)

This is the headline regression. Rewrite the loop to use the bracketing identity (or guarded in-month solve), validate, and chain only validated pre-rates. The flat-futures fixture is the canonical "never sawtooth" guard.

**Files:**
- Modify: `services/data-pipeline/src/fed_fetcher.py` (replace the body of `compute_meeting_probabilities`, lines ~88-146)
- Test: `services/data-pipeline/tests/test_fed_fetcher.py`

- [ ] **Step 1: Write the failing test**

Append to `services/data-pipeline/tests/test_fed_fetcher.py`:

```python
def test_flat_futures_yield_hold_for_every_meeting():
    """FLAT futures (every contract ~ current rate) MUST give a high-probability
    Hold at every meeting and NEVER an alternating +/-50bp sawtooth."""
    from src.fed_fetcher import compute_meeting_probabilities
    from src.fetchers.base import ContractPrice

    current = 3.625
    flat_price = 100.0 - current  # 96.375 -> implied avg 3.625 every month
    months = [6, 7, 8, 9, 10, 11, 12]  # meeting months + bracketing months
    prices = [
        ContractPrice(
            symbol=f"ZQ{m:02d}",
            contract_month=date(2026, m, 1),
            price=flat_price,
            as_of=date(2026, 6, 1),
        )
        for m in months
    ]
    meetings = [
        date(2026, 6, 17),
        date(2026, 7, 29),
        date(2026, 9, 16),
        date(2026, 10, 28),
        date(2026, 12, 9),
    ]
    results = compute_meeting_probabilities(meetings, prices, current)

    # Every meeting that produced output must be Hold-dominant at ~100%.
    seen_meetings = {r.meeting_date for r in results}
    assert seen_meetings, "no meetings produced — flat data must be solvable"
    for meeting in seen_meetings:
        by_label = {
            r.outcome_label: r.probability for r in results if r.meeting_date == meeting
        }
        assert by_label["Hold"] == pytest.approx(1.0, abs=1e-6), (
            f"{meeting}: expected Hold~1.0, got {by_label}"
        )
        # No outcome other than Hold may carry meaningful mass (no sawtooth).
        for label, p in by_label.items():
            if label != "Hold":
                assert p == pytest.approx(0.0, abs=1e-6), f"{meeting} {label}={p}"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/data-pipeline && .venv/bin/python -m pytest tests/test_fed_fetcher.py::test_flat_futures_yield_hold_for_every_meeting -v`
Expected: FAIL — current code chains the tiny-tail solve and produces non-Hold mass on later meetings (e.g. an AssertionError on a `+25bp`/`-50bp` outcome being non-zero), or a `ZQ{m:02d}` symbol mismatch surfaces the lookup-by-`contract_month` path. (The rewrite in Step 3 keys off `contract_month`, not symbol, so the symbol string is irrelevant.)

- [ ] **Step 3: Write minimal implementation**

Replace the entire body of `compute_meeting_probabilities` in `services/data-pipeline/src/fed_fetcher.py` (the function spanning lines ~88-146) with:

```python
def compute_meeting_probabilities(
    meetings: list[date],
    contract_prices: list[ContractPrice],
    current_target_midpoint: float,
) -> list[MeetingProbability]:
    """For each upcoming meeting, compute probabilities of each possible outcome.

    Cross-contract solve (METHODOLOGY.md §10): each meeting's expected
    post-meeting rate is isolated using the contracts that bracket the meeting,
    rather than dividing a single month's average by a tiny post-meeting tail.

    - If the month AFTER the meeting holds no meeting, that next-month contract's
      implied average IS the post-meeting rate (identity — noise-stable).
    - Otherwise we solve within the meeting's own month, but refuse a tail too
      small to be numerically safe (`solve_post_meeting_rate_in_month`).
    - Solved rates are validated (`is_plausible_post_rate`); implausible or
      unsolvable meetings are flagged and skipped — never emitted as garbage.
    - `rate_before` for the next meeting is the *validated* post-rate, so a
      skipped/odd meeting never poisons its successors.
    """
    avg_by_month = {
        p.contract_month: implied_rate_from_price(p.price) for p in contract_prices
    }
    results: list[MeetingProbability] = []
    rate_before = current_target_midpoint

    for meeting in meetings:
        contract_month = date(meeting.year, meeting.month, 1)
        meeting_avg = avg_by_month.get(contract_month)
        if meeting_avg is None:
            logger.warning("No contract price for meeting %s — skipping", meeting)
            continue

        if meeting.month == 12:
            next_month = date(meeting.year + 1, 1, 1)
        else:
            next_month = date(meeting.year, meeting.month + 1, 1)

        expected_post_rate: float | None = None
        if not next_month_has_meeting(meeting, meetings):
            next_avg = avg_by_month.get(next_month)
            if next_avg is not None:
                expected_post_rate = post_rate_from_bracketing_contract(next_avg)

        if expected_post_rate is None:
            days_in_month = monthrange(meeting.year, meeting.month)[1]
            try:
                expected_post_rate = solve_post_meeting_rate_in_month(
                    observed_monthly_avg=meeting_avg,
                    rate_before_meeting=rate_before,
                    meeting_day=meeting.day,
                    days_in_month=days_in_month,
                )
            except ValueError as exc:
                logger.warning(
                    "Skipping %s — cannot solve post-meeting rate: %s", meeting, exc
                )
                continue

        if not is_plausible_post_rate(expected_post_rate, rate_before):
            logger.warning(
                "Skipping %s — implausible solved post-rate %.3f from %.3f",
                meeting,
                expected_post_rate,
                rate_before,
            )
            continue

        outcomes = outcomes_around(rate_before, bps_range=50)
        probs = decompose_probabilities(expected_post_rate, outcomes)

        for outcome, prob in zip(outcomes, probs, strict=True):
            results.append(
                MeetingProbability(
                    meeting_date=meeting,
                    outcome_label=outcome.label,
                    outcome_delta_bps=outcome.delta_bps,
                    probability=prob,
                    post_meeting_rate=outcome.post_meeting_rate,
                )
            )

        # Chain only the VALIDATED post-rate into the next meeting.
        rate_before = expected_post_rate

    return results
```

Update the import block at the top of `services/data-pipeline/src/fed_fetcher.py` to pull in the new primitives. Replace:

```python
from .probability_calc import (
    Outcome,
    decompose_probabilities,
    implied_rate_from_price,
    solve_post_meeting_rate,
)
```

with:

```python
from .probability_calc import (
    Outcome,
    decompose_probabilities,
    implied_rate_from_price,
    is_plausible_post_rate,
    post_rate_from_bracketing_contract,
    solve_post_meeting_rate_in_month,
)
```

(`solve_post_meeting_rate` is no longer used by `fed_fetcher` but remains exported from `probability_calc` for its existing direct unit tests — do not delete it.)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd services/data-pipeline && .venv/bin/python -m pytest tests/test_fed_fetcher.py::test_flat_futures_yield_hold_for_every_meeting -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/data-pipeline/src/fed_fetcher.py services/data-pipeline/tests/test_fed_fetcher.py
git commit -m "fix(pipeline): cross-contract meeting solve — flat futures give Hold, no sawtooth

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Regression test — the Jul-29 late-month meeting (the §10 case)

The specific case METHODOLOGY §10 calls out. With realistic near-flat data, the old single-contract solve turned a 1bp wobble into ~+28bp and seeded the sawtooth. The cross-contract solve (August bracket) must give a sane, Hold-dominant July outcome.

**Files:**
- Test: `services/data-pipeline/tests/test_fed_fetcher.py`

- [ ] **Step 1: Write the failing test**

Append to `services/data-pipeline/tests/test_fed_fetcher.py`:

```python
def test_jul29_late_month_meeting_no_amplification():
    """METHODOLOGY §10 case: Jul-29 leaves only 2/31 of the month post-meeting.

    Near-flat data (July avg 3.620, August (no meeting) avg 3.620) must yield a
    Hold-dominant July, NOT the +28bp swing the single-contract solve produced.
    Expected via the August bracket: post-July = 3.620; with before=3.625 the
    two-point decomposition gives Hold~0.98, -25bp~0.02.
    """
    from src.fed_fetcher import compute_meeting_probabilities
    from src.fetchers.base import ContractPrice

    current = 3.625
    prices = [
        ContractPrice("ZQN26", date(2026, 7, 1), 100.0 - 3.620, date(2026, 6, 1)),
        ContractPrice("ZQQ26", date(2026, 8, 1), 100.0 - 3.620, date(2026, 6, 1)),
    ]
    meetings = [date(2026, 7, 29)]  # August has no meeting -> bracket identity
    results = compute_meeting_probabilities(meetings, prices, current)

    by_label = {r.outcome_label: r.probability for r in results}
    assert by_label["Hold"] == pytest.approx(0.98, abs=0.01)
    assert by_label["-25bp"] == pytest.approx(0.02, abs=0.01)
    # Crucially: no hike mass at all (the bug put 0.88 on +25bp here).
    assert by_label["+25bp"] == pytest.approx(0.0, abs=1e-9)
    assert by_label["+50bp"] == pytest.approx(0.0, abs=1e-9)
```

- [ ] **Step 2: Run test to verify it fails (before Task 5 is present) / passes (after)**

Run: `cd services/data-pipeline && .venv/bin/python -m pytest tests/test_fed_fetcher.py::test_jul29_late_month_meeting_no_amplification -v`
Expected: PASS (Task 5's rewrite already routes Jul-29 through the August bracket). If Task 5 is somehow not yet applied, this FAILs with `+25bp` carrying ~0.88 — that failure is the bug, and Task 5 fixes it. This task adds the explicit §10 regression lock.

- [ ] **Step 3: (no new implementation — this is a regression lock on Task 5)**

No code change. If Step 2 failed, the cause is Task 5 not being applied correctly; re-apply Task 5 Step 3 verbatim.

- [ ] **Step 4: Re-run to confirm PASS**

Run: `cd services/data-pipeline && .venv/bin/python -m pytest tests/test_fed_fetcher.py::test_jul29_late_month_meeting_no_amplification -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/data-pipeline/tests/test_fed_fetcher.py
git commit -m "test(pipeline): lock Jul-29 late-month §10 regression (no +28bp amplification)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Genuine-easing scenario — smooth cut-skewed distribution

Proves the engine produces a *smooth, plausible* easing path (not just flat). Numbers are pre-computed from the actual decomposition; each meeting is centered on the prior validated post-rate.

**Files:**
- Test: `services/data-pipeline/tests/test_fed_fetcher.py`

- [ ] **Step 1: Write the failing test**

Append to `services/data-pipeline/tests/test_fed_fetcher.py`:

```python
def test_easing_scenario_smooth_cut_skew():
    """A genuine easing curve gives a smooth, cut-skewed distribution across all
    meetings — partial -25bp probability + dominant Hold, monotonically falling
    post-rates, NO 100% spikes and NO sign-flipping.

    Bracketing months Aug (after Jul) and Nov (after Oct) carry the post rates of
    the preceding meeting; meeting-month contract averages are pre-computed from
    avg = pre_w*before + post_w*after with the easing path below.
    """
    from src.fed_fetcher import compute_meeting_probabilities
    from src.fetchers.base import ContractPrice

    current = 3.625
    # (contract_month, implied monthly-average) — derived from the easing path
    # post = {Jun:3.560, Jul:3.500, Sep:3.430, Oct:3.370, Dec:3.310}
    avgs = {
        (2026, 6): 3.5968,   # Jun-17 meeting month
        (2026, 7): 3.5561,   # Jul-29 meeting month
        (2026, 8): 3.500,    # Aug bracket = post-Jul rate
        (2026, 9): 3.4673,   # Sep-16 meeting month
        (2026, 10): 3.4242,  # Oct-28 meeting month
        (2026, 11): 3.370,   # Nov bracket = post-Oct rate
        (2026, 12): 3.3274,  # Dec-09 meeting month
    }
    prices = [
        ContractPrice(
            symbol=f"ZQ{m:02d}{y % 100}",
            contract_month=date(y, m, 1),
            price=100.0 - avg,
            as_of=date(2026, 6, 1),
        )
        for (y, m), avg in avgs.items()
    ]
    meetings = [
        date(2026, 6, 17),
        date(2026, 7, 29),
        date(2026, 9, 16),
        date(2026, 10, 28),
        date(2026, 12, 9),
    ]
    results = compute_meeting_probabilities(meetings, prices, current)

    # All five meetings produce output.
    seen = sorted({r.meeting_date for r in results})
    assert seen == meetings

    # Per-meeting expected (Hold, -25bp) splits — smooth, cut-skewed, no spikes.
    expected = {
        date(2026, 6, 17): (0.74, 0.26),
        date(2026, 7, 29): (0.98, 0.02),  # Jul via Aug bracket (post=3.500 vs before=3.560 -> -6bp)
        date(2026, 9, 16): (0.72, 0.28),
        date(2026, 10, 28): (0.98, 0.02),  # Oct via Nov bracket (post=3.370 vs before=3.430 -> -6bp)
        date(2026, 12, 9): (0.76, 0.24),
    }
    for meeting, (exp_hold, exp_cut) in expected.items():
        by_label = {
            r.outcome_label: r.probability for r in results if r.meeting_date == meeting
        }
        assert sum(by_label.values()) == pytest.approx(1.0)
        assert by_label["Hold"] == pytest.approx(exp_hold, abs=0.02), f"{meeting} {by_label}"
        assert by_label["-25bp"] == pytest.approx(exp_cut, abs=0.02), f"{meeting} {by_label}"
        # Cut-skew: never any hike mass.
        assert by_label["+25bp"] == pytest.approx(0.0, abs=1e-9)
        assert by_label["+50bp"] == pytest.approx(0.0, abs=1e-9)
        # No 100% spike anywhere.
        assert max(by_label.values()) < 0.999, f"{meeting} spiked: {by_label}"
```

Note on the Jul/Oct expectations: those meetings are bracketed by a no-meeting month (Aug / Nov), so their post-rate comes from the *bracket identity* (`3.500` / `3.370`), and the outcome set is centered on the chained pre-rate (`3.560` / `3.430`). That yields a −6bp expected move → Hold≈0.98 — intentionally gentler than the mid-month meetings, which is correct: the bracket isolates exactly that meeting's move. The non-bracketed meetings (Jun, Sep, Dec — next month also has a meeting) go through the guarded in-month solve and show the fuller ~26-28% cut probability.

- [ ] **Step 2: Run test to verify it passes**

Run: `cd services/data-pipeline && .venv/bin/python -m pytest tests/test_fed_fetcher.py::test_easing_scenario_smooth_cut_skew -v`
Expected: PASS (Task 5's implementation handles this; this test pins the exact smooth distribution).

If it FAILs on the Jun/Sep/Dec in-month solve because the `min_post_weight` guard (0.20) rejects a mid-month meeting, check the post-weights: Jun-17/30 → 0.433, Sep-16/30 → 0.467, Dec-09/31 → 0.710 — all comfortably above 0.20, so they must solve. A failure here means the guard threshold or the solve algebra was altered from Task 2.

- [ ] **Step 3: (no new implementation — regression lock on Task 5)**

No code change.

- [ ] **Step 4: Confirm PASS**

Run: `cd services/data-pipeline && .venv/bin/python -m pytest tests/test_fed_fetcher.py::test_easing_scenario_smooth_cut_skew -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/data-pipeline/tests/test_fed_fetcher.py
git commit -m "test(pipeline): lock smooth cut-skewed easing distribution

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: Skip/flag path — unbracketed late-month meeting with no usable contract

Proves "un-solvable meetings → flag/skip, never emit garbage" and that a skip does not poison successors. A late-month meeting whose next month also has a meeting (so no bracket identity) AND whose own tail is too small must be skipped — and a later, solvable meeting must still be emitted.

**Files:**
- Test: `services/data-pipeline/tests/test_fed_fetcher.py`

- [ ] **Step 1: Write the failing test**

Append to `services/data-pipeline/tests/test_fed_fetcher.py`:

```python
def test_unbracketed_late_month_meeting_is_skipped_not_garbage(caplog):
    """A late-month meeting with a meeting in the very next month (no bracket
    identity) and a tail too small to solve must be SKIPPED with a warning, and
    must NOT emit any outcome rows. A solvable later meeting is unaffected."""
    import logging

    from src.fed_fetcher import compute_meeting_probabilities
    from src.fetchers.base import ContractPrice

    current = 3.625
    # Two consecutive-month meetings: Jul-30 (tail 1/31) then Aug-12 (mid-month).
    # July's next month (Aug) HAS a meeting -> no bracket identity for July.
    # July tail = 1/31 ~ 0.032 < 0.20 -> in-month solve refuses -> SKIP July.
    prices = [
        ContractPrice("ZQN26", date(2026, 7, 1), 100.0 - 3.620, date(2026, 6, 1)),
        ContractPrice("ZQQ26", date(2026, 8, 1), 100.0 - 3.610, date(2026, 6, 1)),
        ContractPrice("ZQU26", date(2026, 9, 1), 100.0 - 3.610, date(2026, 6, 1)),
    ]
    meetings = [date(2026, 7, 30), date(2026, 8, 12)]
    with caplog.at_level(logging.WARNING):
        results = compute_meeting_probabilities(meetings, prices, current)

    # July-30 produced NO rows (skipped, not garbage).
    assert all(r.meeting_date != date(2026, 7, 30) for r in results)
    assert "Skipping 2026-07-30" in caplog.text

    # Aug-12 IS solvable (Sep is a no-meeting month -> bracket identity = 3.610),
    # so it still produces a full outcome set centered on `current` (the skipped
    # July meeting did NOT advance rate_before).
    aug = {r.outcome_label: r.probability for r in results if r.meeting_date == date(2026, 8, 12)}
    assert aug, "Aug-12 should still be emitted despite July being skipped"
    assert sum(aug.values()) == pytest.approx(1.0)
    # post-Aug = 3.610 vs before = 3.625 (current, since July skipped) -> -1.5bp.
    assert aug["Hold"] == pytest.approx(0.94, abs=0.02)
    assert aug["-25bp"] == pytest.approx(0.06, abs=0.02)
```

- [ ] **Step 2: Run test to verify it passes**

Run: `cd services/data-pipeline && .venv/bin/python -m pytest tests/test_fed_fetcher.py::test_unbracketed_late_month_meeting_is_skipped_not_garbage -v`
Expected: PASS (Task 5 already implements skip + non-poisoning chain; this pins the behavior).

Derivation check for the Aug assertion: Aug-12 next month is Sep, which has no meeting, so post-Aug = Sep avg = 3.610. before = 3.625 (July was skipped, so `rate_before` was never advanced). Outcomes centered on 3.625: Hold @ 3.625, −25bp @ 3.375. E = 3.610 → p(−25bp) = (3.625 − 3.610)/0.25 = 0.06, p(Hold) = 0.94.

- [ ] **Step 3: (no new implementation — regression lock on Task 5)**

No code change.

- [ ] **Step 4: Confirm PASS**

Run: `cd services/data-pipeline && .venv/bin/python -m pytest tests/test_fed_fetcher.py::test_unbracketed_late_month_meeting_is_skipped_not_garbage -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/data-pipeline/tests/test_fed_fetcher.py
git commit -m "test(pipeline): lock skip-not-garbage path for unbracketable late-month meeting

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 9: Update the two pre-existing fed_fetcher tests that assumed the old chaining

The existing `test_compute_meeting_probabilities_with_mock_data` and `test_run_fed_fetch_end_to_end_mock` were written against the single-contract solve. The mock fixture (`mock_source.py`) has contracts for May-Dec 2026, and the FED 2026 calendar's meeting months are Jan, Mar, Apr, Jun, Jul, Sep, Oct, Dec. Under the new bracketing logic, June's next month (July) HAS a meeting, so June goes through the in-month solve; July's next month (Aug) has no meeting → bracket identity. We must re-pin these to the new (correct) behavior rather than the old.

**Files:**
- Modify: `services/data-pipeline/tests/test_fed_fetcher.py` (the existing `test_compute_meeting_probabilities_with_mock_data` and `test_run_fed_fetch_end_to_end_mock`)

- [ ] **Step 1: Run the existing tests to see which assertions break**

Run: `cd services/data-pipeline && .venv/bin/python -m pytest tests/test_fed_fetcher.py::test_compute_meeting_probabilities_with_mock_data tests/test_fed_fetcher.py::test_run_fed_fetch_end_to_end_mock -v`
Expected: the `len(probs) == 5 * 3` assertion in the first test may FAIL if a meeting is now skipped, and the `nonzero ⊆ {-25bp, Hold, -50bp}` assertion may shift. Capture the actual output to set correct expectations.

- [ ] **Step 2: Re-pin `test_compute_meeting_probabilities_with_mock_data`**

The fixture meetings are `[date(2026, 6, 17), date(2026, 7, 29), date(2026, 9, 16)]`. Under bracketing (all numbers below are exact — recomputed from the formulas, do not round differently):
- Jun-17: next month July has a meeting → in-month solve. Jun avg = 100 − 95.685 = 4.315; before 4.375; pre_w 17/30, post_w 13/30; post = (4.315 − (17/30)(4.375))/(13/30) = 4.2365. plausible. Centered on 4.375: E=4.2365 → between −25bp(4.125) and Hold(4.375): p(−25)=(4.375−4.2365)/0.25=0.5538, p(Hold)=0.4462.
- Jul-29: next month Aug has no meeting → bracket identity = Aug avg = 100 − 95.870 = 4.130. before = 4.2365 (chained from June). Centered on 4.2365: outcomes −25bp @ 3.9865, Hold @ 4.2365. E=4.130 → p(−25)=(4.2365−4.130)/0.25=0.4262, p(Hold)=0.5738.
- Sep-16: next month Oct — Oct has a meeting (Oct-28) → in-month solve. Sep avg = 100 − 95.985 = 4.015; before = 4.130 (chained from July's bracket); pre_w 16/30, post_w 14/30; post = (4.015 − (16/30)(4.130))/(14/30) = 3.8836. plausible (|3.8836 − 4.130| = 24.6 bp < 75). Centered on 4.130: −25bp @ 3.880, Hold @ 4.130. E=3.8836 → p(−25)=(4.130−3.8836)/0.25=0.9857, p(Hold)=0.0143 — a near-full cut, because the chained pre-rate (4.130) already reflects July's easing.

Replace the body of `test_compute_meeting_probabilities_with_mock_data` (keep the sum-to-1 and range sanity, fix the specific assertions) with:

```python
def test_compute_meeting_probabilities_with_mock_data():
    """Full path under the cross-contract solve: mock prices -> per-outcome probs."""
    meetings = [date(2026, 6, 17), date(2026, 7, 29), date(2026, 9, 16)]
    fetcher = MockFetcher()
    # Need bracketing months too: Aug (for Jul) is in the mock; pull all covered.
    contracts = ["ZQM26", "ZQN26", "ZQQ26", "ZQU26", "ZQV26"]
    prices = fetcher.fetch(contracts)

    current_midpoint = 4.375
    probs = compute_meeting_probabilities(meetings, prices, current_midpoint)

    # All three meetings solve (none skipped) -> 5 outcomes each.
    assert len({p.meeting_date for p in probs}) == 3
    assert len(probs) == 5 * 3

    for meeting in meetings:
        meeting_probs = [p.probability for p in probs if p.meeting_date == meeting]
        assert len(meeting_probs) == 5
        assert sum(meeting_probs) == pytest.approx(1.0)

    june = {p.outcome_label: p.probability for p in probs if p.meeting_date == date(2026, 6, 17)}
    assert june["-25bp"] == pytest.approx(0.5538, abs=0.01)
    assert june["Hold"] == pytest.approx(0.4462, abs=0.01)
    assert june["+25bp"] == pytest.approx(0.0, abs=1e-9)  # cut-skew, no hikes

    july = {p.outcome_label: p.probability for p in probs if p.meeting_date == date(2026, 7, 29)}
    assert july["-25bp"] == pytest.approx(0.4262, abs=0.01)
    assert july["Hold"] == pytest.approx(0.5738, abs=0.01)
    assert july["+25bp"] == pytest.approx(0.0, abs=1e-9)
```

- [ ] **Step 3: Re-pin `test_run_fed_fetch_end_to_end_mock`**

The mock lacks bracketing contracts for some late meetings (e.g. Dec-09's next month is Jan-2027 with no `ZQF27` in the mock → bracket identity unavailable → falls to in-month solve; Dec-09/31 tail = 0.710 → solves fine). The robust, behavior-stable assertions: results non-empty, every probability in [0,1], every meeting's outcomes sum to ~1, and NO meeting is a 100% spike on a hike (sawtooth guard). Replace the body with:

```python
def test_run_fed_fetch_end_to_end_mock():
    """Top-level orchestrator runs on mock data and never produces a sawtooth."""
    fetcher = MockFetcher()
    results = run_fed_fetch(fetcher=fetcher, current_target_midpoint=4.375, year=2026)
    assert len(results) > 0
    for r in results:
        assert 0.0 <= r.probability <= 1.0

    # Each emitted meeting sums to ~1 and is never a 100% hike spike.
    for meeting in {r.meeting_date for r in results}:
        by_label = {r.outcome_label: r.probability for r in results if r.meeting_date == meeting}
        assert sum(by_label.values()) == pytest.approx(1.0)
        assert by_label.get("+50bp", 0.0) < 0.999, f"{meeting} hike-spiked: {by_label}"
        assert by_label.get("+25bp", 0.0) < 0.999, f"{meeting} hike-spiked: {by_label}"
```

- [ ] **Step 4: Run both updated tests**

Run: `cd services/data-pipeline && .venv/bin/python -m pytest tests/test_fed_fetcher.py::test_compute_meeting_probabilities_with_mock_data tests/test_fed_fetcher.py::test_run_fed_fetch_end_to_end_mock -v`
Expected: PASS (2 passed). If June/July numbers are off, re-derive with the exact mock prices in `mock_source.py` (`ZQM26=95.685`, `ZQN26=95.810`, `ZQQ26=95.870`, `ZQU26=95.985`) — note the **in-month** July path is not used; July uses the **Aug bracket** (`ZQQ26 → 4.130`).

- [ ] **Step 5: Commit**

```bash
git add services/data-pipeline/tests/test_fed_fetcher.py
git commit -m "test(pipeline): re-pin mock fed tests to cross-contract behavior

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 10: Fix the stale `--current-rate` FED default

`main.py` defaults FED to `4.375` (the spec: real Fed mid is `3.625`, range 3.50-3.75 since 2026-04-29). Per the spec, make it dynamic or explicitly required. We make FED require an explicit rate — via `--current-rate` or the `RR_FED_CURRENT_RATE` env var — and remove the stale literal. ECB keeps its default (out of scope here).

**Files:**
- Modify: `services/data-pipeline/src/main.py`
- Create: `services/data-pipeline/tests/test_main_current_rate.py`

- [ ] **Step 1: Write the failing test**

Create `services/data-pipeline/tests/test_main_current_rate.py`:

```python
"""Tests for the FED --current-rate requirement (no stale 4.375 default)."""

from __future__ import annotations

import pytest

from src.main import resolve_current_rate


def test_fed_current_rate_from_cli_arg():
    assert resolve_current_rate(bank="fed", cli_value=3.625, env=None) == pytest.approx(3.625)


def test_fed_current_rate_from_env_when_cli_absent(monkeypatch):
    assert resolve_current_rate(bank="fed", cli_value=None, env="3.625") == pytest.approx(3.625)


def test_fed_current_rate_required_when_missing():
    # No CLI, no env -> hard error. The old silent 4.375 default is gone.
    with pytest.raises(SystemExit):
        resolve_current_rate(bank="fed", cli_value=None, env=None)


def test_fed_has_no_stale_default():
    # Guard: the 4.375 literal must not be the FED fallback anymore.
    from src import main

    assert main.DEFAULT_RATES.get("fed") != 4.375


def test_ecb_default_still_applies():
    assert resolve_current_rate(bank="ecb", cli_value=None, env=None) == pytest.approx(2.00)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/data-pipeline && .venv/bin/python -m pytest tests/test_main_current_rate.py -v`
Expected: FAIL — `ImportError: cannot import name 'resolve_current_rate'` (and the stale-default guard fails because `DEFAULT_RATES["fed"]` is still `4.375`).

- [ ] **Step 3: Write minimal implementation**

In `services/data-pipeline/src/main.py`:

1. Replace the `DEFAULT_RATES` dict (remove the FED entry):

```python
DEFAULT_RATES = {
    "ecb": 2.00,
}
```

2. Add the resolver (place it just after `DEFAULT_RATES`):

```python
def resolve_current_rate(
    bank: str, cli_value: float | None, env: str | None
) -> float:
    """Resolve the current policy-rate midpoint.

    FED has no hard-coded default (the old 4.375 went stale — the real Fed mid
    is 3.625 since 2026-04-29). FED must be given explicitly via --current-rate
    or the RR_FED_CURRENT_RATE env var. ECB keeps its documented default.
    """
    if cli_value is not None:
        return cli_value
    if bank == "fed":
        if env is not None:
            return float(env)
        print(
            "[--current-rate is required for FED (no stale default). Pass "
            "--current-rate 3.625 or set RR_FED_CURRENT_RATE. Real Fed mid is "
            "3.625 / range 3.50-3.75 since 2026-04-29.]",
            file=sys.stderr,
        )
        raise SystemExit(2)
    return DEFAULT_RATES[bank]
```

3. In `main()`, replace the current-rate resolution line:

```python
    current_rate = args.current_rate if args.current_rate is not None else DEFAULT_RATES[args.bank]
```

with:

```python
    import os

    current_rate = resolve_current_rate(
        bank=args.bank,
        cli_value=args.current_rate,
        env=os.environ.get("RR_FED_CURRENT_RATE"),
    )
```

4. Update the `--current-rate` help text (it currently claims a FED default):

```python
    parser.add_argument(
        "--current-rate",
        type=float,
        default=None,
        help="Current policy-rate midpoint, percent. REQUIRED for FED "
        "(or set RR_FED_CURRENT_RATE); ECB defaults to 2.00%%.",
    )
```

(The `import os` already exists later inside the `--write` branch; the new top-level `import os` in Step 3.3 is harmless but to keep ruff happy, leave the existing one inside the `--write` block as-is — Python allows the re-import. If ruff F811/redefinition complains, delete the `import os` inside the `--write` block since the top-level one now covers it.)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd services/data-pipeline && .venv/bin/python -m pytest tests/test_main_current_rate.py -v`
Expected: PASS (5 passed).

- [ ] **Step 5: Commit**

```bash
git add services/data-pipeline/src/main.py services/data-pipeline/tests/test_main_current_rate.py
git commit -m "fix(pipeline): require explicit FED --current-rate, drop stale 4.375 default

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 11: Update METHODOLOGY §10 + bump methodology version (same change)

`CLAUDE.md`: "When changing the calculation, update the methodology doc in the same PR and bump the version." §10 currently describes this as an unimplemented "MVP scaffold / planned fix" — rewrite it to describe the shipped cross-contract solve.

**Files:**
- Modify: `docs/METHODOLOGY.md` (§10 body + §11 changelog)
- Modify: `services/data-pipeline/src/main.py` (`METHODOLOGY_VERSION`)

- [ ] **Step 1: Bump the methodology version constant**

In `services/data-pipeline/src/main.py`, change:

```python
METHODOLOGY_VERSION = "1.0.0"
```

to:

```python
METHODOLOGY_VERSION = "1.1.0"
```

- [ ] **Step 2: Rewrite §10 of `docs/METHODOLOGY.md`**

Replace the entire §10 block (the heading `## 10. Known limitations (MVP scaffold, pre-production)` through the end of its body, up to but not including `## 11. Changelog`) with:

```markdown
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
```

- [ ] **Step 3: Add the §11 changelog entry**

In `docs/METHODOLOGY.md` §11, add a new bullet directly above the `**v0.1**` line:

```markdown
- **v1.1.0** — Fed post-meeting-rate solve rewritten from single-contract to
  cross-contract bracketing (§10): the month after a meeting (when meeting-free)
  yields the post-meeting rate directly; consecutive-month meetings use a
  noise-guarded in-month solve; solved rates are validated and implausible /
  unbracketable meetings are flagged and skipped instead of emitting degenerate
  100% alternating outcomes. Fixes the late-month-meeting noise amplification.
```

- [ ] **Step 4: Verify the version constant and doc agree**

Run: `cd services/data-pipeline && .venv/bin/python -c "from src.main import METHODOLOGY_VERSION; print(METHODOLOGY_VERSION)"`
Expected: prints `1.1.0`.
Then confirm `docs/METHODOLOGY.md` §11 contains a `v1.1.0` bullet and §10 no longer says "MVP scaffold".

Run: `grep -n "MVP scaffold" docs/METHODOLOGY.md || echo "OK: MVP-scaffold language removed"`
Expected: `OK: MVP-scaffold language removed`.

- [ ] **Step 5: Commit**

```bash
git add docs/METHODOLOGY.md services/data-pipeline/src/main.py
git commit -m "docs(methodology): rewrite §10 for cross-contract solve, bump to v1.1.0

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 12: Full suite + lint/format gate

Everything must be green and `black`/`ruff` clean before the real-data verify.

**Files:**
- (no edits unless lint/format requires them)

- [ ] **Step 1: Run the full pipeline test suite**

Run: `cd services/data-pipeline && .venv/bin/python -m pytest -q`
Expected: all tests pass (the pre-existing `test_diff_engine`, `test_ecb_fetcher`, `test_json_writer`, `test_main_db_resilience`, `test_supabase_writer`, `test_probability_calc`, `test_fed_fetcher`, plus the new `test_main_current_rate`). 0 failures.

- [ ] **Step 2: Format check**

Run: `cd services/data-pipeline && .venv/bin/python -m black --check src tests`
Expected: "All done!" / no files reformatted. If it reports files, run `.venv/bin/python -m black src tests` and re-commit in Step 4.

- [ ] **Step 3: Lint**

Run: `cd services/data-pipeline && .venv/bin/python -m ruff check src tests`
Expected: "All checks passed!". Fix any reported issue (most likely an unused import of `solve_post_meeting_rate` if you accidentally removed its last test reference — it is still used by `test_probability_calc.py`, so keep the export; or a duplicate `import os` in `main.py` per Task 10 note).

- [ ] **Step 4: Commit any formatting/lint fixups**

```bash
git add -A services/data-pipeline
git commit -m "chore(pipeline): black + ruff clean for §10 rewrite

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

(If Steps 2-3 were already clean, skip this commit.)

---

## Task 13: Verify — real yfinance run gives smooth, plausible distributions across ALL meetings

The end-to-end proof on live free data. This is the spec's Phase 1 verify gate.

**Files:**
- (no edits — this is a runtime verification)

- [ ] **Step 1: Create the Python 3.11 venv (if not already present)**

Run:
```bash
cd services/data-pipeline && /opt/homebrew/bin/python3.11 -m venv .venv && .venv/bin/pip install --quiet yfinance pandas numpy pyyaml requests tenacity
```
Expected: venv created, deps installed, no error. (If `/opt/homebrew/bin/python3.11` is absent, use any `python3.11`; the repo requires ≥3.11.)

- [ ] **Step 2: Run the FED pipeline on real yfinance data**

Run:
```bash
cd services/data-pipeline && .venv/bin/python -m src.main --bank fed --year 2026 --source yfinance --current-rate 3.625
```
Expected: prints a per-meeting probability table for the upcoming FOMC meetings.

- [ ] **Step 3: Assert the output is smooth and plausible (manual + scripted check)**

Inspect the printed table and confirm:
- **No 100% alternating sawtooth.** No meeting shows ~100% on `+50bp` immediately after ~100% on `-50bp` (the old failure mode).
- **No implausible spikes.** Each meeting's mass sits on Hold and the adjacent cut/hike, consistent with a near-flat-to-easing 2026 Fed path; post-rates do not jump >75bp meeting-to-meeting.
- **All upcoming meetings present** (the remaining 2026 FOMC dates that have tradable contracts) — or any skipped meeting is accompanied by a `Skipping <date> …` warning explaining why (no silent garbage).

Optional scripted guard (run from `services/data-pipeline`):
```bash
.venv/bin/python - <<'PY'
from datetime import date
from src.fed_fetcher import run_fed_fetch
from src.fetchers.yfinance_source import YFinanceFetcher

rows = run_fed_fetch(fetcher=YFinanceFetcher(), current_target_midpoint=3.625, year=2026)
by_meeting = {}
for r in rows:
    by_meeting.setdefault(r.meeting_date, {})[r.outcome_label] = r.probability

prev_spike = None
for meeting in sorted(by_meeting):
    probs = by_meeting[meeting]
    total = sum(probs.values())
    assert abs(total - 1.0) < 1e-6, f"{meeting} sums to {total}"
    dom = max(probs, key=probs.get)
    spike = probs[dom] > 0.999
    # No two consecutive 100% spikes on opposite-sign extremes (the sawtooth).
    if spike and prev_spike and {dom, prev_spike} == {"+50bp", "-50bp"}:
        raise SystemExit(f"SAWTOOTH at {meeting}: {dom} after {prev_spike}")
    prev_spike = dom if spike else None
    print(meeting, {k: round(v, 3) for k, v in probs.items() if v > 1e-6})
print("OK: no sawtooth, all meetings sum to 1.0")
PY
```
Expected: prints each meeting's distribution and `OK: no sawtooth, all meetings sum to 1.0`. (If yfinance rate-limits, re-run after a minute; the fetcher already retries with backoff. yfinance flakiness is a known CI risk per the spec — a transient empty fetch is acceptable for this manual gate as long as a successful run shows clean distributions.)

- [ ] **Step 4: Record the verified output**

Paste the printed distribution table into the PR description as evidence that Phase 1's success criterion ("a real yfinance run yields smooth, plausible distributions across ALL upcoming FOMC meetings — no 100% alternating") is met. No commit needed.

---

## Self-Review (run after all tasks)

**1. Spec coverage** (against `2026-06-02-...-design.md` Phase 1):
- Cross-contract solve isolating each meeting's post-rate → Tasks 1, 2, 4, 5. ✓
- Un-solvable meetings flagged/skipped, never garbage → Tasks 3, 5, 8. ✓
- TDD with §10 late-month regression + chained-meeting case → Tasks 5, 6, 7, 8. ✓
- `probability_calc.py` stays pure (no I/O added) → Tasks 1-3 add only pure functions. ✓
- Update METHODOLOGY §10 + bump version in same change → Task 11. ✓
- Fix stale `--current-rate` default (its own task) → Task 10. ✓
- Real yfinance verify across all meetings → Task 13. ✓
- No paid deps / no scraping → only stdlib + already-present libs used. ✓

**2. Placeholder scan:** No "TBD"/"add error handling"/bare "write tests" — every code step has complete code and every command has expected output. ✓

**3. Type/name consistency:** `post_rate_from_bracketing_contract`, `solve_post_meeting_rate_in_month`, `is_plausible_post_rate`, `next_month_has_meeting`, `resolve_current_rate` are defined once and referenced with identical signatures everywhere. `MeetingProbability` fields unchanged. `METHODOLOGY_VERSION` bumped consistently in code (Task 11 Step 1) and doc (Task 11 Steps 2-3). ✓

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-06-02-fed-methodology-section-10.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
