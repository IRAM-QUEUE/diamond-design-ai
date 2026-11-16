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

const crypto = require('node:crypto');
const sharp = require('sharp');
const load = loader();
const { createInscriptionReferenceDataUrl, resolveInscriptionReferenceFont } = load('src/services/image/inscription-reference.ts');
const { jewelryFonts } = load('src/config/jewelry-fonts.ts');
const { jewelryLetteringStyles } = load('src/config/jewelry-lettering-styles.ts');
const { emptyDesignProfile } = load('src/types/design.ts');
const { buildEditPrompt } = load('src/services/image/prompt-builder.ts');
const { buildReplicateEditInput } = load('src/services/image/replicate-inputs.ts');
const { imageModels } = load('src/services/image/models.ts');
(async () => {
  const hashes = new Set();
  const previews = [];
  assert.equal(await createInscriptionReferenceDataUrl(''), undefined);
  for (const font of jewelryFonts) {
    const text = font.supportsArabic ? 'تامر' : 'Lillian';
    const preferences = { fontPreference: font.name, letteringStylePreference: '' };
    assert.equal(resolveInscriptionReferenceFont(text, preferences).id, font.id);
    const result = await createInscriptionReferenceDataUrl(text, preferences);
    assert.ok(result, `${font.name} must render`);
    const data = Buffer.from(result.split(',')[1], 'base64');
    const meta = await sharp(data).metadata();
    assert.equal(meta.width, 1024);
    assert.equal(meta.height, 512);
    const stats = await sharp(data).stats();
    assert.ok(stats.channels[0].min < 30, 'Reference must contain visible ink');
    assert.equal(stats.channels[0].max, 255);
    hashes.add(crypto.createHash('sha256').update(data).digest('hex'));
    if (['amiri', 'noto-kufi-arabic', 'cairo'].includes(font.id)) previews.push(data);
  }
  assert.equal(hashes.size, jewelryFonts.length, 'Catalog fonts must not silently render the same fallback glyphs');
  for (const style of jewelryLetteringStyles) {
    for (const id of Object.values(style.referenceFonts)) assert.ok(jewelryFonts.some(font => font.id === id));
    assert.equal(resolveInscriptionReferenceFont('تامر', { fontPreference: '', letteringStylePreference: style.name }).id, style.referenceFonts.arabic);
  }
  assert.equal(resolveInscriptionReferenceFont('تامر', { fontPreference: 'Great Vibes', letteringStylePreference: 'Geometric Kufi' }).id, 'noto-kufi-arabic');
  assert.equal(resolveInscriptionReferenceFont('تامر', { fontPreference: '../../secrets', letteringStylePreference: '' }).id, 'noto-naskh-arabic');
  for (const text of ['نوران', 'ليلى', 'محمّد', 'عبد الرحمن', '<b>تامر</b>', 'Éloïse & Anne', 'Lillian', 'عبدالرحمنعبدالرحمنعبدالرحمن']) {
    assert.ok(await createInscriptionReferenceDataUrl(text), 'Names, repeated letters, diacritics and XML characters must render as data');
  }
  // Provider-level regression: every retry must retain the second spelling reference.
  const calls = [];
  const providerLoad = loader({
    '@/config/env': { serverEnv: { replicateApiToken: 'test-only' } },
    replicate: class { async run(_model, request) {
      calls.push(request.input);
      if (calls.length === 1) throw new Error('E005 flagged as sensitive');
      return 'https://example.com/edited.png';
    } }
  });
  const { ReplicateImageProvider } = providerLoad('src/services/image/replicate.ts');
  await new ReplicateImageProvider().editDesign({ model: imageModels.nanoBanana2, imageUrl: 'source', referenceImageUrls: ['name-guide'], prompt: 'Edit lettering', editInstruction: 'Change the style', sourceImageId: 'source-id', sourceVersion: 1, rootId: 'root', variationName: 'Source' });
  assert.equal(calls.length, 2);
  for (const call of calls) assert.deepEqual(call.image_input, ['source', 'name-guide']);
  const profile = { ...emptyDesignProfile, personalizationText: 'تامر', fontPreference: 'Amiri', letteringStylePreference: 'Flowing Calligraphy' };
  for (const model of Object.values(imageModels)) {
    if (!['black-forest-labs/flux-2-pro', 'openai/gpt-image-2', 'google/nano-banana-2', 'bytedance/seedream-5-lite'].includes(model)) continue;
    const input = buildReplicateEditInput(model, 'Change lettering', 'source', ['name-guide']);
    assert.deepEqual(input.input_images || input.image_input, ['source', 'name-guide']);
    const legacy = buildReplicateEditInput(model, 'Change background', 'source');
    assert.deepEqual(legacy.input_images || legacy.image_input, ['source']);
  }
  for (const preference of ['default', 'precise_changes', 'names_lettering', 'creative_exploration']) {
    const guided = buildEditPrompt({ designProfile: profile, editInstruction: 'Use geometric lettering', sourceVariationName: 'Source', preference, hasInscriptionReference: true });
    assert.ok(guided.includes('REFERENCE IMAGE 2'));
    assert.ok(guided.includes('replace the old letter assembly'));
    assert.ok(guided.includes('non-lettering jewelry identity'));
    assert.ok(guided.includes('For unrelated edits, preserve the source lettering'));
    const unassisted = buildEditPrompt({ designProfile: profile, editInstruction: 'Change background', sourceVariationName: 'Source', preference });
    assert.ok(!unassisted.includes('REFERENCE IMAGE 2'));
    assert.ok(!unassisted.includes('replace the old letter assembly'));
    assert.ok(unassisted.includes('main design identity'));
  }
  if (process.argv.includes('--preview')) {
    await sharp({ create: { width: 1024, height: 1536, channels: 3, background: '#ffffff' } })
      .composite(previews.map((input, index) => ({ input, left: 0, top: index * 512 }))).png().toFile('/tmp/form-name-guides.png');
  }
  console.log('PASS: all 12 real fonts, style-family selection, Arabic and Latin names, diacritics, untrusted markup, no clipping, and spelling-guide routing across all edit models.');
})().catch(error => { console.error(error); process.exitCode = 1; });
