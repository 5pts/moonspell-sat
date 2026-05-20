const API_BASE_STORAGE_KEY = 'moonspell_api_base';

const normalizeBase = (value = '') => String(value || '').trim().replace(/\/+$/, '');

const readQueryBase = () => {
  if (typeof window === 'undefined') return '';
  try {
    const url = new URL(window.location.href);
    return normalizeBase(url.searchParams.get('api'));
  } catch {
    return '';
  }
};

const readStoredBase = () => {
  if (typeof window === 'undefined') return '';
  try {
    return normalizeBase(window.localStorage.getItem(API_BASE_STORAGE_KEY));
  } catch {
    return '';
  }
};

const readEnvBase = () => normalizeBase(import.meta.env.VITE_API_URL || '');

const resolveInitialBase = () => {
  const queryBase = readQueryBase();
  if (queryBase && typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(API_BASE_STORAGE_KEY, queryBase);
    } catch {
      // noop
    }
  }
  return queryBase || readStoredBase() || readEnvBase();
};

let apiBase = resolveInitialBase();
const wordbookPullState = new Map();

const buildApiUrl = (pathname) =>
  `${apiBase}${pathname.startsWith('/') ? pathname : `/${pathname}`}`;

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

const readJsonIfOk = async (response) => {
  if (!response.ok) return null;
  try {
    return await response.json();
  } catch {
    return null;
  }
};

export const api = {
  getApiBase: () => apiBase,

  setApiBase: (nextBase) => {
    apiBase = normalizeBase(nextBase);
    if (typeof window !== 'undefined') {
      try {
        if (apiBase) {
          window.localStorage.setItem(API_BASE_STORAGE_KEY, apiBase);
        } else {
          window.localStorage.removeItem(API_BASE_STORAGE_KEY);
        }
      } catch {
        // noop
      }
    }
    return apiBase;
  },

  health: async () => {
    try {
      const response = await fetch(buildApiUrl('/api/health'));
      const payload = await readJsonIfOk(response);
      return Boolean(payload?.ok);
    } catch {
      return false;
    }
  },

  // 提交做题记录
  submitRecord: async (user, record) => {
    try {
      const response = await fetch(buildApiUrl('/api/record'), {
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
      const response = await fetch(buildApiUrl('/api/records/bulk'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user, records }),
      });
      return await readJsonIfOk(response);
    } catch (error) {
      console.error('Bulk API Error:', error);
      return null;
    }
  },

  // 获取所有数据 (Admin)
  fetchAllData: async (token) => {
    try {
      const response = await fetch(buildApiUrl('/api/admin/data'), {
        headers: token
          ? {
              Authorization: `Bearer ${token}`,
            }
          : {},
      });
      return await readJsonIfOk(response);
    } catch (error) {
      console.error('Admin API Error:', error);
      return null;
    }
  },

  // 拉取账号收藏单词
  fetchWordbook: async (userId) => {
    const safeUserId = String(userId || '').trim();
    if (!safeUserId) return null;
    try {
      const response = await fetch(
        buildApiUrl(
          `/api/wordbook?userId=${encodeURIComponent(safeUserId)}`
        )
      );
      const payload = await readJsonIfOk(response);
      if (!payload) {
        wordbookPullState.set(safeUserId, false);
        return null;
      }
      const words = Array.isArray(payload.words) ? payload.words : [];
      wordbookPullState.set(safeUserId, true);
      return normalizeWordList(words);
    } catch (error) {
      console.error('Wordbook fetch API Error:', error);
      wordbookPullState.set(safeUserId, false);
      return null;
    }
  },

  // 全量覆盖账号收藏单词
  replaceWordbook: async (user, words) => {
    const safeUserId = String(user?.id || '').trim();
    if (!safeUserId) return null;

    try {
      let payloadWords = normalizeWordList(words);

      // Safety net: if we have not confirmed a successful pull this session,
      // fetch once before replace and merge to avoid accidental cloud wipe.
      if (!wordbookPullState.get(safeUserId)) {
        const remoteWords = await api.fetchWordbook(safeUserId);
        if (!Array.isArray(remoteWords)) {
          return null;
        }
        payloadWords = normalizeWordList([...remoteWords, ...payloadWords]);
      }

      const response = await fetch(buildApiUrl('/api/wordbook'), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user, words: payloadWords }),
      });
      const payload = await readJsonIfOk(response);
      if (payload?.success) {
        wordbookPullState.set(safeUserId, true);
      }
      return payload;
    } catch (error) {
      console.error('Wordbook replace API Error:', error);
      return null;
    }
  },
};
