import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { sqliteTables, TableName } from './schema';

const DATA_DIR = process.env.DATA_DIR || path.resolve(process.cwd(), 'data');
const DB_PATH = process.env.SQLITE_PATH || path.join(DATA_DIR, 'app.db');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const sqlite = new Database(DB_PATH);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite);

const JSON_FILES: Record<TableName, string> = {
  news: path.join(DATA_DIR, 'news.json'),
  watchlist: path.join(DATA_DIR, 'watchlist.json'),
  newsSources: path.join(DATA_DIR, 'newsSources.json'),
  events: path.join(DATA_DIR, 'events.json'),
  reports: path.join(DATA_DIR, 'reports.json'),
  dailyBriefings: path.join(DATA_DIR, 'dailyBriefings.json'),
  sourceStatus: path.join(DATA_DIR, 'sourceStatus.json'),
  users: path.join(DATA_DIR, 'users.json'),
  systemSettings: path.join(DATA_DIR, 'systemSettings.json'),
};

const TABLE_DDL = [
  `CREATE TABLE IF NOT EXISTS news (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data TEXT NOT NULL,
    title TEXT,
    source TEXT,
    source_url TEXT,
    category TEXT,
    event_id TEXT,
    published_at TEXT,
    exact_hash TEXT,
    sim_hash TEXT,
    keyword_fingerprint TEXT,
    created_at TEXT,
    updated_at TEXT
  )`,
  'CREATE INDEX IF NOT EXISTS idx_news_published_at ON news(published_at)',
  'CREATE INDEX IF NOT EXISTS idx_news_category ON news(category)',
  'CREATE INDEX IF NOT EXISTS idx_news_source ON news(source)',
  'CREATE INDEX IF NOT EXISTS idx_news_event_id ON news(event_id)',
  'CREATE INDEX IF NOT EXISTS idx_news_exact_hash ON news(exact_hash)',

  `CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data TEXT NOT NULL,
    event_id TEXT,
    title TEXT,
    category TEXT,
    last_published_at TEXT,
    created_at TEXT,
    updated_at TEXT
  )`,
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_events_event_id ON events(event_id)',
  'CREATE INDEX IF NOT EXISTS idx_events_last_published_at ON events(last_published_at)',

  `CREATE TABLE IF NOT EXISTS news_sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data TEXT NOT NULL,
    name TEXT,
    type TEXT,
    is_enabled INTEGER,
    is_default INTEGER,
    created_at TEXT,
    updated_at TEXT
  )`,
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_news_sources_name ON news_sources(name)',
  'CREATE INDEX IF NOT EXISTS idx_news_sources_enabled ON news_sources(is_enabled)',

  `CREATE TABLE IF NOT EXISTS source_status (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data TEXT NOT NULL,
    source_name TEXT,
    last_fetch_time TEXT,
    is_active INTEGER,
    created_at TEXT,
    updated_at TEXT
  )`,
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_source_status_name ON source_status(source_name)',
  'CREATE INDEX IF NOT EXISTS idx_source_status_active ON source_status(is_active)',

  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data TEXT NOT NULL,
    username TEXT,
    role TEXT,
    disabled INTEGER,
    created_at TEXT,
    updated_at TEXT
  )`,
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username)',

  `CREATE TABLE IF NOT EXISTS system_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data TEXT NOT NULL,
    key TEXT,
    created_at TEXT,
    updated_at TEXT
  )`,
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(key)',

  `CREATE TABLE IF NOT EXISTS watchlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data TEXT NOT NULL,
    stock_code TEXT,
    created_at TEXT,
    updated_at TEXT
  )`,
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_watchlist_stock_code ON watchlist(stock_code)',

  `CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data TEXT NOT NULL,
    title TEXT,
    stock_code TEXT,
    published_at TEXT,
    created_at TEXT,
    updated_at TEXT
  )`,
  'CREATE INDEX IF NOT EXISTS idx_reports_stock_code ON reports(stock_code)',
  'CREATE INDEX IF NOT EXISTS idx_reports_published_at ON reports(published_at)',

  `CREATE TABLE IF NOT EXISTS daily_briefings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data TEXT NOT NULL,
    date TEXT,
    created_at TEXT,
    updated_at TEXT
  )`,
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_briefings_date ON daily_briefings(date)',

  `CREATE TABLE IF NOT EXISTS db_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT
  )`,
];

function createTables(): void {
  const createAll = sqlite.transaction(() => {
    for (const statement of TABLE_DDL) {
      sqlite.exec(statement);
    }
  });
  createAll();
}

function readJsonArray(filePath: string): any[] {
  try {
    if (!fs.existsSync(filePath)) return [];
    const data = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error(`读取 ${filePath} 失败:`, error);
    return [];
  }
}

function getMeta(key: string): string | null {
  const row = sqlite
    .prepare('SELECT value FROM db_meta WHERE key = ?')
    .get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

function setMeta(key: string, value: string): void {
  sqlite
    .prepare(
      `INSERT INTO db_meta (key, value, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    )
    .run(key, value, new Date().toISOString());
}

function tableCount(table: TableName): number {
  const physicalName = toPhysicalTableName(table);
  const row = sqlite.prepare(`SELECT COUNT(*) as count FROM ${physicalName}`).get() as { count: number };
  return row.count;
}

function toPhysicalTableName(table: TableName): string {
  const names: Record<TableName, string> = {
    news: 'news',
    events: 'events',
    newsSources: 'news_sources',
    sourceStatus: 'source_status',
    users: 'users',
    systemSettings: 'system_settings',
    watchlist: 'watchlist',
    reports: 'reports',
    dailyBriefings: 'daily_briefings',
  };
  return names[table];
}

