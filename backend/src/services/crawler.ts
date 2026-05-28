import axios from 'axios';
import * as cheerio from 'cheerio';
import Parser from 'rss-parser';
import cron from 'node-cron';
import iconv from 'iconv-lite';
import { findAll, create, update, clear } from '../db/jsonDb';
import crypto from 'crypto';
import { 
  checkDuplicate, 
  batchDeduplicate, 
  generateNewsFingerprint,
  getDeduplicationStats 
} from '../utils/deduplication';
import {
  getSourceStatus,
  recordFetchSuccess,
  recordFetchError,
  shouldUpdate,
  getIncrementalStats,
  getNextSourcesToUpdate,
  resetSourceStatus,
  setUpdateInterval,
} from '../utils/incrementalUpdate';

// 创建自定义RSS解析器 - 支持GBK编码
const rssParser = new Parser({
  customFields: {
    item: [
      ['content:encoded', 'contentEncoded'],
      ['description', 'description'],
    ],
  },
});

export function parseChinaLocalDateTime(value: string): string | null {
  const match = value.trim().match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/
  );
  if (!match) return null;

  const [, year, month, day, hour, minute, second = '0'] = match;
  const parts = {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
    second: Number(second),
  };

  const chinaLocalTimestamp = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );
  const chinaLocalDate = new Date(chinaLocalTimestamp);

  if (
    chinaLocalDate.getUTCFullYear() !== parts.year ||
    chinaLocalDate.getUTCMonth() !== parts.month - 1 ||
    chinaLocalDate.getUTCDate() !== parts.day ||
    chinaLocalDate.getUTCHours() !== parts.hour ||
    chinaLocalDate.getUTCMinutes() !== parts.minute ||
    chinaLocalDate.getUTCSeconds() !== parts.second
  ) {
    return null;
  }

  return new Date(chinaLocalTimestamp - 8 * 60 * 60 * 1000).toISOString();
}

// 支持的RSS源配置 - 包含编码信息
const DEFAULT_SOURCES = [
  {
    name: '新浪财经-国际财经',
    url: 'http://rss.sina.com.cn/finance/gjcj.xml',
    type: 'rss',
    category: 'macro',
    encoding: 'utf-8',
  },
  {
    name: '新浪财经-国内财经',
    url: 'http://rss.sina.com.cn/finance/gncj.xml',
    type: 'rss',
    category: 'macro',
    encoding: 'utf-8',
  },
  {
    name: '新浪财经-滚动新闻',
    url: 'http://rss.sina.com.cn/finance/roll/newindex.xml',
    type: 'rss',
    category: 'macro',
    encoding: 'utf-8',
  },
  {
    name: '新浪财经-7x24快讯',
    url: 'https://finance.sina.com.cn/7x24/',
    type: 'sina7x24',
    category: 'macro',
    encoding: 'utf-8',
  },
  {
    name: '云财经-7x24内参快讯',
    url: 'https://www.yuncaijing.com/insider/simple.html',
    type: 'yuncaijing',
    category: 'stock',
    encoding: 'utf-8',
  },
  {
    name: '股掌柜-7x24聚合消息',
    url: 'https://724.guzhang.com/',
    type: 'guzhang',
    category: 'stock',
    encoding: 'utf-8',
  },
  {
    name: '财联社-电报快讯',
    url: 'https://www.cls.cn/telegraph',
    type: 'cls',
    category: 'stock',
    encoding: 'utf-8',
  },
  {
    name: '华尔街见闻-7x24全球快讯',
    url: 'https://wallstreetcn.com/live/global',
    type: 'wallstreetcn',
    category: 'macro',
    encoding: 'utf-8',
  },
];

