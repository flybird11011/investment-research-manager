# 投研综合资讯管理软件

一个专为个人投资者设计的轻量级实时资讯聚合平台，帮助您最快速度获取最新财经资讯。

## 功能特性

- **实时资讯聚合** - 自动抓取多源财经新闻，按时间倒序展示
- **智能事件聚合** - 相同事件自动归类，避免重复阅读
- **自选股管理** - 添加关注的股票，自动高亮相关资讯
- **快讯模式** - 极简视图，快速浏览最新资讯
- **自定义新闻源** - 支持添加 RSS 源，个性化资讯来源
- **语音播报** - 基于 `edge-tts` 的新闻朗读，不需要额外的 TTS 付费 Key
- **研报中心** - 整合研究报告，支持 AI 智能摘要
  - 上传 PDF 自动解析
  - AI 提取核心投资逻辑
  - 自动识别投资评级和目标价
  - 提取关键数据和风险提示

## 技术栈

### 后端
- Node.js + Express
- TypeScript
- PostgreSQL (Drizzle ORM)
- Redis (缓存)
- Cheerio (网页抓取)
- RSS Parser
- OpenAI API (AI 摘要)
- PDF Parse (PDF 解析)
- Multer (文件上传)

### 前端
- React 18
- TypeScript
- Tailwind CSS
- React Router
- Axios

## 快速开始

### 环境要求
- Node.js 18+
- PostgreSQL 14+
- Redis 6+

### 安装步骤

1. 克隆项目
```bash
cd investment-research-manager
```

2. 安装后端依赖
```bash
cd backend
npm install
```

3. 配置环境变量
```bash
cp .env.example .env
# 编辑 .env 文件，配置以下信息：
# - 数据库连接 (DATABASE_URL)
# - Redis 连接 (REDIS_URL)
# - OpenAI API 密钥 (OPENAI_API_KEY) - 用于 AI 研报摘要
# - 语音播报使用 Docker 内置的 edge-tts，无需额外 TTS Key
```

4. 初始化数据库
```bash
npm run db:generate
npm run db:migrate
```

5. 启动后端服务
```bash
npm run dev
```

6. 安装前端依赖
```bash
cd ../frontend
npm install
```

7. 启动前端开发服务器
```bash
npm run dev
```

8. 访问应用
打开浏览器访问 http://localhost:3000

## 项目结构

```
investment-research-manager/
├── backend/                 # 后端服务
│   ├── src/
│   │   ├── db/             # 数据库配置和模型
│   │   ├── routes/         # API 路由
│   │   ├── services/       # 业务逻辑（爬虫等）
│   │   └── index.ts        # 入口文件
│   ├── package.json
│   └── tsconfig.json
├── frontend/               # 前端应用
│   ├── src/
│   │   ├── components/     # 组件
│   │   ├── pages/          # 页面
│   │   ├── lib/            # 工具函数和 API
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
└── README.md
```

## API 接口

### 资讯
- `GET /api/news` - 获取资讯列表
- `GET /api/news/:id` - 获取资讯详情
- `GET /api/news/search?q=关键词` - 搜索资讯

### 自选股
- `GET /api/watchlist` - 获取自选股列表
- `POST /api/watchlist` - 添加自选股
- `DELETE /api/watchlist/:id` - 删除自选股

### 新闻源
- `GET /api/sources` - 获取新闻源列表
- `POST /api/sources` - 添加新闻源
- `PUT /api/sources/:id` - 更新新闻源
- `DELETE /api/sources/:id` - 删除新闻源
- `POST /api/sources/reset` - 恢复默认设置

### 聚合事件
- `GET /api/events` - 获取聚合事件列表

### 研报
- `GET /api/reports` - 获取研报列表
- `GET /api/reports/:id` - 获取研报详情
- `POST /api/reports/upload` - 上传研报 PDF（自动生成 AI 摘要）
- `DELETE /api/reports/:id` - 删除研报

## 数据源

- 财联社
- 华尔街见闻
- 东方财富
- 雪球
- 用户自定义 RSS 源

## 开发计划

- [x] 基础架构搭建
- [x] 后端 API 开发
- [x] 新闻爬虫服务
- [x] 前端界面开发
- [x] 自选股功能
- [x] 快讯模式
- [x] 自定义新闻源
- [x] 研报摘要 AI 功能
- [ ] 用户系统
- [ ] 移动端适配

## AI 研报摘要功能

### 功能介绍
系统集成了 OpenAI GPT 模型，可以自动分析上传的研报 PDF，提取以下关键信息：

- **核心投资逻辑** - 2-3句话概括研报的核心观点
- **投资评级** - 买入/增持/中性/减持
- **目标价** - 研报给出的目标价格
- **关键数据** - 重要的财务数据、增长率、市盈率等
- **投资亮点** - 3-5个关键亮点
- **风险提示** - 研报中提到的主要风险因素

### 使用方法

1. 在「研报中心」页面点击「上传研报」按钮
2. 选择本地的研报 PDF 文件（支持最大 50MB）
3. 系统自动解析 PDF 内容并生成 AI 摘要
4. 查看结构化摘要，快速掌握研报要点

### 配置要求

需要在 `.env` 文件中配置 OpenAI API 密钥：
```
OPENAI_API_KEY=your_openai_api_key_here
```

### 注意事项

- 首次上传可能需要较长时间（30-60秒），因为需要解析 PDF 和调用 AI API
- 支持中文和英文研报
- AI 摘要仅供参考，投资需谨慎

## 许可证

MIT
