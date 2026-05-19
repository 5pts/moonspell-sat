const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const DEFAULT_ADMIN_TOKEN = 'admin';
const LEGACY_ADMIN_TOKEN_HASH = '7c4a8d09ca3762af61e59520943dc26494f8941b';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || DEFAULT_ADMIN_TOKEN;
const ADMIN_TOKEN_HASH = (process.env.ADMIN_TOKEN_HASH || '').toLowerCase();

app.use(cors());
app.use(express.json({ limit: '1mb' }));

// 静态文件托管（用于本地预览）
app.use(express.static(path.join(__dirname, '../dist')));

const extractAuthToken = (authHeader = '') => {
  const raw = String(authHeader || '').trim();
  if (!raw) return '';
  if (/^Bearer\s+/i.test(raw)) {
    return raw.replace(/^Bearer\s+/i, '').trim();
  }
  return raw;
};

const safeEqual = (left, right) => {
  if (!left || !right) return false;
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

const sha1Hex = (value) =>
  crypto
    .createHash('sha1')
    .update(String(value))
    .digest('hex')
    .toLowerCase();

const isAdminAuthorized = (authHeader) => {
  const token = extractAuthToken(authHeader);
  if (!token) return false;

  if (safeEqual(token, ADMIN_TOKEN)) {
    return true;
  }

  // 可选：支持环境变量配置 hash
  if (ADMIN_TOKEN_HASH && safeEqual(sha1Hex(token), ADMIN_TOKEN_HASH)) {
    return true;
  }

  // 兼容历史：以前前端有概率直接传 hash
  if (/^[a-f0-9]{40}$/i.test(token) && safeEqual(token.toLowerCase(), LEGACY_ADMIN_TOKEN_HASH)) {
    return true;
  }

  return false;
};

const fetchJson = async (url, { timeoutMs = 15000, headers = {} } = {}) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`HTTP_${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
};

// API: 提交做题记录（幂等，重复 id 自动忽略）
app.post('/api/record', (req, res) => {
  const { user, record } = req.body || {};

  if (!user?.id || !record?.questionId) {
    return res.status(400).json({ error: 'Missing user.id or record.questionId' });
  }

  try {
    db.upsertUser(user);
    const result = db.insertRecord({
      ...record,
      userId: user.id,
    });
    return res.json({ success: true, ...result });
  } catch (err) {
    console.error('Error saving record:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// API: 批量回补历史记录（用于找回离线期间未同步的数据）
app.post('/api/records/bulk', (req, res) => {
  const { user, records } = req.body || {};

  if (!user?.id || !Array.isArray(records)) {
    return res.status(400).json({ error: 'Missing user.id or records[]' });
  }

  try {
    db.upsertUser(user);
    const normalizedRecords = records
      .filter((item) => item && item.questionId)
      .map((item) => ({
        ...item,
        userId: user.id,
      }));

    const result = db.insertRecordsBulk(normalizedRecords);
    return res.json({
      success: true,
      total: normalizedRecords.length,
      inserted: result.inserted,
      ignored: result.ignored,
    });
  } catch (err) {
    console.error('Error bulk saving records:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// API: 词典查询（兼容 local-site.js）
app.get('/api/dictionary', async (req, res) => {
  const word = String(req.query.word || '').trim().toLowerCase();
  if (!word) {
    return res.status(400).json({ error: 'Missing word parameter.' });
  }

  const apiUrl = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;

  try {
    const payload = await fetchJson(apiUrl, {
      timeoutMs: 15000,
      headers: { 'User-Agent': 'MoonspellServer/1.0' },
    });

    const entry = Array.isArray(payload) ? payload[0] : null;
    if (!entry) {
      return res.status(502).json({ word, error: 'Unexpected dictionary payload.' });
    }

    const definitions = [];
    const meanings = [];

    (entry.meanings || []).slice(0, 3).forEach((meaning) => {
      if (meaning?.partOfSpeech) {
        meanings.push(meaning.partOfSpeech);
      }
      (meaning?.definitions || []).slice(0, 2).forEach((definition) => {
        if (definition?.definition) {
          definitions.push(definition.definition);
        }
      });
    });

    return res.json({
      word: entry.word || word,
      phonetic:
        entry.phonetic ||
        (entry.phonetics || []).map((item) => item?.text).find(Boolean) ||
        '',
      meanings: meanings.slice(0, 3),
      definitions: definitions.slice(0, 3),
    });
  } catch (err) {
    console.warn('Dictionary lookup failed:', err?.message || err);
    return res.status(502).json({ word, error: 'Lookup unavailable' });
  }
});

// API: 翻译查询（兼容 local-site.js）
app.get('/api/translate', async (req, res) => {
  const text = String(req.query.text || '').trim();
  if (!text) {
    return res.status(400).json({ error: 'Missing text parameter.' });
  }

  const apiUrl =
    'https://translate.googleapis.com/translate_a/single' +
    '?client=gtx&sl=en&tl=zh-CN&dt=t&q=' +
    encodeURIComponent(text);

  try {
    const payload = await fetchJson(apiUrl, {
      timeoutMs: 15000,
      headers: { 'User-Agent': 'MoonspellServer/1.0' },
    });

    const translated = Array.isArray(payload?.[0])
      ? payload[0]
          .map((part) => (Array.isArray(part) ? part[0] : ''))
          .join('')
          .trim()
      : '';

    if (!translated) {
      return res.status(502).json({ text, error: 'Unexpected translation payload.' });
    }

    return res.json({ text, translation: translated });
  } catch (err) {
    console.warn('Translation lookup failed:', err?.message || err);
    return res.status(502).json({ text, error: 'Translation unavailable' });
  }
});

// API: 获取某账号的单词收藏
app.get('/api/wordbook', (req, res) => {
  const userId = String(req.query.userId || '').trim();
  if (!userId) {
    return res.status(400).json({ error: 'Missing userId parameter' });
  }

  try {
    const words = db.getWordBookmarksByUser(userId);
    return res.json({ userId, words });
  } catch (err) {
    console.error('Error fetching wordbook:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// API: 全量覆盖某账号单词收藏（客户端会先 merge 再提交，避免丢失）
app.put('/api/wordbook', (req, res) => {
  const { user, words } = req.body || {};

  if (!user?.id || !Array.isArray(words)) {
    return res.status(400).json({ error: 'Missing user.id or words[]' });
  }

  try {
    db.upsertUser(user);
    const result = db.replaceWordBookmarksForUser({
      userId: user.id,
      words,
    });
    return res.json({
      success: true,
      userId: user.id,
      total: result.total,
      words: result.words,
    });
  } catch (err) {
    console.error('Error replacing wordbook:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// API: Admin 获取所有数据（支持 env 安全令牌 + 兼容历史 token）
app.get('/api/admin/data', (req, res) => {
  const authHeader = req.headers.authorization;

  if (!isAdminAuthorized(authHeader)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const data = db.getAllData();
    return res.json(data);
  } catch (err) {
    console.error('Error fetching admin data:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, now: new Date().toISOString() });
});

// 任何其他请求返回 index.html (SPA 支持)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
