import { useState, useEffect, useRef } from 'react'
import { FileText, ExternalLink, Upload, Trash2, Sparkles, X, ChevronDown, ChevronUp } from 'lucide-react'
import { reportsApi } from '../lib/api'
import { formatTime } from '../lib/utils'

interface Report {
  id: number
  title: string
  author: string
  source: string
  stockCode: string
  stockName: string
  rating: string
  targetPrice: string
  summary: string
  sourceUrl: string
  publishedAt: string
}

interface AISummary {
  coreLogic: string
  rating: string
  targetPrice: string
  keyData: string[]
  risks: string[]
  highlights: string[]
}

export default function Reports() {
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [selectedReport, setSelectedReport] = useState<Report | null>(null)
  const [aiSummary, setAiSummary] = useState<AISummary | null>(null)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [expandedSummaries, setExpandedSummaries] = useState<Set<number>>(new Set())
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchReports()
  }, [])

  const fetchReports = async () => {
    setLoading(true)
    try {
      const res = await reportsApi.getList({ limit: 20 })
      setReports(res.data.data)
    } catch (error) {
      console.error('获取研报失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.type !== 'application/pdf') {
      alert('请上传 PDF 文件')
      return
    }

    setUploading(true)
    try {
      const res = await reportsApi.upload(file)
      console.log('上传成功:', res.data)

      // 保存 AI 摘要
      if (res.data.aiSummary) {
        setAiSummary(res.data.aiSummary)
        setSelectedReport(res.data.report)
      }

      // 刷新列表
      fetchReports()
      setShowUploadModal(false)

      alert('研报上传成功！AI 摘要已生成')
    } catch (error) {
      console.error('上传失败:', error)
      alert('上传失败，请重试')
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这份研报吗？')) return

    try {
      await reportsApi.delete(id)
      fetchReports()
      if (selectedReport?.id === id) {
        setSelectedReport(null)
        setAiSummary(null)
      }
    } catch (error) {
      console.error('删除失败:', error)
      alert('删除失败')
    }
  }

  const toggleSummary = (id: number) => {
    const newExpanded = new Set(expandedSummaries)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedSummaries(newExpanded)
  }

  const getRatingColor = (rating: string) => {
    const colors: Record<string, string> = {
      '买入': 'bg-red-100 text-red-800',
      '增持': 'bg-orange-100 text-orange-800',
      '中性': 'bg-yellow-100 text-yellow-800',
      '减持': 'bg-blue-100 text-blue-800',
      '卖出': 'bg-gray-100 text-gray-800',
    }
    return colors[rating] || 'bg-gray-100 text-gray-800'
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">研报中心</h1>
          <p className="text-sm text-gray-500 mt-1 hidden sm:block">
            上传研报 PDF，AI 自动提取核心投资逻辑
          </p>
        </div>
        <button
          onClick={() => setShowUploadModal(true)}
          className="btn-primary flex items-center justify-center space-x-2 w-full sm:w-auto"
        >
          <Upload className="w-4 h-4" />
          <span>上传研报</span>
        </button>
      </div>

      {/* 上传弹窗 */}
      {showUploadModal && (
        <div className="fixed inset-0 modal-backdrop flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl rounded-b-none sm:rounded-b-xl p-6 w-[calc(100%-2rem)] sm:max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">上传研报</h3>
              <button
                onClick={() => setShowUploadModal(false)}
                className="p-1 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".pdf"
                className="hidden"
              />
              <div className="space-y-4">
                <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto">
                  <Upload className="w-8 h-8 text-primary-600" />
                </div>
                <div>
                  <p className="text-gray-900 font-medium">
                    点击上传或拖拽文件到此处
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    支持 PDF 格式，最大 50MB
                  </p>
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="btn-primary"
                >
                  {uploading ? '上传中...' : '选择文件'}
                </button>
              </div>
            </div>

            {uploading && (
              <div className="mt-4 flex items-center justify-center space-x-2 text-gray-500">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
                <span className="text-sm">正在解析并生成 AI 摘要...</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* AI 摘要详情弹窗 */}
      {selectedReport && aiSummary && (
        <div className="fixed inset-0 modal-backdrop flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl rounded-b-none sm:rounded-b-xl w-[calc(100%-2rem)] sm:max-w-2xl w-full modal-safe overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-yellow-500" />
                <h3 className="text-lg font-semibold">AI 研报摘要</h3>
              </div>
              <button
                onClick={() => {
                  setSelectedReport(null)
                  setAiSummary(null)
                }}
                className="p-1 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* 研报标题 */}
              <div>
                <h4 className="font-semibold text-gray-900 text-lg">
                  {selectedReport.title}
                </h4>
                <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                  <span>{selectedReport.source}</span>
                  {selectedReport.author && (
                    <>
                      <span>·</span>
                      <span>{selectedReport.author}</span>
                    </>
                  )}
                </div>
              </div>

              {/* 评级和目标价 */}
              <div className="flex items-center space-x-4">
                {aiSummary.rating && (
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getRatingColor(aiSummary.rating)}`}>
                    {aiSummary.rating}
                  </span>
                )}
                {aiSummary.targetPrice && (
                  <span className="px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                    目标价: {aiSummary.targetPrice}
                  </span>
                )}
              </div>

              {/* 核心投资逻辑 */}
              <div className="bg-blue-50 rounded-lg p-4">
                <h5 className="font-medium text-blue-900 mb-2">核心投资逻辑</h5>
                <p className="text-blue-800 text-sm leading-relaxed">
                  {aiSummary.coreLogic}
                </p>
              </div>

              {/* 关键数据 */}
              {aiSummary.keyData.length > 0 && (
                <div>
                  <h5 className="font-medium text-gray-900 mb-3">关键数据</h5>
                  <div className="grid grid-cols-2 gap-2">
                    {aiSummary.keyData.map((data, index) => (
                      <div key={index} className="bg-gray-50 rounded-lg p-3 text-sm">
                        {data}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 投资亮点 */}
              {aiSummary.highlights.length > 0 && (
                <div>
                  <h5 className="font-medium text-gray-900 mb-3">投资亮点</h5>
                  <ul className="space-y-2">
                    {aiSummary.highlights.map((highlight, index) => (
                      <li key={index} className="flex items-start space-x-2 text-sm">
                        <span className="text-green-500 mt-0.5">✓</span>
                        <span className="text-gray-700">{highlight}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 风险提示 */}
              {aiSummary.risks.length > 0 && (
                <div>
                  <h5 className="font-medium text-gray-900 mb-3">风险提示</h5>
                  <ul className="space-y-2">
                    {aiSummary.risks.map((risk, index) => (
                      <li key={index} className="flex items-start space-x-2 text-sm">
                        <span className="text-red-500 mt-0.5">!</span>
                        <span className="text-gray-700">{risk}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 研报列表 */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      ) : reports.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3 lg:gap-4">
          {reports.map((report) => (
            <div key={report.id} className="card hover:shadow-md transition-shadow">
              <div className="flex items-start space-x-2.5 sm:space-x-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm sm:text-base text-gray-900 mb-1 line-clamp-2">
                    {report.title}
                  </h3>

                  <div className="flex items-center space-x-2 text-sm text-gray-500 mb-2">
                    <span>{report.source}</span>
                    {report.author && (
                      <>
                        <span>·</span>
                        <span>{report.author}</span>
                      </>
                    )}
                  </div>

                  {report.stockCode && (
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="badge badge-yellow">
                        {report.stockName || report.stockCode}
                      </span>
                      {report.rating && (
                        <span className={`badge text-xs ${getRatingColor(report.rating)}`}>
                          {report.rating}
                        </span>
                      )}
                      {report.targetPrice && (
                        <span className="badge badge-green text-xs">
                          目标价: {report.targetPrice}
                        </span>
                      )}
                    </div>
                  )}

                  {/* 摘要展开/收起 */}
                  {report.summary && (
                    <div className="mb-3">
                      <p className={`text-sm text-gray-600 ${expandedSummaries.has(report.id) ? '' : 'line-clamp-2'}`}>
                        {report.summary}
                      </p>
                      {report.summary.length > 100 && (
                        <button
                          onClick={() => toggleSummary(report.id)}
                          className="text-xs text-primary-600 hover:text-primary-700 mt-1 flex items-center"
                        >
                          {expandedSummaries.has(report.id) ? (
                            <>
                              <ChevronUp className="w-3 h-3 mr-1" />
                              收起
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-3 h-3 mr-1" />
                              展开
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">
                      {formatTime(report.publishedAt)}
                    </span>
                    <div className="flex items-center space-x-2">
                      {report.sourceUrl && (
                        <a
                          href={report.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center space-x-1 text-sm text-primary-600 hover:text-primary-700"
                        >
                          <span>查看原文</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      <button
                        onClick={() => handleDelete(report.id)}
                        className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500 bg-white rounded-xl border border-gray-200">
          <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p>暂无研报数据</p>
          <p className="text-sm mt-1">点击上方按钮上传研报 PDF</p>
        </div>
      )}
    </div>
  )
}
