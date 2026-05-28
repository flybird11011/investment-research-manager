import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

const baseColumns = {
  id: integer('id').primaryKey({ autoIncrement: true }),
  data: text('data').notNull(),
  createdAt: text('created_at'),
  updatedAt: text('updated_at'),
};

export const newsRows = sqliteTable('news', {
  ...baseColumns,
  title: text('title'),
  source: text('source'),
  sourceUrl: text('source_url'),
  category: text('category'),
  eventId: text('event_id'),
  publishedAt: text('published_at'),
  exactHash: text('exact_hash'),
  simHash: text('sim_hash'),
  keywordFingerprint: text('keyword_fingerprint'),
}, (table) => ({
  publishedAtIdx: index('idx_news_published_at').on(table.publishedAt),
  categoryIdx: index('idx_news_category').on(table.category),
  sourceIdx: index('idx_news_source').on(table.source),
  eventIdIdx: index('idx_news_event_id').on(table.eventId),
  exactHashIdx: index('idx_news_exact_hash').on(table.exactHash),
}));

export const eventRows = sqliteTable('events', {
  ...baseColumns,
  eventId: text('event_id'),
  title: text('title'),
  category: text('category'),
  lastPublishedAt: text('last_published_at'),
}, (table) => ({
  eventIdIdx: uniqueIndex('idx_events_event_id').on(table.eventId),
  lastPublishedAtIdx: index('idx_events_last_published_at').on(table.lastPublishedAt),
}));

export const newsSourceRows = sqliteTable('news_sources', {
  ...baseColumns,
  name: text('name'),
  type: text('type'),
  isEnabled: integer('is_enabled'),
  isDefault: integer('is_default'),
}, (table) => ({
  nameIdx: uniqueIndex('idx_news_sources_name').on(table.name),
  enabledIdx: index('idx_news_sources_enabled').on(table.isEnabled),
}));

export const sourceStatusRows = sqliteTable('source_status', {
  ...baseColumns,
  sourceName: text('source_name'),
  lastFetchTime: text('last_fetch_time'),
  isActive: integer('is_active'),
}, (table) => ({
  sourceNameIdx: uniqueIndex('idx_source_status_name').on(table.sourceName),
  activeIdx: index('idx_source_status_active').on(table.isActive),
}));

export const userRows = sqliteTable('users', {
  ...baseColumns,
  username: text('username'),
  role: text('role'),
  disabled: integer('disabled'),
}, (table) => ({
  usernameIdx: uniqueIndex('idx_users_username').on(table.username),
}));

export const systemSettingRows = sqliteTable('system_settings', {
  ...baseColumns,
  key: text('key'),
}, (table) => ({
  keyIdx: uniqueIndex('idx_system_settings_key').on(table.key),
}));

export const watchlistRows = sqliteTable('watchlist', {
  ...baseColumns,
  stockCode: text('stock_code'),
}, (table) => ({
  stockCodeIdx: uniqueIndex('idx_watchlist_stock_code').on(table.stockCode),
}));

export const reportRows = sqliteTable('reports', {
  ...baseColumns,
  title: text('title'),
  stockCode: text('stock_code'),
  publishedAt: text('published_at'),
}, (table) => ({
  stockCodeIdx: index('idx_reports_stock_code').on(table.stockCode),
  publishedAtIdx: index('idx_reports_published_at').on(table.publishedAt),
}));

export const dailyBriefingRows = sqliteTable('daily_briefings', {
  ...baseColumns,
  date: text('date'),
}, (table) => ({
  dateIdx: uniqueIndex('idx_daily_briefings_date').on(table.date),
}));

export const dbMetaRows = sqliteTable('db_meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: text('updated_at'),
});

export const sqliteTables = {
  news: newsRows,
  events: eventRows,
  newsSources: newsSourceRows,
  sourceStatus: sourceStatusRows,
  users: userRows,
  systemSettings: systemSettingRows,
  watchlist: watchlistRows,
  reports: reportRows,
  dailyBriefings: dailyBriefingRows,
} as const;

export type TableName = keyof typeof sqliteTables;
