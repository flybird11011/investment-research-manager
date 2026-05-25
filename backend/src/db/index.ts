// 使用 JSON 文件作为数据库，零配置，适合本机快速测试
export * from './jsonDb';

// 表名映射（保持与原来相同的接口）
export const news = 'news' as const;
export const watchlist = 'watchlist' as const;
export const newsSources = 'newsSources' as const;
export const events = 'events' as const;
export const reports = 'reports' as const;
export const dailyBriefings = 'dailyBriefings' as const;

// 模拟 drizzle 的 db 对象
import * as jsonDb from './jsonDb';

type TableName = 'news' | 'watchlist' | 'newsSources' | 'events' | 'reports' | 'dailyBriefings' | 'sourceStatus' | 'users';

export const db = {
  select: () => ({
    from: (table: TableName) => ({
      where: (condition?: any) => ({
        orderBy: (order: any) => ({
          limit: (n: number) => ({
            offset: (n: number) => jsonDb.findAll(table).slice(0, n),
            then: (cb: any) => Promise.resolve(cb(jsonDb.findAll(table).slice(0, n))),
          }),
          then: (cb: any) => Promise.resolve(cb(jsonDb.findAll(table))),
        }),
        limit: (n: number) => ({
          offset: (n: number) => jsonDb.findAll(table).slice(0, n),
          then: (cb: any) => Promise.resolve(cb(jsonDb.findAll(table).slice(0, n))),
        }),
        then: (cb: any) => Promise.resolve(cb(jsonDb.findAll(table))),
      }),
      orderBy: (order: any) => ({
        limit: (n: number) => ({
          offset: (n: number) => jsonDb.findAll(table).slice(0, n),
          then: (cb: any) => Promise.resolve(cb(jsonDb.findAll(table).slice(0, n))),
        }),
        then: (cb: any) => Promise.resolve(cb(jsonDb.findAll(table))),
      }),
      limit: (n: number) => ({
        offset: (n: number) => jsonDb.findAll(table).slice(0, n),
        then: (cb: any) => Promise.resolve(cb(jsonDb.findAll(table).slice(0, n))),
      }),
      then: (cb: any) => Promise.resolve(cb(jsonDb.findAll(table))),
    }),
  }),
  insert: (table: TableName) => ({
    values: (data: any) => ({
      returning: () => {
        const result = jsonDb.create(table, data);
        return Promise.resolve([result]);
      },
    }),
  }),
  update: (table: TableName) => ({
    set: (data: any) => ({
      where: (condition: any) => {
        // 简单处理：假设 condition 是 { id: value }
        const id = condition?.right || condition;
        jsonDb.update(table, id, data);
        return Promise.resolve();
      },
    }),
  }),
  delete: (table: TableName) => ({
    where: (condition: any) => {
      const id = condition?.right || condition;
      jsonDb.remove(table, id);
      return Promise.resolve();
    },
  }),
};

// 辅助函数
export function toJson<T>(value: T | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  return JSON.stringify(value);
}

export function parseJson<T>(value: string | null | undefined): T | null {
  if (!value) return null;
  try { return JSON.parse(value); } catch { return null; }
}
