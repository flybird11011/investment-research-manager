import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { 
  Newspaper, 
  Star, 
  FileText, 
  Zap, 
  Settings,
  TrendingUp,
  X,
  Search,
  Bot,
  CalendarDays
} from 'lucide-react'

interface LayoutProps {
  children: React.ReactNode
}

const navItems = [
  { path: '/', label: '资讯流', icon: Newspaper },
  { path: '/watchlist', label: '自选股', icon: Star },
  { path: '/reports', label: '研报', icon: FileText },
  { path: '/flash', label: '快讯', icon: Zap },
  { path: '/ai', label: 'AI 助手', icon: Bot },
  { path: '/briefing', label: '每日简报', icon: CalendarDays },
  { path: '/settings', label: '设置', icon: Settings },
]

export default function Layout({ children }: LayoutProps) {
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航 */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm safe-top">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center space-x-2 flex-shrink-0">
              <div className="bg-primary-600 p-1.5 sm:p-2 rounded-lg">
                <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <span className="text-lg sm:text-xl font-bold text-gray-900">投研资讯</span>
            </Link>

            {/* 桌面端导航链接 */}
            <nav className="hidden md:flex items-center space-x-1">
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive = location.pathname === item.path
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center space-x-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-primary-50 text-primary-700'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </nav>

            {/* 移动端右侧按钮 */}
            <div className="flex md:hidden items-center space-x-2">
              <Link
                to="/"
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <Search className="w-5 h-5" />
              </Link>
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                aria-label="打开菜单"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 移动端侧滑菜单 */}
      {mobileMenuOpen && (
        <>
          {/* 遮罩 */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-50"
            onClick={() => setMobileMenuOpen(false)}
          />
          {/* 菜单面板 */}
          <div className="fixed top-0 right-0 bottom-0 w-64 bg-white z-50 shadow-xl transform transition-transform">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <span className="text-lg font-bold text-gray-900">菜单</span>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                aria-label="关闭菜单"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="p-2">
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive = location.pathname === item.path
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center space-x-3 px-4 py-3 rounded-lg text-base font-medium transition-colors ${
                      isActive
                        ? 'bg-primary-50 text-primary-700'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </nav>
          </div>
        </>
      )}

      {/* 底部 Tab 导航（仅移动端，最多显示5个核心入口） */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40 safe-bottom">
        <div className="flex items-center justify-around py-1">
          {navItems.filter(item => ['/', '/watchlist', '/flash', '/ai', '/briefing'].includes(item.path)).map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center space-y-0.5 px-2 py-1.5 rounded-lg text-[10px] font-medium transition-colors no-select ${
                  isActive
                    ? 'text-primary-600'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>

      {/* 主内容区 */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 pb-20 md:pb-6">
        {children}
      </main>
    </div>
  )
}
