"use client";

import { useCallback, useState } from "react";
import type { MeetingProbabilities } from "@/lib/types";

interface Props {
  data: MeetingProbabilities;
}

function toCsv(data: MeetingProbabilities): string {
  const rows = [
    "bank,meeting_date,outcome_label,delta_bps,probability,post_meeting_rate,snapshot_at",
  ];
  for (const o of data.outcomes) {
    rows.push(
      [
        data.meeting.bank_code,
        data.meeting.meeting_date,
        o.label,
        o.delta_bps,
        o.probability.toFixed(6),
        o.post_meeting_rate.toFixed(6),
        data.snapshot_at,
      ].join(","),
    );
  }
  return rows.join("\n") + "\n";
}

function trigger(filename: string, contents: string, mime: string) {
  const blob = new Blob([contents], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Small power-user affordance: download the current snapshot as CSV or JSON.
 * Renders in the per-meeting card. Encodes nothing the API doesn't already
 * expose at /api/<bank>/probabilities, so it's also free SEO bait for
 * "fed funds futures csv export".
 */
export function DownloadDataButton({ data }: Props) {
  const [open, setOpen] = useState(false);

  const bank = data.meeting.bank_code.toLowerCase();
  const date = data.meeting.meeting_date;
  const stem = `rateradar-${bank}-${date}`;

  const onCsv = useCallback(() => {
    trigger(`${stem}.csv`, toCsv(data), "text/csv");
    setOpen(false);
  }, [data, stem]);

  const onJson = useCallback(() => {
    trigger(`${stem}.json`, JSON.stringify(data, null, 2), "application/json");
    setOpen(false);
  }, [data, stem]);

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 border border-ink/15 bg-cream px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider text-ink-mute transition-colors hover:border-cut/40 hover:text-ink"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span aria-hidden>↓</span> Export
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-10 mt-1 flex w-32 flex-col border border-ink/15 bg-cream-soft text-xs shadow-sm"
        >
          <button
            type="button"
            role="menuitem"
            onClick={onCsv}
            className="px-3 py-2 text-left font-mono uppercase tracking-wider text-ink-mute hover:bg-cut/10 hover:text-ink"
          >
            CSV
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={onJson}
            className="px-3 py-2 text-left font-mono uppercase tracking-wider text-ink-mute hover:bg-cut/10 hover:text-ink"
          >
            JSON
          </button>
        </div>
      )}
    </div>
  );
}
