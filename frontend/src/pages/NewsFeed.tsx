import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, Filter, RefreshCw, Link2, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { newsApi, eventsApi } from '../lib/api'
import { formatTime, truncateText, getCategoryBadgeClass } from '../lib/utils'
import { speak, unlockSpeechPlayback, getSpeechSettings, listenSpeechSettingsChanged } from '../lib/speech'

interface NewsItem {
  id: number
  title: string
  summary: string
  source: string
  category: string
  eventId: string
  relatedStocks: string[]
  sentiment: string | null
  sentimentScore: number | null
  publishedAt: string
  sourceUrl?: string
}

interface EventItem {
  id: number
  eventId: string
  title: string
  category: string
  relatedStocks: string[]
  newsCount: number
  lastPublishedAt: string
}

const categories = ['全部', '股票', '基金', '宏观', '行业', '其他']
const PAGE_SIZE = 20
const SPEECH_REFRESH_INTERVAL_MS = 60 * 1000
const SPEECH_DEFAULT_MAX_ITEMS = 10

export default function NewsFeed() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [news, setNews] = useState<NewsItem[]>([])
  const [events, setEvents] = useState<EventItem[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const [activeTab, setActiveTab] = useState<'news' | 'events'>('events')
  const [selectedCategory, setSelectedCategory] = useState('全部')
  const [searchQuery, setSearchQuery] = useState('')

  const newsPageRef = useRef(1)
  const eventsPageRef = useRef(1)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const lastNewsIdsRef = useRef<Set<number>>(new Set())
  const isFirstLoadRef = useRef(true)

  const categoryParam = searchParams.get('category') || '全部'

  const [speechEnabled, setSpeechEnabled] = useState(() => getSpeechSettings().enabled)
  const [speechReadAllNew, setSpeechReadAllNew] = useState(() => getSpeechSettings().readAllNew)

  useEffect(() => {
    const syncSpeechSettings = () => {
      const settings = getSpeechSettings()
      setSpeechEnabled(settings.enabled)
      setSpeechReadAllNew(settings.readAllNew)
    }

    syncSpeechSettings()
    return listenSpeechSettingsChanged(syncSpeechSettings)
  }, [])
  const fetchEvents = useCallback(async (page: number, append: boolean = false) => {
    try {
      const category = selectedCategory === '全部' ? undefined : selectedCategory
      const res = await eventsApi.getList({ category, limit: PAGE_SIZE, page })
      const items = res.data.data
      if (append) {
        setEvents(prev => [...prev, ...items])
      } else {
        setEvents(items)
      }
      setHasMore(items.length === PAGE_SIZE)
      eventsPageRef.current = page
    } catch (error) {
      console.error('获取事件失败:', error)
    }
  }, [selectedCategory])

  const fetchNews = useCallback(async (page: number, append: boolean = false) => {
    try {
      const category = selectedCategory === '全部' ? undefined : selectedCategory
      const res = await newsApi.getList({ category, limit: PAGE_SIZE, page })
      const { data: items, total } = res.data

      // 语音播报：检测新新闻（非首次加载且非翻页时）
      if (!append && !isFirstLoadRef.current && speechEnabled && items.length > 0) {
        const newItems = items.filter((item: NewsItem) => !lastNewsIdsRef.current.has(item.id))
        if (newItems.length > 0) {
          // 默认朗读最新的 10 条；开启“全部新增”时朗读全部
          const titlesToSpeak = (speechReadAllNew
            ? newItems
            : newItems.slice(0, SPEECH_DEFAULT_MAX_ITEMS)
          ).map((item: NewsItem) => item.title)
          speak(titlesToSpeak.join('。'))
        }
      }

      // 更新已记录的 ID
      if (!append) {
        lastNewsIdsRef.current = new Set(items.map((item: NewsItem) => item.id))
        isFirstLoadRef.current = false
      }

      if (append) {
        setNews(prev => [...prev, ...items])
      } else {
        setNews(items)
      }
      setTotalCount(total)
      setHasMore(items.length === PAGE_SIZE)
      newsPageRef.current = page
    } catch (error) {
      console.error('获取资讯失败:', error)
    }
  }, [selectedCategory, speechEnabled, speechReadAllNew])

  const fetchData = useCallback(async () => {
    setLoading(true)
    newsPageRef.current = 1
    eventsPageRef.current = 1
    setHasMore(true)
    await Promise.all([
      fetchEvents(1),
      fetchNews(1),
    ])
    setLoading(false)
  }, [fetchEvents, fetchNews])

  useEffect(() => {
    setSelectedCategory(categoryParam)
  }, [categoryParam])

  useEffect(() => {
    newsPageRef.current = 1
    eventsPageRef.current = 1
    setHasMore(true)
    setNews([])
    setEvents([])
    setLoading(true)
    Promise.all([
      fetchEvents(1),
      fetchNews(1),
    ]).finally(() => setLoading(false))
  }, [selectedCategory, fetchEvents, fetchNews])

  useEffect(() => {
    if (!speechEnabled) return

    const interval = window.setInterval(() => {
      if (document.hidden) return
      fetchNews(1)
    }, SPEECH_REFRESH_INTERVAL_MS)

    return () => window.clearInterval(interval)
  }, [speechEnabled, fetchNews])

  // 无限滚动
  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect()
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          if (activeTab === 'news') {
            setLoadingMore(true)
            fetchNews(newsPageRef.current + 1, true).finally(() => setLoadingMore(false))
          } else {
            setLoadingMore(true)
            fetchEvents(eventsPageRef.current + 1, true).finally(() => setLoadingMore(false))
          }
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
  }, [hasMore, loadingMore, loading, activeTab, fetchNews, fetchEvents])

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category)
    if (category === '全部') {
      searchParams.delete('category')
    } else {
      searchParams.set('category', category)
    }
    setSearchParams(searchParams)
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      newsApi.search(searchQuery).then(res => {
        setNews(res.data.data)
        setActiveTab('news')
      })
    }
  }

  return (
    <div className="space-y-6">
      {/* 页面标题和工具栏 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">资讯流</h1>

        <div className="flex flex-wrap items-center space-x-2">
          <span className="text-xs text-gray-400">
            {activeTab === 'news' ? `共 ${totalCount} 条` : `${events.length} 条事件`}
          </span>
          <button
            onClick={() => {
              unlockSpeechPlayback()
              fetchData()
            }}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="刷新"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 搜索栏 */}
      <form onSubmit={handleSearch} className="relative w-full">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="搜索资讯..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-base sm:text-base"
        />
      </form>

      {/* 分类筛选 */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-2 hide-scrollbar flex-nowrap">
        <Filter className="w-4 h-4 text-gray-400 flex-shrink-0" />
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => handleCategoryChange(category)}
            className={`flex-shrink-0 px-3 sm:px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              selectedCategory === category
                ? 'bg-primary-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      {/* 标签切换 */}
      <div className="flex items-stretch border-b border-gray-200">
        <button
          onClick={() => setActiveTab('events')}
          className={`flex-1 pb-3 text-sm font-medium border-b-2 transition-colors text-center ${
            activeTab === 'events'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          聚合事件
        </button>
        <button
          onClick={() => setActiveTab('news')}
          className={`flex-1 pb-3 text-sm font-medium border-b-2 transition-colors text-center ${
            activeTab === 'news'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          最新资讯
        </button>
      </div>

      {/* 内容列表 */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      ) : (
        <div className="space-y-3 sm:space-y-4">
          {activeTab === 'events' ? (
            events.length > 0 ? (
              events.map((event) => (
                <div key={event.eventId} className="card hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className={`badge ${getCategoryBadgeClass(event.category)}`}>
                          {event.category}
                        </span>
                        {event.newsCount > 1 && (
                          <span className="badge badge-blue">
                            {event.newsCount} 篇相关
                          </span>
                        )}
                        {event.relatedStocks?.map((stock) => (
                          <span key={stock} className="badge badge-yellow">
                            {stock}
                          </span>
                        ))}
                      </div>
                      <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">
                        {event.title}
                      </h3>
                      <div className="flex items-center text-sm text-gray-500">
                        <span>{formatTime(event.lastPublishedAt)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-gray-500">
                暂无聚合事件
              </div>
            )
          ) : (
            news.length > 0 ? (
              news.map((item) => (
                <div key={item.id} className="card hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className={`badge ${getCategoryBadgeClass(item.category)}`}>
                          {item.category}
                        </span>
                        <span className="text-sm text-gray-500">{item.source}</span>
                        {item.relatedStocks?.map((stock) => (
                          <span key={stock} className="badge badge-yellow">
                            ⭐ {stock}
                          </span>
                        ))}
                        {item.sentiment && (
                          <span className={`badge flex items-center space-x-0.5 ${
                            item.sentiment === 'positive' ? 'badge-green' :
                            item.sentiment === 'negative' ? 'badge-red' : 'badge-gray'
                          }`}>
                            {item.sentiment === 'positive' ? <TrendingUp className="w-3 h-3" /> :
                             item.sentiment === 'negative' ? <TrendingDown className="w-3 h-3" /> :
                             <Minus className="w-3 h-3" />}
                            {item.sentiment === 'positive' ? '利好' :
                             item.sentiment === 'negative' ? '利空' : '中性'}
                          </span>
                        )}
                      </div>
                      <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">
                        {item.title}
                      </h3>
                      {item.summary && (
                        <p className="text-gray-600 text-sm mb-3">
                          {truncateText(item.summary, 150)}
                        </p>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">
                          {formatTime(item.publishedAt)}
                        </span>
                        {item.sourceUrl && (
                          <a
                            href={item.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center space-x-1 text-sm text-primary-600 hover:text-primary-700"
                          >
                            <Link2 className="w-4 h-4" />
                            <span>查看原文</span>
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-gray-500">
                暂无资讯
              </div>
            )
          )}

          {/* 加载更多触发器 */}
          <div ref={loadMoreRef} className="py-4 text-center">
            {loadingMore && (
              <div className="flex items-center justify-center space-x-2 text-gray-400">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
                <span className="text-sm">加载更多...</span>
              </div>
            )}
            {!hasMore && (news.length > 0 || events.length > 0) && (
              <span className="text-sm text-gray-400">
                已加载全部 {activeTab === 'news' ? news.length : events.length} 条
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