function normalizeRow(table: TableName, item: any, preserveId = false): Record<string, any> {
  const now = new Date().toISOString();
  const data = { ...item };
  if (!preserveId) {
    delete data.id;
  }

  const row: Record<string, any> = {
    data: JSON.stringify(data),
    createdAt: item.createdAt || item.created_at || null,
    updatedAt: now,
  };

  if (preserveId && item.id !== undefined) {
    row.id = item.id;
  }

  switch (table) {
    case 'news':
      row.title = item.title || null;
      row.source = item.source || null;
      row.sourceUrl = item.sourceUrl || null;
      row.category = item.category || null;
      row.eventId = item.eventId || null;
      row.publishedAt = item.publishedAt || null;
      row.exactHash = item.exactHash || null;
      row.simHash = item.simHash || null;
      row.keywordFingerprint = item.keywordFingerprint || null;
      break;
    case 'events':
      row.eventId = item.eventId || null;
      row.title = item.title || null;
      row.category = item.category || null;
      row.lastPublishedAt = item.lastPublishedAt || null;
      break;
    case 'newsSources':
      row.name = item.name || null;
      row.type = item.type || null;
      row.isEnabled = item.isEnabled ? 1 : 0;
      row.isDefault = item.isDefault ? 1 : 0;
      break;
    case 'sourceStatus':
      row.sourceName = item.sourceName || null;
      row.lastFetchTime = item.lastFetchTime || null;
      row.isActive = item.isActive ? 1 : 0;
      break;
    case 'users':
      row.username = item.username || null;
      row.role = item.role || null;
      row.disabled = item.disabled ? 1 : 0;
      break;
    case 'systemSettings':
      row.key = item.key || null;
      break;
    case 'watchlist':
      row.stockCode = item.stockCode || null;
      break;
    case 'reports':
      row.title = item.title || null;
      row.stockCode = item.stockCode || null;
      row.publishedAt = item.publishedAt || null;
      break;
    case 'dailyBriefings':
      row.date = item.date || null;
      break;
  }

  return row;
}

function hydrateRow<T>(row: { id: number; data: string }): T {
  const item = JSON.parse(row.data);
  return { ...item, id: row.id } as T;
}

function importJsonDataIfNeeded(): void {
  if (getMeta('json_import_completed') === '1') return;

  const domainTables = Object.keys(sqliteTables) as TableName[];
  const hasExistingData = domainTables.some((table) => tableCount(table) > 0);
  if (hasExistingData) {
    setMeta('json_import_completed', '1');
    return;
  }

  const importAll = sqlite.transaction(() => {
    for (const table of domainTables) {
      const rows = readJsonArray(JSON_FILES[table]);
      for (const item of rows) {
        insertItem(table, item, true);
      }
    }
    setMeta('json_import_completed', '1');
    setMeta('json_imported_at', new Date().toISOString());
  });

  importAll();
}

function insertItem<T extends { id?: number }>(table: TableName, data: Omit<T, 'id'> | T, preserveId = false): T {
  const sqliteTable = sqliteTables[table] as any;
  const row = normalizeRow(table, data, preserveId);
  const result = db.insert(sqliteTable).values(row).returning({ id: sqliteTable.id }).get() as { id: number };
  return { ...(data as any), id: result.id } as T;
}

createTables();
importJsonDataIfNeeded();

export function create<T extends { id?: number }>(table: TableName, data: Omit<T, 'id'>): T {
  return insertItem<T>(table, data);
}

export function findAll<T>(table: TableName): T[] {
  const sqliteTable = sqliteTables[table] as any;
  const rows = db.select({ id: sqliteTable.id, data: sqliteTable.data }).from(sqliteTable).all() as Array<{
    id: number;
    data: string;
  }>;
  return rows.map((row) => hydrateRow<T>(row));
}

export function findById<T extends { id: number }>(table: TableName, id: number): T | null {
  const sqliteTable = sqliteTables[table] as any;
  const row = db
    .select({ id: sqliteTable.id, data: sqliteTable.data })
    .from(sqliteTable)
    .where(eq(sqliteTable.id, id))
    .get() as { id: number; data: string } | undefined;
  return row ? hydrateRow<T>(row) : null;
}

export function findWhere<T>(table: TableName, predicate: (item: T) => boolean): T[] {
  return findAll<T>(table).filter(predicate);
}

export function update<T extends { id: number }>(table: TableName, id: number, data: Partial<T> & Record<string, any>): T | null {
  const existing = findById<T>(table, id);
  if (!existing) return null;

  const merged = { ...existing, ...data, id };
  const sqliteTable = sqliteTables[table] as any;
  const row = normalizeRow(table, merged, false);

  db.update(sqliteTable).set(row).where(eq(sqliteTable.id, id)).run();
  return merged;
}

export function remove(table: TableName, id: number): boolean {
  const sqliteTable = sqliteTables[table] as any;
  const result = db.delete(sqliteTable).where(eq(sqliteTable.id, id)).run() as { changes: number };
  return result.changes > 0;
}

export function count(table: TableName): number {
  return tableCount(table);
}

export function clear(table: TableName): void {
  const sqliteTable = sqliteTables[table] as any;
  db.delete(sqliteTable).run();
  sqlite.prepare(`DELETE FROM sqlite_sequence WHERE name = ?`).run(toPhysicalTableName(table));
}

export const tables = JSON_FILES;
export const sqliteDatabasePath = DB_PATH;