// 初始化默认新闻源（同时修复已有源的编码配置）
export async function initDefaultSources() {
  try {
    const existingSources = findAll<any>('newsSources');
    
    if (existingSources.length === 0) {
      // 首次启动：创建所有默认源
      for (const source of DEFAULT_SOURCES) {
        create('newsSources', {
          name: source.name,
          url: source.url,
          type: source.type,
          category: source.category,
          encoding: source.encoding || 'utf-8',
          isEnabled: true,
          isDefault: true,
        });
      }
      console.log('✅ 默认新闻源已初始化');
    } else {
      // 非首次启动：补充缺失的默认源 + 更新编码配置
      let updated = 0;
      let added = 0;
      for (const defaultSource of DEFAULT_SOURCES) {
        const existing = existingSources.find(
          (s: any) => s.name === defaultSource.name
        );
        if (!existing) {
          // 补充缺失的默认源
          create('newsSources', {
            name: defaultSource.name,
            url: defaultSource.url,
            type: defaultSource.type,
            category: defaultSource.category,
            encoding: defaultSource.encoding || 'utf-8',
            isEnabled: true,
            isDefault: true,
          });
          added++;
        } else if (existing.encoding !== defaultSource.encoding) {
          // 更新编码配置
          const { update } = require('../db/jsonDb');
          update('newsSources', existing.id, { encoding: defaultSource.encoding } as any);
          updated++;
        }
      }
      if (added > 0) console.log(`✅ 已补充 ${added} 个默认新闻源`);
      if (updated > 0) console.log(`✅ 已更新 ${updated} 个默认新闻源的编码配置`);
    }
  } catch (error) {
    console.error('初始化默认新闻源失败:', error);
  }
}

// ============ 编码转换工具 ============
function convertEncoding(buffer: Buffer, encoding: string): string {
  try {
    if (encoding === 'gbk' || encoding === 'gb2312') {
      return iconv.decode(buffer, 'gbk');
    } else if (encoding === 'gb18030') {
      return iconv.decode(buffer, 'gb18030');
    }
    return buffer.toString('utf-8');
  } catch (error) {
    console.error('编码转换失败，尝试其他方法:', error);
    // 尝试自动检测编码
    return buffer.toString('utf-8');
  }
}

// 清理HTML实体和标签
function cleanHTML(html: string): string {
  if (!html) return '';
  
  return html
    // 移除HTML标签
    .replace(/<[^>]*>/g, '')
    // 解码HTML实体
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)))
    // 清理多余空白
    .replace(/\s+/g, ' ')
    .trim();
}

// ============ RSS 源抓取（支持编码转换）============
async function fetchFromRSS(source: any) {
  try {
    console.log(`📡 [${source.name}] 正在解析RSS (${source.encoding || 'utf-8'}编码)...`);
    
    // 对于GBK编码的网站，使用axios获取buffer并手动转换
    if (source.encoding && source.encoding !== 'utf-8') {
      const response = await axios.get(source.url, {
        responseType: 'arraybuffer',
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });
      
      // 转换编码
      let xmlString = convertEncoding(Buffer.from(response.data), source.encoding);
      
      // 移除XML声明中的encoding属性，防止rss-parser重复解码
      xmlString = xmlString.replace(/<\?xml[^>]*encoding=["'][^"']*["'][^>]*\?>/g, '<?xml version="1.0" encoding="UTF-8"?>');
      
      // 解析XML
      const feed = await rssParser.parseString(xmlString);
      return processRSSItems(feed.items, source);
    } else {
      // UTF-8编码直接解析
      const feed = await rssParser.parseURL(source.url);
      return processRSSItems(feed.items, source);
    }
  } catch (error: any) {
    console.error(`❌ [${source.name}] RSS抓取失败:`, error.message);
    return [];
  }
}

// 处理RSS条目
function processRSSItems(items: any[], source: any) {
  const results = [];
  
  for (const item of items.slice(0, 30)) {
    if (!item.title) continue;

    // 清理标题
    const title = cleanHTML(item.title).trim();
    if (!title || title.length < 5) continue;

    // 检查是否已存在（去重）
    const existing = findAll<any>('news').find(
      (n: any) => n.title === title && n.source === source.name
    );
    if (existing) continue;

    // 获取内容摘要 - 优先使用contentSnippet，然后是description，最后是contentEncoded
    const rawSummary = item.contentSnippet || 
                      item.description || 
                      item.contentEncoded ||
                      item.content || 
                      '';
    
    // 清理HTML
    const summary = cleanHTML(rawSummary).substring(0, 300);
    const content = cleanHTML(rawSummary).substring(0, 2000);

    const newsItem = {
      title,
      summary,
      content,
      source: source.name,
      sourceUrl: item.link || item.guid || '',
      category: detectCategory(title),
      publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
    };

    results.push(newsItem);
  }

  return results;
}

