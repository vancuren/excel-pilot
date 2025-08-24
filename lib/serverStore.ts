import { promises as fs } from 'fs';
import path from 'path';

const DATA_ROOT = path.join(process.cwd(), 'data');

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

async function readJSON(filePath: string): Promise<any> {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (e: any) {
    if (e.code === 'ENOENT') return null;
    throw e;
  }
}

async function writeJSON(filePath: string, data: any): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function tableFile(datasetId: string | undefined, table: string): string {
  if (datasetId) {
    return path.join(DATA_ROOT, datasetId, `${table}.json`);
  }
  return path.join(DATA_ROOT, `${table}.json`);
}

export async function select(table: string, where: any = {}, datasetId?: string): Promise<any[]> {
  const file = tableFile(datasetId, table);
  const records = (await readJSON(file)) || [];
  if (!where || Object.keys(where).length === 0) return records;
  return records.filter((record: any) => matchesWhere(record, where));
}

export async function insert(table: string, data: any, datasetId?: string): Promise<any> {
  const file = tableFile(datasetId, table);
  const records = (await readJSON(file)) || [];
  const newRecord = {
    ...data,
    id: data.id || `${table}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
    updatedAt: data.updatedAt ? new Date(data.updatedAt) : new Date()
  };
  records.push(newRecord);
  await writeJSON(file, records);
  return newRecord;
}

export async function update(table: string, where: any, patch: any, datasetId?: string): Promise<number> {
  const file = tableFile(datasetId, table);
  const records = (await readJSON(file)) || [];
  let count = 0;
  const updated = records.map((r: any) => {
    if (matchesWhere(r, where)) {
      count++;
      return { ...r, ...patch, updatedAt: new Date() };
    }
    return r;
  });
  if (count > 0) await writeJSON(file, updated);
  return count;
}

export async function remove(table: string, where: any, datasetId?: string): Promise<number> {
  const file = tableFile(datasetId, table);
  const records = (await readJSON(file)) || [];
  const before = records.length;
  const filtered = records.filter((r: any) => !matchesWhere(r, where));
  await writeJSON(file, filtered);
  return before - filtered.length;
}

export async function increment(key: string): Promise<number> {
  const file = path.join(DATA_ROOT, 'system', 'counters.json');
  const counters = (await readJSON(file)) || {};
  counters[key] = (counters[key] || 0) + 1;
  await writeJSON(file, counters);
  return counters[key];
}

function matchesWhere(record: any, where: any): boolean {
  for (const [k, v] of Object.entries(where)) {
    if (k.startsWith('$')) continue;
    const rv = (record as any)[k];
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      for (const [op, val] of Object.entries(v)) {
        switch (op) {
          case '$lt': if (!(rv < val)) return false; break;
          case '$lte': if (!(rv <= val)) return false; break;
          case '$gt': if (!(rv > val)) return false; break;
          case '$gte': if (!(rv >= val)) return false; break;
          case '$in': if (!Array.isArray(val) || !val.includes(rv)) return false; break;
          default: if (rv !== (v as any)) return false;
        }
      }
    } else if (Array.isArray(v)) {
      if (!v.includes(rv)) return false;
    } else {
      if (rv !== v) return false;
    }
  }
  return true;
}

