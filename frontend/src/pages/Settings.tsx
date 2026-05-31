import { useState, useEffect } from 'react'
import { Plus, Trash2, RefreshCw, Globe, Rss, Users, Shield, ShieldCheck, Clock, Save, Volume2, VolumeX } from 'lucide-react'
import { sourcesApi, crawlerApi, authApi } from '../lib/api'
import { useAuth } from '../lib/auth'
import api from '../lib/api'
import { isSpeechSupported, speak, initSpeech, unlockSpeechPlayback, notifySpeechSettingsChanged } from '../lib/speech'

interface NewsSource {
  id: number
  name: string
  url: string
  type: string
  isEnabled: boolean
  isDefault: boolean
}

interface ManagedUser {
  id: number
  username: string
  nickname: string
  role: string
  disabled: boolean
  createdAt: string
  lastLoginAt: string | null
}

export default function Settings() {
  const { isAdmin, user: currentUser } = useAuth()
  const [activeTab, setActiveTab] = useState<'sources' | 'users'>('sources')

  // 新闻源相关状态
  const [sources, setSources] = useState<NewsSource[]>([])
  const [loading, setLoading] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newSource, setNewSource] = useState({ name: '', url: '', type: 'rss' })

  // 用户管理相关状态
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [registrationDisabled, setRegistrationDisabled] = useState(false)
  const [deduplicationEnabled, setDeduplicationEnabled] = useState(true)

  // 源状态相关
  const [sourceStatuses, setSourceStatuses] = useState<Record<string, { interval: number; lastFetch: string; lastCount: number; totalCount: number; status: string }>>({})
  const [editingInterval, setEditingInterval] = useState<string | null>(null)
  const [intervalValue, setIntervalValue] = useState<number>(10)

  // 语音播报相关
  const [speechEnabled, setSpeechEnabled] = useState<boolean>(() => {
    return localStorage.getItem('speechEnabled') === 'true'
  })
  const [speechReadAllNew, setSpeechReadAllNew] = useState<boolean>(() => {
    return localStorage.getItem('speechReadAllNew') === 'true'
  })
  const speechSupported = isSpeechSupported()

  useEffect(() => {
    fetchSources()
    fetchSourceStatuses()
    if (isAdmin) {
      fetchUsers()
      fetchSettings()
    }
    // 初始化语音
    initSpeech()
  }, [isAdmin])

  // 保存语音设置到 localStorage
  useEffect(() => {
    localStorage.setItem('speechEnabled', speechEnabled.toString())
    notifySpeechSettingsChanged()
  }, [speechEnabled])

  useEffect(() => {
    localStorage.setItem('speechReadAllNew', speechReadAllNew.toString())
    notifySpeechSettingsChanged()
  }, [speechReadAllNew])

  // 娴嬭瘯璇煶
  const handleTestSpeech = () => {
    unlockSpeechPlayback()
    speak('语音播报已开启，将为您朗读新闻标题')
  }

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

  const fetchSourceStatuses = async () => {
    try {
      const res = await crawlerApi.getStats()
      const details = res.data.stats?.sourceDetails || []
      const map: Record<string, any> = {}
      for (const d of details) {
        map[d.name] = d
      }
      setSourceStatuses(map)
    } catch (error) {
      console.error('获取源状态失败:', error)
    }
  }

  const handleSetInterval = async (sourceName: string) => {
    if (intervalValue < 5) {
      alert('更新间隔最小为 5 分钟')
      return
    }
    try {
      await crawlerApi.setInterval(sourceName, intervalValue)
      setEditingInterval(null)
      fetchSourceStatuses()
    } catch (error) {
      console.error('设置更新频率失败:', error)
      alert('设置失败')
    }
  }

  const fetchUsers = async () => {
    setUsersLoading(true)
    try {
      const res = await api.get('/auth/users')
      setUsers(res.data.users)
    } catch (error) {
      console.error('获取用户列表失败:', error)
    } finally {
      setUsersLoading(false)
    }
  }

  const fetchSettings = async () => {
    try {
      const res = await authApi.getSettings()
      setRegistrationDisabled(res.data.settings.registrationDisabled)
      setDeduplicationEnabled(res.data.settings.deduplicationEnabled ?? true)
    } catch (error) {
      console.error('获取系统设置失败:', error)
    }
  }

  const handleToggleRegistration = async () => {
    const newValue = !registrationDisabled
    const action = newValue ? '关闭' : '开启'
    if (!confirm(`确定要${action}注册功能吗？`)) return

    try {
      await authApi.updateSettings({ registrationDisabled: newValue })
      setRegistrationDisabled(newValue)
    } catch (error) {
      console.error('更新系统设置失败:', error)
      alert('操作失败')
    }
  }

  const handleToggleDeduplication = async () => {
    const newValue = !deduplicationEnabled
    const action = newValue ? '开启' : '关闭'
    if (!confirm(`确定要${action}全局去重功能吗？`)) return

    try {
      await authApi.updateSettings({ deduplicationEnabled: newValue })
      setDeduplicationEnabled(newValue)
    } catch (error) {
      console.error('更新全局去重设置失败:', error)
      alert('操作失败')
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

  const handleToggleUser = async (targetUser: ManagedUser) => {
    if (targetUser.username === currentUser?.username) return

    const action = targetUser.disabled ? '启用' : '禁用'
    if (!confirm(`确定要${action}用户 "${targetUser.nickname}" 吗？`)) return

    try {
      await api.put(`/auth/users/${targetUser.id}`, { disabled: !targetUser.disabled })
      fetchUsers()
    } catch (error: any) {
      const msg = error?.response?.data?.error || '操作失败'
      alert(msg)
    }
  }

  const handleDeleteUser = async (targetUser: ManagedUser) => {
    if (targetUser.username === currentUser?.username) return

    if (!confirm(`确定要删除用户 "${targetUser.nickname}" 吗？此操作不可撤销。`)) return

    try {
      await api.delete(`/auth/users/${targetUser.id}`)
      fetchUsers()
    } catch (error: any) {
      const msg = error?.response?.data?.error || '删除失败'
      alert(msg)
    }
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="space-y-6">
      {/* 椤甸潰鏍囬 */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">设置</h1>
      </div>

      {/* Tab 鍒囨崲 */}
      {isAdmin && (
        <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('sources')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'sources'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Globe className="w-4 h-4" />
            <span>新闻源管理</span>
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'users'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>用户管理</span>
          </button>
        </div>
      )}

      {/* 新闻源管理 Tab */}
      {activeTab === 'sources' && (
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

          {/* 语音播报设置 */}
          {speechSupported && (
            <div className="mb-6 p-3 sm:p-4 bg-blue-50 rounded-lg border border-blue-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    {speechEnabled ? (
                      <Volume2 className="w-5 h-5 text-blue-600" />
                    ) : (
                      <VolumeX className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">语音播报</h3>
                    <p className="text-sm text-gray-500">
                      {speechEnabled
                        ? speechReadAllNew
                          ? '新消息刷新时朗读全部新增标题'
                          : '新消息刷新时默认朗读前 10 条标题'
                        : '已关闭'}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="flex items-center space-x-2">
                    {speechEnabled && (
                      <button
                        onClick={handleTestSpeech}
                        className="px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                      >
                        测试
                      </button>
                    )}
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={speechEnabled}
                        onChange={(e) => {
                          const enabled = e.target.checked
                          if (enabled) {
                            unlockSpeechPlayback()
                          }
                          setSpeechEnabled(enabled)
                        }}
                        className="sr-only peer"
                      />
                      <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                  {speechEnabled && (
                    <label className="flex items-center justify-end gap-2 text-sm text-gray-600 cursor-pointer">
                      <span>全部新增</span>
                      <input
                        type="checkbox"
                        checked={speechReadAllNew}
                        onChange={(e) => setSpeechReadAllNew(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 添加表单 */}
          {showAddForm && (
            <form onSubmit={handleAdd} className="mb-6 p-3 sm:p-4 bg-gray-50 rounded-lg">
              <h3 className="text-sm font-medium text-gray-700 mb-3">添加自定义新闻源</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">名称</label>
                  <input
                    type="text"
                    value={newSource.name}
                    onChange={(e) => setNewSource({ ...newSource, name: e.target.value })}
                    placeholder="如：某某财经"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-base"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-base"
                    required
                  />
                </div>
              </div>
              <div className="flex items-center space-x-3 mt-4">
                <button type="submit" className="btn-primary text-sm flex-1 sm:flex-none">
                  确认添加
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="btn-secondary text-sm flex-1 sm:flex-none"
                >
                  取消
                </button>
              </div>
            </form>
          )}

          {/* 鏂伴椈婧愬垪琛?*/}
          <div className="space-y-2 sm:space-y-3">
            {sources.map((source) => {
              const status = sourceStatuses[source.name]
              return (
              <div
                key={source.id}
                className="p-2.5 sm:p-3 lg:p-4 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 bg-white rounded-lg flex items-center justify-center shrink-0">
                      {source.type === 'rss' ? (
                        <Rss className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500" />
                      ) : (
                        <Globe className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-gray-900 text-sm sm:text-base">{source.name}</span>
                        {source.isDefault && (
                          <span className="badge badge-gray text-xs">默认</span>
                        )}
                      </div>
                      <div className="text-xs sm:text-sm text-gray-500 truncate max-w-[150px] sm:max-w-[200px] lg:max-w-md">
                        {source.url}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 sm:space-x-3 shrink-0 ml-2">
                    {/* 启用/禁用开关 */}
                    <label className="flex items-center cursor-pointer min-h-[44px] min-w-[44px] justify-center">
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

                    {/* 鍒犻櫎鎸夐挳 */}
                    {!source.isDefault && (
                      <button
                        onClick={() => handleRemove(source.id)}
                        className="p-2 sm:p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* 源状态信息行 */}
                {status && (
                  <div className="mt-2 ml-12 sm:ml-13 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400">
                    <span className="flex items-center space-x-1">
                      <Clock className="w-3 h-3" />
                      <span>鏈€鍚庢姄鍙? {status.lastFetch}</span>
                    </span>
                    <span>上次: {status.lastCount}条</span>
                    <span>累计: {status.totalCount}条</span>
                    <span className={status.status === '正常' ? 'text-green-500' : 'text-red-500'}>
                      {status.status}
                    </span>
                  </div>
                )}

                {/* 更新频率设置 */}
                <div className="mt-2 ml-12 sm:ml-13 flex items-center gap-2">
                  <span className="text-xs text-gray-400">更新频率:</span>
                  {editingInterval === source.name ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={5}
                        max={120}
                        value={intervalValue}
                        onChange={(e) => setIntervalValue(Math.max(5, parseInt(e.target.value) || 5))}
                        className="w-16 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSetInterval(source.name)
                          if (e.key === 'Escape') setEditingInterval(null)
                        }}
                      />
                      <span className="text-xs text-gray-400">鍒嗛挓</span>
                      <button
                        onClick={() => handleSetInterval(source.name)}
                        className="p-1 text-primary-600 hover:bg-primary-50 rounded transition-colors"
                        title="淇濆瓨"
                      >
                        <Save className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setEditingInterval(null)}
                        className="p-1 text-gray-400 hover:bg-gray-100 rounded transition-colors"
                        title="取消"
                      >
                        <span className="text-xs">✓</span>
                      </button>
                    </div>
                  ) : (
                     <button
                       onClick={() => {
                         setEditingInterval(source.name)
                         setIntervalValue(sourceStatuses[source.name]?.interval || 10)
                       }}
                       className="text-xs text-primary-600 hover:text-primary-700 hover:underline"
                     >
                       {sourceStatuses[source.name]?.interval
                         ? `姣?${sourceStatuses[source.name].interval} 鍒嗛挓`
                         : '点击设置'}
                     </button>
                  )}
                </div>
              </div>
              )
            })}
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
      )}

      {/* 用户管理 Tab（仅管理员可见） */}
      {activeTab === 'users' && isAdmin && (
        <div className="space-y-6">
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">全局去重</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {deduplicationEnabled
                    ? '抓取时会自动过滤重复新闻，保持现有行为'
                    : '抓取时不会过滤重复新闻，所有抓到的内容都会入库'}
                </p>
              </div>
              <label className="flex items-center cursor-pointer min-h-[44px] min-w-[44px] justify-center">
                <input
                  type="checkbox"
                  checked={deduplicationEnabled}
                  onChange={handleToggleDeduplication}
                  className="sr-only peer"
                />
                <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                <span className="ml-2 text-sm font-medium text-gray-700 hidden sm:inline">
                  {deduplicationEnabled ? '已开启' : '已关闭'}
                </span>
              </label>
            </div>
          </div>
          {/* 娉ㄥ唽寮€鍏?*/}
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">娉ㄥ唽鎺у埗</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {registrationDisabled
                    ? '注册功能已关闭，新用户无法注册'
                    : '娉ㄥ唽鍔熻兘宸插紑鍚紝浠讳綍浜洪兘鍙互娉ㄥ唽'}
                </p>
              </div>
              <label className="flex items-center cursor-pointer min-h-[44px] min-w-[44px] justify-center">
                <input
                  type="checkbox"
                  checked={registrationDisabled}
                  onChange={handleToggleRegistration}
                  className="sr-only peer"
                />
                <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                <span className="ml-2 text-sm font-medium text-gray-700 hidden sm:inline">
                  {registrationDisabled ? '已关闭' : '已开启'}
                </span>
              </label>
            </div>
          </div>

          {/* 鐢ㄦ埛鍒楄〃 */}
          <div className="card">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">用户管理</h2>
              <p className="text-sm text-gray-500 mt-1">
                管理系统用户，共 {users.length} 个用户
              </p>
            </div>
            <button
              onClick={fetchUsers}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              title="刷新"
            >
              <RefreshCw className={`w-5 h-5 ${usersLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* 鐢ㄦ埛鍒楄〃 */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-2 text-gray-600 font-medium">用户名</th>
                  <th className="text-left py-3 px-2 text-gray-600 font-medium">昵称</th>
                  <th className="text-left py-3 px-2 text-gray-600 font-medium">角色</th>
                  <th className="text-left py-3 px-2 text-gray-600 font-medium hidden md:table-cell">注册时间</th>
                  <th className="text-left py-3 px-2 text-gray-600 font-medium hidden lg:table-cell">最后登录</th>
                  <th className="text-left py-3 px-2 text-gray-600 font-medium">状态</th>
                  <th className="text-right py-3 px-2 text-gray-600 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isSelf = u.username === currentUser?.username
                  return (
                    <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-2 text-gray-900 font-medium">{u.username}</td>
                      <td className="py-3 px-2 text-gray-700">{u.nickname}</td>
                      <td className="py-3 px-2">
                        {u.role === 'admin' ? (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                            <ShieldCheck className="w-3 h-3" />
                            <span>管理员</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                            <Shield className="w-3 h-3" />
                            <span>用户</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-2 text-gray-500 hidden md:table-cell">
                        {formatDate(u.createdAt)}
                      </td>
                      <td className="py-3 px-2 text-gray-500 hidden lg:table-cell">
                        {formatDate(u.lastLoginAt)}
                      </td>
                      <td className="py-3 px-2">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          u.disabled
                            ? 'bg-red-100 text-red-700'
                            : 'bg-green-100 text-green-700'
                        }`}>
                          {u.disabled ? '已禁用' : '正常'}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-right">
                        {!isSelf && u.role !== 'admin' && (
                          <div className="flex items-center justify-end space-x-1">
                            <button
                              onClick={() => handleToggleUser(u)}
                              className={`p-1.5 rounded-lg transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center ${
                                u.disabled
                                  ? 'text-green-600 hover:bg-green-50'
                                  : 'text-yellow-600 hover:bg-yellow-50'
                              }`}
                              title={u.disabled ? '启用用户' : '禁用用户'}
                            >
                              <RefreshCw className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteUser(u)}
                              className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                              title="删除用户"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                        {isSelf && (
                            <span className="text-xs text-gray-400">当前用户</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {users.length === 0 && !usersLoading && (
            <div className="text-center py-12 text-gray-400">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>暂无用户数据</p>
            </div>
          )}
          </div>
        </div>
      )}

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