// ============ 新浪财经7x24快讯抓取 ============
async function fetchFromSina7x24(source: any) {
  try {
    console.log(`📡 [${source.name}] 正在抓取新浪7x24快讯...`);
    
    // 使用正确的API接口获取数据
    const apiUrl = 'https://app.cj.sina.com.cn/api/news/pc';
    
    const response = await axios.get(apiUrl, {
      params: {
        page: 1,
        size: 50,
        tag: 0,
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Referer': 'https://finance.sina.com.cn/7x24/',
        'X-Requested-With': 'XMLHttpRequest',
      },
      timeout: 15000,
    });

    const results = [];
    
    // 检查API响应
    if (!response.data?.result?.data?.feed?.list) {
      console.log(`   ⚠️ API返回数据格式不正确`);
      return [];
    }
    
    const newsList = response.data.result.data.feed.list;
    console.log(`   📄 API返回 ${newsList.length} 条快讯`);

    for (const item of newsList) {
      const content = item?.rich_text || item?.text || '';
      if (!content || content.length < 10) continue;

      // 获取链接
      let link = item?.docurl || '';
      if (link && !link.startsWith('http')) {
        link = 'https:' + link;
      }

      // 解析时间
      let publishedAt = new Date().toISOString();
      const createTime = item?.create_time;
      if (createTime) {
        // create_time 是北京时间字符串，例如 "2026-05-25 17:13:31"。
        // 不能直接 new Date(createTime)，否则 UTC 服务器会把它解析成未来 8 小时。
        publishedAt = parseChinaLocalDateTime(createTime) || publishedAt;
      }

      // 提取标题（取前80个字符）
      let title = content.substring(0, 80);
      if (content.length > 80) {
        title += '...';
      }

      // 清理标题中的【】标记
      title = title.replace(/^【[^】]+】/, '').trim();
      
      // 如果清理后标题太短，使用原标题
      if (title.length < 10) {
        title = content.substring(0, 80);
        if (content.length > 80) title += '...';
      }

      results.push({
        title,
        summary: content.substring(0, 200),
        content,
        source: source.name,
        sourceUrl: link || source.url,
        category: detectCategory(content),
        publishedAt,
      });
    }

    console.log(`   ✅ 成功解析 ${results.length} 条快讯`);
    return results.slice(0, 50); // 最多返回50条
  } catch (error: any) {
    console.error(`❌ [${source.name}] 新浪7x24抓取失败:`, error.message);
    if (error.response) {
      console.error(`   响应状态: ${error.response.status}`);
    }
    return [];
  }
}

// ============ 云财经7x24快讯抓取 ============
async function fetchFromYuncaijing(source: any) {
  try {
    console.log(`📡 [${source.name}] 正在抓取云财经7x24快讯...`);
    
    const apiUrl = 'https://www.yuncaijing.com/news/get_realtime_news/yapi/ajax.html';
    
    const response = await axios.post(apiUrl, {}, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Referer': 'https://www.yuncaijing.com/insider/simple.html',
        'X-Requested-With': 'XMLHttpRequest',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      },
      timeout: 15000,
    });

    const results = [];
    
    // 检查API响应
    if (response.data?.error_code !== '0' || !response.data?.data) {
      console.log(`   ⚠️ API返回数据格式不正确: ${response.data?.msg || '未知错误'}`);
      return [];
    }
    
    const newsList = response.data.data;
    console.log(`   📄 API返回 ${newsList.length} 条快讯`);

    for (const item of newsList) {
      const title = item?.title || '';
      const content = item?.description || '';
      
      if (!title || title.length < 5) continue;

      // 构建新闻链接
      const newsId = item?.id;
      const link = newsId ? `https://www.yuncaijing.com/news/id_${newsId}.html` : source.url;

      // 解析时间
      let publishedAt = new Date().toISOString();
      const inputTime = item?.inputtime;
      if (inputTime) {
        // inputtime 是Unix时间戳
        const date = new Date(parseInt(inputTime) * 1000);
        if (!isNaN(date.getTime())) {
          publishedAt = date.toISOString();
        }
      }

      // 提取主题标签
      const tags = item?.thmtags || '';
      const category = detectCategory(title + ' ' + content + ' ' + tags);

      results.push({
        title: title.substring(0, 100),
        summary: content.substring(0, 200),
        content: content,
        source: source.name,
        sourceUrl: link,
        category: category,
        publishedAt,
      });
    }

    console.log(`   ✅ 成功解析 ${results.length} 条快讯`);
    return results.slice(0, 50);
  } catch (error: any) {
    console.error(`❌ [${source.name}] 云财经抓取失败:`, error.message);
    if (error.response) {
      console.error(`   响应状态: ${error.response.status}`);
    }
    return [];
  }
}

