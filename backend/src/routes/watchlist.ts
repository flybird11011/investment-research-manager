import { Router } from 'express';
import { findAll, create, remove } from '../db/jsonDb';

const router = Router();

// 获取自选股列表
router.get('/', async (req, res) => {
  try {
    const results = findAll<any>('watchlist');
    // 按创建时间倒序
    results.sort((a: any, b: any) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    res.json({ data: results });
  } catch (error) {
    console.error('获取自选股列表失败:', error);
    res.status(500).json({ error: '获取自选股列表失败' });
  }
});

// 添加自选股
router.post('/', async (req, res) => {
  try {
    const { stockCode, stockName } = req.body;

    if (!stockCode) {
      return res.status(400).json({ error: '请提供股票代码' });
    }

    // 检查是否已存在
    const existing = findAll<any>('watchlist').find(
      (item: any) => item.stockCode === stockCode
    );

    if (existing) {
      return res.status(409).json({ error: '该股票已在自选列表中' });
    }

    const result = create('watchlist', {
      stockCode,
      stockName: stockName || stockCode,
    });

    res.status(201).json(result);
  } catch (error) {
    console.error('添加自选股失败:', error);
    res.status(500).json({ error: '添加自选股失败' });
  }
});

// 删除自选股
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    remove('watchlist', parseInt(id));
    res.json({ message: '删除成功' });
  } catch (error) {
    console.error('删除自选股失败:', error);
    res.status(500).json({ error: '删除自选股失败' });
  }
});

export { router as watchlistRouter };
