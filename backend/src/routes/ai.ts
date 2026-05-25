import { Router } from 'express';
import { findAll, create, findWhere } from '../db/jsonDb';
import { batchAnalyzeSentiment, chatWithAI, generateDailyBriefing } from '../services/ai';

const router = Router();

// ===== 情绪分析 =====

// 对未分析的新闻批量执行情绪分析
router.post('/sentiment/analyze', async (req, res) => {
  try {
    const allNews = findAll<any>('news');
    const unanalyzed = allNews.filter((n: any) => !n.sentiment).slice(0, 20);

    if (unanalyzed.length === 0) {
      return res.json({ message: '所有新闻已完成情绪分析', analyzed: 0 });
    }

    console.log(`🤖 开始批量情绪分析，共 ${unanalyzed.length} 条新闻...`);

    const items = unanalyzed.map((n: any) => ({
      id: n.id,
      title: n.title,
      summary: n.summary || undefined,
    }));

    const results = await batchAnalyzeSentiment(items);

    // 更新数据库
    let updatedCount = 0;
    for (const [id, sentiment] of results) {
      const newsItem = allNews.find((n: any) => n.id === id);
      if (newsItem) {
        newsItem.sentiment = sentiment.sentiment;
        newsItem.sentimentScore = sentiment.score;
        updatedCount++;
      }
    }

    res.json({
      message: `情绪分析完成`,
      analyzed: updatedCount,
      total: unanalyzed.length,
    });
  } catch (error) {
    console.error('批量情绪分析失败:', error);
    res.status(500).json({ error: '情绪分析失败' });
  }
});

// 获取情绪统计
router.get('/sentiment/stats', async (req, res) => {
  try {
    const allNews = findAll<any>('news').filter((n: any) => n.sentiment);
    const stats: Record<string, { count: number; avgScore: number }> = {};
    
    for (const item of allNews) {
      if (!stats[item.sentiment]) {
        stats[item.sentiment] = { count: 0, avgScore: 0 };
      }
      stats[item.sentiment].count++;
      stats[item.sentiment].avgScore += item.sentimentScore || 50;
    }

    const result = Object.entries(stats).map(([sentiment, data]) => ({
      sentiment,
      count: data.count,
      avgScore: data.count > 0 ? Math.round(data.avgScore / data.count) : 50,
    }));

    res.json({ data: result });
  } catch (error) {
    console.error('获取情绪统计失败:', error);
    res.status(500).json({ error: '获取情绪统计失败' });
  }
});

// ===== AI 智能问答 =====

router.post('/chat', async (req, res) => {
  try {
    const { question } = req.body;

    if (!question || typeof question !== 'string') {
      return res.status(400).json({ error: '请提供问题' });
    }

    if (question.length > 500) {
      return res.status(400).json({ error: '问题不能超过500字' });
    }

    // 获取最新资讯作为上下文
    const recentNews = findAll<any>('news')
      .sort((a: any, b: any) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
      .slice(0, 20);

    const context = recentNews
      .map((n: any) => `[${n.source}] ${n.title}${n.summary ? ': ' + n.summary.slice(0, 100) : ''}`)
      .join('\n');

    const answer = await chatWithAI(question, context);

    res.json({ answer });
  } catch (error) {
    console.error('AI 问答失败:', error);
    res.status(500).json({ error: 'AI 问答失败' });
  }
});

// ===== 每日简报 =====

// 获取今日简报
router.get('/briefing', async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const result = findAll<any>('dailyBriefings').find((b: any) => b.date === today);

    if (!result) {
      return res.json({ data: null, message: '今日简报尚未生成' });
    }

    res.json({ data: result });
  } catch (error) {
    console.error('获取每日简报失败:', error);
    res.status(500).json({ error: '获取每日简报失败' });
  }
});

// 生成今日简报
router.post('/briefing/generate', async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);

    // 检查是否已生成
    const existing = findAll<any>('dailyBriefings').find((b: any) => b.date === today);
    if (existing) {
      return res.json({ data: existing, message: '今日简报已存在' });
    }

    console.log('📊 正在生成每日简报...');

    // 获取今日新闻
    const todayStart = new Date(today);
    const newsItems = findAll<any>('news')
      .filter((n: any) => new Date(n.publishedAt) >= todayStart)
      .sort((a: any, b: any) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
      .slice(0, 50);

    // 获取自选股
    const watchlistStocks = findAll<any>('watchlist');

    if (newsItems.length === 0) {
      return res.status(404).json({ error: '今日暂无资讯，无法生成简报' });
    }

    // 调用 AI 生成简报
    const briefing = await generateDailyBriefing(
      newsItems.map((n: any) => ({
        title: n.title,
        summary: n.summary || undefined,
        source: n.source,
        category: n.category || '',
        publishedAt: n.publishedAt,
      })),
      watchlistStocks.map((w: any) => ({
        stockCode: w.stockCode,
        stockName: w.stockName || w.stockCode,
      }))
    );

    // 保存到数据库
    const result = create('dailyBriefings', {
      date: today,
      marketOverview: briefing.marketOverview,
      hotTopics: briefing.hotTopics,
      watchlistAlerts: briefing.watchlistAlerts,
      riskWarnings: briefing.riskWarnings,
      outlook: briefing.outlook,
    });

    console.log('✅ 每日简报生成成功');
    res.status(201).json({ data: result });
  } catch (error) {
    console.error('生成每日简报失败:', error);
    res.status(500).json({ error: '生成每日简报失败' });
  }
});

// 获取历史简报列表
router.get('/briefing/history', async (req, res) => {
  try {
    const { limit = '7' } = req.query;
    const results = findAll<any>('dailyBriefings')
      .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, parseInt(limit as string));

    res.json({ data: results });
  } catch (error) {
    console.error('获取历史简报失败:', error);
    res.status(500).json({ error: '获取历史简报失败' });
  }
});

export { router as aiRouter };
