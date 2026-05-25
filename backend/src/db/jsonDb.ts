import fs from 'fs';
import path from 'path';

const DATA_DIR = path.resolve(__dirname, '../../data');

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 数据文件路径
const FILES = {
  news: path.join(DATA_DIR, 'news.json'),
  watchlist: path.join(DATA_DIR, 'watchlist.json'),
  newsSources: path.join(DATA_DIR, 'newsSources.json'),
  events: path.join(DATA_DIR, 'events.json'),
  reports: path.join(DATA_DIR, 'reports.json'),
  dailyBriefings: path.join(DATA_DIR, 'dailyBriefings.json'),
  sourceStatus: path.join(DATA_DIR, 'sourceStatus.json'),
  users: path.join(DATA_DIR, 'users.json'),
} as const;

type TableName = keyof typeof FILES;

// 读取 JSON 文件
function readJson<T>(filePath: string, defaultValue: T): T {
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2));
      return defaultValue;
    }
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`读取 ${filePath} 失败:`, error);
    return defaultValue;
  }
}

// 写入 JSON 文件
function writeJson<T>(filePath: string, data: T): void {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error(`写入 ${filePath} 失败:`, error);
  }
}

// ID 生成器
let idCounters: Record<string, number> = {};

function generateId(table: TableName): number {
  if (!idCounters[table]) {
    const data = readJson<any[]>(FILES[table], []);
    const maxId = data.reduce((max, item) => Math.max(max, item.id || 0), 0);
    idCounters[table] = maxId;
  }
  idCounters[table]++;
  return idCounters[table];
}

// 通用 CRUD 操作
export function create<T extends { id?: number }>(table: TableName, data: Omit<T, 'id'>): T {
  const items = readJson<T[]>(FILES[table], []);
  const newItem = { ...data, id: generateId(table) } as T;
  items.push(newItem);
  writeJson(FILES[table], items);
  return newItem;
}

export function findAll<T>(table: TableName): T[] {
  return readJson<T[]>(FILES[table], []);
}

export function findById<T extends { id: number }>(table: TableName, id: number): T | null {
  const items = readJson<T[]>(FILES[table], []);
  return items.find(item => item.id === id) || null;
}

export function findWhere<T>(table: TableName, predicate: (item: T) => boolean): T[] {
  const items = readJson<T[]>(FILES[table], []);
  return items.filter(predicate);
}

export function update<T extends { id: number }>(table: TableName, id: number, data: Partial<T>): T | null {
  const items = readJson<T[]>(FILES[table], []);
  const index = items.findIndex(item => item.id === id);
  if (index === -1) return null;
  items[index] = { ...items[index], ...data };
  writeJson(FILES[table], items);
  return items[index] as T;
}

export function remove(table: TableName, id: number): boolean {
  const items = readJson<any[]>(FILES[table], []);
  const filtered = items.filter(item => item.id !== id);
  if (filtered.length === items.length) return false;
  writeJson(FILES[table], filtered);
  return true;
}

export function count(table: TableName): number {
  const items = readJson<any[]>(FILES[table], []);
  return items.length;
}

// 清空表
export function clear(table: TableName): void {
  writeJson(FILES[table], []);
  idCounters[table] = 0;
}

// 导出表名
export const tables = FILES;
