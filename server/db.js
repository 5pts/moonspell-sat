const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

// Render.com 等平台可能需要将数据持久化到挂载卷
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'moonspell.db');

const db = new Database(DB_PATH);

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
`);

module.exports = {
  // 用户相关操作
  upsertUser: (user) => {
    const stmt = db.prepare(`
      INSERT INTO users (id, name, email, class_name, grade, last_login_at)
      VALUES (@id, @name, @email, @className, @grade, @lastLoginAt)
      ON CONFLICT(id) DO UPDATE SET
        name=excluded.name,
        email=excluded.email,
        class_name=excluded.class_name,
        grade=excluded.grade,
        last_login_at=excluded.last_login_at
    `);
    return stmt.run({
      id: user.id,
      name: user.username || user.name || 'Anonymous',
      email: user.email || '',
      className: user.className || '',
      grade: user.grade || '',
      lastLoginAt: new Date().toISOString()
    });
  },

  // 记录相关操作
  insertRecord: (record) => {
    const stmt = db.prepare(`
      INSERT INTO records (id, user_id, question_id, correct, answer_letter, mode, duration_ms, created_at)
      VALUES (@id, @userId, @questionId, @correct, @answerLetter, @mode, @durationMs, @createdAt)
    `);
    return stmt.run({
      id: record.id || crypto.randomUUID(),
      userId: record.userId,
      questionId: record.questionId,
      correct: record.correct ? 1 : 0,
      answerLetter: record.answerLetter || '',
      mode: record.mode || 'practice',
      durationMs: record.durationMs || 0,
      createdAt: record.at || new Date().toISOString()
    });
  },

  // 获取所有记录 (Admin)
  getAllData: () => {
    const users = db.prepare('SELECT * FROM users').all();
    const records = db.prepare('SELECT * FROM records ORDER BY created_at DESC LIMIT 5000').all();
    
    // 转换为前端 Admin 需要的格式
    return {
      users: users.map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        className: u.class_name,
        grade: u.grade,
        lastLoginAt: u.last_login_at
      })),
      records: records.map(r => ({
        id: r.id,
        userId: r.user_id,
        questionId: r.question_id,
        correct: Boolean(r.correct),
        answerLetter: r.answer_letter,
        mode: r.mode,
        durationMs: r.duration_ms,
        at: r.created_at
      }))
    };
  }
};
