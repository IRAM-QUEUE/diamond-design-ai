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
  const loadedModule = { exports: {} }, requireLocal = createRequire(name);
  new Function('require', 'module', 'exports', js)(id => id in mocks ? mocks[id] : id.startsWith('@/') ? load(`src/${id.slice(2)}.ts`, mocks) : requireLocal(id), loadedModule, loadedModule.exports);
  return loadedModule.exports;
}
const uid = '11111111-1111-4111-8111-111111111111';
const iid = '22222222-2222-4222-8222-222222222222';
const oid = '33333333-3333-4333-8333-333333333333';
const other = '44444444-4444-4444-8444-444444444444';
const originalEnv = process.env.NEXT_PUBLIC_SUPABASE_URL;
const originalFetch = global.fetch;
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
const displayPath = `users/${uid}/sessions/test/images/${iid}.png`;
const sourcePath = displayPath.replace('/images/', '/sources/');
const displayUrl = `https://example.supabase.co/storage/v1/object/sign/design-images/${displayPath}?token=expired`;
const pdf = new Blob(['%PDF-1.4\nfixture'], { type: 'application/pdf' });
const original = new Blob(['original image'], { type: 'image/png' });
const records = [], files = new Map([[`design-images/${sourcePath}`, original]]), downloads = [], links = [];
let authenticated = true, blocked = false, role = 'customer', userId = uid;
const savedImage = { id: iid, user_id: uid, storage_path: displayPath, variation_name: 'Saved necklace' };
const admin = {
  from(table) {
    const filters = []; let inserted, updates, range = [0, 100], count = false;
    const query = {
      select(_fields, options) { count = options?.count === 'exact'; return query; },
      eq(key, value) { filters.push(row => row[key] === value); return query; },
      neq(key, value) { filters.push(row => row[key] !== value); return query; },
      order() { return query; }, range(start, end) { range = [start, end]; return query; },
      insert(values) { inserted = values; return query; }, update(values) { updates = values; return query; },
      maybeSingle() { return Promise.resolve(run(true)); }, single() { return Promise.resolve(run(true)); },
      then(resolve, reject) { return Promise.resolve(run(false)).then(resolve, reject); }
    };
    function run(single) {
      if (!['shop_orders', 'design_images'].includes(table)) throw new Error(`Unexpected table ${table}`);
      if (inserted) {
        if (records.some(row => ['user_id', 'image_id', 'reference_id'].every(key => row[key] === inserted[key]))) return { data: null, error: { code: '23505' } };
        records.push({ id: oid, status: 'preparing', submitted_at: null, ...inserted });
      }
      const rows = (table === 'design_images' ? [savedImage] : records).filter(row => filters.every(filter => filter(row)));
      if (updates) rows.forEach(row => Object.assign(row, updates));
      return { data: single ? rows[0] ? { ...rows[0] } : null : rows.slice(range[0], range[1] + 1).map(row => ({ ...row })), error: null, ...(count ? { count: rows.length } : {}) };
    }
    return query;
  },
  storage: { from(bucket) { return {
    async list(prefix) { return { data: [...files.keys()].filter(key => key.startsWith(`${bucket}/${prefix}/`)).map(key => ({ name: key.split('/').pop() })), error: null }; },
    async download(file) { downloads.push(`${bucket}/${file}`); return { data: files.get(`${bucket}/${file}`) || null, error: null }; },
    async upload(file, bytes, options) {
      assert.equal(options.upsert, false, 'order copies must be immutable');
      if (files.has(`${bucket}/${file}`)) return { error: { statusCode: 409, message: 'already exists' } };
      files.set(`${bucket}/${file}`, new Blob([bytes])); return { error: null };
    },
    async createSignedUrl(file, _expires, options) { links.push({ bucket, file, options }); return { data: { signedUrl: `https://example.supabase.co/${bucket}/${file}?signed` }, error: null }; },
    async createSignedUploadUrl(file, options) { assert.equal(options.upsert, false); return { data: { token: `token:${file}` }, error: null }; }
  }; } }
};
const mocks = {
  '@/lib/supabase-server': { requireAuthenticatedUser: async () => authenticated ? { user: { id: userId, email: 'customer@example.com' }, profile: { role, is_blocked: blocked } } : NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) },
  '@/services/supabase/admin': { createAdminSupabaseClient: () => admin },
  '@/lib/rate-limit': { requireRateLimit: () => null },
  sharp: () => ({ png: () => ({ toBuffer: async () => Buffer.from(await original.arrayBuffer()) }) })
};
const customer = load('src/app/api/workshop-orders/route.ts', mocks);
const inbox = load('src/app/api/admin/orders/route.ts', mocks);
const req = (body, method = 'POST') => new Request('http://localhost/api/workshop-orders', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const prepare = { action: 'prepare', imageId: iid, imageUrl: displayUrl, referenceId: 'DIA-2026-TEST', customerName: 'Test Customer', customerMobile: '+20 100 000 0000' };
const list = params => new Request(`http://localhost/api/admin/orders${params || ''}`);
(async () => {
  authenticated = false;
  assert.equal((await customer.POST(req(prepare))).status, 401);
  assert.equal((await inbox.GET(list())).status, 401);
  authenticated = true; blocked = true;
  assert.equal((await customer.POST(req(prepare))).status, 403);
  blocked = false;
  assert.equal((await inbox.GET(list())).status, 403);
  assert.equal((await inbox.PATCH(req({ orderId: oid, status: 'completed', expectedStatus: 'new' }, 'PATCH'))).status, 403);
  userId = other;
  assert.equal((await customer.POST(req(prepare))).status, 404, 'cannot submit another user image');
  userId = uid;
  assert.equal((await customer.POST(req({ ...prepare, customerMobile: '12' }))).status, 400);
  const prepared = await Promise.all([customer.POST(req(prepare)), customer.POST(req({ ...prepare, imageId: other }))]);
  assert.ok(prepared.every(result => result.status === 200));
  assert.equal(records.length, 1, 'concurrent original and legacy wishlist references create only one pending order');
  assert.equal(records[0].image_id, iid);
  assert.equal(await files.get(`workshop-orders/${oid}/final-image.png`).text(), await original.text());
  assert.ok(downloads.filter(key => key.startsWith('design-images/')).every(key => key.includes('/sources/')));
  role = 'admin';
  assert.equal((await (await inbox.GET(list())).json()).total, 0, 'pending files are not shop orders');
  assert.equal((await inbox.GET(list(`?orderId=${oid}`))).status, 404);
  role = 'customer';
  assert.equal((await customer.POST(req({ action: 'submit', orderId: oid }))).status, 400, 'missing PDF prevents submission');
  files.set(`workshop-orders/${oid}/handover.pdf`, new Blob(['not a PDF']));
  assert.equal((await customer.POST(req({ action: 'submit', orderId: oid }))).status, 400);
  files.set(`workshop-orders/${oid}/handover.pdf`, pdf);
  userId = other;
  assert.equal((await customer.POST(req({ action: 'submit', orderId: oid }))).status, 404);
  userId = uid;
  const submissions = await Promise.all([customer.POST(req({ action: 'submit', orderId: oid })), customer.POST(req({ action: 'submit', orderId: oid }))]);
  assert.ok(submissions.every(result => result.status === 200));
  assert.equal(records[0].status, 'new');
  assert.ok(records[0].submitted_at);
  role = 'admin';
  assert.equal((await (await inbox.GET(list())).json()).total, 1);
  assert.equal((await inbox.GET(list('?status=preparing'))).status, 400);
  assert.equal((await inbox.GET(list('?page=-1'))).status, 400);
  const detail = await inbox.GET(list(`?orderId=${oid}`));
  assert.equal(detail.headers.get('cache-control'), 'private, no-store');
  const detailBody = await detail.json();
  assert.ok(detailBody.pdfUrl && detailBody.imageUrl && detailBody.previewUrl);
  assert.ok(links.some(link => link.options?.download === 'DIA-2026-TEST-final-image.png'));
  assert.equal((await inbox.PATCH(req({ orderId: oid, status: 'completed', expectedStatus: 'new' }, 'PATCH'))).status, 200);
  assert.equal((await inbox.PATCH(req({ orderId: oid, status: 'viewed', expectedStatus: 'new' }, 'PATCH'))).status, 409, 'stale admin cannot overwrite newer status');
  role = 'customer';
  assert.equal((await customer.POST(req({ action: 'submit', orderId: oid }))).status, 200);
  assert.equal(records[0].status, 'completed', 'customer retry must not reset workshop status');
  assert.equal((await (await customer.POST(req(prepare))).json()).submitted, true);

  // Browser flow: prepare + PDF upload + submit; retries skip files already saved.
  const calls = []; let renders = 0, uploads = 0, alreadySubmitted = false, pdfUploaded = false, uploadFails = false;
  global.fetch = async (url, options) => {
    assert.equal(url, '/api/workshop-orders', 'no Gmail or external sending endpoint');
    const body = JSON.parse(options.body); calls.push(body);
    return Response.json(body.action === 'prepare' ? { orderId: oid, submitted: alreadySubmitted, pdfUploaded, referenceId: 'DIA-2026-TEST', imageUrl: 'fresh-display-url', customerContact: { name: 'Saved customer', mobile: '123456789', email: 'customer@example.com' }, pdfPath: `${oid}/handover.pdf`, uploadToken: 'scoped-token' } : { submitted: true, orderId: oid, referenceId: 'DIA-2026-TEST' });
  };
  const client = load('src/lib/submit-workshop-order.ts', { '@/lib/export-design': { createDesignPdfBlob: async handoff => { renders++; assert.equal(handoff.concept.url, 'fresh-display-url'); assert.equal(handoff.brief.customerContact.name, 'Saved customer'); return pdf; } } });
  const supabase = { storage: { from(bucket) { assert.equal(bucket, 'workshop-orders'); return { async uploadToSignedUrl() { uploads++; return { error: uploadFails ? { statusCode: 500, message: 'network' } : null }; } }; } } };
  const handoff = { concept: { id: other, storedImageId: iid, url: displayUrl }, brief: { referenceId: 'DIA-2026-TEST', customerContact: { name: 'Test customer', mobile: '123456789' } } };
  await client.submitWorkshopOrder(handoff, supabase, async () => 'token', () => {});
  assert.equal(calls[0].imageId, iid); assert.deepEqual(calls.map(call => call.action), ['prepare', 'submit']);
  alreadySubmitted = true; calls.length = 0;
  await client.submitWorkshopOrder(handoff, supabase, async () => 'token', () => {});
  assert.equal(renders, 1); assert.equal(uploads, 1); assert.equal(calls.length, 1);
  alreadySubmitted = false; pdfUploaded = true;
  await client.submitWorkshopOrder(handoff, supabase, async () => 'token', () => {});
  assert.equal(renders, 1); assert.equal(uploads, 1);
  pdfUploaded = false; uploadFails = true; calls.length = 0;
  await assert.rejects(client.submitWorkshopOrder(handoff, supabase, async () => 'token', () => {}), /could not be uploaded/);
  assert.deepEqual(calls.map(call => call.action), ['prepare']);
  console.log('PASS: customer/admin authorization, wishlist recovery, immutable original copies, concurrent deduplication, incomplete/invalid PDF rejection, submission receipts, admin downloads/status conflicts, client upload failure and resume, no Gmail dependency.');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => {
  global.fetch = originalFetch;
  if (originalEnv === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = originalEnv;
});