// ============ 股掌柜7x24聚合消息抓取 ============
async function fetchFromGuzhang(source: any) {
  try {
    console.log(`📡 [${source.name}] 正在抓取股掌柜7x24聚合消息...`);
    
    const apiUrl = 'https://724.guzhang.com/index';
    
    const response = await axios.post(apiUrl, 'type=latestNews&ctime=0', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Referer': 'https://724.guzhang.com/',
        'X-Requested-With': 'XMLHttpRequest',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      },
      timeout: 15000,
    });

    const results = [];
    
    // 检查API响应
    if (response.data?.status !== 'ok' || !response.data?.data) {
      console.log(`   ⚠️ API返回数据格式不正确: ${response.data?.status || '未知错误'}`);
      return [];
    }
    
    const newsList = response.data.data;
    console.log(`   📄 API返回 ${newsList.length} 条消息`);

    for (const item of newsList) {
      const title = item?.title || '';
      const content = item?.content || '';
      
      if (!title || title.length < 5) continue;

      // 获取链接
      const link = item?.url || '';

      // 解析时间
      let publishedAt = new Date().toISOString();
      const ctime = item?.ctime;
      if (ctime) {
        // ctime 是Unix时间戳（秒）
        const date = new Date(parseInt(ctime) * 1000);
        if (!isNaN(date.getTime())) {
          publishedAt = date.toISOString();
        }
      }

      // 提取来源信息
      const comefrom = item?.comefrom || '股掌柜';
      
      // 提取股票信息
      const stocks = item?.stocks || [];
      const stockTags = stocks.map((s: any) => s.name).filter(Boolean).join(' ');
      
      // 检测分类
      const category = detectCategory(title + ' ' + content + ' ' + stockTags);

      results.push({
        title: title.substring(0, 100),
        summary: (content || title).substring(0, 200),
        content: content || title,
        source: `${source.name}(${comefrom})`,
        sourceUrl: link || source.url,
        category: category,
        publishedAt,
      });
    }

    console.log(`   ✅ 成功解析 ${results.length} 条消息`);
    return results.slice(0, 100);
  } catch (error: any) {
    console.error(`❌ [${source.name}] 股掌柜抓取失败:`, error.message);
    if (error.response) {
      console.error(`   响应状态: ${error.response.status}`);
    }
    return [];
  }
}

