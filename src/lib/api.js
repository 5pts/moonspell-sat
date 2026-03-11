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
  }
};
