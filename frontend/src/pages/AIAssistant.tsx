import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Loader2, Sparkles } from 'lucide-react'
import { aiApi } from '../lib/api'

interface Message {
  role: 'user' | 'ai'
  content: string
}

const quickQuestions = [
  '今天市场怎么样？',
  '有哪些利好消息？',
  '自选股有什么动态？',
]

const AIAssistant = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'ai',
      content:
        '你好！我是你的 AI 投研助手。你可以问我关于市场动态、个股分析、行业趋势等问题，我会基于最新资讯为你解答。',
    },
  ])
  const [loading, setLoading] = useState(false)
  const [inputText, setInputText] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const handleSend = async (text?: string) => {
    const content = text || inputText.trim()
    if (!content || loading) return

    const userMessage: Message = { role: 'user', content }
    setMessages((prev) => [...prev, userMessage])
    setInputText('')
    setLoading(true)

    try {
      const res = await aiApi.chat(content)
      const aiMessage: Message = {
        role: 'ai',
        content: res.data?.answer || res.data?.message || '抱歉，我暂时无法回答这个问题。',
      }
      setMessages((prev) => [...prev, aiMessage])
    } catch {
      const errorMessage: Message = {
        role: 'ai',
        content: '抱歉，请求出错了，请稍后再试。',
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] sm:h-auto sm:px-4 sm:py-6 sm:px-6 lg:px-8">
      {/* 页面标题 */}
      <div className="mb-3 sm:mb-4 lg:mb-6 flex-shrink-0">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">AI 助手</h1>
        <p className="hidden sm:block text-sm text-gray-500 mt-1">
          基于最新资讯的智能投研问答
        </p>
      </div>

      {/* 快捷问题 */}
      {messages.length <= 1 && (
        <div className="mb-3 sm:mb-4 flex flex-wrap gap-2 flex-shrink-0">
          {quickQuestions.map((q) => (
            <button
              key={q}
              onClick={() => handleSend(q)}
              className="inline-flex items-center gap-1.5 rounded-full border border-primary-200 bg-primary-50 px-3 py-1.5 text-xs sm:text-sm text-primary-700 transition-colors hover:bg-primary-100 min-h-[36px] sm:min-h-[44px]"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {q}
            </button>
          ))}
        </div>
      )}

      {/* 聊天容器 */}
      <div className="flex flex-col flex-1 min-h-0 sm:min-h-[70vh] rounded-xl border border-gray-200 bg-white shadow-sm">
        {/* 消息列表 */}
        <div className="no-select flex-1 overflow-y-auto px-3 sm:px-4 py-3 sm:py-4 space-y-3 sm:space-y-4">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex items-start gap-2 sm:gap-3 ${
                msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'
              }`}
            >
              {/* 头像 */}
              <div
                className={`flex-shrink-0 flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full ${
                  msg.role === 'ai'
                    ? 'bg-primary-100 text-primary-600'
                    : 'bg-gray-200 text-gray-600'
                }`}
              >
                {msg.role === 'ai' ? (
                  <Bot className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                ) : (
                  <User className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                )}
              </div>

              {/* 消息气泡 */}
              <div
                className={`max-w-[80%] sm:max-w-[75%] rounded-2xl px-3 py-2 sm:px-3.5 sm:py-2.5 text-sm leading-relaxed ${
                  msg.role === 'ai'
                    ? 'bg-gray-100 text-gray-800 rounded-tl-sm'
                    : 'bg-primary-600 text-white rounded-tr-sm'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {/* 加载指示器 */}
          {loading && (
            <div className="flex items-start gap-2 sm:gap-3">
              <div className="flex-shrink-0 flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-primary-100 text-primary-600">
                <Bot className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </div>
              <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-3 sm:px-4 py-2 sm:py-3">
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-gray-400 animate-bounce [animation-delay:-0.3s]" />
                  <div className="h-2 w-2 rounded-full bg-gray-400 animate-bounce [animation-delay:-0.15s]" />
                  <div className="h-2 w-2 rounded-full bg-gray-400 animate-bounce" />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* 输入区域 - 移动端固定底部 */}
        <div className="border-t border-gray-100 px-3 sm:px-4 py-2.5 sm:py-3 flex-shrink-0 safe-bottom">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入你的问题..."
              className="flex-1 rounded-full border border-gray-300 bg-gray-50 px-4 py-2.5 text-base text-gray-900 placeholder-gray-400 outline-none transition-colors focus:border-primary-400 focus:bg-white focus:ring-1 focus:ring-primary-400"
              disabled={loading}
            />
            <button
              onClick={() => handleSend()}
              disabled={!inputText.trim() || loading}
              className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-primary-600 text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AIAssistant
