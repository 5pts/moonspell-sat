const API_BASE = import.meta.env.VITE_API_URL || ''; // 默认为同源

export const api = {
  // 提交做题记录
  submitRecord: async (user, record) => {
    try {
      const response = await fetch(`${API_BASE}/api/record`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user, record }),
      });
      return response.ok;
    } catch (error) {
      console.error('API Error:', error);
      return false;
    }
  },

  // 批量回补历史记录
  submitRecordsBulk: async (user, records) => {
    try {
      const response = await fetch(`${API_BASE}/api/records/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user, records }),
      });
      if (!response.ok) return null;
      return await response.json();
    } catch (error) {
      console.error('Bulk API Error:', error);
      return null;
    }
  },

  // 获取所有数据 (Admin)
  fetchAllData: async (token) => {
    try {
      const response = await fetch(`${API_BASE}/api/admin/data`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch');
      return await response.json();
    } catch (error) {
      console.error('Admin API Error:', error);
      return null;
    }
  },

  // 拉取账号收藏单词
  fetchWordbook: async (userId) => {
    try {
      const response = await fetch(
        `${API_BASE}/api/wordbook?userId=${encodeURIComponent(String(userId || '').trim())}`
      );
      if (!response.ok) return null;
      const payload = await response.json();
      return Array.isArray(payload?.words) ? payload.words : [];
    } catch (error) {
      console.error('Wordbook fetch API Error:', error);
      return null;
    }
  },

  // 全量覆盖账号收藏单词
  replaceWordbook: async (user, words) => {
    try {
      const response = await fetch(`${API_BASE}/api/wordbook`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user, words }),
      });
      if (!response.ok) return null;
      return await response.json();
    } catch (error) {
      console.error('Wordbook replace API Error:', error);
      return null;
    }
  },
};
