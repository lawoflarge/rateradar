"""Pure probability-calculation functions. No I/O, no side effects — fully testable.

Implements the step-function decomposition documented in `docs/METHODOLOGY.md`,
used to translate implied monthly-average rates (derived from Fed Funds Futures
or €STR OIS prices) into discrete outcome probabilities for each upcoming meeting.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Outcome:
    """A possible rate-change outcome for a meeting."""

    label: str  # e.g. "-25bp", "Hold", "+25bp"
    delta_bps: int  # 0 = hold, negative = cut, positive = hike
    post_meeting_rate: float  # target-midpoint after this outcome, in percent


def implied_rate_from_price(futures_price: float) -> float:
    """Convert a Fed Funds Futures contract price to its implied monthly-average rate.

    CME standard: implied_rate = 100 - price.
    Returns the rate in percent (e.g. 4.25 for 4.25%).
    """
    return 100.0 - futures_price


def monthly_avg_rate(
    rate_before_meeting: float,
    rate_after_meeting: float,
    meeting_day: int,
    days_in_month: int,
) -> float:
    """Compute the monthly-average rate given a single meeting in the month.

    The contract settles to the arithmetic average of daily effective rates.
    For a meeting on `meeting_day` of `days_in_month`:
      avg = (meeting_day / N) * rate_before + ((N - meeting_day) / N) * rate_after

    Note: the meeting_day convention here assumes the rate changes *after* the
    meeting's decision day — the effective rate on meeting_day itself is rate_before.
    """
    if days_in_month <= 0:
        raise ValueError(f"days_in_month must be > 0, got {days_in_month}")
    if not 0 <= meeting_day <= days_in_month:
        raise ValueError(f"meeting_day {meeting_day} out of range for month of {days_in_month}")
    pre_weight = meeting_day / days_in_month
    post_weight = (days_in_month - meeting_day) / days_in_month
    return pre_weight * rate_before_meeting + post_weight * rate_after_meeting


def solve_post_meeting_rate(
    observed_monthly_avg: float,
    rate_before_meeting: float,
    meeting_day: int,
    days_in_month: int,
) -> float:
    """Invert the monthly-average formula to solve for the post-meeting rate.

    Given the market's observed monthly-average rate (from futures price),
    the pre-meeting rate, and the meeting's position in the month, return
    the market-implied expected post-meeting rate.
    """
    if days_in_month <= 0:
        raise ValueError(f"days_in_month must be > 0, got {days_in_month}")
    if meeting_day == days_in_month:
        raise ValueError("meeting on last day of month — cannot solve for post-meeting rate")
    pre_weight = meeting_day / days_in_month
    post_weight = (days_in_month - meeting_day) / days_in_month
    return (observed_monthly_avg - pre_weight * rate_before_meeting) / post_weight


def decompose_probabilities(
    expected_post_rate: float,
    outcomes: list[Outcome],
) -> list[float]:
    """Decompose an expected post-meeting rate into probabilities over discrete outcomes.

    Uses linear interpolation over the two adjacent outcomes surrounding the
    expected rate. Outcomes outside the span receive probability zero.

    For a two-outcome case (Hold @ 4.50, Cut @ 4.25) with E[r] = 4.40:
      p_cut = (4.50 - 4.40) / (4.50 - 4.25) = 0.40
      p_hold = 0.60

    For three+ outcomes, we still use the two adjacent to E[r]; all others are 0.
    This matches CME's standard step-function decomposition.

    Probabilities are clamped to [0, 1] and re-normalized to sum to 1.
    """
    if not outcomes:
        raise ValueError("outcomes list is empty")
    if len(outcomes) == 1:
        return [1.0]

    # Sort by post-meeting rate ascending so adjacency is well-defined
    ranked = sorted(enumerate(outcomes), key=lambda pair: pair[1].post_meeting_rate)
    probs = [0.0] * len(outcomes)

    # Find the two outcomes surrounding the expected rate
    rates = [o.post_meeting_rate for _, o in ranked]

    if expected_post_rate <= rates[0]:
        probs[ranked[0][0]] = 1.0
    elif expected_post_rate >= rates[-1]:
        probs[ranked[-1][0]] = 1.0
    else:
        for i in range(len(ranked) - 1):
            lo_idx, lo = ranked[i]
            hi_idx, hi = ranked[i + 1]
            if lo.post_meeting_rate <= expected_post_rate <= hi.post_meeting_rate:
                span = hi.post_meeting_rate - lo.post_meeting_rate
                if span == 0:
                    probs[lo_idx] = 0.5
                    probs[hi_idx] = 0.5
                else:
                    hi_weight = (expected_post_rate - lo.post_meeting_rate) / span
                    lo_weight = 1.0 - hi_weight
                    probs[lo_idx] = lo_weight
                    probs[hi_idx] = hi_weight
                break

    # Clamp and renormalize (guards against floating-point noise)
    probs = [max(0.0, min(1.0, p)) for p in probs]
    total = sum(probs)
    if total > 0:
        probs = [p / total for p in probs]
    return probs


def post_rate_from_bracketing_contract(next_month_implied_avg: float) -> float:
    """Post-meeting rate when the *next* month holds no FOMC meeting.

    Per METHODOLOGY.md §10: if the month after a meeting contains no meeting,
    that month's contract settles to the (constant) post-meeting rate for the
    whole month, so its implied monthly-average equals the post-meeting rate
    directly. This avoids dividing the meeting-month's average by the tiny
    post-meeting weight (the late-month-meeting noise-amplification bug).
    """
    return next_month_implied_avg


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
        raise ValueError(f"meeting_day {meeting_day} out of range for month of {days_in_month}")
    post_weight = (days_in_month - meeting_day) / days_in_month
    if post_weight < min_post_weight:
        raise ValueError(
            f"post-meeting weight {post_weight:.4f} below minimum {min_post_weight} "
            f"(meeting_day={meeting_day}, days_in_month={days_in_month}); "
            "solve would amplify noise — use a bracketing contract or skip"
        )
    pre_weight = meeting_day / days_in_month
    return (observed_monthly_avg - pre_weight * rate_before_meeting) / post_weight


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
