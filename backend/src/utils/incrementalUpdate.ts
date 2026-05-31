import { findAll, create, update, findById } from '../db/jsonDb';

/**
 * 增量更新管理模块
 * 管理每个新闻源的最后更新时间，实现增量抓取
 */

// 新闻源状态接口
interface SourceStatus {
  id?: number;
  sourceName: string;
  sourceUrl: string;
  lastFetchTime: string;      // 最后抓取时间
  lastFetchCount: number;     // 上次抓取数量
  lastSuccessTime: string;    // 最后成功时间
  totalFetchCount: number;    // 总抓取次数
  totalNewsCount: number;     // 总新闻数量
  lastError?: string;         // 最后错误信息
  lastErrorTime?: string;     // 最后错误时间
  updateInterval: number;     // 更新间隔（分钟）
  isActive: boolean;          // 是否活跃
  clsLastPublishedAt?: string; // CLS 上次抓到的最新发布时间
}

// 默认更新间隔（分钟）
const DEFAULT_UPDATE_INTERVAL = 10;

// 最小更新间隔（防止过于频繁的请求）
const MIN_UPDATE_INTERVAL = 5;

/**
 * 获取或创建新闻源状态
 */
export function getSourceStatus(sourceName: string, sourceUrl: string): SourceStatus {
  const statuses = findAll<any>('sourceStatus');
  let status = statuses.find((s: any) => s.sourceName === sourceName);
  
  if (!status) {
    // 创建新的状态记录
    const newStatus: SourceStatus = {
      sourceName,
      sourceUrl,
      lastFetchTime: new Date(0).toISOString(), // 1970-01-01，表示从未抓取
      lastFetchCount: 0,
      lastSuccessTime: new Date(0).toISOString(),
      totalFetchCount: 0,
      totalNewsCount: 0,
      updateInterval: DEFAULT_UPDATE_INTERVAL,
      isActive: true,
      clsLastPublishedAt: undefined,
    };
    
    const created = create('sourceStatus', newStatus);
    return { ...newStatus, id: created.id };
  }
  
  return status;
}

/**
 * 更新新闻源状态
 */
export function updateSourceStatus(
  sourceName: string,
  updates: Partial<SourceStatus>
): SourceStatus {
  const statuses = findAll<any>('sourceStatus');
  const status = statuses.find((s: any) => s.sourceName === sourceName);
  
  if (!status) {
    throw new Error(`新闻源状态不存在: ${sourceName}`);
  }
  
  const updated = update('sourceStatus', status.id, {
    ...status,
    ...updates,
  });

  return updated as SourceStatus;
}

/**
 * 记录抓取成功
 */
export function recordFetchSuccess(
  sourceName: string,
  sourceUrl: string,
  fetchCount: number
): void {
  const status = getSourceStatus(sourceName, sourceUrl);
  
  updateSourceStatus(sourceName, {
    lastFetchTime: new Date().toISOString(),
    lastFetchCount: fetchCount,
    lastSuccessTime: new Date().toISOString(),
    totalFetchCount: status.totalFetchCount + 1,
    totalNewsCount: status.totalNewsCount + fetchCount,
    isActive: true,
  });
}

/**
 * 记录抓取失败
 */
export function recordFetchError(
  sourceName: string,
  sourceUrl: string,
  error: string
): void {
  const status = getSourceStatus(sourceName, sourceUrl);
  
  updateSourceStatus(sourceName, {
    lastFetchTime: new Date().toISOString(),
    lastFetchCount: 0,
    totalFetchCount: status.totalFetchCount + 1,
    lastError: error,
    lastErrorTime: new Date().toISOString(),
  });
}

/**
 * 检查是否需要更新
 * 基于时间间隔和最后抓取时间
 */
export function shouldUpdate(sourceName: string, sourceUrl: string): {
  shouldUpdate: boolean;
  reason: string;
  nextUpdateTime: Date;
  timeUntilNextUpdate: number; // 毫秒
} {
  const status = getSourceStatus(sourceName, sourceUrl);
  const now = new Date();
  const lastFetch = new Date(status.lastFetchTime);
  const intervalMs = status.updateInterval * 60 * 1000;
  const nextUpdateTime = new Date(lastFetch.getTime() + intervalMs);
  const timeUntilNextUpdate = nextUpdateTime.getTime() - now.getTime();
  
  // 如果从未抓取过，立即更新
  if (status.lastFetchTime === new Date(0).toISOString()) {
    return {
      shouldUpdate: true,
      reason: '从未抓取过',
      nextUpdateTime: now,
      timeUntilNextUpdate: 0,
    };
  }
  
  // 检查是否到达更新时间
  if (timeUntilNextUpdate <= 0) {
    return {
      shouldUpdate: true,
      reason: `距离上次抓取已超过${status.updateInterval}分钟`,
      nextUpdateTime: now,
      timeUntilNextUpdate: 0,
    };
  }
  
  return {
    shouldUpdate: false,
    reason: `下次更新时间: ${nextUpdateTime.toLocaleString()}`,
    nextUpdateTime,
    timeUntilNextUpdate,
  };
}

