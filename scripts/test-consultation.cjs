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
  const loaded = { exports: {} };
  const localRequire = createRequire(name);
  new Function('require', 'module', 'exports', js)(id => id in mocks ? mocks[id] : id.startsWith('@/') ? load(`src/${id.slice(2)}.ts`, mocks) : localRequire(id), loaded, loaded.exports);
  return loaded.exports;
}
const { emptyDesignProfile } = load('src/types/design.ts');
const { canGenerateDesign, missingDesignDetails } = load('src/lib/design-profile.ts');
const { enforceConsultationPolicy } = load('src/lib/consultation-policy.ts');
const { jewelryLetteringStyles } = load('src/config/jewelry-lettering-styles.ts');
const { jewelryFonts } = load('src/config/jewelry-fonts.ts');
const { buildDiamondConceptPrompts } = load('src/services/image/prompt-builder.ts');
const base = { ...emptyDesignProfile, jewelryType: 'Ring', metal: 'Rose gold', style: 'Minimal', setting: 'Solitaire', readyForGeneration: true };
const response = profile => ({ assistantMessage: 'Creating your concept now.', updatedDesignProfile: profile, stage: 'ready_to_generate', suggestedActions: [], action: { type: 'generate_image' } });
(async () => {
  assert.equal(canGenerateDesign(base), true);
  for (const field of ['jewelryType', 'metal', 'style', 'setting']) {
    const incomplete = { ...base, [field]: '' };
    assert.equal(canGenerateDesign(incomplete), false);
    const guarded = enforceConsultationPolicy(response(incomplete), false, false);
    assert.equal(guarded.action.type, 'ask_clarifying_question');
    assert.equal(guarded.updatedDesignProfile.readyForGeneration, false);
    assert.ok(guarded.assistantMessage.endsWith('?'));
  }
  assert.ok(missingDesignDetails({ ...base, metal: 'Gold' }).includes('metal'));
  for (const message of ['Would you prefer a slim or wide band?', 'هل تفضلين الذهب الأصفر؟']) {
    for (const action of [{ type: 'generate_image' }, { type: 'edit_image', editInstruction: 'Change the chain' }]) {
      const guarded = enforceConsultationPolicy({ ...response(base), assistantMessage: message, action }, false, true);
      assert.equal(guarded.action.type, 'ask_clarifying_question');
      assert.equal(guarded.updatedDesignProfile.readyForGeneration, false);
    }
  }
  assert.equal(enforceConsultationPolicy(response(base), true, false).action.type, 'ask_clarifying_question');
  assert.equal(enforceConsultationPolicy(response(base), false, false).action.type, 'generate_image');
  assert.equal(enforceConsultationPolicy(response({ ...base, readyForGeneration: false }), false, false).action.type, 'ask_clarifying_question');
  assert.equal(enforceConsultationPolicy({ ...response(base), action: { type: 'edit_image', editInstruction: 'Use yellow gold' } }, false, false).action.type, 'edit_image');
  assert.equal(canGenerateDesign({ ...base, personalizationScript: 'Arabic', personalizationText: 'Nouran' }), false);
  assert.equal(canGenerateDesign({ ...base, personalizationScript: 'Arabic', personalizationText: 'نوران' }), true);
  assert.equal(canGenerateDesign({ ...base, jewelryType: 'Name bracelet' }), false);
  for (const style of jewelryLetteringStyles) {
    const profile = { ...base, style: '', jewelryType: 'Name pendant', letteringStylePreference: style.name, personalizationText: style.supportsLatin ? 'Lina' : 'نوران' };
    assert.equal(canGenerateDesign(profile), true);
    const [concept] = buildDiamondConceptPrompts(profile, 'names_lettering', 'spelling');
    assert.deepEqual(concept.referenceImageUrls, ['spelling']);
    assert.ok(concept.prompt.includes(style.constructionDirection));
    assert.ok(concept.prompt.includes('No catalog photo or sample word is supplied'));
    assert.ok(concept.prompt.includes('instead of appending letters to a remembered sample'));
    assert.ok(!concept.prompt.includes('black-and-silver'));
    assert.ok(concept.prompt.includes('Rose gold'));
    assert.ok(concept.prompt.includes(JSON.stringify(Array.from(profile.personalizationText))));
    assert.ok(concept.prompt.includes('EVERY letter, including orthographically non-joining letters'));
    const [noReference] = buildDiamondConceptPrompts(profile);
    assert.deepEqual(noReference.referenceImageUrls, []);
  }
  for (const font of jewelryFonts) {
    const profile = { ...base, style: '', fontPreference: font.name, personalizationText: font.supportsLatin ? 'Lina' : 'ليان' };
    assert.equal(canGenerateDesign(profile), true);
    assert.ok(buildDiamondConceptPrompts(profile)[0].prompt.includes(font.note));
  }
  // Verify the real route cannot return contradictory actions even with a malformed model decision.
  let modelResponse;
  const mocks = {
    '@/config/env': { serverEnv: { demoMode: false, openaiModel: 'test' } },
    '@/lib/rate-limit': { requireRateLimit: () => null },
    '@/lib/supabase-server': { requireAuthenticatedUser: async () => ({ user: { id: 'test' } }), requireImageCredits: async () => null, logUsageEvent: async () => {} },
    '@/services/llm': { OpenAiLlmProvider: class { async complete() { return { content: JSON.stringify(modelResponse) }; } }, MissingOpenAiApiKeyError: class extends Error {} }
  };
  const chat = load('src/app/api/chat/route.ts', mocks);
  const request = () => new Request('http://localhost/api/chat', { method: 'POST', body: JSON.stringify({ messages: [{ role: 'user', content: 'A necklace named نوران' }], designProfile: base }) });
  modelResponse = { ...response({ ...base, metal: '' }), awaitingCustomerAnswer: false };
  let result = await (await chat.POST(request())).json();
  assert.equal(result.action.type, 'ask_clarifying_question');
  modelResponse = { ...response(base), assistantMessage: 'Which metal color would you like?', awaitingCustomerAnswer: false };
  result = await (await chat.POST(request())).json();
  assert.equal(result.action.type, 'ask_clarifying_question');
  modelResponse = { ...response(base), awaitingCustomerAnswer: false };
  result = await (await chat.POST(request())).json();
  assert.equal(result.action.type, 'generate_image');
  delete modelResponse.awaitingCustomerAnswer;
  result = await (await chat.POST(request())).json();
  assert.equal(result.action.type, 'ask_clarifying_question');
  const generation = load('src/app/api/generate-designs/route.ts', {
    ...mocks,
    '@/services/image': { MissingImageApiTokenError: class extends Error {}, ImageGenerationError: class extends Error {} },
    '@/lib/demo-data': {},
    '@/lib/supabase-server': { UsageReservationError: class extends Error {}, requireAuthenticatedUser: async () => { throw new Error('Must reject before auth or credit reservation'); } }
  });
  const rejected = await generation.POST(new Request('http://localhost/api/generate-designs', { method: 'POST', body: JSON.stringify({ designProfile: { ...base, metal: '' } }) }));
  assert.equal(rejected.status, 400);
  console.log('Consultation readiness, clarification sequencing, catalog references, font preservation, and API safeguards passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
