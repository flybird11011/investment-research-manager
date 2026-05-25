import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { findAll, create, remove } from '../db/jsonDb';
import { generateReportSummary } from '../services/ai';
import { parsePDF, cleanPDFText, extractReportInfo } from '../services/pdfParser';

const router = Router();

// 配置 multer 存储
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/reports');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('只支持 PDF 文件'));
    }
  },
});

// 获取研报列表
router.get('/', async (req, res) => {
  try {
    const { stock, page = '1', limit = '20' } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    let results = findAll<any>('reports');

    if (stock) {
      results = results.filter((item: any) => item.stockCode === stock);
    }

    // 排序
    results.sort((a: any, b: any) => 
      new Date(b.publishedAt || b.createdAt).getTime() - new Date(a.publishedAt || a.createdAt).getTime()
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
    console.error('获取研报列表失败:', error);
    res.status(500).json({ error: '获取研报列表失败' });
  }
});

// 获取单条研报详情
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const results = findAll<any>('reports');
    const item = results.find((r: any) => r.id === parseInt(id));

    if (!item) {
      return res.status(404).json({ error: '研报不存在' });
    }

    res.json(item);
  } catch (error) {
    console.error('获取研报详情失败:', error);
    res.status(500).json({ error: '获取研报详情失败' });
  }
});

// 上传研报并生成 AI 摘要
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传文件' });
    }

    const filePath = req.file.path;
    const originalName = req.file.originalname;

    console.log(`📄 正在解析研报: ${originalName}`);

    // 解析 PDF
    const { text, info } = await parsePDF(filePath);
    const cleanedText = cleanPDFText(text);

    // 提取研报基本信息
    const reportInfo = extractReportInfo(cleanedText);

    console.log('📊 研报信息:', reportInfo);

    // 生成 AI 摘要
    let aiSummary = null;
    try {
      console.log('🤖 正在生成 AI 摘要...');
      aiSummary = await generateReportSummary(cleanedText);
      console.log('✅ AI 摘要生成成功');
    } catch (aiError) {
      console.error('AI 摘要生成失败:', aiError);
    }

    // 保存到数据库
    const result = create('reports', {
      title: reportInfo.title || originalName.replace('.pdf', ''),
      author: reportInfo.author || aiSummary?.author || info.author || '',
      source: '用户上传',
      stockCode: reportInfo.stockCode || '',
      stockName: reportInfo.stockName || '',
      rating: reportInfo.rating || aiSummary?.rating || '',
      targetPrice: reportInfo.targetPrice || aiSummary?.targetPrice || '',
      summary: aiSummary?.summary || cleanedText.slice(0, 500),
      sourceUrl: '',
      publishedAt: reportInfo.date ? new Date(reportInfo.date).toISOString() : new Date().toISOString(),
    });

    // 删除临时文件
    fs.unlinkSync(filePath);

    res.status(201).json({
      message: '研报上传成功',
      report: result,
      aiSummary: aiSummary ? {
        coreLogic: aiSummary.coreLogic,
        rating: aiSummary.rating,
        targetPrice: aiSummary.targetPrice,
        keyData: aiSummary.keyData,
        risks: aiSummary.risks,
        highlights: aiSummary.highlights,
      } : null,
    });
  } catch (error) {
    console.error('上传研报失败:', error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: '上传研报失败: ' + (error as Error).message });
  }
});

// 删除研报
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    remove('reports', parseInt(id));
    res.json({ message: '删除成功' });
  } catch (error) {
    console.error('删除研报失败:', error);
    res.status(500).json({ error: '删除研报失败' });
  }
});

export { router as reportsRouter };
