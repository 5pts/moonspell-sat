const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// 静态文件托管（用于本地预览）
app.use(express.static(path.join(__dirname, '../dist')));

// API: 提交做题记录
app.post('/api/record', (req, res) => {
  const { user, record } = req.body;
  
  if (!user || !record) {
    return res.status(400).json({ error: 'Missing user or record data' });
  }

  try {
    // 1. 更新用户信息
    db.upsertUser(user);
    
    // 2. 插入做题记录
    db.insertRecord({
      ...record,
      userId: user.id
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Error saving record:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API: Admin 获取所有数据 (需要简单密码验证)
app.get('/api/admin/data', (req, res) => {
  const authHeader = req.headers.authorization;
  
  // 简单的硬编码密码验证 (实际生产应使用更安全的方案)
  // 前端传: Authorization: Bearer moonspell_admin_token
  if (!authHeader || !authHeader.includes('7c4a8d09ca3762af61e59520943dc26494f8941b')) { // sha1('admin')
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const data = db.getAllData();
    res.json(data);
  } catch (err) {
    console.error('Error fetching admin data:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 任何其他请求返回 index.html (SPA 支持)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