// ============ 财联社电报快讯抓取 ============
async function fetchFromCls(source: any) {
  try {
    console.log(`📡 [${source.name}] 正在抓取财联社电报快讯...`);

    const apiUrl = 'https://www.cls.cn/nodeapi/updateTelegraphList';
    // 用过去1小时的时间戳，获取最近1小时的快讯
    const timestamp = (Math.floor(Date.now() / 1000) - 3600).toString();

    // 构造请求参数
    const params: Record<string, string> = {
      app: 'CailianpressWeb',
      os: 'web',
      sv: '8.4.6',
      rn: '30',
      lastTime: timestamp,
      hasFirstVipArticle: '0',
      subscribedColumnIds: '',
    };

    // 生成 sign：参数按 key 排序 → URL 编码 → SHA1 → MD5
    const sortedKeys = Object.keys(params).sort();
    const queryString = sortedKeys
      .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
      .join('&');

    const sha1Hash = crypto.createHash('sha1').update(queryString).digest('hex');
    const sign = crypto.createHash('md5').update(sha1Hash).digest('hex');
    params.sign = sign;

    const response = await axios.get(apiUrl, {
      params,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Referer': 'https://www.cls.cn/telegraph',
        'X-Requested-With': 'XMLHttpRequest',
      },
      timeout: 15000,
    });

    const results: any[] = [];

    // 检查API响应
    if (!response.data || !response.data.data) {
      console.log(`   ⚠️ API返回数据格式不正确`);
      return [];
    }

    const newsList = response.data?.data?.roll_data || [];
    if (!Array.isArray(newsList) || newsList.length === 0) {
      console.log(`   ⚠️ API返回数据为空（可能没有新快讯）`);
      return [];
    }

    console.log(`   📄 API返回 ${newsList.length} 条快讯`);

    for (const item of newsList) {
      const title = item?.title || item?.brief || '';
      const content = item?.content || item?.brief || '';

      if (!title && !content) continue;

      // 使用标题或内容前80字作为标题
      const displayTitle = title || content.substring(0, 80);
      if (displayTitle.length < 5) continue;

      // 构建新闻链接
      const newsId = item?.id || item?.telegraph_id;
      const link = newsId ? `https://www.cls.cn/telegraph/${newsId}` : source.url;

      // 解析时间
      let publishedAt = new Date().toISOString();
      const ctime = item?.ctime || item?.created_at;
      if (ctime) {
        const date = new Date(parseInt(ctime) * 1000);
        if (!isNaN(date.getTime())) {
          publishedAt = date.toISOString();
        }
      }

      // 提取分类标签
      const subject = item?.subject || '';
      const category = detectCategory(displayTitle + ' ' + content + ' ' + subject);

      results.push({
        title: displayTitle.substring(0, 100),
        summary: (content || title).substring(0, 200),
        content: content || title,
        source: source.name,
        sourceUrl: link,
        category: category,
        publishedAt,
      });
    }

    console.log(`   ✅ 成功解析 ${results.length} 条快讯`);
    return results.slice(0, 50);
  } catch (error: any) {
    console.error(`❌ [${source.name}] 财联社抓取失败:`, error.message);
    if (error.response) {
      console.error(`   响应状态: ${error.response.status}`);
    }
    return [];
  }
}

// ============ 华尔街见闻7x24快讯抓取 ============
async function fetchFromWallstreetcn(source: any) {
  try {
    console.log(`📡 [${source.name}] 正在抓取华尔街见闻7x24快讯...`);

    const apiUrl = 'https://api-one-wscn.awtmt.com/apiv1/content/information-flow';

    const response = await axios.get(apiUrl, {
      params: {
        channel: 'global-live',
        limit: '30',
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Referer': 'https://wallstreetcn.com/live/global',
        'X-Requested-With': 'XMLHttpRequest',
      },
      timeout: 15000,
    });

    const results: any[] = [];

    // 检查API响应
    if (!response.data?.data?.items || !Array.isArray(response.data.data.items)) {
      console.log(`   ⚠️ API返回数据格式不正确`);
      return [];
    }

    const items = response.data.data.items;
    console.log(`   📄 API返回 ${items.length} 条数据`);

    // 只处理 resource_type === 'live' 的快讯
    for (const item of items) {
      if (item.resource_type !== 'live') continue;

      const resource = item.resource;
      if (!resource) continue;

      const title = resource.title || '';
      const contentText = resource.content_text || '';
      const content = cleanHTML(resource.content || '') || contentText;

      if (!title && !content) continue;

      // 使用标题或内容前80字作为标题
      const displayTitle = title || content.substring(0, 80);
      if (displayTitle.length < 5) continue;

      // 构建新闻链接
      const uri = resource.uri || '';
      const link = uri.startsWith('http') ? uri : `https://wallstreetcn.com${uri}`;

      // 解析时间（display_time 是 Unix 时间戳，秒）
      let publishedAt = new Date().toISOString();
      const displayTime = resource.display_time;
      if (displayTime) {
        const date = new Date(parseInt(displayTime) * 1000);
        if (!isNaN(date.getTime())) {
          publishedAt = date.toISOString();
        }
      }

      // 提取分类标签
      const category = detectCategory(displayTitle + ' ' + content);

      results.push({
        title: displayTitle.substring(0, 100),
        summary: (content || title).substring(0, 200),
        content: content || title,
        source: source.name,
        sourceUrl: link || source.url,
        category: category,
        publishedAt,
      });
    }

    console.log(`   ✅ 成功解析 ${results.length} 条快讯`);
    return results.slice(0, 30);
  } catch (error: any) {
    console.error(`❌ [${source.name}] 华尔街见闻抓取失败:`, error.message);
    if (error.response) {
      console.error(`   响应状态: ${error.response.status}`);
    }
    return [];
  }
}

