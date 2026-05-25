import { useState, useEffect } from 'react'
import { FileText, TrendingUp, AlertTriangle, Eye, RefreshCw, Calendar, ChevronRight } from 'lucide-react'
import { aiApi } from '../lib/api'
import { formatDate } from '../lib/utils'

interface Briefing {
  id: number
  date: string
  marketOverview: string
  hotTopics: { title: string; sentiment: string; summary: string }[]
  watchlistAlerts: { stockCode: string; stockName: string; alert: string }[]
  riskWarnings: string[]
  outlook: string
}

function getSentimentEmoji(sentiment: string): string {
  switch (sentiment) {
    case 'positive':
      return '🟢'
    case 'neutral':
      return '🟡'
    case 'negative':
      return '🔴'
    default:
      return '🟡'
  }
}

function getSentimentLabel(sentiment: string): string {
  switch (sentiment) {
    case 'positive':
      return '积极'
    case 'neutral':
      return '中性'
    case 'negative':
      return '消极'
    default:
      return '中性'
  }
}

export default function DailyBriefing() {
  const [briefing, setBriefing] = useState<Briefing | null>(null)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [history, setHistory] = useState<Briefing[]>([])
  const [expandedId, setExpandedId] = useState<number | null>(null)

  useEffect(() => {
    fetchTodayBriefing()
    fetchHistory()
  }, [])

  const fetchTodayBriefing = async () => {
    setLoading(true)
    try {
      const res = await aiApi.getBriefing()
      if (res.data.data) {
        setBriefing(res.data.data)
      }
    } catch (error) {
      console.error('获取今日简报失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchHistory = async () => {
    try {
      const res = await aiApi.getBriefingHistory(30)
      if (res.data.data) {
        setHistory(res.data.data)
      }
    } catch (error) {
      console.error('获取历史简报失败:', error)
    }
  }

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      await aiApi.generateBriefing()
      await fetchTodayBriefing()
      await fetchHistory()
    } catch (error) {
      console.error('生成简报失败:', error)
    } finally {
      setGenerating(false)
    }
  }

  const toggleExpand = (id: number) => {
    setExpandedId(expandedId === id ? null : id)
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">每日简报</h1>
        {briefing && (
          <span className="text-sm text-gray-500 flex items-center space-x-1">
            <Calendar className="w-4 h-4" />
            <span>{formatDate(briefing.date, 'YYYY年MM月DD日')}</span>
          </span>
        )}
      </div>

      {/* 今日简报 */}
      <div className="card">
        <div className="flex items-center space-x-2 mb-4">
          <FileText className="w-5 h-5 text-primary-600" />
          <h2 className="text-lg font-semibold text-gray-900">今日简报</h2>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mb-3"></div>
            <span>加载中...</span>
          </div>
        ) : generating ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <RefreshCw className="w-8 h-8 text-primary-600 animate-spin mb-3" />
            <span>正在生成简报...</span>
          </div>
        ) : briefing ? (
          <div className="space-y-4 sm:space-y-5">
            {/* 大盘概览 */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
              <div className="flex items-center space-x-2 mb-2">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                <h3 className="font-semibold text-blue-800">大盘概览</h3>
              </div>
              <p className="text-sm text-blue-900 leading-relaxed whitespace-pre-line">
                {briefing.marketOverview}
              </p>
            </div>

            {/* 热门话题 */}
            {briefing.hotTopics && briefing.hotTopics.length > 0 && (
              <div>
                <h3 className="font-semibold text-gray-800 mb-3">热门话题</h3>
                <div className="space-y-2 sm:space-y-3">
                  {briefing.hotTopics.map((topic, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-2.5 sm:p-3">
                      <div className="flex items-start space-x-2">
                        <span className="text-lg mt-0.5">{getSentimentEmoji(topic.sentiment)}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="font-medium text-gray-900">{topic.title}</span>
                            <span className="text-xs text-gray-500">
                              {getSentimentLabel(topic.sentiment)}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600">{topic.summary}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 自选股动态 */}
            {briefing.watchlistAlerts && briefing.watchlistAlerts.length > 0 && (
              <div>
                <h3 className="font-semibold text-gray-800 mb-3">自选股动态</h3>
                <div className="space-y-2">
                  {briefing.watchlistAlerts.map((alert, index) => (
                    <div
                      key={index}
                      className="flex items-start space-x-3 bg-gray-50 rounded-lg p-3"
                    >
                      <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <TrendingUp className="w-4 h-4 text-primary-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-gray-900">{alert.stockName}</span>
                        <span className="text-sm text-gray-400 ml-2">{alert.stockCode}</span>
                        <p className="text-sm text-gray-600 mt-1">{alert.alert}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 风险提示 */}
            {briefing.riskWarnings && briefing.riskWarnings.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 sm:p-4">
                <div className="flex items-center space-x-2 mb-3">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  <h3 className="font-semibold text-red-800">风险提示</h3>
                </div>
                <ul className="space-y-2">
                  {briefing.riskWarnings.map((warning, index) => (
                    <li key={index} className="flex items-start space-x-2 text-sm text-red-900">
                      <span className="text-red-500 mt-0.5 flex-shrink-0">&#8226;</span>
                      <span>{warning}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 后市展望 */}
            {briefing.outlook && (
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <Eye className="w-5 h-5 text-gray-600" />
                  <h3 className="font-semibold text-gray-800">后市展望</h3>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                  {briefing.outlook}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <FileText className="w-12 h-12 text-gray-300 mb-3" />
            <p className="mb-4">今日暂无简报</p>
            <button onClick={handleGenerate} className="btn-primary flex items-center space-x-2">
              <RefreshCw className="w-4 h-4" />
              <span>生成今日简报</span>
            </button>
          </div>
        )}
      </div>

      {/* 历史简报 */}
      <div>
        <div className="flex items-center space-x-2 mb-4">
          <Calendar className="w-5 h-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">历史简报</h2>
        </div>

        {history.length > 0 ? (
          <div className="space-y-3">
            {history.map((item) => (
              <div key={item.id} className="card">
                <button
                  onClick={() => toggleExpand(item.id)}
                  className="w-full flex items-center justify-between text-left"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <FileText className="w-5 h-5 text-gray-500" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">
                        {formatDate(item.date, 'YYYY年MM月DD日')}
                      </div>
                      <div className="text-sm text-gray-500 mt-0.5 line-clamp-1">
                        {item.marketOverview}
                      </div>
                    </div>
                  </div>
                  <ChevronRight
                    className={`w-5 h-5 text-gray-400 transition-transform flex-shrink-0 ${
                      expandedId === item.id ? 'rotate-90' : ''
                    }`}
                  />
                </button>

                {expandedId === item.id && (
                  <div className="mt-4 pt-4 border-t border-gray-100 space-y-4">
                    {/* 大盘概览 */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <div className="flex items-center space-x-2 mb-2">
                        <TrendingUp className="w-4 h-4 text-blue-600" />
                        <h4 className="font-semibold text-blue-800 text-sm">大盘概览</h4>
                      </div>
                      <p className="text-sm text-blue-900 leading-relaxed whitespace-pre-line">
                        {item.marketOverview}
                      </p>
                    </div>

                    {/* 热门话题 */}
                    {item.hotTopics && item.hotTopics.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-gray-800 text-sm mb-2">热门话题</h4>
                        <div className="space-y-2">
                          {item.hotTopics.map((topic, index) => (
                            <div key={index} className="border border-gray-200 rounded-lg p-2.5">
                              <div className="flex items-start space-x-2">
                                <span className="text-base mt-0.5">{getSentimentEmoji(topic.sentiment)}</span>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center space-x-2 mb-0.5">
                                    <span className="font-medium text-gray-900 text-sm">{topic.title}</span>
                                    <span className="text-xs text-gray-500">
                                      {getSentimentLabel(topic.sentiment)}
                                    </span>
                                  </div>
                                  <p className="text-sm text-gray-600">{topic.summary}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 自选股动态 */}
                    {item.watchlistAlerts && item.watchlistAlerts.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-gray-800 text-sm mb-2">自选股动态</h4>
                        <div className="space-y-2">
                          {item.watchlistAlerts.map((alert, index) => (
                            <div key={index} className="flex items-start space-x-2 bg-gray-50 rounded-lg p-2.5">
                              <span className="font-medium text-gray-900 text-sm">{alert.stockName}</span>
                              <span className="text-xs text-gray-400">{alert.stockCode}</span>
                              <p className="text-sm text-gray-600">{alert.alert}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 风险提示 */}
                    {item.riskWarnings && item.riskWarnings.length > 0 && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                        <div className="flex items-center space-x-2 mb-2">
                          <AlertTriangle className="w-4 h-4 text-red-600" />
                          <h4 className="font-semibold text-red-800 text-sm">风险提示</h4>
                        </div>
                        <ul className="space-y-1">
                          {item.riskWarnings.map((warning, index) => (
                            <li key={index} className="flex items-start space-x-2 text-sm text-red-900">
                              <span className="text-red-500 mt-0.5 flex-shrink-0">&#8226;</span>
                              <span>{warning}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* 后市展望 */}
                    {item.outlook && (
                      <div>
                        <div className="flex items-center space-x-2 mb-2">
                          <Eye className="w-4 h-4 text-gray-600" />
                          <h4 className="font-semibold text-gray-800 text-sm">后市展望</h4>
                        </div>
                        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                          {item.outlook}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500 bg-white rounded-xl border border-gray-200">
            <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p>暂无历史简报</p>
          </div>
        )}
      </div>
    </div>
  )
}
