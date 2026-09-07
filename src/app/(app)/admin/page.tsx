"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Search, Shield, Users, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { useAuth } from "@/components/auth/auth-provider";
import { OrdersInbox } from "@/components/admin/orders-inbox";
import { publicEnv } from "@/config/public-env";

type AdminMetrics = {
  totalUsers: number;
  imagesGeneratedToday: number;
  imagesEditedToday: number;
  successfulImageGenerationsToday: number;
  failedImageGenerationsToday: number;
  reservedImageGenerationsToday: number;
  successfulImageEditsToday: number;
  failedImageEditsToday: number;
  reservedImageEditsToday: number;
  estimatedUsageCostToday: number;
  averageLatencyMsToday: number | null;
  blockedUsersCount: number;
  topUsersByImageUsage: Array<{ userId: string; email: string; imageUsage: number }>;
  users: Array<{
    id: string;
    email: string | null;
    full_name: string | null;
    role: "customer" | "admin";
    daily_image_limit: number;
    monthly_image_limit: number;
    is_blocked: boolean;
  }>;
};

export default function AdminPage() {
  const { user, getAccessToken } = useAuth();
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [userSearch, setUserSearch] = useState("");

  useEffect(() => {
    void loadMetrics();
  }, [user]);

  async function authHeaders(): Promise<Record<string, string>> {
    const token = await getAccessToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async function loadMetrics() {
    setError("");
    setIsLoading(true);
    try {
      const response = await fetch("/api/admin", { headers: await authHeaders() });
      const payload = (await response.json()) as AdminMetrics & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Admin metrics could not be loaded.");
      setMetrics(payload);
    } catch (adminError) {
      setMetrics(null);
      setError(adminError instanceof Error ? adminError.message : "Admin metrics could not be loaded.");
    } finally {
      setIsLoading(false);
    }
  }

  async function updateUser(userId: string, updates: { isBlocked?: boolean; dailyImageLimit?: number; monthlyImageLimit?: number; role?: "customer" | "admin" }) {
    setError("");
    try {
      const response = await fetch("/api/admin", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ userId, ...updates })
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "The user could not be updated.");
      await loadMetrics();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "The user could not be updated.");
    }
  }

  const filteredUsers = metrics
    ? metrics.users.filter((profile) => {
        const query = userSearch.trim().toLowerCase();
        if (!query) return true;
        return [profile.email, profile.full_name].some((value) => value?.toLowerCase().includes(query));
      })
    : [];

  return (
    <div className="min-h-[calc(100vh-5rem)] space-y-5">
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

      {isLoading ? (
        <LoadingSkeleton className="h-64 rounded-3xl" />
      ) : metrics ? (
        <>
          <OrdersInbox />
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard icon={<Users className="h-5 w-5" />} label="Total Users" value={metrics.totalUsers} />
            <MetricCard icon={<Wand2 className="h-5 w-5" />} label="Successful Generations" value={metrics.successfulImageGenerationsToday} />
            <MetricCard icon={<Wand2 className="h-5 w-5" />} label="Failed Generations" value={metrics.failedImageGenerationsToday} />
            <MetricCard icon={<Wand2 className="h-5 w-5" />} label="Reserved Generations" value={metrics.reservedImageGenerationsToday} />
            <MetricCard icon={<Wand2 className="h-5 w-5" />} label="Successful Edits" value={metrics.successfulImageEditsToday} />
            <MetricCard icon={<Wand2 className="h-5 w-5" />} label="Failed Edits" value={metrics.failedImageEditsToday} />
            <MetricCard icon={<Wand2 className="h-5 w-5" />} label="Reserved Edits" value={metrics.reservedImageEditsToday} />
            <MetricCard icon={<Shield className="h-5 w-5" />} label="Avg Latency" value={metrics.averageLatencyMsToday === null ? "N/A" : `${metrics.averageLatencyMsToday}ms`} />
            <MetricCard icon={<Shield className="h-5 w-5" />} label="Blocked Users" value={metrics.blockedUsersCount} />
            <MetricCard icon={<Shield className="h-5 w-5" />} label="Cost Today" value={`$${metrics.estimatedUsageCostToday.toFixed(2)}`} />
          </section>

          <section className="grid gap-5 xl:grid-cols-[1fr_26rem]">
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
                    />
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No users match that search.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Image Users Today</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {metrics.topUsersByImageUsage.length ? (
                  metrics.topUsersByImageUsage.map((entry) => (
                    <div key={entry.userId} className="rounded-2xl border bg-white/[0.035] p-4">
                      <p className="truncate text-sm font-medium text-white">{entry.email}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{entry.imageUsage} image credits</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No image usage logged today.</p>
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
  onUpdate
}: {
  profile: AdminMetrics["users"][number];
  currentUserId: string;
  onUpdate: (userId: string, updates: { isBlocked?: boolean; dailyImageLimit?: number; monthlyImageLimit?: number; role?: "customer" | "admin" }) => Promise<void>;
}) {
  const [daily, setDaily] = useState(String(profile.daily_image_limit));
  const [monthly, setMonthly] = useState(String(profile.monthly_image_limit));
  const isCurrentUser = profile.id === currentUserId;

  return (
    <div className="grid gap-3 rounded-2xl border bg-white/[0.035] p-4 lg:grid-cols-[minmax(0,1fr)_8rem_8rem_auto_auto_auto] lg:items-center">
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
        onChange={(event) => setDaily(event.target.value)}
        className="rounded-xl border bg-background/70 px-3 py-2 text-sm text-white outline-none"
        aria-label="Daily image limit"
      />
      <input
        value={monthly}
        onChange={(event) => setMonthly(event.target.value)}
        className="rounded-xl border bg-background/70 px-3 py-2 text-sm text-white outline-none"
        aria-label="Monthly image limit"
      />
      <Button
        variant="secondary"
        onClick={() =>
          onUpdate(profile.id, {
            dailyImageLimit: Number(daily),
            monthlyImageLimit: Number(monthly)
          })
        }
      >
        Save
      </Button>
      <Button
        variant="secondary"
        className={!profile.is_blocked ? "border-destructive/40 text-destructive-foreground" : ""}
        onClick={() => onUpdate(profile.id, { isBlocked: !profile.is_blocked })}
      >
        {profile.is_blocked ? "Unblock" : "Block"}
      </Button>
      {profile.role === "admin" ? (
        <Button
          variant="secondary"
          className="border-destructive/40 text-destructive-foreground"
          disabled={isCurrentUser}
          title={isCurrentUser ? "You cannot remove your own admin access." : undefined}
          onClick={() => onUpdate(profile.id, { role: "customer" })}
        >
          Remove Admin
        </Button>
      ) : (
        <Button variant="secondary" onClick={() => onUpdate(profile.id, { role: "admin" })}>
          Promote to Admin
        </Button>
      )}
    </div>
  );
}
