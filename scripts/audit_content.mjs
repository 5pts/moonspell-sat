import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
const questions = readJson('src/data/questions.json').questions || [];
const translations = readJson('src/data/option_translations.json');
const lexicon = readJson('src/data/lexicon_seed.json').entries || {};
const barron = readJson('src/data/barron_words.json');
const overrides = readJson('src/data/content_overrides.json');

const genericExplanation = /这句话的关键在于围绕|其他选项则破坏了逻辑|根据句子上下文判断/;
const suspiciousDerivative = /(lyly|nessness|mentment|nessly|lyness|nessment)$/i;
const weakHook = /词义关键词|拼写首尾|首字母.+末字母|可以拆成.+\+|前半段.+后半段|分块读两遍|放回原题|常见于这种语境/i;

const hardErrors = [];
const warnings = [];
const seenIds = new Set();
let genericCount = 0;
let missingSentenceTranslations = 0;
let missingOptionTranslations = 0;
let dedicatedExplanations = 0;
let dedicatedHints = 0;

questions.forEach((question) => {
  const override = overrides[question.globalId];
  if (!question.globalId || seenIds.has(question.globalId)) hardErrors.push(`duplicate or missing id: ${question.globalId || '(empty)'}`);
  seenIds.add(question.globalId);
  if (!Array.isArray(question.options) || question.options.length < 2) hardErrors.push(`${question.globalId}: fewer than two options`);
  if (!Number.isInteger(question.answer) || !question.options?.[question.answer]) hardErrors.push(`${question.globalId}: invalid answer index`);
  if (!String(question.stem || '').match(/_{2,}/)) warnings.push(`${question.globalId}: no visible blank`);
  if (genericExplanation.test(String(question.explanation || ''))) genericCount += 1;
  if (!question.translation && !overrides[question.globalId]?.sentenceTranslation) missingSentenceTranslations += 1;
  (question.options || []).forEach((option) => {
    if (!translations[option.text] && !overrides[question.globalId]?.contextualGlosses?.[option.text]) missingOptionTranslations += 1;
  });

  if (!override) return;
  if (override.reviewStatus !== 'reviewed') {
    if (override.hint) hardErrors.push(`${question.globalId}: hint exists without reviewed status`);
    return;
  }

  const logicSteps = Array.isArray(override.logicSteps) ? override.logicSteps : [];
  const optionReviews = override.optionReviews || {};
  const contextualGlosses = override.contextualGlosses || {};
  if (!String(override.hint || '').trim()) hardErrors.push(`${question.globalId}: reviewed content is missing a dedicated hint`);
  if (!String(override.concise || '').trim()) hardErrors.push(`${question.globalId}: reviewed content is missing a concise explanation`);
  if (!String(override.sentenceTranslation || '').trim()) hardErrors.push(`${question.globalId}: reviewed content is missing a sentence translation`);
  if (logicSteps.length < 2 || logicSteps.some((step) => !String(step?.title || '').trim() || !String(step?.text || '').trim())) {
    hardErrors.push(`${question.globalId}: reviewed content needs at least two complete logic steps`);
  }
  (question.options || []).forEach((option) => {
    if (!String(optionReviews[option.text] || '').trim()) hardErrors.push(`${question.globalId}: missing dedicated reason for ${option.text}`);
    if (!String(contextualGlosses[option.text] || '').trim()) hardErrors.push(`${question.globalId}: missing contextual gloss for ${option.text}`);
  });
  if (genericExplanation.test(String(override.concise || '')) || logicSteps.some((step) => genericExplanation.test(String(step?.text || '')))) {
    hardErrors.push(`${question.globalId}: reviewed content contains generic explanation language`);
  }
  dedicatedExplanations += 1;
  dedicatedHints += 1;
});

let suspiciousDerivatives = 0;
let weakLexiconHooks = 0;
Object.values(lexicon).forEach((entry) => {
  suspiciousDerivatives += (entry.derivatives || []).filter((word) => suspiciousDerivative.test(String(word))).length;
  weakLexiconHooks += (entry.memoryHooks || []).filter((hook) => weakHook.test(String(hook?.text || ''))).length;
});

let weakBarronHooks = 0;
(Array.isArray(barron) ? barron : []).forEach((entry) => {
  weakBarronHooks += (entry.mnemonics || []).filter((hook) => weakHook.test(String(hook?.text || ''))).length;
});

const report = {
  generatedAt: new Date().toISOString(),
  questions: {
    total: questions.length,
    reviewedOverrides: Object.keys(overrides).length,
    dedicatedExplanations,
    dedicatedHints,
    questionsWithoutDedicatedExplanation: questions.length - dedicatedExplanations,
    questionsWithoutDedicatedHint: questions.length - dedicatedHints,
    displayedTemplateExplanations: 0,
    genericExplanations: genericCount,
    missingSentenceTranslations,
    missingOptionTranslations,
  },
  lexicon: {
    totalEntries: Object.keys(lexicon).length,
    suspiciousDerivatives,
    weakHooks: weakLexiconHooks,
  },
  barron: {
    totalEntries: Array.isArray(barron) ? barron.length : 0,
    weakHooks: weakBarronHooks,
  },
  hardErrors,
  warnings: warnings.slice(0, 30),
};

console.log(JSON.stringify(report, null, 2));
if (hardErrors.length) process.exitCode = 1;
