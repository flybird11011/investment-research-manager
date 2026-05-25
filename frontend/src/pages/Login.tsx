import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import {
  User,
  Lock,
  Eye,
  EyeOff,
  TrendingUp,
  Newspaper,
  Star,
  Zap,
  Bot,
} from 'lucide-react';

type TabType = 'login' | 'register';

export default function Login() {
  const navigate = useNavigate();
  const { login, register } = useAuth();

  const [activeTab, setActiveTab] = useState<TabType>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!username.trim()) {
      newErrors.username = '请输入用户名';
    } else if (username.trim().length < 3) {
      newErrors.username = '用户名至少需要3个字符';
    }

    if (!password) {
      newErrors.password = '请输入密码';
    } else if (password.length < 6) {
      newErrors.password = '密码至少需要6个字符';
    }

    if (activeTab === 'register') {
      if (!confirmPassword) {
        newErrors.confirmPassword = '请确认密码';
      } else if (password !== confirmPassword) {
        newErrors.confirmPassword = '两次输入的密码不一致';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError('');

    if (!validate()) return;

    setIsSubmitting(true);
    try {
      if (activeTab === 'login') {
        await login(username.trim(), password);
      } else {
        await register(username.trim(), password, nickname.trim() || undefined);
      }
      navigate('/');
    } catch (err: any) {
      const message =
        err.response?.data?.message || err.message || '操作失败，请稍后重试';
      setServerError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const switchTab = (tab: TabType) => {
    setActiveTab(tab);
    setErrors({});
    setServerError('');
    setConfirmPassword('');
  };

  const features = [
    {
      icon: <Newspaper className="w-5 h-5" />,
      title: '实时资讯',
      desc: '多源聚合，实时追踪市场动态',
    },
    {
      icon: <Star className="w-5 h-5" />,
      title: '智能自选',
      desc: '个股监控，重要事件及时提醒',
    },
    {
      icon: <Zap className="w-5 h-5" />,
      title: '闪电模式',
      desc: '快速浏览，高效获取关键信息',
    },
    {
      icon: <Bot className="w-5 h-5" />,
      title: 'AI 助手',
      desc: '智能问答，辅助投资决策分析',
    },
  ];

  return (
    <div className="min-h-screen flex">
      {/* 左侧品牌区 - 移动端隐藏 */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary-600 to-primary-800 text-white flex-col justify-center px-16">
        <div className="max-w-md">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <TrendingUp className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">投研资讯</h1>
              <p className="text-primary-200 text-sm">Investment Research Manager</p>
            </div>
          </div>

          <p className="text-lg text-primary-100 mb-10 leading-relaxed">
            一站式投研资讯管理平台，整合多源数据，利用 AI
            技术为您提供智能化的投资研究体验。
          </p>

          <div className="space-y-5">
            {features.map((feature, idx) => (
              <div key={idx} className="flex items-start gap-4">
                <div className="w-10 h-10 bg-white/15 rounded-lg flex items-center justify-center flex-shrink-0 backdrop-blur-sm">
                  {feature.icon}
                </div>
                <div>
                  <h3 className="font-semibold text-white">{feature.title}</h3>
                  <p className="text-primary-200 text-sm mt-0.5">
                    {feature.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 右侧表单区 */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-12 bg-gray-50">
        <div className="w-full max-w-md">
          {/* 移动端品牌显示 */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">投研资讯</h1>
          </div>

          {/* Tab 切换 */}
          <div className="flex bg-gray-200 rounded-lg p-1 mb-8">
            <button
              type="button"
              onClick={() => switchTab('login')}
              className={`flex-1 py-2.5 text-sm font-medium rounded-md transition-all duration-200 ${
                activeTab === 'login'
                  ? 'bg-white text-primary-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              登录
            </button>
            <button
              type="button"
              onClick={() => switchTab('register')}
              className={`flex-1 py-2.5 text-sm font-medium rounded-md transition-all duration-200 ${
                activeTab === 'register'
                  ? 'bg-white text-primary-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              注册
            </button>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {activeTab === 'login' ? '欢迎回来' : '创建账号'}
          </h2>
          <p className="text-gray-500 mb-8">
            {activeTab === 'login'
              ? '登录您的账号以继续使用投研资讯平台'
              : '注册一个新账号，开始您的投研之旅'}
          </p>

          {/* 服务端错误提示 */}
          {serverError && (
            <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* 用户名 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                用户名
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    if (errors.username) {
                      setErrors((prev) => ({ ...prev, username: '' }));
                    }
                  }}
                  placeholder="请输入用户名"
                  className={`w-full pl-10 pr-4 py-2.5 border rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors ${
                    errors.username ? 'border-red-300' : 'border-gray-300'
                  }`}
                  autoComplete="username"
                />
              </div>
              {errors.username && (
                <p className="mt-1.5 text-sm text-red-500">{errors.username}</p>
              )}
            </div>

            {/* 昵称 - 仅注册时显示 */}
            {activeTab === 'register' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  昵称 <span className="text-gray-400 font-normal">（可选）</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="请输入昵称"
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                    autoComplete="nickname"
                  />
                </div>
              </div>
            )}

            {/* 密码 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                密码
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password) {
                      setErrors((prev) => ({ ...prev, password: '' }));
                    }
                  }}
                  placeholder="请输入密码"
                  className={`w-full pl-10 pr-12 py-2.5 border rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors ${
                    errors.password ? 'border-red-300' : 'border-gray-300'
                  }`}
                  autoComplete={
                    activeTab === 'login' ? 'current-password' : 'new-password'
                  }
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1.5 text-sm text-red-500">{errors.password}</p>
              )}
            </div>

            {/* 确认密码 - 仅注册时显示 */}
            {activeTab === 'register' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  确认密码
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (errors.confirmPassword) {
                        setErrors((prev) => ({
                          ...prev,
                          confirmPassword: '',
                        }));
                      }
                    }}
                    placeholder="请再次输入密码"
                    className={`w-full pl-10 pr-12 py-2.5 border rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors ${
                      errors.confirmPassword
                        ? 'border-red-300'
                        : 'border-gray-300'
                    }`}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="mt-1.5 text-sm text-red-500">
                    {errors.confirmPassword}
                  </p>
                )}
              </div>
            )}

            {/* 提交按钮 */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full btn-primary py-3 text-base disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting
                ? activeTab === 'login'
                  ? '登录中...'
                  : '注册中...'
                : activeTab === 'login'
                  ? '登录'
                  : '注册'}
            </button>
          </form>

          {/* 底部切换提示 */}
          <p className="mt-8 text-center text-sm text-gray-500">
            {activeTab === 'login' ? '还没有账号？' : '已有账号？'}
            <button
              type="button"
              onClick={() => switchTab(activeTab === 'login' ? 'register' : 'login')}
              className="text-primary-600 hover:text-primary-700 font-medium ml-1 transition-colors"
            >
              {activeTab === 'login' ? '立即注册' : '去登录'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