// ============ 网页抓取（备选方案）============
async function fetchFromWeb(source: any) {
  try {
    console.log(`📡 [${source.name}] 正在抓取网页...`);
    
    const response = await axios.get(source.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
      timeout: 15000,
    });

    const $ = cheerio.load(response.data);
    const results: any[] = [];

    // 尝试多种选择器
    const selectors = [
      '.news-item',
      '.article-item',
      '.list-item',
      '.item',
      'article',
      '.article',
      '.news-list li',
      '.feed-list li',
    ];

    for (const selector of selectors) {
      $(selector).each((_, element) => {
        const $el = $(element);

        // 尝试获取标题
        let title = $el.find('h3, h2, .title, a').first().text().trim();
        if (!title) {
          title = $el.find('a').first().attr('title') || $el.text().trim();
        }

        if (!title || title.length < 10) return;

        // 获取链接
        const link = $el.find('a').first().attr('href') || source.url;
        const fullUrl = link.startsWith('http') ? link : new URL(link, source.url).toString();

        // 检查是否已存在
        const existing = findAll<any>('news').find((n: any) => n.title === title);
        if (existing) return;

        results.push({
          title,
          summary: '',
          content: '',
          source: source.name,
          sourceUrl: fullUrl,
          category: detectCategory(title),
          publishedAt: new Date().toISOString(),
        });
      });

      if (results.length > 0) break;
    }

    return results.slice(0, 20);
  } catch (error: any) {
    console.error(`❌ [${source.name}] 网页抓取失败:`, error.message);
    return [];
  }
}

// ============ 数据处理函数 ============

// 检测资讯分类
function detectCategory(title: string): string {
  const text = title.toLowerCase();
  const categories: { [key: string]: string[] } = {
    '股票': ['股票', '个股', '涨停', '跌停', '股价', '市值', 'A股', '沪指', '深指', '上证', '上市', 'IPO', '牛股', '大盘', '指数', '权重', '蓝筹'],
    '基金': ['基金', 'ETF', '公募', '私募', '净值', '基金经理', '定投', '收益', '份额', '募集'],
    '宏观': ['央行', '美联储', 'GDP', 'CPI', '利率', '降准', '降息', '政策', '经济', '货币', '外汇', '汇率', '财政', '债券', '美债', '欧债'],
    '行业': ['行业', '板块', '产业链', '新能源', '医药', '科技', '消费', '地产', '银行', '保险', '券商', '钢铁', '煤炭', '有色', '地产链'],
  };

  for (const [category, keywords] of Object.entries(categories)) {
    if (keywords.some(keyword => text.includes(keyword))) {
      return category;
    }
  }

  return '其他';
}

// 提取相关股票代码
function extractStocks(title: string, content: string = ''): string[] {
  const stocks: string[] = [];
  const text = title + content;
  
  // 匹配股票代码模式
  const stockPattern = /\b(\d{6})\b/g;
  const matches = text.match(stockPattern);
  
  if (matches) {
    const uniqueStocks = [...new Set(matches)];
    for (const code of uniqueStocks) {
      // 验证股票代码格式：6开头(沪市)、0/3开头(深市)
      if (code.startsWith('6') || code.startsWith('0') || code.startsWith('3')) {
        stocks.push(code);
      }
    }
  }
  
  return stocks;
}

// 生成事件ID
function generateEventId(title: string): string {
  const keywords = title
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '')
    .slice(0, 30);
  return crypto.createHash('md5').update(keywords).digest('hex').slice(0, 16);
}

// ============ 数据存储 ============

