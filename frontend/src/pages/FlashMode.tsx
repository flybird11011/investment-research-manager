import { useState, useEffect } from 'react'
import { newsApi } from '../lib/api'
import { formatTime } from '../lib/utils'

interface NewsItem {
  id: number
  title: string
  source: string
  category: string
  publishedAt: string
}

export default function FlashMode() {
  const [news, setNews] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchNews()
    // 每30秒自动刷新
    const interval = setInterval(fetchNews, 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchNews = async () => {
    setLoading(true)
    try {
      const res = await newsApi.getList({ limit: 50 })
      setNews(res.data.data)
    } catch (error) {
      console.error('获取资讯失败:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">快讯模式</h1>
          <p className="text-sm text-gray-500 mt-1 hidden sm:block">极简视图，快速浏览最新资讯</p>
        </div>
        {loading && (
          <div className="flex items-center space-x-2 text-gray-500">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
            <span className="text-sm">更新中...</span>
          </div>
        )}
      </div>

      {/* 快讯列表 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {news.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {news.map((item, index) => (
              <div
                key={item.id}
                className="p-3 sm:p-4 hover:bg-gray-50 transition-colors"
              >
                {/* Mobile: vertical layout */}
                <div className="sm:hidden space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">{index + 1} · {formatTime(item.publishedAt)}</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-medium text-primary-600">{item.source}</span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">{item.category}</span>
                    </div>
                  </div>
                  <h3 className="text-sm text-gray-900 leading-relaxed">{item.title}</h3>
                </div>
                {/* Desktop: horizontal layout (original) */}
                <div className="hidden sm:flex items-start space-x-4">
                  {/* 序号 */}
                  <div className="flex-shrink-0 w-8 text-center">
                    <span className="text-xs font-medium text-gray-400">
                      {index + 1}
                    </span>
                  </div>

                  {/* 时间 */}
                  <div className="flex-shrink-0 w-20 text-right">
                    <span className="text-xs text-gray-500">
                      {formatTime(item.publishedAt)}
                    </span>
                  </div>

                  {/* 来源 */}
                  <div className="flex-shrink-0 w-20">
                    <span className="text-xs font-medium text-primary-600">
                      {item.source}
                    </span>
                  </div>

                  {/* 标题 */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm text-gray-900 leading-relaxed">
                      {item.title}
                    </h3>
                  </div>

                  {/* 分类标签 */}
                  <div className="flex-shrink-0">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                      {item.category}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            暂无快讯
          </div>
        )}
      </div>

      {/* 底部提示 */}
      <div className="text-center text-sm text-gray-400">
        每30秒自动刷新 | 共 {news.length} 条快讯
      </div>
    </div>
  )
}
