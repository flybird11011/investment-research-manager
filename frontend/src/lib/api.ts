import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
})

// 请求拦截器：自动附带认证信息
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token')
  const userStr = localStorage.getItem('auth_user')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  if (userStr) {
    try {
      const user = JSON.parse(userStr)
      if (user.username) {
        config.headers['x-username'] = user.username
      }
    } catch {
      // ignore
    }
  }
  return config
})

// 资讯API
export const newsApi = {
  getList: (params?: { category?: string; source?: string; stock?: string; page?: number; limit?: number }) =>
    api.get('/news', { params }),
  getById: (id: number) => api.get(`/news/${id}`),
  search: (q: string, params?: { page?: number; limit?: number }) =>
    api.get('/news/search', { params: { q, ...params } }),
}

// 自选股API
export const watchlistApi = {
  getList: () => api.get('/watchlist'),
  add: (data: { stockCode: string; stockName?: string }) => api.post('/watchlist', data),
  remove: (id: number) => api.delete(`/watchlist/${id}`),
}

// 新闻源API
export const sourcesApi = {
  getList: () => api.get('/sources'),
  add: (data: { name: string; url: string; type?: string }) => api.post('/sources', data),
  update: (id: number, data: Partial<{ name: string; url: string; isEnabled: boolean }>) =>
    api.put(`/sources/${id}`, data),
  remove: (id: number) => api.delete(`/sources/${id}`),
  reset: () => api.post('/sources/reset'),
}

// 事件API
export const eventsApi = {
  getList: (params?: { category?: string; stock?: string; page?: number; limit?: number }) =>
    api.get('/events', { params }),
  getById: (eventId: string) => api.get(`/events/${eventId}`),
}

// 研报API
export const reportsApi = {
  getList: (params?: { stock?: string; page?: number; limit?: number }) =>
    api.get('/reports', { params }),
  getById: (id: number) => api.get(`/reports/${id}`),
  upload: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post('/reports/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
  },
  delete: (id: number) => api.delete(`/reports/${id}`),
}

// AI API
export const aiApi = {
  // 情绪分析
  analyzeSentiment: () => api.post('/ai/sentiment/analyze'),
  getSentimentStats: () => api.get('/ai/sentiment/stats'),
  // AI 问答
  chat: (question: string) => api.post('/ai/chat', { question }, { timeout: 30000 }),
  // 每日简报
  getBriefing: () => api.get('/ai/briefing'),
  generateBriefing: () => api.post('/ai/briefing/generate', {}, { timeout: 60000 }),
  getBriefingHistory: (limit?: number) => api.get('/ai/briefing/history', { params: { limit } }),
}

export default api

// 认证API
export const authApi = {
  login: (username: string, password: string) =>
    api.post('/auth/login', { username, password }),
  register: (username: string, password: string, nickname?: string) =>
    api.post('/auth/register', { username, password, nickname }),
  getMe: () => api.get('/auth/me'),
};

// 爬虫/源状态API
export const crawlerApi = {
  getStats: () => api.get('/crawler/stats'),
  setInterval: (sourceName: string, intervalMinutes: number) =>
    api.post('/crawler/set-interval', { sourceName, intervalMinutes }),
  trigger: () => api.post('/crawler/trigger'),
  force: (sourceName?: string) => api.post('/crawler/force', { sourceName }),
};
