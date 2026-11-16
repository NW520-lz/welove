import path from 'node:path';
import { fileURLToPath } from 'node:url';
import request from 'supertest';
import { openDb, importData } from '../src/db.js';
import { createApp } from '../src/app.js';

export const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');

export const silentLog = { warn() {}, error() {}, log() {} };

// 可控的随机数：按顺序吐出 values 里的值，用完后返回 0
export function scriptedRandom() {
  const rng = { values: [], fn: () => (rng.values.length ? rng.values.shift() : 0) };
  return rng;
}

export function makeApp(options = {}) {
  const db = openDb();
  importData(db, fixturesDir, silentLog);
  const rng = scriptedRandom();
  const clock = { now: 1_700_000_000_000 };
  const app = createApp({
    db,
    random: rng.fn,
    now: () => clock.now,
    planItinerary: async () => {
      throw new Error('测试里默认不调 AI');
    },
    log: silentLog,
    ...options,
  });
  return { app, db, rng, clock, api: request(app) };
}

export async function register(api, nickname, gender) {
  const res = await api.post('/api/users').send({ nickname, gender }).expect(201);
  return { ...res.body, auth: { Authorization: `Bearer ${res.body.token}` } };
}

export async function setPrefs(api, user, excludeTags, note = '') {
  await api.put('/api/me/preferences').set(user.auth).send({ excludeTags, note }).expect(200);
}

// 注册并绑定一对：inviter 生成邀请码，invitee 输入
export async function makeCouple(api, inviterGender = 'female', inviteeGender = 'male') {
  const inviter = await register(api, '邀请方', inviterGender);
  const invitee = await register(api, '被邀请方', inviteeGender);
  const { body } = await api.post('/api/couple/invite').set(inviter.auth).expect(201);
  await api.post('/api/couple/join').set(invitee.auth).send({ code: body.code }).expect(200);
  return { inviter, invitee };
}

export async function newDate(api, user) {
  const res = await api.post('/api/dates').set(user.auth).send({ date: '2026-11-21', startTime: '14:00' }).expect(201);
  return res.body;
}
