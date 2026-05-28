// SQLite + Drizzle-backed data layer.
// The JSON-style helpers are re-exported to keep existing routes stable during migration.
export * from './jsonDb';

export const news = 'news' as const;
export const watchlist = 'watchlist' as const;
export const newsSources = 'newsSources' as const;
export const events = 'events' as const;
export const reports = 'reports' as const;
export const dailyBriefings = 'dailyBriefings' as const;
export const sourceStatus = 'sourceStatus' as const;
export const users = 'users' as const;
export const systemSettings = 'systemSettings' as const;

export function toJson<T>(value: T | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  return JSON.stringify(value);
}

export function parseJson<T>(value: string | null | undefined): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
