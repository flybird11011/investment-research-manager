import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { newsRouter } from './routes/news';
import { watchlistRouter } from './routes/watchlist';
import { sourcesRouter } from './routes/sources';
import { eventsRouter } from './routes/events';
import { reportsRouter } from './routes/reports';
import { aiRouter } from './routes/ai';
import { authRouter } from './routes/auth';
import { 
  startCrawler, 
  triggerCrawl, 
  forceCrawl, 
  updateSource,
  getIncrementalStats,
  resetSourceStatus,
  setUpdateInterval,
  getNextSourcesToUpdate
} from './services/crawler';
import { checkDuplicate, calculateSimilarity } from './utils/deduplication';
import { findAll } from './db/jsonDb';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件
app.use(cors());
app.use(express.json());

// 路由
app.use('/api/news', newsRouter);
app.use('/api/watchlist', watchlistRouter);
app.use('/api/sources', sourcesRouter);
app.use('/api/events', eventsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/ai', aiRouter);
app.use('/api/auth', authRouter);

// 手动触发爬虫（增量模式）
app.post('/api/crawler/trigger', async (req, res) => {
  try {
    await triggerCrawl();
    res.json({ success: true, message: '爬虫任务已触发（增量模式）' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 强制更新（忽略时间间隔）
app.post('/api/crawler/force', async (req, res) => {
  try {
    const { sourceName } = req.body;
    await forceCrawl(sourceName);
    res.json({ 
      success: true, 
      message: sourceName 
        ? `强制更新新闻源: ${sourceName}` 
        : '强制更新所有新闻源' 
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 更新特定新闻源
app.post('/api/crawler/update-source', async (req, res) => {
  try {
    const { sourceName } = req.body;
    
    if (!sourceName) {
      return res.status(400).json({ error: '请提供sourceName参数' });
    }
    
    await updateSource(sourceName);
    res.json({ 
      success: true, 
      message: `更新新闻源: ${sourceName}` 
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取增量更新统计
app.get('/api/crawler/stats', async (req, res) => {
  try {
    const stats = getIncrementalStats();
    res.json({
      success: true,
      stats
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取下一个要更新的新闻源
app.get('/api/crawler/next-updates', async (req, res) => {
  try {
    const nextSources = getNextSourcesToUpdate();
    res.json({
      success: true,
      count: nextSources.length,
      sources: nextSources
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 设置新闻源更新间隔
app.post('/api/crawler/set-interval', async (req, res) => {
  try {
    const { sourceName, intervalMinutes } = req.body;
    
    if (!sourceName || !intervalMinutes) {
      return res.status(400).json({ 
        error: '请提供sourceName和intervalMinutes参数' 
      });
    }
    
    setUpdateInterval(sourceName, intervalMinutes);
    
    res.json({
      success: true,
      message: `已将 ${sourceName} 的更新间隔设置为 ${intervalMinutes} 分钟`
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 重置新闻源状态
app.post('/api/crawler/reset-source', async (req, res) => {
  try {
    const { sourceName } = req.body;
    
    if (!sourceName) {
      return res.status(400).json({ error: '请提供sourceName参数' });
    }
    
    resetSourceStatus(sourceName);
    
    res.json({
      success: true,
      message: `已重置新闻源状态: ${sourceName}`
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 测试去重功能
app.post('/api/test/deduplication', async (req, res) => {
  try {
    const { title, sourceUrl, content } = req.body;
    
    if (!title) {
      return res.status(400).json({ error: '请提供title参数' });
    }
    
    const existingNews = findAll<any>('news');
    
    const result = checkDuplicate(
      { title, sourceUrl, content },
      existingNews,
      {
        exactMatch: true,
        similarityThreshold: 0.88,
        timeWindowHours: 48,
        useSemanticHash: true,
        useUrlMatch: true
      }
    );
    
    res.json({
      success: true,
      testNews: { title, sourceUrl },
      result
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 计算两个标题的相似度
app.post('/api/test/similarity', async (req, res) => {
  try {
    const { title1, title2 } = req.body;
    
    if (!title1 || !title2) {
      return res.status(400).json({ error: '请提供title1和title2参数' });
    }
    
    const similarity = calculateSimilarity(title1, title2);
    
    res.json({
      success: true,
      title1,
      title2,
      similarity,
      similarityPercentage: `${(similarity * 100).toFixed(2)}%`,
      isDuplicate: similarity >= 0.88
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 启动爬虫服务
startCrawler();

app.listen(PORT, () => {
  console.log(`🚀 服务器运行在端口 ${PORT}`);
  console.log(`📊 投研综合资讯管理后端服务已启动`);
});
