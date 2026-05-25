import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, Filter, RefreshCw, Link2, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { newsApi, eventsApi, aiApi } from '../lib/api'
import { formatTime, truncateText, getCategoryBadgeClass } from '../lib/utils'

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

export default function NewsFeed() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [news, setNews] = useState<NewsItem[]>([])
  const [events, setEvents] = useState<EventItem[]>([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'news' | 'events'>('events')
  const [selectedCategory, setSelectedCategory] = useState('全部')
  const [searchQuery, setSearchQuery] = useState('')

  const categoryParam = searchParams.get('category') || '全部'

  useEffect(() => {
    setSelectedCategory(categoryParam)
    fetchData()
  }, [categoryParam])

  const fetchData = async () => {
    setLoading(true)
    try {
      const category = selectedCategory === '全部' ? undefined : selectedCategory

      // 获取聚合事件
      const eventsRes = await eventsApi.getList({ category, limit: 20 })
      setEvents(eventsRes.data.data)

      // 获取最新资讯
      const newsRes = await newsApi.getList({ category, limit: 20 })
      setNews(newsRes.data.data)
    } catch (error) {
      console.error('获取数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

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
      // 执行搜索
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
          <button
            onClick={fetchData}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="刷新"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 搜索栏 */}
      <form onSubmit={handleSearch} className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="搜索资讯..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </form>

      {/* 分类筛选 */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-2 hide-scrollbar">
        <Filter className="w-4 h-4 text-gray-400 flex-shrink-0" />
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => handleCategoryChange(category)}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
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
      <div className="flex items-center space-x-4 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('events')}
          className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'events'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          聚合事件
        </button>
        <button
          onClick={() => setActiveTab('news')}
          className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
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
        <div className="space-y-4">
          {activeTab === 'events' ? (
            // 聚合事件列表
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
            // 最新资讯列表
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
        </div>
      )}
    </div>
  )
}
