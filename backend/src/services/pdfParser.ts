import pdf from 'pdf-parse';
import fs from 'fs';

// 解析 PDF 文件
export async function parsePDF(filePath: string): Promise<{
  text: string;
  info: {
    pages: number;
    title?: string;
    author?: string;
  };
}> {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdf(dataBuffer);

    return {
      text: data.text,
      info: {
        pages: data.numpages,
        title: data.info?.Title,
        author: data.info?.Author,
      },
    };
  } catch (error) {
    console.error('PDF 解析失败:', error);
    throw new Error('PDF 解析失败');
  }
}

// 清理 PDF 文本
export function cleanPDFText(text: string): string {
  return text
    // 移除多余的空白字符
    .replace(/\s+/g, ' ')
    // 移除页眉页脚常见的数字
    .replace(/\d+\s*\/\s*\d+/g, '')
    // 移除单独的页码
    .replace(/^\s*\d+\s*$/gm, '')
    // 移除常见的研报页眉关键词
    .replace(/(免责声明|风险提示|分析师声明|投资评级说明)[\s\S]*$/i, '')
    // 移除多余的空行
    .replace(/\n\s*\n/g, '\n')
    .trim();
}

// 提取研报关键信息
export function extractReportInfo(text: string): {
  title?: string;
  stockCode?: string;
  stockName?: string;
  rating?: string;
  targetPrice?: string;
  author?: string;
  date?: string;
} {
  const info: any = {};

  // 提取标题（通常在开头）
  const titleMatch = text.match(/^([^\n]{10,100})/);
  if (titleMatch) {
    info.title = titleMatch[1].trim();
  }

  // 提取股票代码（6位数字）
  const stockCodeMatch = text.match(/(\d{6})/);
  if (stockCodeMatch) {
    info.stockCode = stockCodeMatch[1];
  }

  // 提取股票名称（通常在代码附近）
  const stockNameMatch = text.match(/(\d{6})[\s\)]*([^\s]{2,10})/);
  if (stockNameMatch) {
    info.stockName = stockNameMatch[2].trim();
  }

  // 提取投资评级
  const ratingPatterns = [
    /投资评级[：:]\s*(买入|增持|中性|减持|卖出)/i,
    /评级[：:]\s*(买入|增持|中性|减持|卖出)/i,
    /(买入|增持|中性|减持|卖出)\s*评级/i,
  ];
  for (const pattern of ratingPatterns) {
    const match = text.match(pattern);
    if (match) {
      info.rating = match[1];
      break;
    }
  }

  // 提取目标价
  const targetPricePatterns = [
    /目标价[：:]\s*([\d.]+)/i,
    /目标价格[：:]\s*([\d.]+)/i,
    /目标价位[：:]\s*([\d.]+)/i,
  ];
  for (const pattern of targetPricePatterns) {
    const match = text.match(pattern);
    if (match) {
      info.targetPrice = match[1];
      break;
    }
  }

  // 提取分析师
  const authorMatch = text.match(/分析师[：:]\s*([^\n]{2,20})/i);
  if (authorMatch) {
    info.author = authorMatch[1].trim();
  }

  // 提取日期
  const dateMatch = text.match(/(\d{4}[年/-]\d{1,2}[月/-]\d{1,2})/);
  if (dateMatch) {
    info.date = dateMatch[1];
  }

  return info;
}
