/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { createRequire } = require('node:module');
const repo = path.resolve(__dirname, '..');
function load(file, mocks = {}) {
  const name = path.join(repo, file);
  const js = ts.transpileModule(fs.readFileSync(name, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const loadedModule = { exports: {} };
  const requireLocal = createRequire(name);
  const customRequire = id => id in mocks ? mocks[id] : id.startsWith('@/') ? load(`src/${id.slice(2)}.ts`, mocks) : requireLocal(id);
  new Function('require', 'module', 'exports', js)(customRequire, loadedModule, loadedModule.exports);
  return loadedModule.exports;
}
const helpers = load('src/lib/shop-order.ts');
const email = load('src/services/email/shop-order.ts');
const { NextResponse } = require('next/server');
const originalFetch = global.fetch;
const originalSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
const uid = '11111111-1111-4111-8111-111111111111';
const iid = '22222222-2222-4222-8222-222222222222';
const oid = '33333333-3333-4333-8333-333333333333';
const order = { id: oid, user_id: uid, image_id: iid, recipient_email: 'shop@example.com', customer_email: 'customer@example.com', customer_name: 'عميل تجريبي', customer_mobile: '+20 100 000 0000', reference_id: 'DIA-2026-TEST', source_storage_path: `users/${uid}/sessions/test/sources/image.png`, status: 'pending' };
(async () => {
  assert.equal(helpers.isEmailAddress('shop@example.com\r\nBcc: injected@example.com'), false);
  assert.equal(helpers.isEmailAddress('shop@example.com,other@example.com'), false);
  assert.equal(helpers.orderSourcePath(`users/${uid}/sessions/test/images/image.png`, uid), order.source_storage_path);
  assert.equal(helpers.orderSourcePath(`users/other/sessions/test/images/image.png`, uid), null);
  assert.equal(helpers.orderSourcePath(`users/${uid}/sessions/test/uploads/image.png`, uid), `users/${uid}/sessions/test/uploads/image.png`);
  const displayPath = `users/${uid}/sessions/test/images/image.png`;
  const displayUrl = `https://example.supabase.co/storage/v1/object/sign/design-images/${displayPath}?token=expired`;
  assert.equal(helpers.ownedDisplayStoragePath(displayUrl, uid, process.env.NEXT_PUBLIC_SUPABASE_URL), displayPath);
  for (const invalid of [displayUrl.replace('example.supabase.co', 'attacker.example'), displayUrl.replace(uid, oid), displayUrl.replace('design-images/', 'other-bucket/'), displayUrl.replace('image.png', '%2e%2e%2fimage.png'), 'not a URL']) {
    assert.equal(helpers.ownedDisplayStoragePath(invalid, uid, process.env.NEXT_PUBLIC_SUPABASE_URL), null);
  }
  const pdf = Buffer.from('%PDF-1.4\nfixture');
  const image = Buffer.from('original image bytes');
  const mime = email.buildOrderMime(order, pdf, image);
  assert.match(mime, /Subject: New Order\r\n/);
  assert.match(mime, /From: customer@example.com\r\nTo: shop@example.com/);
  assert.equal((mime.match(/Content-Disposition: attachment;/g) || []).length, 2);
  assert.ok(mime.includes(pdf.toString('base64')) && mime.includes(image.toString('base64')));
  assert.match(mime, /Content-Type: application\/pdf/);
  assert.match(mime, /Content-Type: image\/png/);
  const textPart = mime.split('Content-Transfer-Encoding: base64\r\n\r\n')[1].split('\r\n--')[0];
  assert.ok(Buffer.from(textPart.replaceAll('\r\n', ''), 'base64').toString().includes(order.customer_name));

  let calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    return Response.json({ id: 'draft-1', message: { id: 'abcdef123' } });
  };
  const draft = await email.createGmailDraft('fake-token', mime);
  assert.equal(draft.messageId, 'abcdef123');
  assert.equal(calls[0].url, 'https://gmail.googleapis.com/gmail/v1/users/me/drafts');
  assert.equal(Buffer.from(JSON.parse(calls[0].options.body).message.raw, 'base64url').toString(), mime);
  assert.ok(!calls.some(call => call.url.includes('/send')));
  global.fetch = async () => Response.json({ email: 'someoneelse@example.com', email_verified: true });
  await assert.rejects(email.verifyGmailAccess('fake-token', order.customer_email), /matches your signed-in email/);
  global.fetch = async url => url.includes('userinfo') ? Response.json({ email: order.customer_email, email_verified: true }) : Response.json({ error: { details: [{ reason: 'SERVICE_DISABLED' }] } }, { status: 403 });
  await assert.rejects(email.verifyGmailAccess('fake-token', order.customer_email), issue => issue.code === 'GMAIL_SETUP_REQUIRED');

  let state = { ...order };
  let creations = 0;
  let failCreate = false;
  let reconcile = null;
  let role = 'customer';
  let authenticated = true;
  let sourceMissing = false;
  let savedImage = { id: iid, user_id: uid, storage_path: displayPath };
  const downloads = [];
  const fakeAdmin = {
    from(table) {
      let updates, inserted, filters = [];
      const query = {
        select() { return query; }, eq(key, value) { filters.push([key, value]); return query; },
        update(values) { updates = values; return query; },
        insert(values) { inserted = values; return query; },
        maybeSingle() { return Promise.resolve(run()); }, single() { return Promise.resolve(run()); },
        then(resolve, reject) { return Promise.resolve(run()).then(resolve, reject); }
      };
      function run() {
        if (table === 'design_images') return { data: savedImage && filters.every(([key, value]) => savedImage[key] === value) ? { ...savedImage } : null, error: null };
        if (table === 'shop_settings') return { data: { recipient_email: order.recipient_email }, error: null };
        if (table !== 'shop_order_drafts') throw new Error(`Unexpected table: ${table}`);
        if (inserted) { state = { ...order, ...inserted }; return { data: { ...state }, error: null }; }
        if (!state || !filters.every(([key, value]) => state[key] === value)) return { data: null, error: null };
        if (updates) Object.assign(state, updates);
        return { data: { ...state }, error: null };
      }
      return query;
    },
    storage: { from(bucket) { return { async download(file) {
      downloads.push({ bucket, file });
      if (sourceMissing && bucket === 'design-images') return { data: null, error: new Error('missing source') };
      return { data: new Blob([bucket === helpers.shopOrderFilesBucket ? pdf : image]), error: null };
    }, async list() { return { data: [], error: null }; }, async createSignedUploadUrl() { return { data: { token: 'upload-token' }, error: null }; } }; } }
  };
  const mocks = {
    '@/lib/supabase-server': { requireAuthenticatedUser: async () => authenticated ? { user: { id: uid, email: order.customer_email }, profile: { role, is_blocked: false } } : NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) },
    '@/services/supabase/admin': { createAdminSupabaseClient: () => fakeAdmin },
    '@/lib/rate-limit': { requireRateLimit: () => null },
    '@/services/email/shop-order': { ...email, verifyGmailAccess: async () => {}, findGmailDraft: async () => reconcile,
      createGmailDraft: async () => { creations++; await new Promise(resolve => setTimeout(resolve, 10)); if (failCreate) throw new Error('timeout'); return { draftId: 'draft-1', messageId: 'abcdef123' }; } },
    sharp: () => ({ png: () => ({ toBuffer: async () => image }) })
  };
  const route = load('src/app/api/shop-orders/route.ts', mocks);
  const request = (id = oid) => new Request('http://localhost/api/shop-orders', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Gmail-Token': 'fake-token' }, body: JSON.stringify({ action: 'create', orderId: id }) });
  authenticated = false;
  assert.equal((await route.POST(request())).status, 401);
  authenticated = true;
  assert.equal((await route.POST(request(iid))).status, 404);
  const concurrent = await Promise.all([route.POST(request()), route.POST(request())]);
  assert.equal(creations, 1, 'concurrent clicks must claim only one draft creation');
  assert.equal(concurrent.filter(response => response.status === 200).length, 1);
  assert.equal(state.status, 'ready');
  assert.equal((await route.POST(request())).status, 200);
  assert.equal(creations, 1, 'ready draft must reopen without another creation');
  assert.ok(downloads.filter(item => item.bucket === 'design-images').every(item => item.file.includes('/sources/')));
  state = { ...order }; failCreate = true;
  assert.equal((await route.POST(request())).status, 502);
  assert.equal(state.status, 'unknown');
  const before = creations;
  assert.equal((await route.POST(request())).status, 409);
  assert.equal(creations, before, 'ambiguous creation must not create another draft');
  reconcile = { id: 'recovered', message: { id: 'abcdef456' } };
  assert.equal((await route.POST(request())).status, 200);
  assert.equal(state.gmail_draft_id, 'recovered');
  assert.equal(creations, before);
  const prepare = (imageId, imageUrl = displayUrl) => new Request('http://localhost/api/shop-orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'prepare', imageId, imageUrl, referenceId: order.reference_id, customerName: order.customer_name, customerMobile: order.customer_mobile }) });
  state = null;
  assert.equal((await route.POST(prepare(iid))).status, 200, 'saved wishlist ID can prepare an order');
  assert.equal(state.image_id, iid);
  assert.equal(state.source_storage_path, order.source_storage_path);
  state = null;
  assert.equal((await route.POST(prepare(oid))).status, 200, 'old references recover the saved ID from an expired display URL');
  assert.equal(state.image_id, iid, 'order uses the stored image ID, never the temporary chat ID');
  state.status = 'ready'; state.gmail_message_id = 'existing-draft-message';
  const reopened = await (await route.POST(prepare(oid))).json();
  assert.equal(reopened.ready, true, 'recovered references reuse the existing draft');
  assert.ok(reopened.gmailUrl.includes('existing-draft-message'));
  state = null;
  assert.equal((await route.POST(prepare(oid, displayUrl.replace('example.supabase.co', 'attacker.example')))).status, 404);
  savedImage.user_id = oid;
  assert.equal((await route.POST(prepare(iid))).status, 404, 'both ID and URL lookup require database ownership');
  savedImage.user_id = uid;
  sourceMissing = true;
  const missingSource = await route.POST(prepare(oid));
  assert.equal(missingSource.status, 400);
  assert.match((await missingSource.json()).error, /without the app watermark is unavailable/);
  assert.equal(state, null, 'a missing original must not create an order with the display image');
  assert.ok(downloads.filter(item => item.bucket === 'design-images').every(item => item.file.includes('/sources/')));
  const settings = load('src/app/api/admin/shop-settings/route.ts', mocks);
  assert.equal((await settings.GET(new Request('http://localhost'))).status, 403);
  role = 'admin';
  assert.equal((await settings.PUT(new Request('http://localhost', { method: 'PUT', body: JSON.stringify({ recipientEmail: 'invalid' }) }))).status, 400);
  console.log('PASS: MIME subject/recipient/Arabic/two attachments, original image ownership, Gmail draft-only API, account mismatch, missing API setup, authorization, concurrent/repeated requests, ambiguous retry recovery, wishlist IDs, legacy reference recovery, rejected foreign images, missing originals, and admin validation.');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => {
  global.fetch = originalFetch;
  if (originalSupabaseUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = originalSupabaseUrl;
});
