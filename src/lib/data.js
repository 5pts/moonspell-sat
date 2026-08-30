import questionsData from '../data/questions.json';
import questionMeta from '../data/question_meta.json';
import lexiconData from '../data/lexicon_seed.json';
import barronWordsData from '../data/barron_words.json';
import optionTranslations from '../data/option_translations.json';
import explanationTranslations from '../data/explanation_translations.json';
import contentOverrides from '../data/content_overrides.json';
import { api } from './api';

const RAW_QUESTIONS = questionsData?.questions || [];
const QUESTION_STEM_BY_ID = new Map(
  RAW_QUESTIONS.map((question) => [question.globalId, question.stem || ''])
);

const GLOBAL_STORAGE_KEYS = {
  USERS: 'moonspell_users',
  CURRENT_USER: 'moonspell_current_user',
  WORD_LOOKUPS: 'moonspell_word_lookups',
  PREFERENCES: 'moonspell_preferences',
};

const USER_STORAGE_FIELDS = {
  BOOKMARKS: 'bookmarks',
  MISTAKES: 'mistakes',
  WORD_BOOKMARKS: 'word_bookmarks',
  OPTION_BOOKMARKS: 'option_bookmarks',
  HISTORY: 'history',
  REVIEW_STATES: 'review_states',
  REVIEW_EVENTS: 'review_events',
};

// The old API identifies users from a client-supplied id. Keep it opt-in while
// the authenticated sync service is rebuilt; local learning data remains fully
// functional and is safer by default.
const REMOTE_SYNC_ENABLED = import.meta.env.VITE_ENABLE_LEGACY_SYNC === 'true';

const HISTORY_SYNC_MIN_INTERVAL_MS = 60 * 1000;
const historySyncTimers = new Map();
const historySyncInFlight = new Set();
const historySyncLastRunAt = new Map();

const WORDBOOK_SYNC_MIN_INTERVAL_MS = 10 * 1000;
const wordbookSyncTimers = new Map();
const wordbookSyncInFlight = new Set();
const wordbookSyncLastRunAt = new Map();
const wordbookHydratedUsers = new Set();
const wordbookRemoteReachableUsers = new Set();

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

const getStoredUsers = () => {
  const users = readStorage(GLOBAL_STORAGE_KEYS.USERS, []);
  let changed = false;
  const sanitized = (Array.isArray(users) ? users : []).map((user) => {
    if (!user || typeof user !== 'object' || !Object.hasOwn(user, 'password')) return user;
    const { password: _discardedPassword, ...safeUser } = user;
    changed = true;
    return safeUser;
  }).filter(Boolean);

  if (changed) writeStorage(GLOBAL_STORAGE_KEYS.USERS, sanitized);
  return sanitized;
};

const saveStoredUsers = (users) => {
  writeStorage(GLOBAL_STORAGE_KEYS.USERS, users);
  return users;
};

const getCurrentUserFromStorage = () => {
  const user = readStorage(GLOBAL_STORAGE_KEYS.CURRENT_USER, null);
  if (!user || typeof user !== 'object') return null;
  if (!Object.hasOwn(user, 'password')) return user;
  const { password: _discardedPassword, ...safeUser } = user;
  writeStorage(GLOBAL_STORAGE_KEYS.CURRENT_USER, safeUser);
  return safeUser;
};

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
  if (!userId) {
    return {
      words: getUserWordBookmarks(userId),
      remoteOk: false,
      merged: false,
    };
  }

  if (!force && wordbookHydratedUsers.has(userId)) {
    return {
      words: getUserWordBookmarks(userId),
      remoteOk: wordbookRemoteReachableUsers.has(userId),
      merged: false,
    };
  }

  const localWords = getUserWordBookmarks(userId);
  const remoteWords = await api.fetchWordbook(userId);
  if (!Array.isArray(remoteWords)) {
    wordbookRemoteReachableUsers.delete(userId);
    return {
      words: localWords,
      remoteOk: false,
      merged: false,
    };
  }

  const mergedWords = normalizeWordBookmarksList([...localWords, ...remoteWords]);
  setUserStorage(USER_STORAGE_FIELDS.WORD_BOOKMARKS, mergedWords, userId);
  wordbookHydratedUsers.add(userId);
  wordbookRemoteReachableUsers.add(userId);
  return {
    words: mergedWords,
    remoteOk: true,
    merged: true,
  };
};

