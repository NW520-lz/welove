import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { openDb, importData } from '../src/db.js';
import { planWithDeepSeek } from '../src/ai.js';
import { fixturesDir } from './helpers.js';

function captureLog() {
  const lines = [];
  return { lines, warn: (m) => lines.push(m), error: (m) => lines.push(m), log: (m) => lines.push(m) };
}

test('导入样本数据：10 张卡、3 条任务', () => {
  const db = openDb();
  assert.deepEqual(importData(db, fixturesDir, captureLog()), { ideas: 10, tasks: 3 });
});

test('数据文件缺失时不崩溃，打出清楚的提示', () => {
  const db = openDb();
  const log = captureLog();
  const counts = importData(db, path.join(os.tmpdir(), 'no-such-dir-yuehui'), log);
  assert.deepEqual(counts, { ideas: 0, tasks: 0 });
  assert.ok(log.lines.some((l) => l.includes('没找到') && l.includes('ideas.json')));
  assert.ok(log.lines.some((l) => l.includes('没找到') && l.includes('tasks.json')));
});

test('数据文件缺失时保留库里已有的数据；JSON 坏掉也不崩溃', () => {
  const db = openDb();
  importData(db, fixturesDir, captureLog());
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'yuehui-'));
  fs.writeFileSync(path.join(dir, 'ideas.json'), '{ broken');
  const log = captureLog();
  assert.deepEqual(importData(db, dir, log), { ideas: 10, tasks: 3 });
  assert.ok(log.lines.some((l) => l.includes('不是有效的 JSON')));
});

test('DeepSeek：没配 Key 直接报错（由调用方走兜底）', async () => {
  await assert.rejects(planWithDeepSeek({ cards: [] }, undefined, { apiKey: '' }), /DEEPSEEK_API_KEY/);
});

test('DeepSeek：按 OpenAI 兼容格式请求 deepseek-flash（关闭思考）的 JSON 输出', async () => {
  let call;
  const fakeFetch = async (url, init) => {
    call = { url, init, body: JSON.parse(init.body) };
    return {
      ok: true,
      json: async () => ({ choices: [{ message: { content: '{"items":[{"start":"14:00","title":"x"}],"tips":[]}' } }] }),
    };
  };
  const context = { date: '2026-11-21', startTime: '14:00', cards: [{ id: 'a', title: 'A' }], task: null, notes: [] };
  const plan = await planWithDeepSeek(context, undefined, { apiKey: 'k', fetchImpl: fakeFetch });

  assert.equal(call.url, 'https://api.deepseek.com/chat/completions');
  assert.equal(call.init.headers.Authorization, 'Bearer k');
  assert.equal(call.body.model, 'deepseek-flash');
  assert.deepEqual(call.body.thinking, { type: 'disabled' });
  assert.deepEqual(call.body.response_format, { type: 'json_object' });
  assert.match(call.body.messages[0].content, /json/);
  assert.equal(plan.items[0].title, 'x');
});

test('DeepSeek：HTTP 出错或返回空内容都会抛错', async () => {
  const opts = (res) => ({ apiKey: 'k', fetchImpl: async () => res });
  const ctx = { cards: [], notes: [] };
  await assert.rejects(planWithDeepSeek(ctx, undefined, opts({ ok: false, status: 401 })), /401/);
  await assert.rejects(
    planWithDeepSeek(ctx, undefined, opts({ ok: true, json: async () => ({ choices: [{ message: { content: '' } }] }) })),
    /空内容/,
  );
});
