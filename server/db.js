const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Render.com 等平台可能需要将数据持久化到挂载卷
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'moonspell.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

// 初始化数据库表
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT,
    email TEXT,
    class_name TEXT,
    grade TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login_at DATETIME
  );

  CREATE TABLE IF NOT EXISTS records (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    question_id TEXT,
    correct INTEGER, -- 0 or 1
    answer_letter TEXT,
    mode TEXT, -- practice, walkthrough, quiz
    duration_ms INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_records_user ON records(user_id);
  CREATE INDEX IF NOT EXISTS idx_records_question ON records(question_id);

  CREATE TABLE IF NOT EXISTS word_bookmarks (
    user_id TEXT NOT NULL,
    word TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, word),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_word_bookmarks_user ON word_bookmarks(user_id);
`);

const upsertUserStmt = db.prepare(`
  INSERT INTO users (id, name, email, class_name, grade, last_login_at)
  VALUES (:id, :name, :email, :class_name, :grade, :last_login_at)
  ON CONFLICT(id) DO UPDATE SET
    name=excluded.name,
    email=excluded.email,
    class_name=excluded.class_name,
    grade=excluded.grade,
    last_login_at=excluded.last_login_at
`);

const insertRecordStmt = db.prepare(`
  INSERT OR IGNORE INTO records (id, user_id, question_id, correct, answer_letter, mode, duration_ms, created_at)
  VALUES (:id, :user_id, :question_id, :correct, :answer_letter, :mode, :duration_ms, :created_at)
`);

const selectUsersStmt = db.prepare(`
  SELECT id, name, email, class_name, grade, last_login_at
  FROM users
  ORDER BY created_at DESC
`);

const selectRecordsStmt = db.prepare(`
  SELECT id, user_id, question_id, correct, answer_letter, mode, duration_ms, created_at
  FROM records
  ORDER BY created_at DESC
  LIMIT 50000
`);

const insertWordBookmarkStmt = db.prepare(`
  INSERT INTO word_bookmarks (user_id, word, updated_at)
  VALUES (:user_id, :word, :updated_at)
  ON CONFLICT(user_id, word) DO UPDATE SET
    updated_at=excluded.updated_at
`);

const deleteWordBookmarkStmt = db.prepare(`
  DELETE FROM word_bookmarks
  WHERE user_id = :user_id AND word = :word
`);

const replaceWordBookmarksDeleteStmt = db.prepare(`
  DELETE FROM word_bookmarks
  WHERE user_id = :user_id
`);

const selectWordBookmarksByUserStmt = db.prepare(`
  SELECT word
  FROM word_bookmarks
  WHERE user_id = :user_id
  ORDER BY updated_at DESC, word ASC
`);

const normalizeUserPayload = (user) => ({
  id: user.id,
  name: user.username || user.name || 'Anonymous',
  email: user.email || '',
  class_name: user.className || '',
  grade: user.grade || '',
  last_login_at: user.lastLoginAt || new Date().toISOString(),
});

const normalizeRecordPayload = (record) => ({
  id: record.id || crypto.randomUUID(),
  user_id: record.userId,
  question_id: record.questionId,
  correct: record.correct ? 1 : 0,
  answer_letter: record.answerLetter || '',
  mode: record.mode || 'practice',
  duration_ms: record.durationMs || 0,
  created_at: record.at || new Date().toISOString(),
});

const normalizeWordList = (words = []) =>
  [...new Set(
    (words || [])
      .map((word) =>
        String(word || '')
          .trim()
          .toLowerCase()
          .replace(/[^a-z'-]/g, '')
      )
      .filter(Boolean)
  )];

const runBulkInsert = (rows = []) => {
  if (!rows.length) {
    return { inserted: 0, ignored: 0 };
  }

  let inserted = 0;
  let ignored = 0;

  db.exec('BEGIN');
  try {
    rows.forEach((row) => {
      const result = insertRecordStmt.run(row);
      if (result.changes > 0) {
        inserted += 1;
      } else {
        ignored += 1;
      }
    });
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  return { inserted, ignored };
};

module.exports = {
  // 用户相关操作
  upsertUser: (user) => upsertUserStmt.run(normalizeUserPayload(user)),

  // 记录相关操作（幂等：同 id 重传会被忽略）
  insertRecord: (record) => {
    const result = insertRecordStmt.run(normalizeRecordPayload(record));
    return { inserted: result.changes > 0, ignored: result.changes === 0 };
  },

  // 批量回补历史记录
  insertRecordsBulk: (records) => {
    const rows = (records || []).map(normalizeRecordPayload);
    return runBulkInsert(rows);
  },

  // 单词收藏相关（按账号持久化）
  getWordBookmarksByUser: (userId) => {
    if (!userId) return [];
    const rows = selectWordBookmarksByUserStmt.all({ user_id: userId });
    return rows.map((row) => row.word);
  },

  addWordBookmark: ({ userId, word }) => {
    const normalizedWords = normalizeWordList([word]);
    if (!userId || !normalizedWords.length) {
      return { inserted: 0 };
    }
    const result = insertWordBookmarkStmt.run({
      user_id: userId,
      word: normalizedWords[0],
      updated_at: new Date().toISOString(),
    });
    return { inserted: result.changes > 0 ? 1 : 0, word: normalizedWords[0] };
  },

  removeWordBookmark: ({ userId, word }) => {
    const normalizedWords = normalizeWordList([word]);
    if (!userId || !normalizedWords.length) {
      return { removed: 0 };
    }
    const result = deleteWordBookmarkStmt.run({
      user_id: userId,
      word: normalizedWords[0],
    });
    return { removed: result.changes > 0 ? 1 : 0, word: normalizedWords[0] };
  },

  replaceWordBookmarksForUser: ({ userId, words }) => {
    if (!userId) return { total: 0 };
    const normalizedWords = normalizeWordList(words);

    db.exec('BEGIN');
    try {
      replaceWordBookmarksDeleteStmt.run({ user_id: userId });
      normalizedWords.forEach((word) => {
        insertWordBookmarkStmt.run({
          user_id: userId,
          word,
          updated_at: new Date().toISOString(),
        });
      });
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }

    return { total: normalizedWords.length, words: normalizedWords };
  },

  // 获取所有记录 (Admin)
  getAllData: () => {
    const users = selectUsersStmt.all();
    const records = selectRecordsStmt.all();

    // 转换为前端 Admin 需要的格式
    return {
      users: users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        className: u.class_name,
        grade: u.grade,
        lastLoginAt: u.last_login_at,
      })),
      records: records.map((r) => ({
        id: r.id,
        userId: r.user_id,
        questionId: r.question_id,
        correct: Boolean(r.correct),
        answerLetter: r.answer_letter,
        mode: r.mode,
        durationMs: r.duration_ms,
        at: r.created_at,
      })),
    };
  },
};