/**
 * 设置更新间隔
 */
export function setUpdateInterval(
  sourceName: string,
  intervalMinutes: number
): void {
  const clampedInterval = Math.max(MIN_UPDATE_INTERVAL, intervalMinutes);
  
  const statuses = findAll<any>('sourceStatus');
  const status = statuses.find((s: any) => s.sourceName === sourceName);
  
  if (status) {
    updateSourceStatus(sourceName, {
      updateInterval: clampedInterval,
    });
  }
}

/**
 * 获取所有新闻源状态
 */
export function getAllSourceStatus(): SourceStatus[] {
  return findAll<any>('sourceStatus');
}

/**
 * 获取活跃的新闻源
 */
export function getActiveSources(): SourceStatus[] {
  return findAll<any>('sourceStatus').filter((s: any) => s.isActive);
}

/**
 * 重置新闻源状态（用于全量更新）
 */
export function resetSourceStatus(sourceName: string): void {
  const statuses = findAll<any>('sourceStatus');
  const status = statuses.find((s: any) => s.sourceName === sourceName);
  
  if (status) {
    updateSourceStatus(sourceName, {
      lastFetchTime: new Date(0).toISOString(),
      lastFetchCount: 0,
      totalFetchCount: 0,
      totalNewsCount: 0,
      lastError: undefined,
      lastErrorTime: undefined,
      clsLastPublishedAt: undefined,
    });
  }
}

/**
 * 获取增量更新统计
 */
export function getIncrementalStats(): {
  totalSources: number;
  activeSources: number;
  totalNewsFetched: number;
  lastUpdateTime: string;
  sourceDetails: Array<{
    name: string;
    lastFetch: string;
    lastCount: number;
    totalCount: number;
    status: string;
    interval: number;
  }>;
} {
  const statuses = findAll<any>('sourceStatus');
  
  const sourceDetails = statuses.map((s: any) => ({
    name: s.sourceName,
    lastFetch: s.lastFetchTime === new Date(0).toISOString() 
      ? '从未' 
      : new Date(s.lastFetchTime).toLocaleString(),
    lastCount: s.lastFetchCount,
    totalCount: s.totalNewsCount,
    status: s.lastErrorTime && new Date(s.lastErrorTime) > new Date(s.lastSuccessTime)
      ? '错误'
      : '正常',
    interval: s.updateInterval || DEFAULT_UPDATE_INTERVAL,
  }));
  
  // 找到最近的更新时间
  const lastUpdateTimes = statuses
    .filter((s: any) => s.lastFetchTime !== new Date(0).toISOString())
    .map((s: any) => new Date(s.lastFetchTime));
  
  const lastUpdateTime = lastUpdateTimes.length > 0
    ? new Date(Math.max(...lastUpdateTimes.map(d => d.getTime()))).toLocaleString()
    : '从未';
  
  return {
    totalSources: statuses.length,
    activeSources: statuses.filter((s: any) => s.isActive).length,
    totalNewsFetched: statuses.reduce((sum: number, s: any) => sum + s.totalNewsCount, 0),
    lastUpdateTime,
    sourceDetails,
  };
}

/**
 * 智能调度下一个要更新的新闻源
 * 返回应该优先更新的新闻源列表
 */
export function getNextSourcesToUpdate(): Array<{
  sourceName: string;
  sourceUrl: string;
  priority: number;
  reason: string;
}> {
  const statuses = findAll<any>('sourceStatus');
  const now = new Date();
  
  const sourcesWithPriority = statuses.map((status: any) => {
    const lastFetch = new Date(status.lastFetchTime);
    const intervalMs = status.updateInterval * 60 * 1000;
    const timeSinceLastFetch = now.getTime() - lastFetch.getTime();
    const overdueTime = timeSinceLastFetch - intervalMs;
    
    // 计算优先级（越 overdue 优先级越高）
    let priority = 0;
    let reason = '';
    
    if (status.lastFetchTime === new Date(0).toISOString()) {
      priority = 1000; // 最高优先级：从未抓取
      reason = '从未抓取';
    } else if (overdueTime > 0) {
      priority = overdueTime / 1000 / 60; // 按过期分钟数计算
      reason = `已过期 ${Math.floor(overdueTime / 1000 / 60)} 分钟`;
    } else {
      priority = -1; // 不需要更新
      reason = `还需等待 ${Math.floor(-overdueTime / 1000 / 60)} 分钟`;
    }
    
    return {
      sourceName: status.sourceName,
      sourceUrl: status.sourceUrl,
      priority,
      reason,
    };
  });
  
  // 按优先级排序，只返回需要更新的
  return sourcesWithPriority
    .filter((s: any) => s.priority > 0)
    .sort((a: any, b: any) => b.priority - a.priority);
}

export default {
  getSourceStatus,
  updateSourceStatus,
  recordFetchSuccess,
  recordFetchError,
  shouldUpdate,
  setUpdateInterval,
  getAllSourceStatus,
  getActiveSources,
  resetSourceStatus,
  getIncrementalStats,
  getNextSourcesToUpdate,
};