// 保存新闻到数据库（使用智能去重）
async function saveNews(newsItems: any[]) {
  let savedCount = 0;
  let duplicateCount = 0;
  
  // 获取现有新闻用于去重（只获取最近48小时的）
  const allExistingNews = findAll<any>('news');
  const cutoffTime = new Date();
  cutoffTime.setHours(cutoffTime.getHours() - 48);
  
  const recentNews = allExistingNews.filter((n: any) => {
    if (!n.publishedAt) return true;
    return new Date(n.publishedAt) > cutoffTime;
  });
  
  console.log(`   📊 去重检查: 现有${allExistingNews.length}条新闻，最近48小时${recentNews.length}条`);
  
  for (const item of newsItems) {
    try {
      // 使用新的去重算法检查
      const duplicateCheck = checkDuplicate(
        {
          title: item.title,
          sourceUrl: item.sourceUrl,
          content: item.content,
          publishedAt: item.publishedAt
        },
        recentNews,
        {
          exactMatch: true,
          similarityThreshold: 0.88,
          timeWindowHours: 48,
          useSemanticHash: true,
          useUrlMatch: true
        }
      );
      
      if (duplicateCheck.isDuplicate) {
        console.log(`   ⚠️ 跳过重复新闻: "${item.title.substring(0, 40)}..." (${duplicateCheck.matchType}, 相似度${(duplicateCheck.similarity * 100).toFixed(1)}%)`);
        duplicateCount++;
        continue;
      }
      
      // 提取相关股票
      const relatedStocks = extractStocks(item.title, item.content || '');
      
      // 生成事件ID
      const eventId = generateEventId(item.title);
      
      // 生成新闻指纹（用于后续去重）
      const fingerprint = generateNewsFingerprint({
        title: item.title,
        sourceUrl: item.sourceUrl,
        content: item.content
      });
      
      // 保存新闻（包含指纹信息）
      const savedNews = create('news', {
        ...item,
        relatedStocks,
        eventId,
        exactHash: fingerprint.exactHash,
        simHash: fingerprint.simHash,
        keywordFingerprint: fingerprint.keywordFingerprint,
        createdAt: new Date().toISOString(),
      });

      // 更新事件聚合
      await updateEvent(eventId, item, relatedStocks);
      
      // 添加到recentNews以便后续去重
      recentNews.push({
        id: savedNews.id,
        title: item.title,
        sourceUrl: item.sourceUrl,
        content: item.content,
        publishedAt: item.publishedAt,
        exactHash: fingerprint.exactHash,
        simHash: fingerprint.simHash,
        keywordFingerprint: fingerprint.keywordFingerprint
      });
      
      savedCount++;
    } catch (error) {
      console.error('保存新闻失败:', error);
    }
  }
  
  if (duplicateCount > 0) {
    console.log(`   📉 过滤重复新闻: ${duplicateCount}条`);
  }
  
  return savedCount;
}

