import { useState, useEffect } from 'react'
import { Plus, Trash2, RefreshCw, Globe, Rss } from 'lucide-react'
import { sourcesApi } from '../lib/api'

interface NewsSource {
  id: number
  name: string
  url: string
  type: string
  isEnabled: boolean
  isDefault: boolean
}

export default function Settings() {
  const [sources, setSources] = useState<NewsSource[]>([])
  const [loading, setLoading] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newSource, setNewSource] = useState({ name: '', url: '', type: 'rss' })

  useEffect(() => {
    fetchSources()
  }, [])

  const fetchSources = async () => {
    setLoading(true)
    try {
      const res = await sourcesApi.getList()
      setSources(res.data.data)
    } catch (error) {
      console.error('获取新闻源失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newSource.name.trim() || !newSource.url.trim()) return

    try {
      await sourcesApi.add(newSource)
      setNewSource({ name: '', url: '', type: 'rss' })
      setShowAddForm(false)
      fetchSources()
    } catch (error) {
      console.error('添加新闻源失败:', error)
      alert('添加失败')
    }
  }

  const handleToggle = async (source: NewsSource) => {
    try {
      await sourcesApi.update(source.id, { isEnabled: !source.isEnabled })
      fetchSources()
    } catch (error) {
      console.error('更新新闻源失败:', error)
    }
  }

  const handleRemove = async (id: number) => {
    if (!confirm('确定要删除这个新闻源吗？')) return

    try {
      await sourcesApi.remove(id)
      fetchSources()
    } catch (error) {
      console.error('删除新闻源失败:', error)
    }
  }

  const handleReset = async () => {
    if (!confirm('确定要恢复默认设置吗？这将删除所有自定义新闻源。')) return

    try {
      await sourcesApi.reset()
      fetchSources()
    } catch (error) {
      console.error('恢复默认设置失败:', error)
    }
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">设置</h1>
      </div>

      {/* 新闻源设置 */}
      <div className="card">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">新闻源管理</h2>
            <p className="text-sm text-gray-500 mt-1">
              管理资讯来源，支持添加自定义 RSS 源
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={fetchSources}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              title="刷新"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="btn-primary flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">添加源</span>
            </button>
          </div>
        </div>

        {/* 添加表单 */}
        {showAddForm && (
          <form onSubmit={handleAdd} className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-sm font-medium text-gray-700 mb-3">添加自定义新闻源</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">名称</label>
                <input
                  type="text"
                  value={newSource.name}
                  onChange={(e) => setNewSource({ ...newSource, name: e.target.value })}
                  placeholder="如：某某财经"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm text-gray-600 mb-1">RSS URL</label>
                <input
                  type="url"
                  value={newSource.url}
                  onChange={(e) => setNewSource({ ...newSource, url: e.target.value })}
                  placeholder="https://example.com/feed.xml"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>
            </div>
            <div className="flex items-center space-x-3 mt-4">
              <button type="submit" className="btn-primary text-sm">
                确认添加
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="btn-secondary text-sm"
              >
                取消
              </button>
            </div>
          </form>
        )}

        {/* 新闻源列表 */}
        <div className="space-y-3">
          {sources.map((source) => (
            <div
              key={source.id}
              className="flex items-center justify-between p-3 sm:p-4 bg-gray-50 rounded-lg"
            >
              <div className="flex items-center space-x-3 min-w-0 flex-1">
                <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shrink-0">
                  {source.type === 'rss' ? (
                    <Rss className="w-5 h-5 text-orange-500" />
                  ) : (
                    <Globe className="w-5 h-5 text-blue-500" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium text-gray-900">{source.name}</span>
                    {source.isDefault && (
                      <span className="badge badge-gray text-xs">默认</span>
                    )}
                  </div>
                  <div className="text-sm text-gray-500 truncate max-w-[200px] sm:max-w-md">
                    {source.url}
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2 sm:space-x-3 shrink-0 ml-2">
                {/* 启用/禁用开关 */}
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={source.isEnabled}
                    onChange={() => handleToggle(source)}
                    className="sr-only peer"
                  />
                  <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                  <span className="ml-2 text-sm font-medium text-gray-700 hidden sm:inline">
                    {source.isEnabled ? '启用' : '禁用'}
                  </span>
                </label>

                {/* 删除按钮 */}
                {!source.isDefault && (
                  <button
                    onClick={() => handleRemove(source.id)}
                    className="p-1.5 sm:p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* 恢复默认 */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <button
            onClick={handleReset}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            恢复默认新闻源设置
          </button>
        </div>
      </div>

      {/* 关于 */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">关于</h2>
        <div className="text-sm text-gray-600 space-y-2">
          <p>投研资讯 - 实时财经资讯聚合平台</p>
          <p>版本：v1.0.0</p>
          <p>技术栈：React + TypeScript + Node.js + PostgreSQL</p>
        </div>
      </div>
    </div>
  )
}
