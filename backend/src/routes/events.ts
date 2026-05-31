import { Router } from 'express';
import { findAll } from '../db/jsonDb';

const router = Router();

function getEventSortTime(item: any): number {
  const candidates = [item.lastUpdatedAt, item.updatedAt, item.lastPublishedAt, item.firstPublishedAt, item.publishedAt];

  for (const candidate of candidates) {
    if (!candidate) continue;
    const time = new Date(candidate).getTime();
    if (Number.isFinite(time) && time > 0) return time;
  }

  return item.id || 0;
}

// 获取聚合事件列表
router.get('/', async (req, res) => {
  try {
    const { category, stock, page = '1', limit = '20' } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    let results = findAll<any>('events');

    if (category) {
      results = results.filter((item: any) => item.category === category);
    }
    if (stock) {
      results = results.filter((item: any) =>
        item.relatedStocks && item.relatedStocks.includes(stock)
      );
    }

    // 优先按最近更新，其次按最后发布时间
    results.sort((a: any, b: any) => {
      const timeDiff = getEventSortTime(b) - getEventSortTime(a);
      if (timeDiff !== 0) return timeDiff;
      return (b.lastPublishedAt || '').localeCompare(a.lastPublishedAt || '');
    });

    const total = results.length;
    results = results.slice(offset, offset + limitNum);

    res.json({
      data: results,
      total,
      page: pageNum,
      limit: limitNum,
    });
  } catch (error) {
    console.error('获取事件列表失败:', error);
    res.status(500).json({ error: '获取事件列表失败' });
  }
});

// 获取单个事件详情
router.get('/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;
    const results = findAll<any>('events');
    const item = results.find((e: any) => e.eventId === eventId);

    if (!item) {
      return res.status(404).json({ error: '事件不存在' });
    }

    res.json(item);
  } catch (error) {
    console.error('获取事件详情失败:', error);
    res.status(500).json({ error: '获取事件详情失败' });
  }
});

export { router as eventsRouter };
