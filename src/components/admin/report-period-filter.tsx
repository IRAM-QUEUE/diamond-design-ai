"use client";

import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resolveAdminReportRange, utcDateString, type AdminReportRange, type ReportPeriod } from "@/lib/admin-reporting";

export function ReportPeriodFilter({ range, onChange }: {
  range: AdminReportRange | null;
  onChange: (query: string) => void;
}) {
  const [period, setPeriod] = useState<ReportPeriod>("daily");
  const [from, setFrom] = useState(() => utcDateString(new Date()));
  const [to, setTo] = useState(() => utcDateString(new Date()));
  const [error, setError] = useState("");

  return (
    <section className="min-w-0 space-y-4 rounded-3xl border bg-card/70 p-4 sm:p-5" aria-label="Reporting timeframe">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 font-medium text-white"><CalendarDays className="h-4 w-4 text-diamond-champagne" />Insights timeframe</h2>
          <p className="mt-1 text-sm text-muted-foreground">Image activity, cost, latency, and top users share this range.</p>
        </div>
        <label className="flex shrink-0 items-center gap-3 text-sm text-muted-foreground">Timeframe
          <select
            aria-label="Insights timeframe"
            value={period}
            className="min-h-11 min-w-0 flex-1 rounded-xl border bg-background px-3 py-2 text-white sm:flex-none"
            onChange={(event) => {
              const next = event.target.value as ReportPeriod;
              setPeriod(next);
              setError("");
              if (next === "custom") {
                if (range) { setFrom(range.from); setTo(range.to); }
              } else {
                onChange(new URLSearchParams({ period: next }).toString());
              }
            }}
          >
            <option value="daily">Daily — Today</option>
            <option value="weekly">Weekly — This week</option>
            <option value="monthly">Monthly — This month</option>
            <option value="custom">Custom dates</option>
          </select>
        </label>
      </div>
      {period === "custom" ? (
        <form className="space-y-3" onSubmit={(event) => {
          event.preventDefault();
          try {
            const params = new URLSearchParams({ period: "custom", from, to });
            resolveAdminReportRange(params);
            setError("");
            onChange(params.toString());
          } catch (issue) {
            setError(issue instanceof Error ? issue.message : "Choose valid dates.");
          }
        }}>
          <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
            <label className="block min-w-0 space-y-2 text-sm text-muted-foreground">From
              <input required type="date" aria-label="From date" value={from} onChange={(event) => setFrom(event.target.value)} className="block min-h-11 w-full min-w-0 rounded-xl border bg-background px-3 py-2 text-white [color-scheme:dark]" />
            </label>
            <label className="block min-w-0 space-y-2 text-sm text-muted-foreground">To
              <input required type="date" aria-label="To date" value={to} onChange={(event) => setTo(event.target.value)} className="block min-h-11 w-full min-w-0 rounded-xl border bg-background px-3 py-2 text-white [color-scheme:dark]" />
            </label>
            <Button type="submit" className="min-h-11">Apply dates</Button>
          </div>
          <p className="text-xs text-muted-foreground">Choose dates and select Apply dates to update the report. Both dates are included.</p>
          {error ? <p role="alert" className="text-sm text-destructive-foreground">{error}</p> : null}
        </form>
      ) : null}
      <p className="text-xs text-muted-foreground">Dates use UTC. Weeks run Monday–Sunday. User totals and account controls show current accounts.</p>
    </section>
  );
}
