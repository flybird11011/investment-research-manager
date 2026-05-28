import { useState, useEffect, useRef, useCallback } from 'react'
import { newsApi } from '../lib/api'
import { formatTime } from '../lib/utils'

interface NewsItem {
  id: number
  title: string
  source: string
  category: string
  publishedAt: string
}

const PAGE_SIZE = 30

function getPublishedTime(item: NewsItem): number {
  const time = new Date(item.publishedAt).getTime()
  return Number.isNaN(time) ? 0 : time
}

function sortNewsByPublishedAtDesc(items: NewsItem[]): NewsItem[] {
  return [...items].sort((a, b) => {
    const timeDiff = getPublishedTime(b) - getPublishedTime(a)
    if (timeDiff !== 0) return timeDiff
    return b.id - a.id
  })
}

function mergeNewsByPublishedAtDesc(current: NewsItem[], incoming: NewsItem[]): NewsItem[] {
  const byId = new Map<number, NewsItem>()

  for (const item of current) {
    byId.set(item.id, item)
  }
  for (const item of incoming) {
    byId.set(item.id, item)
  }

  return sortNewsByPublishedAtDesc(Array.from(byId.values()))
}

export default function FlashMode() {
  const [news, setNews] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const pageRef = useRef(1)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const loadMoreRef = useRef<HTMLDivElement>(null)

  const fetchNews = useCallback(async (page: number, append: boolean = false) => {
    if (append) {
      setLoadingMore(true)
    } else {
      setLoading(true)
    }

    try {
      const res = await newsApi.getList({ limit: PAGE_SIZE, page })
      const { data: items, total } = res.data

      setNews(prev => {
        return append
          ? mergeNewsByPublishedAtDesc(prev, items)
          : sortNewsByPublishedAtDesc(items)
      })

      setTotalCount(total)
      setHasMore(items.length === PAGE_SIZE)
      pageRef.current = page
    } catch (error) {
      console.error('获取资讯失败:', error)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

  // 初始加载
  useEffect(() => {
    fetchNews(1)
  }, [fetchNews])

  // 自动刷新（只刷新第一页，合并去重）
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await newsApi.getList({ limit: PAGE_SIZE, page: 1 })
        const newItems = res.data.data
        setNews(prev => mergeNewsByPublishedAtDesc(prev, newItems))
        setTotalCount(res.data.total)
      } catch (error) {
        console.error('自动刷新失败:', error)
      }
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  // 无限滚动
  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect()
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          fetchNews(pageRef.current + 1, true)
        }
      },
      { threshold: 0.1 }
    )

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current)
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
    }
  }, [hasMore, loadingMore, loading, fetchNews])

  return (
    <div className="space-y-4">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">快讯模式</h1>
          <p className="text-sm text-gray-500 mt-1 hidden sm:block">极简视图，快速浏览最新资讯</p>
        </div>
        <div className="flex items-center space-x-3">
          <span className="text-xs text-gray-400">共 {totalCount} 条</span>
          {loading && (
            <div className="flex items-center space-x-2 text-gray-500">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
              <span className="text-sm">更新中...</span>
            </div>
          )}
        </div>
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
                    <span className="text-[11px] sm:text-xs text-gray-400">{index + 1} · {formatTime(item.publishedAt)}</span>
                    <div className="flex items-center space-x-1.5 sm:space-x-2">
                      <span className="text-[11px] sm:text-xs font-medium text-primary-600">{item.source}</span>
                      <span className="inline-flex items-center px-1.5 sm:px-2 py-0.5 rounded text-[11px] sm:text-xs font-medium bg-gray-100 text-gray-600">{item.category}</span>
                    </div>
                  </div>
                  <h3 className="text-sm text-gray-900 leading-relaxed">{item.title}</h3>
                </div>
                {/* Desktop: horizontal layout */}
                <div className="hidden sm:flex items-start space-x-4">
                  <div className="flex-shrink-0 w-8 text-center">
                    <span className="text-xs font-medium text-gray-400">
                      {index + 1}
                    </span>
                  </div>
                  <div className="flex-shrink-0 w-20 text-right">
                    <span className="text-xs text-gray-500">
                      {formatTime(item.publishedAt)}
                    </span>
                  </div>
                  <div className="flex-shrink-0 w-20">
                    <span className="text-xs font-medium text-primary-600">
                      {item.source}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm text-gray-900 leading-relaxed">
                      {item.title}
                    </h3>
                  </div>
                  <div className="flex-shrink-0">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                      {item.category}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : !loading ? (
          <div className="text-center py-12 text-gray-500">
            暂无快讯
          </div>
        ) : null}

        {/* 加载更多触发器 */}
        <div ref={loadMoreRef} className="py-4 text-center">
          {loadingMore && (
            <div className="flex items-center justify-center space-x-2 text-gray-400">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
              <span className="text-sm">加载更多...</span>
            </div>
          )}
          {!hasMore && news.length > 0 && (
            <span className="text-sm text-gray-400">已加载全部 {news.length} 条快讯</span>
          )}
        </div>
      </div>

      {/* 底部提示 */}
      <div className="text-center text-sm text-gray-400">
        每30秒自动刷新 · 已加载 {news.length}/{totalCount} 条
      </div>
    </div>
  )
}
