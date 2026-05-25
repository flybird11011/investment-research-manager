import crypto from 'crypto';

/**
 * 新闻去重工具模块
 * 提供多种去重策略：精确匹配、模糊匹配、语义相似度
 */

// 去重配置
interface DeduplicationConfig {
  // 精确匹配阈值（标题完全相等）
  exactMatch: boolean;
  // 模糊匹配阈值（0-1，建议0.85-0.95）
  similarityThreshold: number;
  // 时间窗口（小时），只检查最近N小时的新闻
  timeWindowHours: number;
  // 是否使用语义哈希
  useSemanticHash: boolean;
  // 是否使用URL去重
  useUrlMatch: boolean;
}

// 默认配置
const DEFAULT_CONFIG: DeduplicationConfig = {
  exactMatch: true,
  similarityThreshold: 0.88,
  timeWindowHours: 48,
  useSemanticHash: true,
  useUrlMatch: true,
};

/**
 * 文本预处理
 * 1. 移除标点符号
 * 2. 统一空格
 * 3. 转换为小写
 * 4. 移除停用词
 */
function preprocessText(text: string): string {
  if (!text) return '';
  
  const stopWords = new Set([
    '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好', '自己', '这', '那', '这些', '那些', '这个', '那个',
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should'
  ]);
  
  return text
    .toLowerCase()
    // 移除标点符号，保留中文和英文
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s]/g, ' ')
    // 统一空格
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(word => word.length > 0 && !stopWords.has(word))
    .join(' ');
}

/**
 * 计算SimHash（局部敏感哈希）
 * 用于快速计算文本相似度
 */
function computeSimHash(text: string): string {
  const processed = preprocessText(text);
  if (!processed) return '0'.repeat(64);
  
  const words = processed.split(' ');
  const vector = new Array(64).fill(0);
  
  words.forEach(word => {
    const hash = crypto.createHash('md5').update(word).digest('hex');
    for (let i = 0; i < 64; i++) {
      const bit = parseInt(hash[i % 32], 16) & (1 << (i % 4));
      vector[i] += bit ? 1 : -1;
    }
  });
  
  return vector.map(v => v >= 0 ? '1' : '0').join('');
}

/**
 * 计算汉明距离
 * 两个SimHash之间的不同位数
 */
function hammingDistance(hash1: string, hash2: string): number {
  let distance = 0;
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] !== hash2[i]) distance++;
  }
  return distance;
}

/**
 * 计算SimHash相似度
 * 返回0-1之间的值，1表示完全相同
 */
function simHashSimilarity(hash1: string, hash2: string): number {
  const distance = hammingDistance(hash1, hash2);
  return 1 - distance / hash1.length;
}

/**
 * 计算编辑距离（Levenshtein Distance）
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j - 1] + 1,  // 替换
          dp[i - 1][j] + 1,      // 删除
          dp[i][j - 1] + 1       // 插入
        );
      }
    }
  }
  
  return dp[m][n];
}

/**
 * 计算编辑距离相似度
 */
function editDistanceSimilarity(str1: string, str2: string): number {
  if (!str1 && !str2) return 1;
  if (!str1 || !str2) return 0;
  
  const distance = levenshteinDistance(str1, str2);
  const maxLength = Math.max(str1.length, str2.length);
  return 1 - distance / maxLength;
}

/**
 * 计算Jaccard相似度
 * 基于词集合的交集/并集
 */
function jaccardSimilarity(str1: string, str2: string): number {
  const set1 = new Set(preprocessText(str1).split(' '));
  const set2 = new Set(preprocessText(str2).split(' '));
  
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  if (union.size === 0) return 1;
  return intersection.size / union.size;
}

/**
 * 计算余弦相似度
 * 基于词频向量
 */
function cosineSimilarity(str1: string, str2: string): number {
  const words1 = preprocessText(str1).split(' ');
  const words2 = preprocessText(str2).split(' ');
  
  const freq1: { [key: string]: number } = {};
  const freq2: { [key: string]: number } = {};
  
  words1.forEach(w => freq1[w] = (freq1[w] || 0) + 1);
  words2.forEach(w => freq2[w] = (freq2[w] || 0) + 1);
  
  const allWords = new Set([...Object.keys(freq1), ...Object.keys(freq2)]);
  
  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;
  
  allWords.forEach(word => {
    const v1 = freq1[word] || 0;
    const v2 = freq2[word] || 0;
    dotProduct += v1 * v2;
    norm1 += v1 * v1;
    norm2 += v2 * v2;
  });
  
  if (norm1 === 0 || norm2 === 0) return 0;
  return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
}

/**
 * 综合相似度计算
 * 结合多种算法的加权平均
 */
function calculateSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  if (str1 === str2) return 1;
  
  // 预处理
  const processed1 = preprocessText(str1);
  const processed2 = preprocessText(str2);
  
  // 如果预处理后完全相同
  if (processed1 === processed2) return 0.98;
  
  // 计算各种相似度
  const editSim = editDistanceSimilarity(str1, str2);
  const jaccardSim = jaccardSimilarity(str1, str2);
  const cosineSim = cosineSimilarity(str1, str2);
  
  // 加权平均（可以根据实际情况调整权重）
  const weights = {
    edit: 0.3,
    jaccard: 0.4,
    cosine: 0.3
  };
  
  return editSim * weights.edit + jaccardSim * weights.jaccard + cosineSim * weights.cosine;
}

/**
 * 提取URL的关键部分用于去重
 * 移除跟踪参数、协议等
 */
function normalizeUrl(url: string): string {
  if (!url) return '';
  
  try {
    const urlObj = new URL(url);
    // 移除常见的跟踪参数
    const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'gclid'];
    trackingParams.forEach(param => urlObj.searchParams.delete(param));
    
    // 返回路径和查询参数（不含跟踪参数）
    return urlObj.pathname + urlObj.search;
  } catch {
    return url;
  }
}

/**
 * 生成新闻指纹
 * 用于快速查找相似新闻
 */
export function generateNewsFingerprint(news: {
  title: string;
  sourceUrl?: string;
  content?: string;
}): {
  exactHash: string;
  simHash: string;
  normalizedUrl: string;
  keywordFingerprint: string;
} {
  const processedTitle = preprocessText(news.title);
  
  // 精确匹配哈希
  const exactHash = crypto
    .createHash('md5')
    .update(news.title.trim())
    .digest('hex');
  
  // SimHash用于模糊匹配
  const simHash = computeSimHash(news.title + ' ' + (news.content || ''));
  
  // URL标准化
  const normalizedUrl = normalizeUrl(news.sourceUrl || '');
  
  // 关键词指纹（取前5个关键词）
  const keywords = processedTitle
    .split(' ')
    .filter(w => w.length >= 2)
    .slice(0, 5)
    .sort()
    .join('|');
  
  const keywordFingerprint = crypto
    .createHash('md5')
    .update(keywords)
    .digest('hex');
  
  return {
    exactHash,
    simHash,
    normalizedUrl,
    keywordFingerprint
  };
}

/**
 * 检查新闻是否重复
 * @param newNews 新新闻
 * @param existingNews 现有新闻列表
 * @param config 去重配置
 * @returns 重复检测结果
 */
