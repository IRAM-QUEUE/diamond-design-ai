"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Loader2, Search, Shield, Users, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { useAuth } from "@/components/auth/auth-provider";
import { OrdersInbox } from "@/components/admin/orders-inbox";
import { publicEnv } from "@/config/public-env";
import { ReportPeriodFilter } from "@/components/admin/report-period-filter";
import type { AdminMetrics } from "@/lib/admin-reporting";

type UserUpdates = { isBlocked?: boolean; dailyImageLimit?: number; monthlyImageLimit?: number; role?: "customer" | "admin" };
type UserAction = "save" | "block" | "unblock" | "promote" | "demote";

export default function AdminPage() {
  const { user, getAccessToken } = useAuth();
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [userSearch, setUserSearch] = useState("");

  const [reportQuery, setReportQuery] = useState("period=daily");
  const [loadedQuery, setLoadedQuery] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const tokenProvider = useRef(getAccessToken);
  tokenProvider.current = getAccessToken;
  const latestRequest = useRef(0);
  const updatingUsersRef = useRef(new Set<string>());
  const [updatingUsers, setUpdatingUsers] = useState<Record<string, UserAction>>({});
  const [userErrors, setUserErrors] = useState<Record<string, string>>({});

  async function authHeaders(): Promise<Record<string, string>> {
    const token = await tokenProvider.current();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  const loadMetrics = useCallback(async () => {
    const requestId = ++latestRequest.current;
    setError("");
    setIsLoading(true);
    try {
      const response = await fetch(`/api/admin?${reportQuery}`, { headers: await authHeaders(), cache: "no-store" });
      const payload = (await response.json()) as AdminMetrics & { error?: string };
      if (requestId !== latestRequest.current) return;
      if (!response.ok) throw new Error(payload.error ?? "Admin metrics could not be loaded.");
      setMetrics(payload);
      setLoadedQuery(reportQuery);
    } catch (adminError) {
      if (requestId !== latestRequest.current) return;
      setMetrics(null);
      setError(adminError instanceof Error ? adminError.message : "Admin metrics could not be loaded.");
    } finally {
      if (requestId === latestRequest.current) setIsLoading(false);
    }
  }, [reportQuery]);

  useEffect(() => {
    void loadMetrics();
    const counter = latestRequest;
    return () => { counter.current++; };
  }, [loadMetrics, user?.id, refreshKey]);

  async function updateUser(userId: string, updates: UserUpdates) {
    // Lock synchronously, before token lookup, to ignore rapid repeated clicks.
    if (updatingUsersRef.current.has(userId)) return;
    updatingUsersRef.current.add(userId);
    const action: UserAction = updates.isBlocked !== undefined ? (updates.isBlocked ? "block" : "unblock")
      : updates.role ? (updates.role === "admin" ? "promote" : "demote") : "save";
    setUpdatingUsers((current) => ({ ...current, [userId]: action }));
    setUserErrors((current) => ({ ...current, [userId]: "" }));
    setError("");
    try {
      const response = await fetch("/api/admin", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ userId, ...updates })
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "The user could not be updated.");
      // Show the confirmed change immediately instead of leaving stale action buttons
      // enabled while the background metrics request is still running.
      latestRequest.current++;
      setMetrics((current) => {
        if (!current) return current;
        const users = current.users.map((profile) => profile.id !== userId ? profile : {
          ...profile,
          ...(updates.isBlocked !== undefined ? { is_blocked: updates.isBlocked } : {}),
          ...(updates.dailyImageLimit !== undefined ? { daily_image_limit: updates.dailyImageLimit } : {}),
          ...(updates.monthlyImageLimit !== undefined ? { monthly_image_limit: updates.monthlyImageLimit } : {}),
          ...(updates.role ? { role: updates.role } : {})
        });
        return { ...current, users, blockedUsersCount: users.filter((profile) => profile.is_blocked).length };
      });
      setRefreshKey((value) => value + 1);
    } catch (updateError) {
      const message = updateError instanceof Error ? updateError.message : "The user could not be updated.";
      setError(message);
      setUserErrors((current) => ({ ...current, [userId]: message }));
    } finally {
      updatingUsersRef.current.delete(userId);
      setUpdatingUsers((current) => {
        const next = { ...current };
        delete next[userId];
        return next;
      });
    }
  }

  function changeReportQuery(query: string) {
    setIsLoading(true);
    if (query === reportQuery) setRefreshKey((value) => value + 1);
    else setReportQuery(query);
  }

  const filteredUsers = metrics
    ? metrics.users.filter((profile) => {
        const query = userSearch.trim().toLowerCase();
        if (!query) return true;
        return [profile.email, profile.full_name].some((value) => value?.toLowerCase().includes(query));
      })
    : [];

  const refreshingReport = isLoading || (Boolean(metrics) && loadedQuery !== reportQuery);
  const reportLabel = metrics ? formatRangeLabel(metrics.range) : "";
  const rankingLabel = metrics?.range.period === "daily" ? "Today"
    : metrics?.range.period === "weekly" ? "This Week"
      : metrics?.range.period === "monthly" ? "This Month" : "Selected Dates";

  return (
    <div className="min-h-[calc(100dvh-5rem)] min-w-0 space-y-5">
      <header className="rounded-3xl border bg-card/70 p-5 shadow-luxury backdrop-blur-xl">
        <p className="text-sm text-muted-foreground">Production controls</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Admin Usage Dashboard</h1>
      </header>

      {error ? (
        <div className="rounded-3xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive-foreground">
          {error}
        </div>
      ) : null}

      {publicEnv.demoMode ? (
        <div className="rounded-3xl border border-diamond-champagne/30 bg-diamond-champagne/10 p-4 text-sm leading-6 text-diamond-champagne">
          Production warning: demo mode is enabled. Set `NEXT_PUBLIC_DEMO_MODE=false` in Vercel before launch.
        </div>
      ) : null}

      <ReportPeriodFilter range={metrics?.range ?? null} isLoading={refreshingReport} onChange={changeReportQuery} />
      {isLoading && !metrics ? (
        <LoadingSkeleton className="h-64 rounded-3xl" />
      ) : metrics ? (
        <>
          <OrdersInbox />
          <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">{refreshingReport ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : null}{refreshingReport ? "Loading insights..." : `Showing ${reportLabel}`}</p>
          {refreshingReport ? <LoadingSkeleton className="h-64 rounded-3xl" /> : <section aria-label="Usage insights" className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard icon={<Users className="h-5 w-5" />} label="Total Users · All Time" value={metrics.totalUsers} />
            <MetricCard icon={<Wand2 className="h-5 w-5" />} label="Successful Generations" value={metrics.successfulImageGenerations} />
            <MetricCard icon={<Wand2 className="h-5 w-5" />} label="Failed Generations" value={metrics.failedImageGenerations} />
            <MetricCard icon={<Wand2 className="h-5 w-5" />} label="Reserved Generations" value={metrics.reservedImageGenerations} />
            <MetricCard icon={<Wand2 className="h-5 w-5" />} label="Successful Edits" value={metrics.successfulImageEdits} />
            <MetricCard icon={<Wand2 className="h-5 w-5" />} label="Failed Edits" value={metrics.failedImageEdits} />
            <MetricCard icon={<Wand2 className="h-5 w-5" />} label="Reserved Edits" value={metrics.reservedImageEdits} />
            <MetricCard icon={<Shield className="h-5 w-5" />} label="Avg Latency" value={metrics.averageLatencyMs === null ? "N/A" : `${metrics.averageLatencyMs}ms`} />
            <MetricCard icon={<Shield className="h-5 w-5" />} label="Blocked Users · Current" value={metrics.blockedUsersCount} />
            <MetricCard icon={<Shield className="h-5 w-5" />} label="Estimated Image Cost" value={`$${metrics.estimatedUsageCost.toFixed(2)}`} />
          </section>}

          <section className="grid min-w-0 gap-5 2xl:grid-cols-[minmax(0,1fr)_22rem]">
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <CardTitle>Users</CardTitle>
                  <label className="flex min-w-0 items-center gap-2 rounded-full border bg-background/70 px-3 py-2 text-sm text-muted-foreground sm:w-72">
                    <Search className="h-4 w-4 shrink-0" />
                    <input
                      value={userSearch}
                      onChange={(event) => setUserSearch(event.target.value)}
                      placeholder="Search by email or name"
                      className="min-w-0 flex-1 bg-transparent text-white outline-none placeholder:text-muted-foreground"
                    />
                  </label>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {filteredUsers.length ? (
                  filteredUsers.map((profile) => (
                    <UserLimitRow
                      key={profile.id}
                      profile={profile}
                      currentUserId={user?.id ?? ""}
                      onUpdate={updateUser}
                      pendingAction={updatingUsers[profile.id] ?? null}
                      error={userErrors[profile.id] ?? ""}
                    />
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No users match that search.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Image Users · {rankingLabel}</CardTitle>
                <p className="mt-2 text-xs text-muted-foreground">{refreshingReport ? "Loading selected range..." : reportLabel}</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {refreshingReport ? <p role="status" className="text-sm text-muted-foreground">Loading top users...</p> : metrics.topUsersByImageUsage.length ? (
                  metrics.topUsersByImageUsage.map((entry) => (
                    <div key={entry.userId} className="rounded-2xl border bg-white/[0.035] p-4">
                      <p className="truncate text-sm font-medium text-white">{entry.email}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{entry.imageUsage} image credits · successful + reserved</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No image usage in this date range.</p>
                )}
              </CardContent>
            </Card>
          </section>
        </>
      ) : null}
    </div>
  );
}

function MetricCard({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full border bg-white/[0.04] text-diamond-champagne">
          {icon}
        </div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
      </CardContent>
    </Card>
  );
}

function UserLimitRow({
  profile,
  currentUserId,
  onUpdate,
  pendingAction,
  error
}: {
  profile: AdminMetrics["users"][number];
  currentUserId: string;
  onUpdate: (userId: string, updates: UserUpdates) => Promise<void>;
  pendingAction: UserAction | null;
  error: string;
}) {
  const [daily, setDaily] = useState(String(profile.daily_image_limit));
  const [monthly, setMonthly] = useState(String(profile.monthly_image_limit));
  const isCurrentUser = profile.id === currentUserId;
  const busy = pendingAction !== null;
  const changingBlock = pendingAction === "block" || pendingAction === "unblock";
  const changingRole = pendingAction === "promote" || pendingAction === "demote";
  const spinner = <Loader2 aria-hidden="true" className="h-4 w-4 shrink-0 animate-spin" />;

  return (
    <div role="group" aria-label={`User controls for ${profile.email ?? profile.id}`} aria-busy={busy} className="grid gap-3 rounded-2xl border bg-white/[0.035] p-4 xl:grid-cols-[minmax(0,1fr)_5rem_5rem_auto_auto_auto] xl:items-center">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-white">{profile.email ?? profile.id}</p>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {profile.full_name ? `${profile.full_name} • ` : ""}
          {profile.role}
          {isCurrentUser ? " • you" : ""}
        </p>
      </div>
      <input
        value={daily}
        disabled={busy}
        onChange={(event) => setDaily(event.target.value)}
        className="min-w-0 rounded-xl border bg-background/70 px-3 py-2 text-sm text-white outline-none"
        aria-label="Daily image limit"
      />
      <input
        value={monthly}
        disabled={busy}
        onChange={(event) => setMonthly(event.target.value)}
        className="min-w-0 rounded-xl border bg-background/70 px-3 py-2 text-sm text-white outline-none"
        aria-label="Monthly image limit"
      />
      <Button
        variant="secondary"
        className="min-w-[6.5rem] px-3"
        disabled={busy}
        aria-busy={pendingAction === "save"}
        onClick={() =>
          onUpdate(profile.id, {
            dailyImageLimit: Number(daily),
            monthlyImageLimit: Number(monthly)
          })
        }
      >
        {pendingAction === "save" ? spinner : null}
        {pendingAction === "save" ? "Saving..." : "Save"}
      </Button>
      <Button
        variant="secondary"
        className={`min-w-[7.5rem] px-3 ${!profile.is_blocked ? "border-destructive/40 text-destructive-foreground" : ""}`}
        disabled={busy}
        aria-busy={changingBlock}
        onClick={() => onUpdate(profile.id, { isBlocked: !profile.is_blocked })}
      >
        {changingBlock ? spinner : null}
        {pendingAction === "block" ? "Blocking..." : pendingAction === "unblock" ? "Unblocking..." : profile.is_blocked ? "Unblock" : "Block"}
      </Button>
      {profile.role === "admin" ? (
        <Button
          variant="secondary"
          className="min-w-[11rem] border-destructive/40 px-3 text-destructive-foreground"
          disabled={isCurrentUser || busy}
          aria-busy={changingRole}
          title={isCurrentUser ? "You cannot remove your own admin access." : undefined}
          onClick={() => onUpdate(profile.id, { role: "customer" })}
        >
          {changingRole ? spinner : null}
          {changingRole ? "Removing..." : "Remove Admin"}
        </Button>
      ) : (
        <Button variant="secondary" className="min-w-[11rem] px-3" disabled={busy} aria-busy={changingRole} onClick={() => onUpdate(profile.id, { role: "admin" })}>
          {changingRole ? spinner : null}
          {changingRole ? "Promoting..." : "Promote to Admin"}
        </Button>
      )}
      {error ? <p role="alert" className="text-sm text-destructive-foreground xl:col-span-6">{error}</p> : null}
    </div>
  );
}

function formatRangeLabel(range: AdminMetrics["range"]) {
  const format = (value: string) => new Intl.DateTimeFormat("en", {
    day: "numeric", month: "short", year: "numeric", timeZone: "UTC"
  }).format(new Date(`${value}T00:00:00Z`));
  return `${format(range.from)}${range.from === range.to ? "" : ` – ${format(range.to)}`} (UTC)`;
}
