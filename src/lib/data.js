import questionsData from '../data/questions.json';
import questionMeta from '../data/question_meta.json';
import lexiconData from '../data/lexicon_seed.json';
import barronWordsData from '../data/barron_words.json';
import optionTranslations from '../data/option_translations.json';
import explanationTranslations from '../data/explanation_translations.json';
import { api } from './api';

const RAW_QUESTIONS = questionsData?.questions || [];
const QUESTION_STEM_BY_ID = new Map(
  RAW_QUESTIONS.map((question) => [question.globalId, question.stem || ''])
);

const GLOBAL_STORAGE_KEYS = {
  USERS: 'moonspell_users',
  CURRENT_USER: 'moonspell_current_user',
  WORD_LOOKUPS: 'moonspell_word_lookups',
};

const USER_STORAGE_FIELDS = {
  BOOKMARKS: 'bookmarks',
  MISTAKES: 'mistakes',
  WORD_BOOKMARKS: 'word_bookmarks',
  OPTION_BOOKMARKS: 'option_bookmarks',
  HISTORY: 'history',
};

const HISTORY_SYNC_MIN_INTERVAL_MS = 60 * 1000;
const historySyncTimers = new Map();
const historySyncInFlight = new Set();
const historySyncLastRunAt = new Map();

const WORDBOOK_SYNC_MIN_INTERVAL_MS = 10 * 1000;
const wordbookSyncTimers = new Map();
const wordbookSyncInFlight = new Set();
const wordbookSyncLastRunAt = new Map();
const wordbookHydratedUsers = new Set();

const BARRON_WORDS = Array.isArray(barronWordsData) ? barronWordsData : [];
const BARRON_LESSON_THEMES = {
  1: 'Using Few Words or Being Quiet',
  2: 'Speaking',
  3: 'Feeling Superior',
  4: 'Unoriginal, Dull, Played Out',
  5: 'Lessening Pain, Tension, or Conflict',
  6: 'Friendly and Agreeable',
  7: 'Quarreling, Fighting, and Bitter Feelings',
  8: 'Generosity; Showing Concern for Others',
  9: 'Cheapness or Care with Spending Money',
  10: 'Problems, Puzzlements, and Disasters',
  11: 'Harmful or Mean',
  12: 'Criticizing, Disapproving, or Scolding',
  13: 'Lacking Interest or Emotion',
  14: 'Lacking Energy or Movement',
  15: 'Humility and Obedience',
  16: 'Enthusiasm and Passion',
  17: 'Being Stubborn',
  18: 'Sound',
  19: 'Praise and Respect',
  20: 'More Than Enough',
  21: 'Food and Hunger',
  22: 'Being Careful',
  23: 'Being Short-Lived in Time or Place',
  24: 'Old or New',
  25: 'Being Sneaky or Hardly Noticeable',
  26: 'People You Will Meet on the SAT',
  27: 'Having Little Importance or Value',
  28: 'Being Wise and Sharp-Minded',
  29: 'Words That Look/Sound Alike (Tricky Twins)',
  30: 'More Tricky Twins and Triplets',
  31: 'Hottest Hot Words: A to G',
  32: 'Hottest Hot Words: H to P',
  33: 'Hottest Hot Words: Q to Z',
  34: 'More Hot Words',
  35: 'Even More Hot Words',
  36: 'Literary Terms for the SAT Essay',
  37: 'Literary Terms for the SAT Essay II',
};

const readStorage = (key, defaultVal) => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultVal;
  } catch (e) {
    console.error('Storage error', e);
    return defaultVal;
  }
};

const writeStorage = (key, val) => {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (e) {
    console.error('Storage set error', e);
  }
};

const slugify = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const normalizeEmail = (value) => String(value ?? '').trim().toLowerCase();