export function checkDuplicate(
  newNews: {
    title: string;
    sourceUrl?: string;
    content?: string;
    publishedAt?: string;
  },
  existingNews: Array<{
    id: number;
    title: string;
    sourceUrl?: string;
    content?: string;
    publishedAt?: string;
    exactHash?: string;
    simHash?: string;
    keywordFingerprint?: string;
  }>,
  config: Partial<DeduplicationConfig> = {}
): {
  isDuplicate: boolean;
  duplicateOf?: number;
  similarity: number;
  matchType: 'exact' | 'url' | 'semantic' | 'fuzzy' | 'none';
  details: string;
} {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  
  // 生成新新闻的指纹
  const newFingerprint = generateNewsFingerprint(newNews);
  
  // 过滤时间窗口内的新闻
  const cutoffTime = new Date();
  cutoffTime.setHours(cutoffTime.getHours() - finalConfig.timeWindowHours);
  
  const recentNews = existingNews.filter(n => {
    if (!n.publishedAt) return true;
    return new Date(n.publishedAt) > cutoffTime;
  });
  
  // 1. 精确匹配检查（标题完全相等）
  if (finalConfig.exactMatch) {
    const exactMatch = recentNews.find(n => 
      n.title.trim() === newNews.title.trim() ||
      n.exactHash === newFingerprint.exactHash
    );
    
    if (exactMatch) {
      return {
        isDuplicate: true,
        duplicateOf: exactMatch.id,
        similarity: 1,
        matchType: 'exact',
        details: `标题完全匹配: "${exactMatch.title}"`
      };
    }
  }
  
  // 2. URL匹配检查
  if (finalConfig.useUrlMatch && newFingerprint.normalizedUrl) {
    const urlMatch = recentNews.find(n => {
      const existingUrl = normalizeUrl(n.sourceUrl || '');
      return existingUrl && existingUrl === newFingerprint.normalizedUrl;
    });
    
    if (urlMatch) {
      return {
        isDuplicate: true,
        duplicateOf: urlMatch.id,
        similarity: 0.95,
        matchType: 'url',
        details: `URL匹配: ${newFingerprint.normalizedUrl}`
      };
    }
  }
  
  // 3. SimHash快速筛选（汉明距离小于3视为相似）
  if (finalConfig.useSemanticHash) {
    for (const news of recentNews) {
      if (news.simHash) {
        const simHashSim = simHashSimilarity(newFingerprint.simHash, news.simHash);
        if (simHashSim >= finalConfig.similarityThreshold) {
          return {
            isDuplicate: true,
            duplicateOf: news.id,
            similarity: simHashSim,
            matchType: 'semantic',
            details: `SimHash相似度: ${(simHashSim * 100).toFixed(2)}%`
          };
        }
      }
    }
  }
  
  // 4. 关键词指纹匹配（快速预筛选）
  const keywordMatch = recentNews.find(n => 
    n.keywordFingerprint === newFingerprint.keywordFingerprint
  );
  
  if (keywordMatch) {
    // 关键词相同，进一步计算详细相似度
    const similarity = calculateSimilarity(newNews.title, keywordMatch.title);
    if (similarity >= finalConfig.similarityThreshold) {
      return {
        isDuplicate: true,
        duplicateOf: keywordMatch.id,
        similarity,
        matchType: 'fuzzy',
        details: `关键词匹配，综合相似度: ${(similarity * 100).toFixed(2)}%`
      };
    }
  }
  
  // 5. 详细相似度计算（对候选新闻进行精确计算）
  let bestMatch: { news: typeof recentNews[0]; similarity: number } | null = null;
  
  for (const news of recentNews) {
    const similarity = calculateSimilarity(newNews.title, news.title);
    
    if (similarity >= finalConfig.similarityThreshold) {
      if (!bestMatch || similarity > bestMatch.similarity) {
        bestMatch = { news, similarity };
      }
    }
  }
  
  if (bestMatch) {
    return {
      isDuplicate: true,
      duplicateOf: bestMatch.news.id,
      similarity: bestMatch.similarity,
      matchType: 'fuzzy',
      details: `模糊匹配相似度: ${(bestMatch.similarity * 100).toFixed(2)}%`
    };
  }
  
  // 未找到重复
  return {
    isDuplicate: false,
    similarity: 0,
    matchType: 'none',
    details: '未找到重复新闻'
  };
}

/**
 * 批量去重
 * 对一批新闻进行去重，返回不重复的新闻列表
 */
export function batchDeduplicate(
  newsList: Array<{
    title: string;
    sourceUrl?: string;
    content?: string;
    publishedAt?: string;
    [key: string]: any;
  }>,
  existingNews: Array<any>,
  config?: Partial<DeduplicationConfig>
): {
  unique: typeof newsList;
  duplicates: Array<{ news: typeof newsList[0]; reason: string }>;
} {
  const unique: typeof newsList = [];
  const duplicates: Array<{ news: typeof newsList[0]; reason: string }> = [];
  
  // 用于检测这批新闻内部的重复
  const processedFingerprints: string[] = [];
  
  for (const news of newsList) {
    // 1. 检查与现有新闻的重复
    const existingCheck = checkDuplicate(news, existingNews, config);
    
    if (existingCheck.isDuplicate) {
      duplicates.push({
        news,
        reason: `与现有新闻重复(ID:${existingCheck.duplicateOf}): ${existingCheck.details}`
      });
      continue;
    }
    
    // 2. 检查与这批新闻内部的重复
    const fingerprint = generateNewsFingerprint(news);
    const internalDuplicate = processedFingerprints.some(fp => 
      simHashSimilarity(fp, fingerprint.simHash) >= (config?.similarityThreshold || 0.88)
    );
    
    if (internalDuplicate) {
      duplicates.push({
        news,
        reason: '与同一批次新闻重复'
      });
      continue;
    }
    
    // 通过所有检查，添加到唯一列表
    unique.push(news);
    processedFingerprints.push(fingerprint.simHash);
  }
  
  return { unique, duplicates };
}

/**
 * 获取去重统计信息
 */
export function getDeduplicationStats(
  duplicates: Array<{ news: any; reason: string }>
): {
  total: number;
  byType: { [key: string]: number };
} {
  const byType: { [key: string]: number } = {};
  
  duplicates.forEach(d => {
    const type = d.reason.includes('精确') ? 'exact' :
                 d.reason.includes('URL') ? 'url' :
                 d.reason.includes('同一批次') ? 'internal' : 'fuzzy';
    byType[type] = (byType[type] || 0) + 1;
  });
  
  return {
    total: duplicates.length,
    byType
  };
}

// 导出calculateSimilarity函数供外部使用
export { calculateSimilarity };

export default {
  checkDuplicate,
  batchDeduplicate,
  generateNewsFingerprint,
  calculateSimilarity,
  getDeduplicationStats
};
