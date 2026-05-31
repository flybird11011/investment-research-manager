import { execSync } from 'node:child_process';

const sourceName = process.argv[2] || '股掌柜-7x24聚合消息';
const lookbackHours = Number(process.argv[3] || 12);
const statsUrl = process.env.CRAWLER_STATS_URL || 'https://invest.791127.xyz/api/crawler/stats';

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function countMatches(text, pattern) {
  const matches = text.match(pattern);
  return matches ? matches.length : 0;
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: {
      'accept': 'application/json',
    },
  });
  if (!res.ok) {
    throw new Error(`stats request failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

function summarizeBlock(block) {
  const savedMatch = block.match(/成功获取\s+(\d+)\s+条新闻，保存\s+(\d+)\s+条/);
  return {
    apiReturned: countMatches(block, /API返回\s+\d+\s+条/gi),
    parsed: countMatches(block, /成功解析\s+\d+\s+条/gi),
    saved: savedMatch ? Number(savedMatch[2]) : 0,
    duplicate: countMatches(block, /跳过重复新闻/g),
    noNew: countMatches(block, /未获取到新新闻/g),
    timeout: countMatches(block, /ETIMEDOUT/g),
    failed: countMatches(block, /抓取失败/g),
  };
}

function conclude(metrics, source) {
  const savedFromLogs = metrics.saved;
  if (metrics.timeout > 0 && metrics.apiReturned === 0 && metrics.parsed === 0) {
    return '抓取失败：请求层超时';
  }
  if (savedFromLogs > 0 || Number(source.lastCount) > 0) {
    return '最近抓到并入库';
  }
  if (metrics.apiReturned > 0 || metrics.parsed > 0) {
    if (metrics.duplicate > 0) return '最近抓到了原始数据，但被去重了';
    return '最近抓到了原始数据，但没有新增入库';
  }
  if (metrics.noNew > 0) return '最近没有解析到新内容';
  if (Number(source.lastCount) === 0) return '任务跑了，但这次没有新增';
  return '状态不明确';
}

async function main() {
  const payload = await fetchJson(statsUrl);
  const stats = payload?.stats;
  if (!stats) {
    throw new Error('stats payload missing');
  }

  const source = stats.sourceDetails?.find((item) => item.name === sourceName);
  if (!source) {
    console.error(`未找到新闻源: ${sourceName}`);
    process.exitCode = 1;
    return;
  }

  const sinceIso = new Date(Date.now() - lookbackHours * 60 * 60 * 1000).toISOString();
  let logs = '';
  try {
    logs = execSync(`docker logs investment-backend --since "${sinceIso}" 2>&1`, {
      encoding: 'utf8',
      maxBuffer: 5 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    logs = error?.stdout?.toString?.() || error?.stderr?.toString?.() || '';
  }

  const blocks = logs
    .split(/\n(?=📰 新闻源: )/g)
    .filter((block) => block.includes(`📰 新闻源: ${sourceName}`));

  const metrics = blocks.reduce(
    (acc, block) => {
      const current = summarizeBlock(block);
      acc.apiReturned += current.apiReturned;
      acc.parsed += current.parsed;
      acc.saved += current.saved;
      acc.duplicate += current.duplicate;
      acc.noNew += current.noNew;
      acc.timeout += current.timeout;
      acc.failed += current.failed;
      return acc;
    },
    { apiReturned: 0, parsed: 0, saved: 0, duplicate: 0, noNew: 0, timeout: 0, failed: 0 }
  );

  const latestBlock = blocks.at(-1) || '';
  const verdict = conclude(metrics, source);

  console.log(`source: ${sourceName}`);
  console.log(`lastFetch: ${source.lastFetch}`);
  console.log(`lastCount: ${source.lastCount}`);
  console.log(`totalCount: ${source.totalCount}`);
  console.log(`status: ${source.status}`);
  console.log(`logsSince: ${lookbackHours}h`);
  console.log(`apiReturned: ${metrics.apiReturned}`);
  console.log(`parsed: ${metrics.parsed}`);
  console.log(`saved: ${metrics.saved}`);
  console.log(`duplicate: ${metrics.duplicate}`);
  console.log(`noNew: ${metrics.noNew}`);
  console.log(`timeout: ${metrics.timeout}`);
  console.log(`verdict: ${verdict}`);

  if (latestBlock) {
    const tail = latestBlock
      .trim()
      .split('\n')
      .slice(-12)
      .join('\n');
    console.log('--- recent block tail ---');
    console.log(tail);
  } else {
    console.log('--- recent block tail ---');
    console.log('未找到该源的近期日志块');
  }
}

main().catch((error) => {
  console.error(`check-source failed: ${error.message}`);
  process.exitCode = 1;
});
