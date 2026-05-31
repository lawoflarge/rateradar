"use client";

import { useState } from "react";

import { ImpliedRateCurve } from "@/components/ImpliedRateCurve";
import { buildConditional } from "@/lib/scenario";
import { CURRENT_POLICY_RATES } from "@/lib/policy-rates";
import type { BankCode, MeetingProbabilities } from "@/lib/types";

interface Props {
  fed: MeetingProbabilities[];
  ecb: MeetingProbabilities[];
}

function formatMeeting(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function ScenarioBuilder({ fed, ecb }: Props) {
  const [bank, setBank] = useState<BankCode>("FED");
  const [meetingId, setMeetingId] = useState<string>(fed[0]?.meeting.id ?? "");
  const [outcomeId, setOutcomeId] = useState<string>(
    fed[0]?.outcomes[0]?.id ?? "",
  );

  const snapshots = bank === "FED" ? fed : ecb;
  const ecbAvailable = ecb.length > 0;

  // Resolve the active selection defensively — fall back to the first
  // meeting/outcome of the current bank if the stored id is stale (e.g. just
  // after switching banks).
  const activeMeeting =
    snapshots.find((s) => s.meeting.id === meetingId) ?? snapshots[0];
  const activeOutcome =
    activeMeeting?.outcomes.find((o) => o.id === outcomeId) ??
    activeMeeting?.outcomes[0];

  const conditional =
    activeMeeting && activeOutcome
      ? buildConditional(snapshots, activeMeeting.meeting.id, activeOutcome.id)
      : null;

  const bankLabel = bank === "FED" ? "Federal Reserve" : "European Central Bank";

  function selectBank(next: BankCode) {
    if (next === "ECB" && !ecbAvailable) return;
    setBank(next);
    const list = next === "FED" ? fed : ecb;
    setMeetingId(list[0]?.meeting.id ?? "");
    setOutcomeId(list[0]?.outcomes[0]?.id ?? "");
  }

  function selectMeeting(id: string) {
    setMeetingId(id);
    const m = snapshots.find((s) => s.meeting.id === id);
    setOutcomeId(m?.outcomes[0]?.id ?? "");
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Bank toggle */}
      <div className="flex gap-2">
        {(["FED", "ECB"] as BankCode[]).map((b) => {
          const disabled = b === "ECB" && !ecbAvailable;
          const active = b === bank;
          return (
            <button
              key={b}
              type="button"
              disabled={disabled}
              onClick={() => selectBank(b)}
              className={`border px-3 py-1.5 font-mono text-xs uppercase tracking-wider transition-colors ${
                active
                  ? "border-cut text-cut"
                  : "border-ink/15 text-ink-mute hover:border-cut/40 hover:text-ink"
              } ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
            >
              {b === "FED" ? "Fed" : "ECB"}
            </button>
          );
        })}
      </div>

      {snapshots.length === 0 ? (
        <p className="text-sm text-ink-mute">No meetings available for this bank yet.</p>
      ) : (
        <>
          {/* Meeting selector */}
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[11px] uppercase tracking-wider text-ink-mute">
              Condition on meeting
            </span>
            <select
              value={activeMeeting?.meeting.id ?? ""}
              onChange={(e) => selectMeeting(e.target.value)}
              className="border border-ink/15 bg-cream px-3 py-2 text-sm text-ink"
            >
              {snapshots.map((s) => (
                <option key={s.meeting.id} value={s.meeting.id}>
                  {formatMeeting(s.meeting.meeting_date)}
                </option>
              ))}
            </select>
          </label>

          {/* Outcome chips */}
          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-[11px] uppercase tracking-wider text-ink-mute">
              …resolves to
            </span>
            <div className="flex flex-wrap gap-2">
              {activeMeeting?.outcomes.map((o) => {
                const active = o.id === activeOutcome?.id;
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setOutcomeId(o.id)}
                    className={`border px-2.5 py-1 font-mono text-xs transition-colors ${
                      active
                        ? "border-cut text-cut"
                        : "border-ink/15 text-ink-mute hover:border-cut/40 hover:text-ink"
                    }`}
                  >
                    {o.label} · {(o.probability * 100).toFixed(0)}%
                  </button>
                );
              })}
            </div>
          </div>

          {/* Disclaimer */}
          <p className="border-l-2 border-cut/40 bg-cream-soft px-3 py-2 text-xs text-ink-mute">
            What-if scenario. Assumes the subsequent meetings&apos; market-implied
            distributions are <strong>unchanged</strong> (independence) and re-anchors
            the path on the selected outcome. This is not a forecast.
          </p>

          {/* Baseline curve */}
          <div className="flex flex-col gap-2">
            <span className="font-mono text-[11px] uppercase tracking-wider text-ink-mute">
              Baseline (today&apos;s market path)
            </span>
            <ImpliedRateCurve
              snapshots={snapshots}
              startingRate={CURRENT_POLICY_RATES[bank]}
              bankLabel={bankLabel}
            />
          </div>

          {/* Conditional curve */}
          <div className="flex flex-col gap-2">
            <span className="font-mono text-[11px] uppercase tracking-wider text-cut">
              Conditional ({conditional?.anchorLabel ?? "—"})
            </span>
            {conditional ? (
              <ImpliedRateCurve
                snapshots={conditional.after}
                startingRate={conditional.startingRate}
                bankLabel={`${bankLabel} — if ${conditional.anchorLabel}`}
                anchorLabel={conditional.anchorLabel}
              />
            ) : (
              <p className="text-sm text-ink-mute">
                This is the last scheduled meeting — there is no subsequent path to
                project. Pick an earlier meeting.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
