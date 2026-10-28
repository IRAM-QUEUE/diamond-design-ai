/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { createRequire } = require('node:module');
const { NextResponse } = require('next/server');
const repo = path.resolve(__dirname, '..');
function load(file, mocks = {}) {
  const name = path.join(repo, file);
  const js = ts.transpileModule(fs.readFileSync(name, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const loaded = { exports: {} }, localRequire = createRequire(name);
  new Function('require', 'module', 'exports', js)(id => id in mocks ? mocks[id] : id.startsWith('@/') ? load(`src/${id.slice(2)}.ts`, mocks) : localRequire(id), loaded, loaded.exports);
  return loaded.exports;
}
const reporting = load('src/lib/admin-reporting.ts');
const resolve = (query, now = '2026-10-28T17:45:00Z') => reporting.resolveAdminReportRange(new URLSearchParams(query), new Date(now));
const users = Array.from({ length: 1105 }, (_, index) => ({ id: String(index).padStart(5, '0'), email: `user${index}@example.com`, full_name: null, role: 'customer', daily_image_limit: 25, monthly_image_limit: 250, is_blocked: index === 0 }));
const activity = (overrides = {}) => ({ id: 'event', user_id: users[0].id, event_type: 'image_generation', units: 1, estimated_cost: '0.04', status: 'succeeded', latency_ms: 500, created_at: '2026-10-28T12:00:00Z', ...overrides });
let authenticated = true, role = 'admin', databaseError = false;
const calls = [];
const events = Array.from({ length: 2305 }, (_, index) => activity({ id: `generated-${String(index).padStart(5, '0')}` }));
events.push(activity({ id: 'before', created_at: '2026-10-27T23:59:59.999Z' }));
events.push(activity({ id: 'after', created_at: '2026-10-29T00:00:00Z' }));
events.push(activity({ id: 'edit', user_id: users[1].id, event_type: 'image_edit', units: 2 }));
events.push(activity({ id: 'failed', user_id: users[2].id, status: 'failed', units: 50, estimated_cost: 0, latency_ms: null }));
events.push(activity({ id: 'reserved', user_id: users[1].id, status: 'reserved', latency_ms: null }));
events.push(activity({ id: 'upload', event_type: 'upload', units: 999 }));
const admin = {
  from(table) {
    const filters = [], orders = [];
    let window = [0, 999];
    const query = {
      select() { return query; },
      gte(key, value) { filters.push(row => row[key] >= value); calls.push({ table, key, gte: value }); return query; },
      lt(key, value) { filters.push(row => row[key] < value); calls.push({ table, key, lt: value }); return query; },
      in(key, values) { filters.push(row => values.includes(row[key])); return query; },
      order(key) { orders.push(key); return query; },
      range(from, to) { window = [from, to]; calls.push({ table, window }); return query; },
      then(resolve, reject) {
        const rows = (table === 'profiles' ? users : events).filter(row => filters.every(filter => filter(row))).sort((a, b) => {
          for (const key of orders) { const difference = String(a[key]).localeCompare(String(b[key])); if (difference) return difference; }
          return 0;
        });
        return Promise.resolve({ data: rows.slice(window[0], window[1] + 1), error: databaseError ? { message: 'query failed' } : null }).then(resolve, reject);
      }
    };
    return query;
  }
};
const api = load('src/app/api/admin/route.ts', {
  '@/lib/admin-reporting': reporting,
  '@/lib/supabase-server': { requireAuthenticatedUser: async () => authenticated ? { user: { id: users[0].id }, profile: { role } } : NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) },
  '@/services/supabase/admin': { createAdminSupabaseClient: () => admin }
});
const request = query => new Request(`https://example.com/api/admin${query ? `?${query}` : ''}`);

(async () => {
  assert.equal(resolve('').start, '2026-10-28T00:00:00.000Z');
  assert.equal(resolve('').endExclusive, '2026-10-29T00:00:00.000Z');
  assert.deepEqual([resolve('period=weekly').from, resolve('period=weekly').to], ['2026-10-26', '2026-11-01']);
  assert.equal(resolve('period=weekly', '2026-11-01T23:59:59Z').from, '2026-10-26', 'Sunday belongs to the week that began Monday');
  assert.equal(resolve('period=weekly', '2026-11-02T00:00:00Z').from, '2026-11-02');
  assert.deepEqual([resolve('period=monthly', '2026-12-31T23:59:59Z').from, resolve('period=monthly', '2026-12-31T23:59:59Z').endExclusive], ['2026-12-01', '2027-01-01T00:00:00.000Z']);
  assert.equal(resolve('period=monthly', '2028-02-29T23:59:59Z').to, '2028-02-29');
  const leapDay = resolve('period=custom&from=2028-02-29&to=2028-02-29');
  assert.equal(leapDay.endExclusive, '2028-03-01T00:00:00.000Z');
  assert.equal(resolve('period=custom&from=2026-03-29&to=2026-03-29').endExclusive, '2026-03-30T00:00:00.000Z', 'DST does not shift UTC report days');
  for (const query of ['period=yearly', 'period=custom', 'period=custom&from=2026-02-29&to=2026-03-01', 'period=custom&from=2026-04-31&to=2026-05-01', 'period=custom&from=2026-10-29&to=2026-10-28', 'period=custom&from=2026-1-1&to=2026-10-28', 'period=custom&from=bad&to=2026-10-28']) {
    assert.throws(() => resolve(query), reporting.AdminReportRangeError);
  }
  const empty = reporting.summarizeAdminUsage([], []);
  assert.equal(empty.estimatedUsageCost, 0);
  assert.equal(empty.averageLatencyMs, null);
  assert.deepEqual(empty.topUsersByImageUsage, []);

  authenticated = false;
  assert.equal((await api.GET(request())).status, 401);
  authenticated = true; role = 'customer';
  assert.equal((await api.GET(request('period=monthly'))).status, 403);
  assert.equal(calls.length, 0, 'unauthorized requests do not query report data');
  role = 'admin';
  assert.equal((await api.GET(request('period=custom&from=bad&to=bad'))).status, 400);
  assert.equal(calls.length, 0, 'invalid dates do not query report data');
  const response = await api.GET(request('period=custom&from=2026-10-28&to=2026-10-28'));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  const report = await response.json();
  assert.equal(report.totalUsers, 1105, 'profiles are not capped at 1000');
  assert.equal(report.blockedUsersCount, 1);
  assert.equal(report.successfulImageGenerations, 2305, 'all event pages are included');
  assert.equal(report.successfulImageEdits, 2);
  assert.equal(report.failedImageGenerations, 50);
  assert.equal(report.reservedImageGenerations, 1);
  assert.ok(Math.abs(report.estimatedUsageCost - 92.28) < 0.00001);
  assert.equal(report.averageLatencyMs, 500);
  assert.deepEqual(report.topUsersByImageUsage.map(row => [row.userId, row.imageUsage]), [[users[0].id, 2305], [users[1].id, 3]], 'failed attempts and uploads do not inflate credit rankings');
  assert.ok(calls.some(call => call.gte === '2026-10-28T00:00:00.000Z'));
  assert.ok(calls.some(call => call.lt === '2026-10-29T00:00:00.000Z'));
  assert.ok(calls.some(call => call.table === 'usage_events' && call.window?.[0] === 2000));
  const longer = await (await api.GET(request('period=custom&from=2026-10-27&to=2026-10-29'))).json();
  assert.equal(longer.successfulImageGenerations, 2307, 'the same range also drives wider report totals');
  for (const period of ['daily', 'weekly', 'monthly']) {
    assert.equal((await (await api.GET(request(`period=${period}`))).json()).range.period, period);
  }
  const legacy = await (await api.GET(request())).json();
  assert.equal(legacy.range.period, 'daily');
  assert.equal(legacy.successfulImageGenerationsToday, legacy.successfulImageGenerations, 'already-open dashboards retain daily API fields');
  assert.equal(legacy.estimatedUsageCostToday, legacy.estimatedUsageCost);
  assert.equal(legacy.averageLatencyMsToday, legacy.averageLatencyMs);
  databaseError = true;
  const previousError = console.error; console.error = () => {};
  try { assert.equal((await api.GET(request())).status, 500, 'query errors do not produce partial metrics'); }
  finally { console.error = previousError; }
  console.log('PASS: UTC daily/week/month/custom boundaries, inclusive dates, leap years, DST, invalid ranges, admin-only access, all event/profile pages, synchronized totals/rankings, failed credit exclusion, empty reports, and query errors.');
})().catch(error => { console.error(error); process.exitCode = 1; });