const pushWordBookmarksToServer = async (user, { force = false } = {}) => {
  const userId = user?.id;
  if (!userId) return null;

  if (!wordbookHydratedUsers.has(userId)) {
    const hydrateResult = await hydrateWordBookmarksFromServer(user);
    if (!hydrateResult?.remoteOk) {
      return null;
    }
  }

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
      wordbookRemoteReachableUsers.add(userId);
      return result;
    }
    if (force) {
      wordbookRemoteReachableUsers.delete(userId);
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

  return '';
};

const cleanDerivatives = (word, derivatives = [], verified = false) => {
  if (!verified) return [];
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

const normalizeMemoryHook = (hook) => {
  if (!hook || !hook.text) return null;
  return {
    type: hook.type || 'memory',
    title: hook.title || '记忆提示',
    text: String(hook.text).trim(),
    reviewed: Boolean(hook.reviewed || hook.reviewStatus === 'reviewed'),
    source: hook.source || '',
  };
};

const LOW_QUALITY_HOOK_PATTERNS = [
  /把.+绑回/i,
  /放回原题/i,
  /词义关键词/i,
  /拼写首尾/i,
  /首字母.+末字母/i,
  /可以拆成.+\+/i,
  /前半段.+后半段/i,
  /分块读两遍/i,
  /常见于这种语境/i,
  /先记.+再记/i,
];

const ensureTwoMemoryHooks = (word, entry = {}) => {
  const hooks = (entry.memoryHooks || [])
    .map(normalizeMemoryHook)
    .filter(Boolean)
    .filter((hook) => hook.reviewed)
    .filter((hook) => !LOW_QUALITY_HOOK_PATTERNS.some((pattern) => pattern.test(hook.text)));

  // A missing mnemonic is honest. Never fabricate two hooks just to fill UI.
  return hooks.filter((hook, index, list) => (
    list.findIndex((candidate) => candidate.text === hook.text) === index
  )).slice(0, 3);
};

const toBarronMemoryHooks = (item = {}) => {
  const hooks = (item.mnemonics || [])
    .map((hook, index) => ({
      type: 'barron',
      title: String(hook?.method || `Barron Hook ${index + 1}`).trim(),
      text: String(hook?.text || '').trim(),
      reviewed: Boolean(hook?.reviewed || hook?.reviewStatus === 'reviewed'),
    }))
    .filter((hook) => hook.text);

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

const buildAnalysis = (question, answerIndex, reasoning) => {
  const override = contentOverrides[question.globalId] || null;
  const isReviewed = override?.reviewStatus === 'reviewed';
  const answerText = getAnswerText(question, answerIndex);
  const answerTranslation = override?.answerTranslation || getOptionTranslation(answerText);
  const optionReviews = (question.options || []).map((option, optionIndex) => ({
    label: option.label,
    text: option.text,
    translation: override?.contextualGlosses?.[option.text] || getOptionTranslation(option.text),
    isCorrect: optionIndex === answerIndex,
    reason: isReviewed ? override?.optionReviews?.[option.text] || '' : '',
    reviewStatus: isReviewed && override?.optionReviews?.[option.text] ? 'reviewed' : 'unavailable',
  }));

  return {
    answerLetter: answerIndex >= 0 ? String.fromCharCode(65 + answerIndex) : '?',
    answerText,
    answerTranslation,
    hint: isReviewed ? override?.hint || '' : '',
    cues: isReviewed ? override?.cues || [] : [],
    reasoning: isReviewed ? override?.reasoning || reasoning : '',
    concise: isReviewed ? override?.concise || '' : '',
    logicSteps: isReviewed ? override?.logicSteps || [] : [],
    sentenceTranslation: override?.sentenceTranslation || question.translation || '',
    reviewStatus: isReviewed ? 'reviewed' : 'unavailable',
    reviewedAt: isReviewed ? override?.reviewedAt || '' : '',
    optionReviews,
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

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;
const REVIEW_EVENT_LIMIT = 5000;
const confidenceWeight = { low: 0.35, medium: 0.65, high: 0.9 };

const getReviewStates = () => getUserStorage(USER_STORAGE_FIELDS.REVIEW_STATES, {});

const resolveReviewStatus = (state, now = Date.now()) => {
  if (!state?.reps) return 'new';
  if (new Date(state.dueAt || 0).getTime() <= now) return 'due';
  if ((state.stability || 0) >= 14 && (state.lapses || 0) <= 2) return 'stable';
  return 'learning';
};

const updateMemoryState = ({
  itemId,
  itemType,
  questionId = '',
  word = '',
  correct,
  confidence = 'medium',
  grade,
  at = new Date().toISOString(),
}) => {
  const states = getReviewStates();
  const previous = states[itemId] || {
    itemId,
    itemType,
    questionId,
    word,
    reps: 0,
    lapses: 0,
    stability: 0.5,
    difficulty: 0.5,
  };
  const failed = grade === 'again' || !correct;
  const confidenceScore = confidenceWeight[confidence] ?? confidenceWeight.medium;
  const reviewedAt = new Date(at).getTime();
  const previousStability = Math.max(0.5, Number(previous.stability || 0.5));
  const nextReps = Number(previous.reps || 0) + 1;
  let stability;
  let intervalMs;

  if (failed) {
    stability = Math.max(0.5, previousStability * 0.55);
    intervalMs = itemType === 'word' ? 10 * MINUTE_MS : DAY_MS;
  } else if (confidence === 'low') {
    stability = Math.max(1, previousStability * 1.2);
    intervalMs = DAY_MS;
  } else {
    const growth = 1.55 + confidenceScore + Math.min(nextReps, 6) * 0.08;
    stability = Math.min(180, Math.max(1, previousStability * growth));
    intervalMs = Math.max(DAY_MS, Math.round(stability) * DAY_MS);
  }

  const next = {
    ...previous,
    itemId,
    itemType,
    questionId: questionId || previous.questionId || '',
    word: word || previous.word || '',
    reps: nextReps,
    lapses: Number(previous.lapses || 0) + (failed ? 1 : 0),
    stability: Number(stability.toFixed(2)),
    difficulty: Number(Math.min(0.95, Math.max(0.1,
      Number(previous.difficulty || 0.5) + (failed ? 0.08 : -0.025)
    )).toFixed(2)),
    lastReviewedAt: at,
    lastResult: failed ? 'again' : 'remembered',
    lastConfidence: confidence,
    dueAt: new Date(reviewedAt + intervalMs).toISOString(),
  };
  next.status = resolveReviewStatus(next, reviewedAt);
  states[itemId] = next;
  setUserStorage(USER_STORAGE_FIELDS.REVIEW_STATES, states);
  return next;
};

const appendReviewEvent = (event) => {
  const events = getUserStorage(USER_STORAGE_FIELDS.REVIEW_EVENTS, []);
  const nextEvents = [{
    id: event.id || `review-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    at: event.at || new Date().toISOString(),
    ...event,
  }, ...events].slice(0, REVIEW_EVENT_LIMIT);
  setUserStorage(USER_STORAGE_FIELDS.REVIEW_EVENTS, nextEvents);
  return nextEvents;
};

export const DataManager = {
  // === Preferences ===
  getPreference: (key, fallback = null) => {
    const preferences = readStorage(GLOBAL_STORAGE_KEYS.PREFERENCES, {});
    return Object.hasOwn(preferences, key) ? preferences[key] : fallback;
  },

  setPreference: (key, value) => {
    const preferences = readStorage(GLOBAL_STORAGE_KEYS.PREFERENCES, {});
    const next = { ...preferences, [key]: value };
    writeStorage(GLOBAL_STORAGE_KEYS.PREFERENCES, next);
    return value;
  },

  // === Questions ===
  getAllQuestions: () => {
    const questions = questionsData?.questions || [];
    
    return questions.map(q => {
      const meta = questionMeta.questions ? questionMeta.questions[q.globalId] : undefined;
      const override = contentOverrides[q.globalId] || null;
      
      let answerIndex = resolveAnswerIndex(q, meta);
      let explanation = pickReasoningText(q, meta);
      let translation = q.translation || "";
      const options = (q.options || []).map(o => o.text);
      const optionDetails = (q.options || []).map((option) => ({
        label: option.label,
        text: option.text,
        translation: override?.contextualGlosses?.[option.text] || getOptionTranslation(option.text),
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
        translation: analysis.sentenceTranslation || translation,
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
      derivatives: cleanDerivatives(
        cleanWord,
        seedEntry?.derivatives || barronEntry?.derivatives || [],
        Boolean(seedEntry?.derivativesVerified || seedEntry?.derivativesReviewed)
      ),
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
    const withHooks = entries.filter((entry) => (entry.memoryHooks || []).length > 0).length;
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
    if (REMOTE_SYNC_ENABLED && user?.id) {
      scheduleUserHistorySync(user);
      hydrateWordBookmarksFromServer(user).then((hydrateResult) => {
        if (hydrateResult?.remoteOk) {
          scheduleWordbookSync(user, { force: true, delayMs: 500 });
        }
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

  registerUser: ({ username, email }) => {
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
      className: 'Independent',
      grade: 'SAT SC',
      createdAt: now,
      lastLoginAt: now,
      lastActivityAt: now,
    });

    setCurrentUser(nextUser);
    if (REMOTE_SYNC_ENABLED) {
      scheduleUserHistorySync(nextUser, { force: true, delayMs: 400 });
      hydrateWordBookmarksFromServer(nextUser, { force: true })
        .then((hydrateResult) => {
          if (hydrateResult?.remoteOk) {
            scheduleWordbookSync(nextUser, { force: true, delayMs: 600 });
          }
        })
        .catch(() => {});
    }
    return { user: nextUser };
  },

  loginUser: ({ email }) => {
    const safeEmail = normalizeEmail(email);
    if (!safeEmail) return { error: 'missing_fields' };

    const existing = DataManager.findUserByEmail(safeEmail);
    if (!existing) return { error: 'not_found' };

    const now = new Date().toISOString();
    const nextUser = upsertUserProfile({
      ...existing,
      lastLoginAt: now,
      lastActivityAt: now,
    });

    setCurrentUser(nextUser);
    if (REMOTE_SYNC_ENABLED) {
      scheduleUserHistorySync(nextUser, { force: true, delayMs: 400 });
      hydrateWordBookmarksFromServer(nextUser, { force: true })
        .then((hydrateResult) => {
          if (hydrateResult?.remoteOk) {
            scheduleWordbookSync(nextUser, { force: true, delayMs: 600 });
          }
        })
        .catch(() => {});
    }
    return { user: nextUser };
  },
  logoutUser: () => {
    const currentUser = getCurrentUserFromStorage();
    if (REMOTE_SYNC_ENABLED && currentUser?.id) {
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
    if (REMOTE_SYNC_ENABLED && user?.id) {
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
  recordAttempt: ({
    questionId,
    sectionCode,
    correct,
    selectedIndex,
    answerIndex,
    mode,
    confidence = 'medium',
    durationMs = 0,
    hintUsed = false,
  }) => {
    const history = getUserStorage(USER_STORAGE_FIELDS.HISTORY, []);
    const at = new Date().toISOString();
    const entry = {
      id: `${questionId}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      questionId,
      sectionCode,
      correct,
      selectedIndex,
      answerIndex,
      mode,
      confidence,
      durationMs: Math.max(0, Number(durationMs || 0)),
      hintUsed: Boolean(hintUsed),
      at,
    };
    const nextHistory = [entry, ...history].slice(0, 1000);
    setUserStorage(USER_STORAGE_FIELDS.HISTORY, nextHistory);

    const questionState = updateMemoryState({
      itemId: `question:${questionId}`,
      itemType: 'question',
      questionId,
      correct,
      confidence,
      at,
    });
    appendReviewEvent({
      itemId: questionState.itemId,
      itemType: 'question',
      questionId,
      correct,
      confidence,
      durationMs: entry.durationMs,
      hintUsed: entry.hintUsed,
      selectedIndex,
      answerIndex,
      mode,
      at,
    });

    const question = DataManager.getAllQuestions().find((item) => item.id === questionId);
    const answerWord = normalizeWord(question?.answerText || '');
    if (answerWord && !answerWord.includes('-')) {
      updateMemoryState({
        itemId: `word:${answerWord}`,
        itemType: 'word',
        word: answerWord,
        questionId,
        correct,
        confidence,
        at,
      });
    }
    touchCurrentUser();

    // Async sync to backend
    const user = getCurrentUserFromStorage();
    if (REMOTE_SYNC_ENABLED && user && user.id) {
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

  recordReview: ({
    itemId,
    itemType = 'word',
    word = '',
    questionId = '',
    correct,
    confidence = 'medium',
    grade = correct ? 'good' : 'again',
    durationMs = 0,
  }) => {
    const at = new Date().toISOString();
    const resolvedItemId = itemId || `${itemType}:${word || questionId}`;
    const state = updateMemoryState({
      itemId: resolvedItemId,
      itemType,
      word,
      questionId,
      correct,
      confidence,
      grade,
      at,
    });
    appendReviewEvent({
      itemId: resolvedItemId,
      itemType,
      word,
      questionId,
      correct,
      confidence,
      grade,
      durationMs,
      at,
    });
    touchCurrentUser();
    return state;
  },

  getReviewState: (itemId) => {
    const state = getReviewStates()[itemId] || null;
    return state ? { ...state, status: resolveReviewStatus(state) } : null;
  },

  getReviewEvents: () => getUserStorage(USER_STORAGE_FIELDS.REVIEW_EVENTS, []),

  getLearningSummary: () => {
    const questions = DataManager.getAllQuestions();
    const wordBookmarks = DataManager.getWordBookmarks();
    const rawStates = Object.values(getReviewStates());
    const states = rawStates.map((state) => ({ ...state, status: resolveReviewStatus(state) }));
    const reviewedQuestionIds = new Set(
      states.filter((state) => state.itemType === 'question').map((state) => state.questionId)
    );
    const counts = {
      new: Math.max(0, questions.length - reviewedQuestionIds.size) + wordBookmarks.filter(
        (word) => !states.some((state) => state.itemId === `word:${word}`)
      ).length,
      learning: states.filter((state) => state.status === 'learning').length,
      due: states.filter((state) => state.status === 'due').length,
      stable: states.filter((state) => state.status === 'stable').length,
    };
    const dueStates = states
      .filter((state) => state.status === 'due')
      .sort((left, right) => String(left.dueAt).localeCompare(String(right.dueAt)));
    const questionById = new Map(questions.map((question) => [question.id, question]));
    const dueQueue = dueStates.map((state) => {
      const question = state.questionId ? questionById.get(state.questionId) : null;
      const word = state.word || normalizeWord(question?.answerText || '');
      const entry = word ? DataManager.getWord(word) : null;
      return {
        ...state,
        question,
        word,
        translation: question?.analysis?.answerTranslation || entry?.barronZh || entry?.shortDefs?.[0] || '',
      };
    });
    const events = DataManager.getReviewEvents();
    const lastEventByItem = new Map();
    const delayedEvents = [...events]
      .sort((left, right) => new Date(left.at).getTime() - new Date(right.at).getTime())
      .filter((event) => {
        const previous = lastEventByItem.get(event.itemId);
        lastEventByItem.set(event.itemId, event);
        if (!previous?.at || !event.at) return false;
        return new Date(event.at).getTime() - new Date(previous.at).getTime() >= 20 * 60 * 60 * 1000;
      });
    const delayedCorrect = delayedEvents.filter((event) => event.correct).length;
    const delayedRetention = delayedEvents.length
      ? Math.round((delayedCorrect / delayedEvents.length) * 100)
      : null;
    const confidenceEvents = events.filter((event) => confidenceWeight[event.confidence] !== undefined);
    const calibrationError = confidenceEvents.length
      ? Math.round(confidenceEvents.reduce((sum, event) => (
        sum + Math.abs(confidenceWeight[event.confidence] - (event.correct ? 1 : 0))
      ), 0) / confidenceEvents.length * 100)
      : null;

    return {
      counts,
      dueQueue,
      estimatedMinutes: counts.due ? Math.max(3, Math.ceil(counts.due * 0.65)) : 0,
      delayedRetention,
      calibrationError,
      reviewBurdenMinutes: Math.round(events.filter((event) => isSameDay(event.at)).reduce(
        (sum, event) => sum + Number(event.durationMs || 0),
        0
      ) / 60000),
    };
  },

  syncHistoryNow: async () => {
    if (!REMOTE_SYNC_ENABLED) return { success: false, reason: 'legacy_sync_disabled' };
    const user = getCurrentUserFromStorage();
    if (!user?.id) return null;
    return syncUserHistoryToServer(user, { force: true });
  },

  syncWordbookNow: async () => {
    if (!REMOTE_SYNC_ENABLED) return { success: false, reason: 'legacy_sync_disabled' };
    const user = getCurrentUserFromStorage();
    if (!user?.id) return null;
    const hydrateResult = await hydrateWordBookmarksFromServer(user, { force: true });
    if (!hydrateResult?.remoteOk) {
      return {
        success: false,
        reason: 'remote_unavailable',
        words: hydrateResult?.words || getUserWordBookmarks(user.id),
      };
    }
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
