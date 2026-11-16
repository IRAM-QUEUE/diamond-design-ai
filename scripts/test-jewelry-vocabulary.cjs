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
const { buildJewelryVocabularyGuidance, jewelryVocabularyConsultantGuidance } = load('src/config/jewelry-vocabulary.ts');
const { buildDiamondConceptPrompts, buildEditPrompt } = load('src/services/image/prompt-builder.ts');
const { diamondConsultantSystemPrompt } = load('src/lib/diamond-consultant-prompt.ts');
const { buildDesignBriefPrompt } = load('src/lib/design-brief-prompt.ts');
const base = { ...emptyDesignProfile, style: 'Minimal', metal: 'Platinum', setting: 'Bezel-set oval diamond' };
for (const [type, scope] of [['Ring', 'Rings:'], ['خاتم', 'Rings:'], ['Bracelet', 'Bracelets:'], ['سوار', 'Bracelets:'], ['Pendant', 'Necklaces and pendants:'], ['قلادة', 'Necklaces and pendants:'], ['Earrings', 'Earrings:'], ['أقراط', 'Earrings:']]) {
  const profile = { ...base, jewelryType: type };
  const guidance = buildJewelryVocabularyGuidance(profile);
  assert.ok(guidance.includes(scope));
  for (const other of ['Rings:', 'Bracelets:', 'Necklaces and pendants:', 'Earrings:'].filter(value => value !== scope)) assert.ok(!guidance.includes(other), `${type} must not inherit ${other}`);
  assert.ok(guidance.includes('Use only the requested technique'));
  assert.ok(!guidance.includes('Gold:'));
  for (const preference of ['default', 'precise_changes', 'names_lettering', 'creative_exploration']) {
    const prompt = buildDiamondConceptPrompts(profile, preference)[0].prompt;
    assert.ok(prompt.includes(scope));
    assert.ok(prompt.includes('Platinum'));
    assert.ok(!prompt.includes('Gold:'));
    const edit = buildEditPrompt({ designProfile: profile, editInstruction: 'Change only the background', sourceVariationName: 'Existing image', preference });
    assert.ok(edit.includes('Apply only the requested change'));
    assert.ok(edit.includes('Preserve the original view unless this edit requests a different view'));
  }
}
const unrelated = buildJewelryVocabularyGuidance({ ...emptyDesignProfile, personalizationText: 'Ring Diamond Gold' });
assert.ok(!unrelated.includes('Rings:'));
assert.ok(!unrelated.includes('Gold:'));
assert.ok(!unrelated.includes('Diamonds and stone setting:'));
const gold = buildJewelryVocabularyGuidance({ ...base, metal: '14K brushed yellow gold' });
assert.ok(gold.includes('never replace another karat or assume 18K'));
assert.ok(gold.includes('preserve matte, brushed and hammered finishes'));
const views = { ...base, notes: ['أمامي وجانبي مع الحفاظ على نفس التصميم في كل الزوايا'] };
assert.ok(buildJewelryVocabularyGuidance(views).includes('Requested views:'));
assert.ok(!buildJewelryVocabularyGuidance(views, 'Change only the background').includes('Requested views:'));
assert.ok(buildJewelryVocabularyGuidance(views, 'Show the rear view').includes('Requested views:'));
assert.ok(diamondConsultantSystemPrompt.includes(jewelryVocabularyConsultantGuidance));
for (const term of ['AccurateRingSize', 'FunctionalGallery', 'AssemblyClearance', 'FunctionalBail', 'GravityAccurateDrape', 'FunctionalPost', '18KRealGold', 'RealDiamond', 'NoFakeDiamonds', 'ProductionReadyGeometry', 'ترصيع ميكرو بافيه', 'إسقاط هندسي', 'بدون توهج صناعي']) assert.ok(jewelryVocabularyConsultantGuidance.includes(term));
const concept = { id: 'test', prompt: 'Gold pendant', description: 'Concept', variationName: 'Study', version: 1, parentId: null };
const brief = buildDesignBriefPrompt({ finalizedConcept: concept, concepts: [concept], referenceId: 'TEST', language: 'ar' });
assert.ok(brief.includes('generic realism goals in image prompts are not verified image features or customer specifications'));
assert.ok(brief.includes('Write every human-readable value in Arabic'));
console.log('PASS: bilingual jewelry-type routing, relevant terms across all image models and edits, no inscription-keyword leakage, material/finish/setting preservation, requested views only, and workshop evidence boundaries.');
