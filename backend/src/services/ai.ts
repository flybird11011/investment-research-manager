import OpenAI from 'openai';

const apiKey = process.env.OPENAI_API_KEY;
const openai = apiKey ? new OpenAI({ apiKey }) : null;

// 研报摘要提示词模板
const REPORT_SUMMARY_PROMPT = `你是一位专业的金融分析师，请对以下研报内容进行深度分析，并提供结构化的摘要。

请从以下几个维度进行分析：

1. **核心投资逻辑**（2-3句话概括研报的核心观点）
2. **投资评级**（买入/增持/中性/减持，如果研报中有明确说明）
3. **目标价**（研报给出的目标价格）
4. **关键数据**（重要的财务数据、增长率、市盈率等）
5. **风险提示**（研报中提到的主要风险因素）
6. **行业/公司亮点**（3-5个关键亮点）

请以 JSON 格式返回，结构如下：
{
  "coreLogic": "核心投资逻辑...",
  "rating": "买入/增持/中性/减持",
  "targetPrice": "目标价格",
  "keyData": ["数据1", "数据2", ...],
  "risks": ["风险1", "风险2", ...],
  "highlights": ["亮点1", "亮点2", ...],
  "summary": "整体摘要（100字以内）"
}

研报内容：
`;

// 生成研报摘要
export async function generateReportSummary(reportContent: string): Promise<{
  coreLogic: string;
  rating: string;
  targetPrice: string;
  keyData: string[];
  risks: string[];
  highlights: string[];
  summary: string;
}> {
  if (!openai) {
    console.log('⚠️ 未配置 OPENAI_API_KEY，返回模拟数据');
    return {
      coreLogic: '（AI功能未配置）请配置 OPENAI_API_KEY 以启用AI摘要功能',
      rating: '未配置',
      targetPrice: '未配置',
      keyData: ['AI功能未启用'],
      risks: ['请配置 OPENAI_API_KEY'],
      highlights: ['配置后可自动生成研报摘要'],
      summary: reportContent.slice(0, 200) + '...',
    };
  }

  try {
    // 截断内容以适应 token 限制
    const truncatedContent = reportContent.slice(0, 15000);

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo-16k',
      messages: [
        {
          role: 'system',
          content: '你是一位专业的金融分析师，擅长从研报中提取关键信息并提供结构化的投资分析。',
        },
        {
          role: 'user',
          content: REPORT_SUMMARY_PROMPT + truncatedContent,
        },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('AI 返回内容为空');
    }

    // 解析 JSON 响应
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      return {
        coreLogic: result.coreLogic || '',
        rating: result.rating || '',
        targetPrice: result.targetPrice || '',
        keyData: result.keyData || [],
        risks: result.risks || [],
        highlights: result.highlights || [],
        summary: result.summary || '',
      };
    }

    // 如果无法解析 JSON，返回原始内容作为摘要
    return {
      coreLogic: content.slice(0, 500),
      rating: '',
      targetPrice: '',
      keyData: [],
      risks: [],
      highlights: [],
      summary: content.slice(0, 200),
    };
  } catch (error) {
    console.error('AI 摘要生成失败:', error);
    throw error;
  }
}

// 快速摘要（用于新闻）
export async function generateQuickSummary(text: string): Promise<string> {
  if (!openai) {
    return text.slice(0, 100) + '...';
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: '请用一句话概括以下财经新闻的核心要点：',
        },
        {
          role: 'user',
          content: text.slice(0, 2000),
        },
      ],
      temperature: 0.3,
      max_tokens: 100,
    });

    return response.choices[0]?.message?.content || '';
  } catch (error) {
    console.error('快速摘要生成失败:', error);
    return '';
  }
}

// 提取股票代码和名称
export async function extractStockInfo(text: string): Promise<{
  stockCode?: string;
  stockName?: string;
}> {
  if (!openai) {
    return {};
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: '从以下文本中提取股票代码和股票名称，以 JSON 格式返回：{ "stockCode": "", "stockName": "" }',
        },
        {
          role: 'user',
          content: text.slice(0, 1000),
        },
      ],
      temperature: 0.1,
      max_tokens: 100,
    });

    const content = response.choices[0]?.message?.content;
    if (content) {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    }

    return {};
  } catch (error) {
    console.error('提取股票信息失败:', error);
    return {};
  }
}

// 分析投资情绪
export async function analyzeSentiment(text: string): Promise<{
  sentiment: 'positive' | 'neutral' | 'negative';
  score: number;
}> {
  if (!openai) {
    return { sentiment: 'neutral', score: 50 };
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: '分析以下财经文本的投资情绪，以 JSON 格式返回：{ "sentiment": "positive/neutral/negative", "score": 0-100 }。positive 表示利好/看涨，negative 表示利空/看跌，neutral 表示中性。score 表示情绪强度，0-100。',
        },
        {
          role: 'user',
          content: text.slice(0, 2000),
        },
      ],
      temperature: 0.2,
      max_tokens: 100,
    });

    const content = response.choices[0]?.message?.content;
    if (content) {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    }

    return { sentiment: 'neutral', score: 50 };
  } catch (error) {
    console.error('情绪分析失败:', error);
    return { sentiment: 'neutral', score: 50 };
  }
}

