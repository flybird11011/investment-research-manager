import { useState, useEffect } from 'react'
import { Plus, Trash2, TrendingUp, TrendingDown } from 'lucide-react'
import { watchlistApi, newsApi } from '../lib/api'
import { formatTime, getCategoryBadgeClass } from '../lib/utils'

interface WatchlistItem {
  id: number
  stockCode: string
  stockName: string
  createdAt: string
}

interface NewsItem {
  id: number
  title: string
  summary: string
  source: string
  category: string
  publishedAt: string
}

export default function Watchlist() {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([])
  const [relatedNews, setRelatedNews] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(false)
  const [newStockCode, setNewStockCode] = useState('')
  const [newStockName, setNewStockName] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)

  useEffect(() => {
    fetchWatchlist()
  }, [])

  const fetchWatchlist = async () => {
    setLoading(true)
    try {
      const res = await watchlistApi.getList()
      setWatchlist(res.data.data)
      
      // 获取相关资讯
      if (res.data.data.length > 0) {
        const stockCodes = res.data.data.map((item: WatchlistItem) => item.stockCode)
        const newsRes = await newsApi.getList({ limit: 20 })
        // 过滤出包含自选股的资讯
        const filtered = newsRes.data.data.filter((news: NewsItem) => 
          stockCodes.some((code: string) => news.title.includes(code))
        )
        setRelatedNews(filtered)
      }
    } catch (error) {
      console.error('获取自选股失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newStockCode.trim()) return

    try {
      await watchlistApi.add({
        stockCode: newStockCode.trim(),
        stockName: newStockName.trim() || newStockCode.trim(),
      })
      setNewStockCode('')
      setNewStockName('')
      setShowAddForm(false)
      fetchWatchlist()
    } catch (error) {
      console.error('添加自选股失败:', error)
      alert('添加失败，请检查股票代码是否正确')
    }
  }

  const handleRemove = async (id: number) => {
    if (!confirm('确定要删除这只股票吗？')) return
    
    try {
      await watchlistApi.remove(id)
      fetchWatchlist()
    } catch (error) {
      console.error('删除自选股失败:', error)
    }
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">自选股</h1>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="btn-primary flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">添加股票</span>
        </button>
      </div>

      {/* 添加表单 */}
      {showAddForm && (
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">添加自选股</h3>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  股票代码 *
                </label>
                <input
                  type="text"
                  value={newStockCode}
                  onChange={(e) => setNewStockCode(e.target.value)}
                  placeholder="如：600519"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  股票名称
                </label>
                <input
                  type="text"
                  value={newStockName}
                  onChange={(e) => setNewStockName(e.target.value)}
                  placeholder="如：贵州茅台"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button type="submit" className="btn-primary">
                确认添加
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="btn-secondary"
              >
                取消
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 自选股列表 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* 股票列表 */}
        <div className="lg:col-span-1">
          <h2 className="text-lg font-semibold mb-4">我的自选</h2>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
            </div>
          ) : watchlist.length > 0 ? (
            <div className="space-y-3">
              {watchlist.map((item) => (
                <div
                  key={item.id}
                  className="card flex items-center justify-between group"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-primary-600" />
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">
                        {item.stockName}
                      </div>
                      <div className="text-sm text-gray-500">
                        {item.stockCode}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemove(item.id)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-100 md:opacity-0 md:group-hover:opacity-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 bg-white rounded-xl border border-gray-200">
              暂无自选股，点击上方按钮添加
            </div>
          )}
        </div>

        {/* 相关资讯 */}
        <div className="lg:col-span-2">
          <h2 className="text-lg font-semibold mb-4">相关资讯</h2>
          {relatedNews.length > 0 ? (
            <div className="space-y-4">
              {relatedNews.map((news) => (
                <div key={news.id} className="card">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className={`badge ${getCategoryBadgeClass(news.category)}`}>
                      {news.category}
                    </span>
                    <span className="text-sm text-gray-500">{news.source}</span>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">
                    {news.title}
                  </h3>
                  {news.summary && (
                    <p className="text-sm text-gray-600 mb-2">
                      {news.summary}
                    </p>
                  )}
                  <span className="text-sm text-gray-500">
                    {formatTime(news.publishedAt)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500 bg-white rounded-xl border border-gray-200">
              暂无相关资讯
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
