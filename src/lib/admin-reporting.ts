export type ReportPeriod = "daily" | "weekly" | "monthly" | "custom";

export type AdminReportRange = {
  period: ReportPeriod;
  from: string;
  to: string;
  start: string;
  endExclusive: string;
  timeZone: "UTC";
};

export type AdminUser = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: "customer" | "admin";
  daily_image_limit: number;
  monthly_image_limit: number;
  is_blocked: boolean;
};

export type ImageUsageEvent = {
  user_id: string;
  event_type: string;
  units: number | null;
  estimated_cost: number | string | null;
  status: string | null;
  latency_ms: number | null;
};

export type AdminMetrics = ReturnType<typeof summarizeAdminUsage> & { range: AdminReportRange };

export class AdminReportRangeError extends Error {}

const dayMs = 86_400_000;

export function utcDateString(date: Date) {
  return date.toISOString().slice(0, 10);
}

/** Calendar days in UTC, with an inclusive From/To and an exclusive query end. */
export function resolveAdminReportRange(params: URLSearchParams, now = new Date()): AdminReportRange {
  const period = params.get("period") ?? "daily";
  let start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  let end = new Date(start.getTime() + dayMs);

  switch (period) {
    case "daily":
      break;
    case "weekly":
      start = new Date(start.getTime() - ((start.getUTCDay() + 6) % 7) * dayMs);
      end = new Date(start.getTime() + 7 * dayMs);
      break;
    case "monthly":
      start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
      break;
    case "custom":
      start = parseReportDate(params.get("from"), "From");
      end = new Date(parseReportDate(params.get("to"), "To").getTime() + dayMs);
      if (start >= end) throw new AdminReportRangeError("From must be on or before To.");
      break;
    default:
      throw new AdminReportRangeError("Choose daily, weekly, monthly, or custom reporting.");
  }

  return {
    period,
    from: utcDateString(start),
    to: utcDateString(new Date(end.getTime() - dayMs)),
    start: start.toISOString(),
    endExclusive: end.toISOString(),
    timeZone: "UTC"
  };
}

function parseReportDate(value: string | null, label: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new AdminReportRangeError(`${label} must be a valid date (YYYY-MM-DD).`);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || utcDateString(date) !== value) {
    throw new AdminReportRangeError(`${label} must be a valid calendar date.`);
  }
  return date;
}

// Supabase caps individual responses. Read every page so busy weeks/months are not truncated.
export async function readAllReportRows<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>
) {
  const rows: T[] = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const page = await fetchPage(offset, offset + pageSize - 1);
    if (page.error) throw new Error("Admin metrics could not be loaded.");
    rows.push(...(page.data ?? []));
    if ((page.data?.length ?? 0) < pageSize) return rows;
  }
}

export function summarizeAdminUsage(users: AdminUser[], events: ImageUsageEvent[]) {
  const topUsers = new Map<string, { userId: string; email: string; imageUsage: number }>();
  const emails = new Map(users.map((profile) => [profile.id, profile.email ?? "Unknown"]));
  const imageEvents = events.filter((event) => event.event_type === "image_generation" || event.event_type === "image_edit");

  for (const event of imageEvents) {
    // Failed requests don't consume image credits and must not inflate the ranking.
    if (event.status !== "reserved" && event.status !== "succeeded") continue;
    const units = event.units ?? 0;
    if (units <= 0) continue;
    const entry = topUsers.get(event.user_id) ?? {
      userId: event.user_id,
      email: emails.get(event.user_id) ?? "Unknown",
      imageUsage: 0
    };
    entry.imageUsage += units;
    topUsers.set(event.user_id, entry);
  }

  const count = (eventType: string, status: string) => imageEvents
    .filter((event) => event.event_type === eventType && event.status === status)
    .reduce((total, event) => total + (event.units ?? 0), 0);
  const latencies = imageEvents.map((event) => event.latency_ms)
    .filter((latency): latency is number => typeof latency === "number" && Number.isFinite(latency));

  return {
    totalUsers: users.length,
    blockedUsersCount: users.filter((profile) => profile.is_blocked).length,
    successfulImageGenerations: count("image_generation", "succeeded"),
    failedImageGenerations: count("image_generation", "failed"),
    reservedImageGenerations: count("image_generation", "reserved"),
    successfulImageEdits: count("image_edit", "succeeded"),
    failedImageEdits: count("image_edit", "failed"),
    reservedImageEdits: count("image_edit", "reserved"),
    estimatedUsageCost: imageEvents.reduce((total, event) => total + Number(event.estimated_cost ?? 0), 0),
    averageLatencyMs: latencies.length ? Math.round(latencies.reduce((total, latency) => total + latency, 0) / latencies.length) : null,
    topUsersByImageUsage: Array.from(topUsers.values())
      .sort((a, b) => b.imageUsage - a.imageUsage || a.userId.localeCompare(b.userId))
      .slice(0, 5),
    users
  };
}