// 批量情绪分析（合并多条新闻一次请求，节省 token）
export async function batchAnalyzeSentiment(
  items: { id: number; title: string; summary?: string }[]
): Promise<Map<number, { sentiment: 'positive' | 'neutral' | 'negative'; score: number }>> {
  const results = new Map<number, { sentiment: 'positive' | 'neutral' | 'negative'; score: number }>();

  if (!openai) {
    for (const item of items) {
      results.set(item.id, { sentiment: 'neutral', score: 50 });
    }
    return results;
  }

  try {
    // 构建批量请求文本
    const batchText = items
      .map((item, index) => `[${index}] ${item.title}${item.summary ? ' - ' + item.summary.slice(0, 100) : ''}`)
      .join('\n');

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: `你是一位专业的金融情绪分析师。请对以下每条财经新闻进行情绪分析。
对每条新闻返回：{ "index": 序号, "sentiment": "positive/neutral/negative", "score": 0-100 }
以 JSON 数组格式返回所有结果。`,
        },
        {
          role: 'user',
          content: batchText.slice(0, 8000),
        },
      ],
      temperature: 0.2,
      max_tokens: 2000,
    });

    const content = response.choices[0]?.message?.content;
    if (content) {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        for (const item of parsed) {
          const newsItem = items[item.index];
          if (newsItem) {
            results.set(newsItem.id, {
              sentiment: item.sentiment || 'neutral',
              score: Math.max(0, Math.min(100, item.score || 50)),
            });
          }
        }
      }
    }

    // 未匹配到的条目设置默认值
    for (const item of items) {
      if (!results.has(item.id)) {
        results.set(item.id, { sentiment: 'neutral', score: 50 });
      }
    }
  } catch (error) {
    console.error('批量情绪分析失败:', error);
    for (const item of items) {
      results.set(item.id, { sentiment: 'neutral', score: 50 });
    }
  }

  return results;
}

// AI 智能问答
export async function chatWithAI(
  question: string,
  context?: string
): Promise<string> {
  if (!openai) {
    return 'AI 问答功能需要配置 OPENAI_API_KEY 才能使用。请在环境变量中设置您的 OpenAI API 密钥。';
  }

  try {
    const systemPrompt = `你是一位专业的投资研究助手，可以帮助用户分析财经资讯、解读市场动态、回答投资相关问题。

请遵循以下原则：
1. 基于提供的信息回答，不要编造数据
2. 给出客观中立的分析，不提供具体投资建议
3. 回答简洁明了，重点突出
4. 如果信息不足，诚实说明
5. 使用中文回答`;

    const messages: { role: string; content: string }[] = [
      { role: 'system', content: systemPrompt },
    ];

    if (context) {
      messages.push({
        role: 'system',
        content: `以下是用户关注的最新资讯，请参考这些信息回答问题：\n${context.slice(0, 6000)}`,
      });
    }

    messages.push({ role: 'user', content: question });

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: messages as any,
      temperature: 0.5,
      max_tokens: 1000,
    });

    return response.choices[0]?.message?.content || '抱歉，我暂时无法回答这个问题。';
  } catch (error) {
    console.error('AI 问答失败:', error);
    return 'AI 服务暂时不可用，请稍后再试。';
  }
}

// 生成每日简报
export async function generateDailyBriefing(newsItems: {
  title: string;
  summary?: string;
  source: string;
  category: string;
  publishedAt: string;
}[], watchlistStocks: { stockCode: string; stockName: string }[]): Promise<{
  marketOverview: string;
  hotTopics: { title: string; sentiment: string; summary: string }[];
  watchlistAlerts: { stockCode: string; stockName: string; alert: string }[];
  riskWarnings: string[];
  outlook: string;
}> {
  if (!openai) {
    return {
      marketOverview: '（AI功能未配置）请配置 OPENAI_API_KEY 以启用AI简报功能',
      hotTopics: newsItems.slice(0, 5).map(n => ({
        title: n.title,
        sentiment: 'neutral',
        summary: n.summary?.slice(0, 50) || ''
      })),
      watchlistAlerts: [],
      riskWarnings: ['AI功能未启用'],
      outlook: '请配置 OPENAI_API_KEY 以获取AI分析',
    };
  }

  try {
    const newsContext = newsItems
      .slice(0, 30)
      .map((n, i) => `${i + 1}. [${n.category}] ${n.title}${n.summary ? ' - ' + n.summary.slice(0, 80) : ''}`)
      .join('\n');

    const watchlistContext = watchlistStocks.length > 0
      ? '\n用户自选股：' + watchlistStocks.map(s => `${s.stockName}(${s.stockCode})`).join('、')
      : '';

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo-16k',
      messages: [
        {
          role: 'system',
          content: `你是一位资深的投资研究分析师，请根据以下最新资讯生成每日投资简报。

请以 JSON 格式返回：
{
  "marketOverview": "大盘整体走势概述（2-3句话）",
  "hotTopics": [
    { "title": "热门话题标题", "sentiment": "positive/neutral/negative", "summary": "一句话概括" }
  ],
  "watchlistAlerts": [
    { "stockCode": "股票代码", "stockName": "股票名称", "alert": "相关动态提醒" }
  ],
  "riskWarnings": ["风险提示1", "风险提示2"],
  "outlook": "后市展望（2-3句话）"
}

注意：
- hotTopics 选取 3-5 个最重要的话题
- watchlistAlerts 只包含与自选股相关的信息，如果没有则返回空数组
- riskWarnings 列出 2-3 个主要风险
- 所有内容基于提供的资讯，不要编造`,
        },
        {
          role: 'user',
          content: `最新资讯：\n${newsContext}${watchlistContext}`,
        },
      ],
      temperature: 0.4,
      max_tokens: 2000,
    });

    const content = response.choices[0]?.message?.content;
    if (content) {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        return {
          marketOverview: result.marketOverview || '',
          hotTopics: (result.hotTopics || []).slice(0, 5),
          watchlistAlerts: result.watchlistAlerts || [],
          riskWarnings: result.riskWarnings || [],
          outlook: result.outlook || '',
        };
      }
    }

    throw new Error('JSON 解析失败');
  } catch (error) {
    console.error('每日简报生成失败:', error);
    throw error;
  }
}