// 更新事件聚合
async function updateEvent(eventId: string, newsItem: any, relatedStocks: string[]) {
  try {
    const existing = findAll<any>('events').find((e: any) => e.eventId === eventId);

    if (existing) {
      // 更新现有事件
      const existingStocks = existing.relatedStocks || [];
      update('events', existing.id, {
        newsCount: (existing.newsCount || 1) + 1,
        lastPublishedAt: newsItem.publishedAt,
        relatedStocks: [...new Set([...existingStocks, ...relatedStocks])],
      } as any);
    } else {
      // 创建新事件
      create('events', {
        eventId,
        title: newsItem.title.slice(0, 200),
        category: newsItem.category,
        relatedStocks,
        newsCount: 1,
        firstPublishedAt: newsItem.publishedAt,
        lastPublishedAt: newsItem.publishedAt,
        createdAt: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error('更新事件失败:', error);
  }
}

// ============ 定时任务 ============

// 执行爬虫任务（支持增量更新）
async function crawlTask(options: { force?: boolean; sourceName?: string } = {}) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🕐 [${new Date().toLocaleString()}] 开始抓取新闻...`);
  if (options.force) {
    console.log('⚡ 强制更新模式：忽略时间间隔限制');
  }
  console.log('='.repeat(60));

  let totalNews = 0;
  let successSources = 0;
  let skippedSources = 0;
  let failedSources = 0;

  try {
    // 获取启用的新闻源
    let sources = findAll<any>('newsSources').filter((s: any) => s.isEnabled);
    
    // 如果指定了特定新闻源
    if (options.sourceName) {
      sources = sources.filter((s: any) => s.name === options.sourceName);
      if (sources.length === 0) {
        console.log(`❌ 未找到新闻源: ${options.sourceName}`);
        return;
      }
    }

    for (const source of sources) {
      console.log(`\n📰 新闻源: ${source.name}`);
      console.log(`   类型: ${source.type}`);
      console.log(`   编码: ${source.encoding || 'utf-8'}`);
      console.log(`   地址: ${source.url}`);
      
      // 检查是否需要更新（增量更新逻辑）
      if (!options.force) {
        const updateCheck = shouldUpdate(source.name, source.url);
        
        if (!updateCheck.shouldUpdate) {
          console.log(`   ⏭️ 跳过: ${updateCheck.reason}`);
          skippedSources++;
          continue;
        }
        
        console.log(`   ✅ ${updateCheck.reason}`);
      }
      
      let newsItems: any[] = [];
      
      try {
        // 根据类型选择抓取方式
        switch (source.type) {
          case 'rss':
            newsItems = await fetchFromRSS(source);
            break;
          case 'web':
            // 检测是否是新浪7x24快讯
            if (source.url.includes('7x24') || source.url.includes('sina')) {
              newsItems = await fetchFromSina7x24(source);
            } else {
              newsItems = await fetchFromWeb(source);
            }
            break;
          case 'sina7x24':
            newsItems = await fetchFromSina7x24(source);
            break;
          case 'yuncaijing':
            newsItems = await fetchFromYuncaijing(source);
            break;
          case 'guzhang':
            newsItems = await fetchFromGuzhang(source);
            break;
          case 'cls':
            newsItems = await fetchFromCls(source);
            break;
          case 'wallstreetcn':
            newsItems = await fetchFromWallstreetcn(source);
            break;
          default:
            newsItems = await fetchFromRSS(source);
        }

        if (newsItems.length > 0) {
          const saved = await saveNews(newsItems);
          totalNews += saved;
          successSources++;
          
          // 记录成功状态
          recordFetchSuccess(source.name, source.url, saved);
          
          console.log(`   ✅ 成功获取 ${newsItems.length} 条新闻，保存 ${saved} 条`);
          
          // 显示前3条示例
          console.log(`   📝 示例:`);
          newsItems.slice(0, 3).forEach((item, idx) => {
            console.log(`      ${idx + 1}. ${item.title.substring(0, 60)}${item.title.length > 60 ? '...' : ''}`);
          });
        } else {
          console.log(`   ⚠️ 未获取到新新闻`);
          recordFetchSuccess(source.name, source.url, 0);
        }
      } catch (error: any) {
        console.error(`   ❌ 抓取失败: ${error.message}`);
        recordFetchError(source.name, source.url, error.message);
        failedSources++;
      }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`📊 抓取完成统计:`);
    console.log(`   - 成功: ${successSources} 个新闻源`);
    console.log(`   - 跳过: ${skippedSources} 个新闻源（未达到更新时间）`);
    console.log(`   - 失败: ${failedSources} 个新闻源`);
    console.log(`   - 新增新闻: ${totalNews} 条`);
    console.log(`   - 时间: ${new Date().toLocaleString()}`);
    console.log('='.repeat(60) + '\n');
    
  } catch (error: any) {
    console.error('❌ 爬虫任务失败:', error);
  }
}

// 启动爬虫
export function startCrawler() {
  console.log('🤖 初始化爬虫服务...');
  
  // 初始化默认源
  initDefaultSources();

  // 立即执行一次（增量更新模式）
  setTimeout(() => {
    crawlTask();
  }, 3000);

  // 设置定时任务 - 每5分钟检查一次（实际是否更新由增量逻辑决定）
  const intervalMinutes = 5;
  cron.schedule(`*/${intervalMinutes} * * * *`, () => crawlTask());

  console.log(`✅ 爬虫服务已启动，每 ${intervalMinutes} 分钟检查一次更新`);
  console.log(`   💡 提示：使用增量更新，只有到达更新时间的新闻源才会被抓取`);
}

// 手动触发一次抓取（增量模式）
export async function triggerCrawl() {
  await crawlTask();
}

// 强制更新（忽略时间间隔）
export async function forceCrawl(sourceName?: string) {
  await crawlTask({ force: true, sourceName });
}

// 更新特定新闻源
export async function updateSource(sourceName: string) {
  await crawlTask({ sourceName });
}

// 清空所有新闻数据（用于测试）
export async function clearAllNews() {
  clear('news');
  clear('events');
  clear('sourceStatus');
  console.log('🗑️ 已清空所有新闻、事件和状态数据');
}

// 导出增量更新相关函数
export {
  getIncrementalStats,
  resetSourceStatus,
  setUpdateInterval,
  getNextSourcesToUpdate,
};
