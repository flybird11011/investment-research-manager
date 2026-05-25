import { Router } from 'express';
import { findAll, create, update, remove } from '../db/jsonDb';

const router = Router();

// 获取新闻源列表
router.get('/', async (req, res) => {
  try {
    const results = findAll<any>('newsSources');
    results.sort((a: any, b: any) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    res.json({ data: results });
  } catch (error) {
    console.error('获取新闻源列表失败:', error);
    res.status(500).json({ error: '获取新闻源列表失败' });
  }
});

// 添加新闻源
router.post('/', async (req, res) => {
  try {
    const { name, url, type = 'rss' } = req.body;

    if (!name || !url) {
      return res.status(400).json({ error: '请提供名称和URL' });
    }

    const result = create('newsSources', {
      name,
      url,
      type,
      isEnabled: true,
      isDefault: false,
    });

    res.status(201).json(result);
  } catch (error) {
    console.error('添加新闻源失败:', error);
    res.status(500).json({ error: '添加新闻源失败' });
  }
});

// 更新新闻源
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, url, isEnabled } = req.body;

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (url !== undefined) updateData.url = url;
    if (isEnabled !== undefined) updateData.isEnabled = isEnabled;

    const result = update('newsSources', parseInt(id), updateData);

    if (!result) {
      return res.status(404).json({ error: '新闻源不存在' });
    }

    res.json(result);
  } catch (error) {
    console.error('更新新闻源失败:', error);
    res.status(500).json({ error: '更新新闻源失败' });
  }
});

// 删除新闻源
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 检查是否是默认源
    const source = findAll<any>('newsSources').find(
      (item: any) => item.id === parseInt(id)
    );

    if (!source) {
      return res.status(404).json({ error: '新闻源不存在' });
    }

    if (source.isDefault) {
      return res.status(403).json({ error: '不能删除默认新闻源' });
    }

    remove('newsSources', parseInt(id));
    res.json({ message: '删除成功' });
  } catch (error) {
    console.error('删除新闻源失败:', error);
    res.status(500).json({ error: '删除新闻源失败' });
  }
});

// 恢复默认新闻源
router.post('/reset', async (req, res) => {
  try {
    // 删除所有非默认源
    const sources = findAll<any>('newsSources');
    sources.forEach((source: any) => {
      if (!source.isDefault) {
        remove('newsSources', source.id);
      }
    });

    // 重置默认源为启用状态
    sources.forEach((source: any) => {
      if (source.isDefault) {
        update('newsSources', source.id, { isEnabled: true } as any);
      }
    });

    res.json({ message: '已恢复默认设置' });
  } catch (error) {
    console.error('恢复默认新闻源失败:', error);
    res.status(500).json({ error: '恢复默认新闻源失败' });
  }
});

export { router as sourcesRouter };
