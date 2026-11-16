import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  nickname TEXT NOT NULL,
  gender TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  recovery_code TEXT UNIQUE NOT NULL,
  exclude_tags TEXT NOT NULL DEFAULT '[]',
  note TEXT NOT NULL DEFAULT '',
  preferences_set INTEGER NOT NULL DEFAULT 0,
  couple_id TEXT,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS couples (
  id TEXT PRIMARY KEY,
  inviter_id TEXT NOT NULL,
  invitee_id TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS invites (
  code TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS ideas (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  text TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS dates (
  id TEXT PRIMARY KEY,
  couple_id TEXT NOT NULL,
  share_id TEXT UNIQUE NOT NULL,
  state TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
`;

export function openDb(file = ':memory:') {
  const db = new Database(file);
  if (file !== ':memory:') db.pragma('journal_mode = WAL');
  db.exec(SCHEMA);
  return db;
}

// 从 dataDir 导入 ideas.json 和 tasks.json。文件缺失或格式不对时只打提示、保留库里原有数据，不抛错。
export function importData(db, dataDir, log = console) {
  const ideas = readJsonArray(path.join(dataDir, 'ideas.json'), log);
  const tasks = readJsonArray(path.join(dataDir, 'tasks.json'), log);

  db.transaction(() => {
    if (ideas) {
      const valid = ideas.filter(isValidIdea);
      if (valid.length < ideas.length) {
        log.warn(`[数据] ideas.json 里有 ${ideas.length - valid.length} 张卡缺少 id 或 kind 不是 eat/play，已跳过`);
      }
      db.prepare('DELETE FROM ideas').run();
      const insert = db.prepare('INSERT OR REPLACE INTO ideas (id, data) VALUES (?, ?)');
      for (const idea of valid) insert.run(idea.id, JSON.stringify(normalizeIdea(idea)));
    }
    if (tasks) {
      db.prepare('DELETE FROM tasks').run();
      const insert = db.prepare('INSERT OR REPLACE INTO tasks (id, text) VALUES (?, ?)');
      for (const task of tasks) {
        if (task && task.id && task.text) insert.run(String(task.id), String(task.text));
      }
    }
  })();

  const counts = {
    ideas: db.prepare('SELECT COUNT(*) AS n FROM ideas').get().n,
    tasks: db.prepare('SELECT COUNT(*) AS n FROM tasks').get().n,
  };
  if (counts.ideas === 0) log.warn('[数据] 点子卡为 0 张，抽卡会提示"没有符合条件的卡片"。生成知识库后重启服务即可导入。');
  if (counts.tasks === 0) log.warn('[数据] 刮刮乐小任务为 0 条，刮刮乐会提示"还没有小任务"。');
  return counts;
}

function readJsonArray(file, log) {
  if (!fs.existsSync(file)) {
    log.warn(`[数据] 没找到 ${file}，本次跳过导入（库里已有的数据保留）。`);
    return null;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (Array.isArray(parsed)) return parsed;
    log.warn(`[数据] ${file} 的内容不是数组，本次跳过导入。`);
  } catch (err) {
    log.warn(`[数据] ${file} 不是有效的 JSON（${err.message}），本次跳过导入。`);
  }
  return null;
}

function isValidIdea(idea) {
  return idea && typeof idea.id === 'string' && (idea.kind === 'eat' || idea.kind === 'play');
}

function normalizeIdea(idea) {
  return {
    ...idea,
    tags: Array.isArray(idea.tags) ? idea.tags : [],
    budgetPerPerson: Number(idea.budgetPerPerson) || 0,
    durationMin: Number(idea.durationMin) || 60,
    rarity: ['common', 'rare', 'surprise'].includes(idea.rarity) ? idea.rarity : 'common',
  };
}
