/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { createRequire } = require('node:module');
const repo = path.resolve(__dirname, '..');
function loader(mocks = {}) {
  const cache = new Map();
  function load(file) {
    let name = path.resolve(repo, file);
    if (!fs.existsSync(name)) {
      name = fs.existsSync(`${name}.ts`) ? `${name}.ts` : path.join(name.replace(/\.ts$/, ''), 'index.ts');
    }
    if (cache.has(name)) return cache.get(name);
    const js = ts.transpileModule(fs.readFileSync(name, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    const loaded = { exports: {} };
    cache.set(name, loaded.exports);
    const localRequire = createRequire(name);
    new Function('require', 'module', 'exports', js)(id => id in mocks ? mocks[id] : id.startsWith('@/') ? load(`src/${id.slice(2)}.ts`) : id.startsWith('.') ? load(path.resolve(path.dirname(name), id)) : localRequire(id), loaded, loaded.exports);
    cache.set(name, loaded.exports);
    return loaded.exports;
  }
  return load;
}
const load = loader();
const { emptyDesignProfile } = load('src/types/design.ts');
const { reviewPersonalizedImage, ImageQualityReviewError } = load('src/services/image/quality-review.ts');
const good = text => ({ observedCharacters: Array.from(text.replace(/\s/gu, "")), observedInscription: text, confident: true, allComponentsSupported: true, styleMatches: true, issues: [] });
const profile = { ...emptyDesignProfile, jewelryType: 'Pendant', metal: 'Yellow gold', setting: 'Full pavé', letteringStylePreference: 'Geometric Kufi', personalizationScript: 'Arabic', personalizationText: 'نوران', readyForGeneration: true };
(async () => {
  const texts = ['نوران', 'سارة', 'عبد الرحمن', 'Lillian', 'Éloïse', 'A.B.', 'Nina 2026'];
  for (const text of texts) {
    let request;
    const provider = { complete: async input => { request = input; return { content: JSON.stringify(good(text)) }; } };
    await reviewPersonalizedImage('https://example.com/candidate.png', { ...profile, personalizationText: text }, provider);
    // The visual reviewer gets no expected name, so it cannot fill in missing letters from the request.
    assert.ok(!JSON.stringify(request).includes(text));
    assert.equal(request.messages[1].content[1].image_url.detail, 'high');
    assert.equal(request.messages[1].content[1].image_url.url, 'https://example.com/candidate.png');
  }
  for (const result of [
    { ...good('نوران'), observedInscription: 'نور' },
    { ...good('نوران'), observedCharacters: ['ن', 'و', 'ر'] },
    { ...good('نوران'), allComponentsSupported: false },
    { ...good('نوران'), confident: false },
    { ...good('نوران'), styleMatches: false },
    { ...good('نوران'), issues: ['Unsupported upright stroke'] },
    { ...good('نوران'), allComponentsSupported: 'true' },
    { observedInscription: 'نوران' },
    [], null
  ]) {
    await assert.rejects(reviewPersonalizedImage('https://example.com/candidate.png', profile, { complete: async () => ({ content: JSON.stringify(result) }) }), ImageQualityReviewError);
  }
  await assert.rejects(reviewPersonalizedImage('url', profile, { complete: async () => ({ content: 'invalid JSON' }) }), ImageQualityReviewError);
  await assert.rejects(reviewPersonalizedImage('url', profile, { complete: async () => { throw new Error('Review unavailable'); } }), ImageQualityReviewError);
  await reviewPersonalizedImage('url', emptyDesignProfile, { complete: async () => { throw new Error('Non-personalized images must skip this review'); } });
  // Check the real LLM adapter sends both text and images without changing ordinary text messages.
  const originalFetch = global.fetch;
  let sent;
  global.fetch = async (_url, options) => { sent = JSON.parse(options.body); return Response.json({ choices: [{ message: { content: '{}' } }] }); };
  try {
    const { OpenAiLlmProvider } = load('src/services/llm/openai.ts');
    const provider = new OpenAiLlmProvider('test-only', 'test-model');
    await provider.complete({ messages: [{ role: 'user', content: 'Text still works' }] });
    assert.equal(sent.messages[0].content, 'Text still works');
    await provider.complete({ messages: [{ role: 'user', content: [{ type: 'image_url', image_url: { url: 'image', detail: 'high' } }] }] });
    assert.equal(sent.messages[0].content[0].image_url.url, 'image');
  } finally { global.fetch = originalFetch; }
  // Exercise both API flows: rejected images must never be stored or returned, and credits must be released.
  for (const operation of ['generate-designs', 'edit-design']) {
    let failReview = true;
    let reviewCalls = 0;
    let stored = 0;
    let failed = 0;
    let succeeded = 0;
    const image = { id: 'image', url: 'https://example.com/generated.png', variationName: 'Concept', rootId: 'root', version: 1 };
    const mocks = {
      '@/config/env': { serverEnv: { demoMode: false, openaiModel: 'review-model' } },
      '@/lib/rate-limit': { requireRateLimit: () => null },
      '@/lib/demo-data': {},
      '@/lib/edit-profile': { updateDesignProfileFromEdit: value => value },
      '@/services/image/inscription-reference': { createInscriptionReferenceDataUrl: async () => 'spelling' },
      '@/services/image/quality-review': { ImageQualityReviewError, reviewPersonalizedImage: async (_url, receivedProfile) => {
        reviewCalls++;
        assert.equal(receivedProfile.personalizationText, 'نوران');
        if (failReview) throw new ImageQualityReviewError();
      } },
      '@/services/image': {
        ...load('src/services/image/provider.ts'),
        resolveImageModel: () => ({ modelIdentifier: 'image-model', effectivePreference: 'names_lettering' }),
        buildDiamondConceptPrompts: () => [{ prompt: 'test', referenceImageUrls: ['spelling'] }],
        buildEditPrompt: () => 'test',
        ReplicateImageProvider: class { async generateDesigns() { return [image]; } async editDesign() { return image; } }
      },
      '@/lib/supabase-server': {
        UsageReservationError: class extends Error {},
        requireAuthenticatedUser: async () => ({ user: { id: 'user' } }), requireAiAccess: () => null,
        getOrCreateDesignSession: async () => 'session', getEditableImageUrlForUser: async () => 'https://example.com/source.png',
        reserveImageCredit: async input => { assert.ok(input.estimatedCost > 0); return { usageEventId: 'reservation' }; },
        markUsageEventFailed: async input => { failed++; assert.equal(input.errorCode, 'IMAGE_QUALITY_REJECTED'); },
        markUsageEventSucceeded: async () => { succeeded++; },
        storeGeneratedImageFromUrl: async () => { stored++; return { signedUrl: 'stored-url' }; },
        persistDesignImage: async () => ({ id: 'saved' }), mapImageRecordToConcept: async value => value
      }
    };
    const route = loader(mocks)(`src/app/api/${operation}/route.ts`);
    const request = () => new Request(`http://localhost/api/${operation}`, { method: 'POST', body: JSON.stringify({ designProfile: profile, imageUrl: 'https://example.com/source.png', sourceImageId: 'source', sourceVersion: 1, editInstruction: 'Use yellow gold' }) });
    let result = await route.POST(request());
    assert.equal(result.status, 502);
    assert.match((await result.json()).error, /No image credit was used/);
    assert.equal(reviewCalls, 1);
    assert.equal(stored, 0);
    assert.equal(failed, 1);
    assert.equal(succeeded, 0);
    failReview = false;
    result = await route.POST(request());
    assert.equal(result.status, 200);
    assert.equal(stored, 1);
    assert.equal(succeeded, 1);
  }
  console.log('PASS: independent Arabic/Latin transcription, complete character matching, support/style checks, fail-closed review, text/vision adapter, and generation/edit rejection before persistence with credit release.');
})().catch(error => { console.error(error); process.exitCode = 1; });
