import { Router } from 'express';
import { findAll, findWhere, create } from '../db/jsonDb';

const router = Router();

// 获取资讯列表
router.get('/', async (req, res) => {
  try {
    const { category, source, stock, page = '1', limit = '20' } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    let results = findAll<any>('news');

    // 筛选
    if (category) {
      results = results.filter((item: any) => item.category === category);
    }
    if (source) {
      results = results.filter((item: any) => item.source === source);
    }
    if (stock) {
      results = results.filter((item: any) => 
        item.relatedStocks && item.relatedStocks.includes(stock)
      );
    }

    // 排序（按发布时间倒序）
    results.sort((a: any, b: any) => 
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );

    // 分页
    const total = results.length;
    results = results.slice(offset, offset + limitNum);

    res.json({
      data: results,
      total,
      page: pageNum,
      limit: limitNum,
    });
  } catch (error) {
    console.error('获取资讯列表失败:', error);
    res.status(500).json({ error: '获取资讯列表失败' });
  }
});

// 搜索资讯 - 必须放在 /:id 之前，否则会被 /:id 匹配
router.get('/search', async (req, res) => {
  try {
    const { q, page = '1', limit = '20' } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    if (!q) {
      return res.status(400).json({ error: '请提供搜索关键词' });
    }

    const keyword = (q as string).toLowerCase();
    let results = findAll<any>('news').filter((item: any) => 
      item.title.toLowerCase().includes(keyword) || 
      (item.summary && item.summary.toLowerCase().includes(keyword))
    );

    // 排序
    results.sort((a: any, b: any) => 
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );

    const total = results.length;
    results = results.slice(offset, offset + limitNum);

    res.json({
      data: results,
      total,
      page: pageNum,
      limit: limitNum,
    });
  } catch (error) {
    console.error('搜索资讯失败:', error);
    res.status(500).json({ error: '搜索资讯失败' });
  }
});

// 获取单条资讯详情
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const results = findAll<any>('news');
    const item = results.find((n: any) => n.id === parseInt(id));
    
    if (!item) {
      return res.status(404).json({ error: '资讯不存在' });
    }

    res.json(item);
  } catch (error) {
    console.error('获取资讯详情失败:', error);
    res.status(500).json({ error: '获取资讯详情失败' });
  }
});

export { router as newsRouter };