const normalizeText = (value) =>
  String(value ?? '')
    .toLowerCase()
    .replace(/[“”"']/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeWord = (value) =>
  String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z'-]/g, '')
    .trim();

const OPTION_PART_SPLIT_RE = /(?:\s*(?:\.\s*\.\s*|\.{2,}|…+|[。.]\s*[。.])\s*|\s+[\/\\|]\s+)/;

const toDisplayText = (value) =>
  String(value ?? '')
    .replace(/[。.]\s*[。.]/g, ' / ')
    .replace(/\s*\/\s*\/\s*/g, ' / ')
    .replace(/\s*\/\s*/g, ' / ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^\/\s*|\s*\/$/g, '')
    .trim();

const toTitleCase = (value) => {
  const safe = String(value ?? '').trim();
  return safe ? safe.charAt(0).toUpperCase() + safe.slice(1) : safe;
};

const truncateSentence = (value, limit = 110) => {
  const safe = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (!safe) return '';
  return safe.length > limit ? `${safe.slice(0, limit).trim()}...` : safe;
};

const COMMON_PREFIXES = ['ab', 'ad', 'anti', 'auto', 'bene', 'circum', 'contra', 'de', 'dis', 'en', 'ex', 'extra', 'fore', 'hyper', 'im', 'in', 'inter', 'intro', 'mal', 'mis', 'non', 'over', 'post', 'pre', 'pro', 're', 'sub', 'super', 'trans', 'under'];
const COMMON_SUFFIXES = ['able', 'ably', 'acy', 'al', 'ally', 'ance', 'ant', 'ary', 'ate', 'ation', 'ed', 'ence', 'ent', 'er', 'ery', 'ful', 'hood', 'ic', 'ical', 'ify', 'ing', 'ion', 'ious', 'ism', 'ist', 'ity', 'ive', 'ize', 'less', 'logy', 'ly', 'ment', 'ness', 'ory', 'ous', 'ship', 'tion', 'ty', 'ure', 'y'];

const buildUserId = ({ username, email }) => {
  const normalizedEmail = normalizeEmail(email);
  if (normalizedEmail) {
    return `user:${normalizedEmail}`;
  }

  const normalizedUsername = slugify(username);
  if (normalizedUsername) {
    return `user:${normalizedUsername}`;
  }

  return `user:${Date.now()}`;
};

const buildUserStorageKey = (userId, field) => `moonspell_user:${userId}:${field}`;

const getStoredUsers = () => readStorage(GLOBAL_STORAGE_KEYS.USERS, []);

const saveStoredUsers = (users) => {
  writeStorage(GLOBAL_STORAGE_KEYS.USERS, users);
  return users;
};

const getCurrentUserFromStorage = () => readStorage(GLOBAL_STORAGE_KEYS.CURRENT_USER, null);

const getCurrentUserId = () => getCurrentUserFromStorage()?.id || null;

const getUserStorage = (field, defaultVal, userId = getCurrentUserId()) => {
  if (!userId) {
    return defaultVal;
  }
  return readStorage(buildUserStorageKey(userId, field), defaultVal);
};

const setUserStorage = (field, value, userId = getCurrentUserId()) => {
  if (!userId) {
    return value;
  }
  writeStorage(buildUserStorageKey(userId, field), value);
  return value;
};

const normalizeWordBookmarksList = (words = []) =>
  [...new Set((words || []).map((word) => normalizeWord(word)).filter(Boolean))];

const getUserWordBookmarks = (userId = getCurrentUserId()) => {
  const bookmarks = getUserStorage(USER_STORAGE_FIELDS.WORD_BOOKMARKS, [], userId);
  const normalized = normalizeWordBookmarksList(bookmarks);

  if (
    normalized.length !== (bookmarks || []).length ||
    normalized.some((word, index) => word !== bookmarks[index])
  ) {
    setUserStorage(USER_STORAGE_FIELDS.WORD_BOOKMARKS, normalized, userId);
  }

  return normalized;
};

const upsertUserProfile = (profile) => {
  const users = getStoredUsers();
  const index = users.findIndex((user) => user.id === profile.id);
  const nextProfile = index === -1 ? profile : { ...users[index], ...profile };
  const nextUsers = index === -1
    ? [...users, nextProfile]
    : users.map((user, userIndex) => (userIndex === index ? nextProfile : user));

  saveStoredUsers(nextUsers);
  return nextProfile;
};

const setCurrentUser = (profile) => {
  writeStorage(GLOBAL_STORAGE_KEYS.CURRENT_USER, profile);
  return profile;
};

const normalizeRecordForSync = (record) => {
  const answerIndex = Number.isInteger(record?.answerIndex) ? record.answerIndex : -1;
  return {
    ...record,
    id: record?.id,
    questionId: record?.questionId,
    correct: Boolean(record?.correct),
    answerLetter: answerIndex >= 0 ? String.fromCharCode(65 + answerIndex) : '',
    mode: record?.mode || 'practice',
    durationMs: Number(record?.durationMs || 0),
    at: record?.at || new Date().toISOString(),
  };
};

const syncUserHistoryToServer = async (user, { force = false } = {}) => {
  const userId = user?.id;
  if (!userId) return null;

  const now = Date.now();
  const lastRunAt = historySyncLastRunAt.get(userId) || 0;
  if (!force && now - lastRunAt < HISTORY_SYNC_MIN_INTERVAL_MS) {
    return null;
  }
  if (historySyncInFlight.has(userId)) {
    return null;
  }

  const history = getUserStorage(USER_STORAGE_FIELDS.HISTORY, [], userId);
  if (!Array.isArray(history) || history.length === 0) {
    historySyncLastRunAt.set(userId, now);
    return { success: true, total: 0, inserted: 0, ignored: 0 };
  }

  historySyncInFlight.add(userId);
  try {
    const payload = history
      .map(normalizeRecordForSync)
      .filter((entry) => entry && entry.questionId);
    const result = await api.submitRecordsBulk(user, payload);
    if (result?.success) {
      historySyncLastRunAt.set(userId, Date.now());
    }
    return result;
  } finally {
    historySyncInFlight.delete(userId);
  }
};

const scheduleUserHistorySync = (user, { force = false, delayMs = 900 } = {}) => {
  const userId = user?.id;
  if (!userId) return;

  const pendingTimer = historySyncTimers.get(userId);
  if (pendingTimer) {
    clearTimeout(pendingTimer);
  }

  const nextTimer = setTimeout(() => {
    historySyncTimers.delete(userId);
    syncUserHistoryToServer(user, { force }).catch(() => {});
  }, Math.max(0, delayMs));

  historySyncTimers.set(userId, nextTimer);
};

const hydrateWordBookmarksFromServer = async (user, { force = false } = {}) => {
  const userId = user?.id;
  if (!userId) return getUserWordBookmarks(userId);

  if (!force && wordbookHydratedUsers.has(userId)) {
    return getUserWordBookmarks(userId);
  }

  const localWords = getUserWordBookmarks(userId);
  const remoteWords = await api.fetchWordbook(userId);
  if (!Array.isArray(remoteWords)) {
    return localWords;
  }

  const mergedWords = normalizeWordBookmarksList([...localWords, ...remoteWords]);
  setUserStorage(USER_STORAGE_FIELDS.WORD_BOOKMARKS, mergedWords, userId);
  wordbookHydratedUsers.add(userId);
  return mergedWords;
};

const pushWordBookmarksToServer = async (user, { force = false } = {}) => {
  const userId = user?.id;
  if (!userId) return null;

  const now = Date.now();
  const lastRunAt = wordbookSyncLastRunAt.get(userId) || 0;
  if (!force && now - lastRunAt < WORDBOOK_SYNC_MIN_INTERVAL_MS) {
    return null;
  }
  if (wordbookSyncInFlight.has(userId)) {
    return null;
  }

  wordbookSyncInFlight.add(userId);
  try {
    const words = getUserWordBookmarks(userId);
    const result = await api.replaceWordbook(user, words);
    if (result?.success) {
      wordbookSyncLastRunAt.set(userId, Date.now());
      return result;
    }
    return null;
  } finally {
    wordbookSyncInFlight.delete(userId);
  }
};

const scheduleWordbookSync = (user, { force = false, delayMs = 700 } = {}) => {
  const userId = user?.id;
  if (!userId) return;

  const pendingTimer = wordbookSyncTimers.get(userId);
  if (pendingTimer) {
    clearTimeout(pendingTimer);
  }

  const nextTimer = setTimeout(() => {
    wordbookSyncTimers.delete(userId);
    pushWordBookmarksToServer(user, { force }).catch(() => {});
  }, Math.max(0, delayMs));

  wordbookSyncTimers.set(userId, nextTimer);
};

const touchCurrentUser = (patch = {}) => {
  const currentUser = getCurrentUserFromStorage();
  if (!currentUser) {
    return null;
  }

  const nextUser = upsertUserProfile({
    ...currentUser,
    ...patch,
    lastActivityAt: new Date().toISOString(),
  });
  setCurrentUser(nextUser);
  return nextUser;
};

const makeOptionBookmarkId = (questionId, optionIndex) => `${questionId}::${optionIndex}`;

const splitOptionParts = (value) =>
  String(value ?? '')
    .split(OPTION_PART_SPLIT_RE)
    .map((part) => part.trim())
    .filter(Boolean);

const hasChinese = (value) => /[\u4e00-\u9fff]/.test(String(value || ''));

const resolveAnswerIndex = (question, meta) => {
  if (Number.isInteger(question.answer)) {
    return question.answer;
  }

  if (typeof question.answer === 'string') {
    const answerIndex = question.options.findIndex(
      (option) => normalizeText(option.text) === normalizeText(question.answer)
    );
    if (answerIndex !== -1) {
      return answerIndex;
    }
  }

  if (meta && meta.answerLetter) {
    return meta.answerLetter.charCodeAt(0) - 65;
  }

  return -1;
};

const getAnswerText = (question, answerIndex) => {
  if (answerIndex >= 0 && question.options[answerIndex]) {
    return question.options[answerIndex].text;
  }
  if (typeof question.answer === 'string') {
    return question.answer;
  }
  return '';
};

const extractCueFragments = (sentence, explanation) => {
  const quoteMatches = Array.from(
    String(explanation || '').matchAll(/[“"]([^”"]+)[”"]/g),
    (match) => match[1].trim()
  ).filter(Boolean);

  if (quoteMatches.length) {
    return [...new Set(quoteMatches)].slice(0, 3);
  }

  return String(sentence || '')
    .split(/[,:;]+/)
    .map((part) => part.replace(/_+/g, 'blank').trim())
    .filter(Boolean)
    .slice(0, 2);
};

const cleanTranslatedExplanation = (text) =>
  String(text || '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.!?;:])/g, '$1')
    .trim();

const pickReasoningText = (question, meta) => {
  const bakedExplanation = cleanTranslatedExplanation(question.explanation || '');
  if (hasChinese(bakedExplanation)) {
    return bakedExplanation;
  }

  const translated = cleanTranslatedExplanation(explanationTranslations[question.globalId] || '');
  if (translated) {
    return translated;
  }

  if (meta?.walkthroughExplanation) {
    return cleanTranslatedExplanation(meta.walkthroughExplanation);
  }

  if (bakedExplanation) {
    return bakedExplanation;
  }

  return '这题需要根据句子上下文判断空格处的词义和语气。';
};

const findPrefix = (word) =>
  COMMON_PREFIXES.find((prefix) => word.startsWith(prefix) && word.length - prefix.length >= 4) || '';

const findSuffix = (word) =>
  COMMON_SUFFIXES.find((suffix) => word.endsWith(suffix) && word.length - suffix.length >= 3) || '';

const cleanDerivatives = (word, derivatives = []) => {
  const baseWord = normalizeWord(word);
  const blockedPatterns = [
    /lyly$/,
    /nessness$/,
    /mentment$/,
    /nessly$/,
    /lyness$/,
    /nessment$/,
  ];

  return [...new Set((derivatives || []).map((entry) => String(entry || '').trim()).filter(Boolean))]
    .filter((entry) => normalizeWord(entry) !== baseWord)
    .filter((entry) => !blockedPatterns.some((pattern) => pattern.test(entry.toLowerCase())))
    .filter((entry) => {
      const normalized = normalizeWord(entry);
      if (!normalized) return false;
      if (baseWord.endsWith('y') && normalized === `${baseWord}s`) return false;
      if (baseWord.endsWith('ly') && (normalized.endsWith('ly') || normalized.endsWith('ness'))) return false;
      if (
        (normalized === `${baseWord}ment` || normalized === `${baseWord}ments`) &&
        /(ed|ly|ous|ive|al|ary|ory|ic)$/.test(baseWord)
      ) return false;
      if (normalized.includes(`${baseWord}${baseWord.slice(-2)}`)) return false;
      return true;
    })
    .slice(0, 8);
};

const buildQuestionAnchorHook = (word, relatedQuestionIds = []) => {
  const anchorQuestionId = relatedQuestionIds[0];
  const sentence = QUESTION_STEM_BY_ID.get(anchorQuestionId) || '';
  const snippet = truncateSentence(sentence, 96);

  if (anchorQuestionId && snippet) {
    return {
      type: 'context',
      title: '题目锚点',
      text: `把 ${toTitleCase(word)} 绑回 ${anchorQuestionId}。再次遇到这道题时，先回想这句：${snippet}`,
    };
  }

  return {
    type: 'context',
    title: '语境联想',
    text: `把 ${toTitleCase(word)} 放回题目语境里记，不要孤立背词。先记它在句子里负责表达的语气和逻辑。`,
  };
};

const buildStructureHook = (word) => {
  const cleanWord = normalizeWord(word);
  const prefix = findPrefix(cleanWord);
  const suffix = findSuffix(cleanWord);

  if (prefix && suffix && cleanWord.length - prefix.length - suffix.length >= 2) {
    const stem = cleanWord.slice(prefix.length, cleanWord.length - suffix.length);
    return {
      type: 'morphology',
      title: '词形拆分',
      text: `${toTitleCase(word)} 可以拆成 ${prefix} + ${stem} + ${suffix}。先抓中间词干，再把前后缀当功能标签记。`,
    };
  }

  if (suffix) {
    return {
      type: 'suffix',
      title: '后缀提示',
      text: `${toTitleCase(word)} 末尾的 -${suffix} 很关键。背词时先记词尾常见功能，再回到整词意义。`,
    };
  }

  if (prefix) {
    return {
      type: 'prefix',
      title: '前缀提示',
      text: `${toTitleCase(word)} 前半段的 ${prefix}- 可以当路标。先记前缀方向，再记后面的核心词干。`,
    };
  }

  const chunks = cleanWord.match(/[aeiouy]*[^aeiouy]+|[aeiouy]+/g) || [cleanWord];
  const displayChunks = chunks.filter(Boolean).slice(0, 3).join(' / ');
  return {
    type: 'chunk',
    title: '分块记忆',
    text: `${toTitleCase(word)} 可以按 ${displayChunks} 这样分块读两遍。先记字形节奏，再回想它在题目里的意思。`,
  };
};

const normalizeMemoryHook = (hook) => {
  if (!hook || !hook.text) return null;
  return {
    type: hook.type || 'memory',
    title: hook.title || '记忆提示',
    text: String(hook.text).trim(),
  };
};

const ensureTwoMemoryHooks = (word, entry = {}) => {
  const hooks = (entry.memoryHooks || [])
    .map(normalizeMemoryHook)
    .filter(Boolean);

  const fallbackHooks = [
    buildQuestionAnchorHook(word, entry.relatedQuestionIds || []),
    buildStructureHook(word),
  ];

  const deduped = [];
  [...hooks, ...fallbackHooks].forEach((hook) => {
    if (!hook) return;
    if (deduped.some((existing) => existing.text === hook.text)) return;
    deduped.push(hook);
  });

  while (deduped.length < 2) {
    deduped.push({
      type: 'review',
      title: '复现提醒',
      text: `把 ${toTitleCase(word)} 放回原题复现一遍，再用 Cambridge / Merriam 的英文义确认细微差别。`,
    });
  }

  return deduped.slice(0, 2);
};

const toBarronMemoryHooks = (item = {}) => {
  const hooks = (item.mnemonics || [])
    .map((hook, index) => ({
      type: 'barron',
      title: String(hook?.method || `Barron Hook ${index + 1}`).trim(),
      text: String(hook?.text || '').trim(),
    }))
    .filter((hook) => hook.text);

  if (hooks.length >= 2) {
    return hooks.slice(0, 2);
  }

  return ensureTwoMemoryHooks(item.word || '', { memoryHooks: hooks });
};

const mapBarronWordEntry = (item = {}) => {
  const cleanWord = normalizeWord(item.word);
  if (!cleanWord) return null;

  const defEn = String(item.barron_def_en || item.cambridge_en || '').trim();
  const defZh = toDisplayText(item.barron_zh || item.cambridge_zh || '');
  const shortDefs = [defEn, String(item.cambridge_en || '').trim()].filter(Boolean);

  return {
    word: cleanWord,
    displayWord: item.word || cleanWord,
    partOfSpeech: item.pos || '',
    shortDefs: [...new Set(shortDefs)],
    barronZh: defZh,
    barronEn: defEn,
    phonetic: item.ipa_us || item.ipa_uk || '',
    ipaUk: item.ipa_uk || '',
    ipaUs: item.ipa_us || '',
    audioUrl: item.audio_us || item.audio_uk || '',
    audioUkUrl: item.audio_uk || '',
    audioUsUrl: item.audio_us || '',
    memoryHooks: toBarronMemoryHooks(item),
    derivatives: [],
    relatedQuestionIds: [],
    authorityExamples: [],
    source: item.source || '',
    cambridgeUrl:
      item.source ||
      `https://dictionary.cambridge.org/us/search/english/direct/?q=${encodeURIComponent(cleanWord)}`,
    merriamUrl: `https://www.merriam-webster.com/dictionary/${encodeURIComponent(cleanWord)}`,
    lesson: Number(item.lesson || 0) || 0,
    theme: BARRON_LESSON_THEMES[Number(item.lesson || 0)] || '',
    sourceType: 'barron',
  };
};

const BARRON_WORD_ENTRIES = BARRON_WORDS
  .map(mapBarronWordEntry)
  .filter(Boolean)
  .sort((left, right) => {
    const lessonDiff = (left.lesson || 0) - (right.lesson || 0);
    if (lessonDiff !== 0) return lessonDiff;
    return left.word.localeCompare(right.word);
  });

const BARRON_WORD_ENTRY_MAP = new Map(BARRON_WORD_ENTRIES.map((entry) => [entry.word, entry]));

const buildBarronLessons = () => {
  const grouped = new Map();
  BARRON_WORD_ENTRIES.forEach((entry) => {
    const lesson = entry.lesson || 0;
    const list = grouped.get(lesson) || [];
    list.push(entry);
    grouped.set(lesson, list);
  });

  return [...grouped.entries()]
    .sort((left, right) => left[0] - right[0])
    .map(([lesson, words], index) => ({
      id: `lesson-${lesson}`,
      lesson,
      title: `Lesson ${lesson}`,
      theme: BARRON_LESSON_THEMES[lesson] || '',
      index,
      words,
    }));
};

const BARRON_LESSON_LIST = buildBarronLessons();

const getOptionTranslation = (optionText) => {
  const safeOptionText = String(optionText ?? '').trim();
  if (!safeOptionText) {
    return '';
  }

  const fullTranslation = toDisplayText(optionTranslations[safeOptionText] || '');
  const parts = splitOptionParts(safeOptionText);

  if (parts.length <= 1) {
    const singleTranslation = toDisplayText(optionTranslations[parts[0]] || '');
    return singleTranslation || fullTranslation || safeOptionText;
  }

  const translatedParts = parts.map((part) => toDisplayText(optionTranslations[part] || ''));
  if (translatedParts.every(Boolean)) {
    return toDisplayText(translatedParts.join(' / '));
  }

  if (fullTranslation) {
    return fullTranslation;
  }

  return toDisplayText(parts.join(' / '));
};

const buildConciseAnalysis = (question, answerIndex, answerText, answerTranslation, reasoning) => {
  const answerLetter = answerIndex >= 0 ? String.fromCharCode(65 + answerIndex) : '?';
  const cues = extractCueFragments(question.stem, reasoning);
  const cueText = cues.length ? cues.map((cue) => `“${cue}”`).join('、') : '上下文';
  const answerParts = splitOptionParts(answerTranslation);

  if ((question.blankCount || 1) > 1) {
    if (answerParts.length > 1) {
      return `看 ${cueText}。这题两空要一起成立：第一空应接近“${answerParts[0]}”，第二空应接近“${answerParts[1]}”，所以选 ${answerLetter}. ${answerText}。`;
    }
    return `看 ${cueText}。这题两空要一起成立，只有 ${answerLetter}. ${answerText}（${answerTranslation}）能把前后逻辑同时接上。`;
  }

  return `看 ${cueText}。空格处需要表达“${answerTranslation}”这层意思，放回原句最顺，所以选 ${answerLetter}. ${answerText}。`;
};

const buildOptionReviews = (question, answerIndex, answerText, answerTranslation, reasoning) => {
  const cues = extractCueFragments(question.stem, reasoning);
  const cueText = cues.length ? cues.map((cue) => `“${cue}”`).join('、') : '上下文';

  return (question.options || []).map((option, optionIndex) => {
    const optionText = option.text;
    const translation = getOptionTranslation(optionText);
    const isCorrect = optionIndex === answerIndex;

    let reason = '';
    if (isCorrect) {
      if ((question.blankCount || 1) > 1) {
        reason = `正确。这个组合表示“${translation}”，能同时满足两空逻辑；结合 ${cueText}，句子需要的正是这一组搭配。`;
      } else {
        reason = `正确。“${translation}”最符合句子语境；结合 ${cueText}，这里需要的就是“${answerTranslation}”这一层意思。`;
      }
    } else if ((question.blankCount || 1) > 1) {
      reason = `不对。“${translation}”这组搭配放回句中后，前后两空不能同时成立；结合 ${cueText}，句子真正需要的是“${answerTranslation}”。`;
    } else {
      reason = `不对。“${translation}”与句意不符；结合 ${cueText}，这里要表达的是“${answerTranslation}”，不是“${translation}”。`;
    }

    return {
      label: option.label,
      text: optionText,
      translation,
      isCorrect,
      reason,
    };
  });
};

const buildAnalysis = (question, answerIndex, reasoning) => {
  const answerText = getAnswerText(question, answerIndex);
  const answerTranslation = getOptionTranslation(answerText);
  return {
    answerLetter: answerIndex >= 0 ? String.fromCharCode(65 + answerIndex) : '?',
    answerText,
    answerTranslation,
    cues: extractCueFragments(question.stem, reasoning),
    reasoning,
    concise: buildConciseAnalysis(question, answerIndex, answerText, answerTranslation, reasoning),
    optionReviews: buildOptionReviews(question, answerIndex, answerText, answerTranslation, reasoning),
  };
};

const isSameDay = (isoString, date = new Date()) => {
  if (!isoString) return false;
  const attemptDate = new Date(isoString);
  return (
    attemptDate.getFullYear() === date.getFullYear() &&
    attemptDate.getMonth() === date.getMonth() &&
    attemptDate.getDate() === date.getDate()
  );
};

const parseWordLookupResponse = (word, payload) => {
  if (!Array.isArray(payload) || !payload.length) {
    return null;
  }

  const entry = payload[0] || {};
  const phonetic =
    entry.phonetic ||
    (entry.phonetics || []).map((item) => item?.text).find(Boolean) ||
    '';
  const audioUrl =
    (entry.phonetics || []).map((item) => item?.audio).find(Boolean) ||
    '';

  const meanings = (entry.meanings || [])
    .map((meaning) => ({
      partOfSpeech: meaning?.partOfSpeech || '',
      definitions: (meaning?.definitions || [])
        .map((definition) => definition?.definition)
        .filter(Boolean)
        .slice(0, 2),
    }))
    .filter((meaning) => meaning.definitions.length > 0)
    .slice(0, 3);

  const shortDefs = meanings.flatMap((meaning) => meaning.definitions).slice(0, 3);

  if (!phonetic && !audioUrl && shortDefs.length === 0) {
    return null;
  }

  return {
    word: entry.word || word,
    phonetic,
    audioUrl,
    meanings,
    shortDefs,
    partOfSpeech: meanings[0]?.partOfSpeech || '',
    fetchedAt: new Date().toISOString(),
  };
};

export const DataManager = {
  // === Questions ===
  getAllQuestions: () => {
    const questions = questionsData?.questions || [];
    
    return questions.map(q => {
      const meta = questionMeta.questions ? questionMeta.questions[q.globalId] : undefined;
      
      let answerIndex = resolveAnswerIndex(q, meta);
      let explanation = pickReasoningText(q, meta);
      let translation = q.translation || "";
      const options = (q.options || []).map(o => o.text);
      const optionDetails = (q.options || []).map((option) => ({
        label: option.label,
        text: option.text,
        translation: getOptionTranslation(option.text),
      }));
      const analysis = buildAnalysis(q, answerIndex, explanation);

      return {
        id: q.globalId,
        localId: q.localId || q.globalId,
        sentence: q.stem, // Map stem to sentence
        options: options,
        optionDetails,
        difficulty: q.difficulty || 1, // Default to 1 if missing
        answer: answerIndex,
        answerText: getAnswerText(q, answerIndex),
        explanation: explanation,
        translation: translation,
        section: q.sectionDisplayName,
        sectionCode: q.sectionCode,
        analysis,
        meta: meta // Keep raw meta just in case
      };
    });
  },

  getSections: () => {
    return questionsData?.sections || [];
  },
  
  getDebugInfo: () => {
    return {
        questionsDataExists: !!questionsData,
        questionsArrayExists: !!(questionsData && questionsData.questions),
        questionsLength: questionsData && questionsData.questions ? questionsData.questions.length : -1,
        sectionsLength: questionsData && questionsData.sections ? questionsData.sections.length : -1,
        metaExists: !!questionMeta,
        metaQuestionsExists: !!(questionMeta && questionMeta.questions),
    };
  },

  // === Lexicon ===
  getWord: (word) => {
    if (!word) return null;
    const cleanWord = normalizeWord(word);
    if (!cleanWord) return null;

    const cachedLookup = DataManager.getCachedWordLookup(cleanWord);
    const barronEntry = BARRON_WORD_ENTRY_MAP.get(cleanWord) || null;
    let seedEntry = null;

    // Try exact match
    if (lexiconData.entries[cleanWord]) {
      seedEntry = lexiconData.entries[cleanWord];
    }
    // Try singular/plural? (Simple heuristic)
    if (!seedEntry && cleanWord.endsWith('s') && lexiconData.entries[cleanWord.slice(0, -1)]) {
      seedEntry = lexiconData.entries[cleanWord.slice(0, -1)];
    }

    const merged = {
      ...(seedEntry || {}),
      ...(barronEntry || {}),
      ...(cachedLookup || {}),
      word: seedEntry?.word || barronEntry?.word || cachedLookup?.word || cleanWord,
      displayWord: barronEntry?.displayWord || seedEntry?.word || cleanWord,
      relatedQuestionIds: seedEntry?.relatedQuestionIds || barronEntry?.relatedQuestionIds || [],
      memoryHooks: ensureTwoMemoryHooks(cleanWord, {
        ...(seedEntry || {}),
        ...(barronEntry || {}),
      }),
      authorityExamples: seedEntry?.authorityExamples || barronEntry?.authorityExamples || [],
      derivatives: cleanDerivatives(cleanWord, seedEntry?.derivatives || barronEntry?.derivatives || []),
      cambridgeUrl:
        barronEntry?.cambridgeUrl ||
        seedEntry?.cambridgeUrl ||
        `https://dictionary.cambridge.org/us/search/english/direct/?q=${encodeURIComponent(cleanWord)}`,
      merriamUrl:
        barronEntry?.merriamUrl ||
        seedEntry?.merriamUrl ||
        `https://www.merriam-webster.com/dictionary/${encodeURIComponent(cleanWord)}`,
      barronZh: barronEntry?.barronZh || '',
      barronEn: barronEntry?.barronEn || '',
      lesson: barronEntry?.lesson || 0,
      theme: barronEntry?.theme || '',
      sourceType: barronEntry ? 'barron' : 'lexicon',
    };

    if (!merged.shortDefs?.length && barronEntry?.shortDefs?.length) {
      merged.shortDefs = barronEntry.shortDefs;
    }
    if (!merged.phonetic && barronEntry?.phonetic) {
      merged.phonetic = barronEntry.phonetic;
    }
    if (!merged.audioUrl && barronEntry?.audioUrl) {
      merged.audioUrl = barronEntry.audioUrl;
    }
    if (!merged.partOfSpeech && barronEntry?.partOfSpeech) {
      merged.partOfSpeech = barronEntry.partOfSpeech;
    }

    return merged;
  },
  
  getAllWords: () => {
      return [...Object.values(lexiconData.entries), ...BARRON_WORD_ENTRIES];
  },

  getBarronWords: () => BARRON_WORD_ENTRIES,

  getBarronLessons: () => BARRON_LESSON_LIST,

  getBarronWord: (word) => {
    const cleanWord = normalizeWord(word);
    if (!cleanWord) return null;
    return BARRON_WORD_ENTRY_MAP.get(cleanWord) || null;
  },

  getWordbookEntries: () => {
    return DataManager.getWordBookmarks()
      .map((word) => DataManager.getWord(word))
      .filter(Boolean)
      .map((entry, index) => ({
        ...entry,
        notebookIndex: index + 1,
      }));
  },

  getWordbookSummary: () => {
    const entries = DataManager.getWordbookEntries();
    const withLookup = entries.filter((entry) => entry.shortDefs?.length || entry.phonetic || entry.audioUrl).length;
    const withRelated = entries.filter((entry) => (entry.relatedQuestionIds || []).length > 0).length;
    const withHooks = entries.filter((entry) => (entry.memoryHooks || []).length >= 2).length;
    const suggestedDeckSize = entries.length <= 12 ? entries.length : Math.min(20, Math.max(12, Math.ceil(entries.length / 3)));

    return {
      totalWords: entries.length,
      withLookup,
      withHooks,
      withRelated,
      suggestedDeckSize,
    };
  },

  getCachedWordLookup: (word) => {
    const cleanWord = normalizeWord(word);
    if (!cleanWord) return null;
    const cache = readStorage(GLOBAL_STORAGE_KEYS.WORD_LOOKUPS, {});
    return cache[cleanWord] || null;
  },

  fetchWordLookup: async (word) => {
    const cleanWord = normalizeWord(word);
    if (!cleanWord) return null;

    const cached = DataManager.getCachedWordLookup(cleanWord);
    if (cached) {
      return cached;
    }

    try {
      const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(cleanWord)}`);
      if (!response.ok) {
        return null;
      }

      const payload = await response.json();
      const parsed = parseWordLookupResponse(cleanWord, payload);
      if (!parsed) {
        return null;
      }

      const cache = readStorage(GLOBAL_STORAGE_KEYS.WORD_LOOKUPS, {});
      cache[cleanWord] = parsed;
      writeStorage(GLOBAL_STORAGE_KEYS.WORD_LOOKUPS, cache);
      return parsed;
    } catch (_error) {
      return null;
    }
  },

  // === Session ===
  getCurrentUser: () => {
    const user = getCurrentUserFromStorage();
    if (user?.id) {
      scheduleUserHistorySync(user);
      hydrateWordBookmarksFromServer(user).then(() => {
        scheduleWordbookSync(user, { force: true, delayMs: 500 });
      }).catch(() => {});
    }
    return user;
  },
  getAllUsers: () => getStoredUsers(),
  findUserByEmail: (email) => {
    const safeEmail = normalizeEmail(email);
    if (!safeEmail) return null;
    return getStoredUsers().find((user) => normalizeEmail(user.email) === safeEmail) || null;
  },

  registerUser: ({ username, email, password }) => {
    const safeUsername = String(username ?? '').trim();
    const safeEmail = normalizeEmail(email);
    if (!safeUsername || !safeEmail) return { error: 'missing_fields' };

    const existing = DataManager.findUserByEmail(safeEmail);
    if (existing) return { error: 'email_taken' };

    const now = new Date().toISOString();
    const id = buildUserId({ username: safeUsername, email: safeEmail });
    const nextUser = upsertUserProfile({
      id,
      username: safeUsername,
      name: safeUsername,
      email: safeEmail,
      password: password || '',
      className: 'Independent',
      grade: 'SAT SC',
      createdAt: now,
      lastLoginAt: now,
      lastActivityAt: now,
    });

    setCurrentUser(nextUser);
    scheduleUserHistorySync(nextUser, { force: true, delayMs: 400 });
    hydrateWordBookmarksFromServer(nextUser, { force: true })
      .then(() => {
        scheduleWordbookSync(nextUser, { force: true, delayMs: 600 });
      })
      .catch(() => {});
    return { user: nextUser };
  },

  loginUser: ({ email, password }) => {
    const safeEmail = normalizeEmail(email);
    if (!safeEmail) return { error: 'missing_fields' };

    const existing = DataManager.findUserByEmail(safeEmail);
    if (!existing) return { error: 'not_found' };

    if ((existing.password || '') !== (password || '')) return { error: 'wrong_password' };

    const now = new Date().toISOString();
    const nextUser = upsertUserProfile({
      ...existing,
      lastLoginAt: now,
      lastActivityAt: now,
    });

    setCurrentUser(nextUser);
    scheduleUserHistorySync(nextUser, { force: true, delayMs: 400 });
    hydrateWordBookmarksFromServer(nextUser, { force: true })
      .then(() => {
        scheduleWordbookSync(nextUser, { force: true, delayMs: 600 });
      })
      .catch(() => {});
    return { user: nextUser };
  },
  logoutUser: () => {
    const currentUser = getCurrentUserFromStorage();
    if (currentUser?.id) {
      scheduleWordbookSync(currentUser, { force: true, delayMs: 0 });
    }
    localStorage.removeItem(GLOBAL_STORAGE_KEYS.CURRENT_USER);
  },

  // === User Data ===
  getBookmarks: () => getUserStorage(USER_STORAGE_FIELDS.BOOKMARKS, []),
  toggleBookmark: (id) => {
    const bookmarks = getUserStorage(USER_STORAGE_FIELDS.BOOKMARKS, []);
    const newBookmarks = bookmarks.includes(id) 
      ? bookmarks.filter(b => b !== id)
      : [...bookmarks, id];
    setUserStorage(USER_STORAGE_FIELDS.BOOKMARKS, newBookmarks);
    touchCurrentUser();
    return newBookmarks;
  },

  getMistakes: () => getUserStorage(USER_STORAGE_FIELDS.MISTAKES, []),
  addMistake: (id) => {
    const mistakes = getUserStorage(USER_STORAGE_FIELDS.MISTAKES, []);
    if (!mistakes.includes(id)) {
      setUserStorage(USER_STORAGE_FIELDS.MISTAKES, [...mistakes, id]);
      touchCurrentUser();
    }
    return getUserStorage(USER_STORAGE_FIELDS.MISTAKES, []);
  },
  removeMistake: (id) => {
    const mistakes = getUserStorage(USER_STORAGE_FIELDS.MISTAKES, []);
    const newMistakes = mistakes.filter(m => m !== id);
    setUserStorage(USER_STORAGE_FIELDS.MISTAKES, newMistakes);
    touchCurrentUser();
    return newMistakes;
  },

  getWordBookmarks: () => getUserWordBookmarks(),
  toggleWordBookmark: (word) => {
    const cleanWord = normalizeWord(word);
    if (!cleanWord) {
      return getUserWordBookmarks();
    }

    const bookmarks = getUserWordBookmarks();
    const newBookmarks = bookmarks.includes(cleanWord)
      ? bookmarks.filter((entry) => entry !== cleanWord)
      : [...bookmarks, cleanWord];
    setUserStorage(USER_STORAGE_FIELDS.WORD_BOOKMARKS, newBookmarks);
    touchCurrentUser();

    const user = getCurrentUserFromStorage();
    if (user?.id) {
      scheduleWordbookSync(user, { force: true, delayMs: 600 });
    }

    return newBookmarks;
  },

  getOptionBookmarks: () => getUserStorage(USER_STORAGE_FIELDS.OPTION_BOOKMARKS, []),
  isOptionBookmarked: (questionId, optionIndex) => {
    const bookmarks = getUserStorage(USER_STORAGE_FIELDS.OPTION_BOOKMARKS, []);
    return bookmarks.includes(makeOptionBookmarkId(questionId, optionIndex));
  },
  toggleOptionBookmark: ({ questionId, optionIndex }) => {
    const bookmarkId = makeOptionBookmarkId(questionId, optionIndex);
    const bookmarks = getUserStorage(USER_STORAGE_FIELDS.OPTION_BOOKMARKS, []);
    const newBookmarks = bookmarks.includes(bookmarkId)
      ? bookmarks.filter((entry) => entry !== bookmarkId)
      : [...bookmarks, bookmarkId];
    setUserStorage(USER_STORAGE_FIELDS.OPTION_BOOKMARKS, newBookmarks);
    touchCurrentUser();
    return newBookmarks;
  },

  getHistory: () => getUserStorage(USER_STORAGE_FIELDS.HISTORY, []),
  recordAttempt: ({ questionId, sectionCode, correct, selectedIndex, answerIndex, mode }) => {
    const history = getUserStorage(USER_STORAGE_FIELDS.HISTORY, []);
    const entry = {
      id: `${questionId}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      questionId,
      sectionCode,
      correct,
      selectedIndex,
      answerIndex,
      mode,
      at: new Date().toISOString(),
    };
    const nextHistory = [entry, ...history].slice(0, 1000);
    setUserStorage(USER_STORAGE_FIELDS.HISTORY, nextHistory);
    touchCurrentUser();

    // Async sync to backend
    const user = getCurrentUserFromStorage();
    if (user && user.id) {
      api.submitRecord(user, entry)
        .then((ok) => {
          if (!ok) {
            scheduleUserHistorySync(user, { force: true, delayMs: 1400 });
          }
        })
        .catch(() => {
          scheduleUserHistorySync(user, { force: true, delayMs: 1400 });
        });
    }
    
    return nextHistory;
  },

  syncHistoryNow: async () => {
    const user = getCurrentUserFromStorage();
    if (!user?.id) return null;
    return syncUserHistoryToServer(user, { force: true });
  },

  syncWordbookNow: async () => {
    const user = getCurrentUserFromStorage();
    if (!user?.id) return null;
    await hydrateWordBookmarksFromServer(user, { force: true });
    return pushWordBookmarksToServer(user, { force: true });
  },

  getDashboardData: () => {
    const questions = DataManager.getAllQuestions();
    const sections = DataManager.getSections();
    const mistakes = DataManager.getMistakes();
    const bookmarks = DataManager.getBookmarks();
    const wordBookmarks = DataManager.getWordBookmarks();
    const optionBookmarks = DataManager.getOptionBookmarks();
    const history = DataManager.getHistory();

    const questionById = new Map(questions.map((question) => [question.id, question]));
    const perQuestion = new Map();

    history.forEach((attempt) => {
      const existing = perQuestion.get(attempt.questionId) || {
        attempts: 0,
        correct: 0,
        wrong: 0,
        lastSeen: null,
      };

      existing.attempts += 1;
      existing.correct += attempt.correct ? 1 : 0;
      existing.wrong += attempt.correct ? 0 : 1;
      existing.lastSeen = existing.lastSeen && existing.lastSeen > attempt.at ? existing.lastSeen : attempt.at;
      perQuestion.set(attempt.questionId, existing);
    });

    const totalAttempts = history.length;
    const correctAttempts = history.filter((attempt) => attempt.correct).length;
    const uniqueAnswered = new Set(history.map((attempt) => attempt.questionId)).size;
    const accuracy = totalAttempts ? Math.round((correctAttempts / totalAttempts) * 100) : 0;
    const todayAttempts = history.filter((attempt) => isSameDay(attempt.at)).length;

    let currentStreak = 0;
    for (const attempt of history) {
      if (attempt.correct) currentStreak += 1;
      else break;
    }

    let bestStreak = 0;
    let runningStreak = 0;
    [...history].reverse().forEach((attempt) => {
      if (attempt.correct) {
        runningStreak += 1;
        bestStreak = Math.max(bestStreak, runningStreak);
      } else {
        runningStreak = 0;
      }
    });

    const sectionStats = sections.map((section) => {
      const sectionQuestions = questions.filter((question) => question.sectionCode === section.code);
      const questionIds = new Set(sectionQuestions.map((question) => question.id));
      const attempts = history.filter((attempt) => questionIds.has(attempt.questionId));
      const correct = attempts.filter((attempt) => attempt.correct).length;
      const mistakeCount = mistakes.filter((id) => questionIds.has(id)).length;
      const bookmarkCount = bookmarks.filter((id) => questionIds.has(id)).length;
      const optionBookmarkCount = optionBookmarks.filter((entry) => questionIds.has(String(entry).split('::')[0])).length;

      return {
        ...section,
        attempts: attempts.length,
        correct,
        accuracy: attempts.length ? Math.round((correct / attempts.length) * 100) : 0,
        mistakeCount,
        bookmarkCount,
        optionBookmarkCount,
      };
    });

    const focusQueue = mistakes
      .map((questionId) => {
        const question = questionById.get(questionId);
        const stats = perQuestion.get(questionId) || { attempts: 0, wrong: 0, correct: 0, lastSeen: null };
        return {
          id: questionId,
          question,
          attempts: stats.attempts,
          wrong: stats.wrong,
          correct: stats.correct,
          lastSeen: stats.lastSeen,
        };
      })
      .filter((item) => item.question)
      .sort((a, b) => {
        if (b.wrong !== a.wrong) return b.wrong - a.wrong;
        return String(b.lastSeen || '').localeCompare(String(a.lastSeen || ''));
      })
      .slice(0, 12);

    const bookmarkedQuestions = bookmarks
      .map((questionId) => questionById.get(questionId))
      .filter(Boolean)
      .slice(0, 12);

    const savedOptions = optionBookmarks
      .map((entry) => {
        const [questionId, rawIndex] = String(entry).split('::');
        const optionIndex = Number(rawIndex);
        const question = questionById.get(questionId);
        if (!question || !Number.isInteger(optionIndex) || !question.optionDetails?.[optionIndex]) {
          return null;
        }

        const option = question.optionDetails[optionIndex];
        return {
          id: entry,
          questionId,
          optionIndex,
          question,
          option,
        };
      })
      .filter(Boolean)
      .slice(0, 16);

    const recentActivity = history
      .slice(0, 10)
      .map((attempt) => ({
        ...attempt,
        question: questionById.get(attempt.questionId) || null,
      }))
      .filter((entry) => entry.question);

    return {
      overview: {
        totalQuestions: questions.length,
        totalAttempts,
        correctCount: correctAttempts,
        uniqueAnswered,
        accuracy,
        todayAttempts,
        bookmarks: bookmarks.length,
        mistakes: mistakes.length,
        wordBookmarks: wordBookmarks.length,
        optionBookmarks: optionBookmarks.length,
        currentStreak,
        bestStreak,
      },
      sectionStats,
      focusQueue,
      bookmarkedQuestions,
      savedOptions,
      recentActivity,
    };
  },
};
