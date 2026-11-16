import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeApp, register, setPrefs, makeCouple, newDate } from './helpers.js';

// ---------- 注册与鉴权 ----------

test('注册返回 token 和恢复码，恢复码可以找回账号', async () => {
  const { api } = makeApp();
  const me = await register(api, '小明', 'male');
  assert.equal(me.user.gender, 'male');
  assert.match(me.recoveryCode, /^[A-Z0-9]{8}$/);

  const res = await api.post('/api/users/recover').send({ recoveryCode: me.recoveryCode.toLowerCase() }).expect(200);
  assert.equal(res.body.token, me.token);
  const bad = await api.post('/api/users/recover').send({ recoveryCode: 'NOPE' }).expect(404);
  assert.ok(bad.body.error);
});

test('注册参数不对返回中文错误', async () => {
  const { api } = makeApp();
  const r1 = await api.post('/api/users').send({ nickname: '', gender: 'male' }).expect(400);
  assert.match(r1.body.error, /昵称/);
  await api.post('/api/users').send({ nickname: 'a', gender: 'x' }).expect(400);
  await api.post('/api/users').set('Content-Type', 'application/json').send('{bad').expect(400);
});

test('没带 token 返回 401', async () => {
  const { api } = makeApp();
  const res = await api.get('/api/me').expect(401);
  assert.equal(res.body.error, '请先登录');
});

test('问卷只接受词表内的 tag，/api/me 能看到', async () => {
  const { api } = makeApp();
  const me = await register(api, '小明', 'male');
  await api.put('/api/me/preferences').set(me.auth).send({ excludeTags: ['不存在'] }).expect(400);
  await setPrefs(api, me, ['辣', '辣', '恐怖'], '不想太晚回家');
  const res = await api.get('/api/me').set(me.auth).expect(200);
  assert.equal(res.body.preferencesSet, true);
  assert.deepEqual(res.body.preferences, { excludeTags: ['辣', '恐怖'], note: '不想太晚回家' });
});

test('开放 CORS', async () => {
  const { api } = makeApp();
  const res = await api.options('/api/me').set('Origin', 'http://localhost:5173').expect(204);
  assert.equal(res.headers['access-control-allow-origin'], '*');
});

// ---------- 邀请码绑定 ----------

test('邀请码：输错、过期、自己绑自己都被拒绝', async () => {
  const { api, clock } = makeApp();
  const a = await register(api, 'A', 'female');
  const b = await register(api, 'B', 'male');
  const { body } = await api.post('/api/couple/invite').set(a.auth).expect(201);
  assert.match(body.code, /^\d{6}$/);

  const wrong = body.code === '000000' ? '111111' : '000000';
  const r1 = await api.post('/api/couple/join').set(b.auth).send({ code: wrong }).expect(404);
  assert.match(r1.body.error, /邀请码不对/);
  await api.post('/api/couple/join').set(a.auth).send({ code: body.code }).expect(400);

  clock.now += 24 * 60 * 60 * 1000;
  const r2 = await api.post('/api/couple/join').set(b.auth).send({ code: body.code }).expect(410);
  assert.match(r2.body.error, /过期/);
});

test('邀请码 24 小时内可以绑定，绑定后双方都能看到对象，可以解绑', async () => {
  const { api, clock } = makeApp();
  const a = await register(api, 'A', 'female');
  const b = await register(api, 'B', 'male');
  const { body } = await api.post('/api/couple/invite').set(a.auth).expect(201);
  clock.now += 23 * 60 * 60 * 1000;
  await api.post('/api/couple/join').set(b.auth).send({ code: body.code }).expect(200);

  const meA = await api.get('/api/me').set(a.auth).expect(200);
  assert.equal(meA.body.partner.nickname, 'B');
  // 已绑定的人不能再生成邀请码；邀请码用过就作废
  await api.post('/api/couple/invite').set(a.auth).expect(409);
  const c = await register(api, 'C', 'male');
  await api.post('/api/couple/join').set(c.auth).send({ code: body.code }).expect(404);

  await api.delete('/api/couple').set(b.auth).expect(200);
  const after = await api.get('/api/me').set(a.auth).expect(200);
  assert.equal(after.body.partner, null);
});

test('没绑定不能发起约会，别的情侣看不到这次约会', async () => {
  const { api } = makeApp();
  const lonely = await register(api, '单身', 'male');
  await api.post('/api/dates').set(lonely.auth).send({ date: '2026-11-21', startTime: '14:00' }).expect(409);

  const { inviter } = await makeCouple(api);
  const date = await newDate(api, inviter);
  const other = await makeCouple(api);
  await api.get(`/api/dates/${date.id}`).set(other.inviter.auth).expect(404);
});

// ---------- 骰子与各抽一半 ----------

test('先掷骰子才能抽卡，每次约会只能掷一次', async () => {
  const { api, rng } = makeApp();
  const { inviter } = await makeCouple(api);
  const date = await newDate(api, inviter);
  await api.post(`/api/dates/${date.id}/draw`).set(inviter.auth).send({ game: 'split' }).expect(409);

  rng.values = [0.2];
  const res = await api.post(`/api/dates/${date.id}/dice`).set(inviter.auth).expect(200);
  assert.equal(res.body.dice, 2);
  assert.equal(res.body.budgetMax, 100);
  await api.post(`/api/dates/${date.id}/dice`).set(inviter.auth).expect(409);
});

test('各抽一半：女方邀请时仍是男生抽吃、女生抽玩，每人只能抽自己那一半', async () => {
  const { api, rng } = makeApp();
  const { inviter: her, invitee: him } = await makeCouple(api, 'female', 'male');
  const date = await newDate(api, her);
  assert.deepEqual(date.roles, { eat: him.user.id, play: her.user.id });
  rng.values = [0.99];
  await api.post(`/api/dates/${date.id}/dice`).set(her.auth).expect(200);

  const herDraw = await api.post(`/api/dates/${date.id}/draw`).set(her.auth).send({ game: 'split' }).expect(200);
  assert.equal(herDraw.body.myRole, 'play');
  assert.equal(herDraw.body.cards.play.kind, 'play');
  assert.equal(herDraw.body.cards.eat, null);
  await api.post(`/api/dates/${date.id}/draw`).set(her.auth).send({ game: 'split' }).expect(409);

  const hisDraw = await api.post(`/api/dates/${date.id}/draw`).set(him.auth).send({ game: 'split' }).expect(200);
  assert.equal(hisDraw.body.cards.eat.kind, 'eat');
  // 抽出的卡对双方都可见
  const seen = await api.get(`/api/dates/${date.id}`).set(her.auth).expect(200);
  assert.equal(seen.body.cards.eat.id, hisDraw.body.cards.eat.id);
});

test('各抽一半：同性时邀请方抽吃', async () => {
  const { api, rng } = makeApp();
  const { inviter, invitee } = await makeCouple(api, 'male', 'male');
  const date = await newDate(api, invitee);
  rng.values = [0.99];
  await api.post(`/api/dates/${date.id}/dice`).set(invitee.auth).expect(200);
  const a = await api.post(`/api/dates/${date.id}/draw`).set(inviter.auth).send({ game: 'split' }).expect(200);
  assert.equal(a.body.cards.eat.kind, 'eat');
  const b = await api.post(`/api/dates/${date.id}/draw`).set(invitee.auth).send({ game: 'split' }).expect(200);
  assert.equal(b.body.cards.play.kind, 'play');
});

test('抽卡同时按两人排除 tag 的并集和骰子预算过滤', async () => {
  const { api, rng } = makeApp();
  const { inviter: her, invitee: him } = await makeCouple(api);
  await setPrefs(api, him, ['辣']);
  await setPrefs(api, her, ['生冷']);

  // 骰子 2 点 → 人均 ≤100。吃的卡里 ≤100 的有火锅(辣)、甜品、冰粉(生冷)，并集排除后只剩甜品，
  // 无论随机数是多少都只会抽到它
  for (const r of [0, 0.5, 0.99]) {
    const date = await newDate(api, her);
    rng.values = [0.2];
    await api.post(`/api/dates/${date.id}/dice`).set(her.auth).expect(200);
    rng.values = [r];
    const res = await api.post(`/api/dates/${date.id}/draw`).set(him.auth).send({ game: 'split' }).expect(200);
    assert.equal(res.body.cards.eat.id, 't-e3');

    // 只剩一张时否决会失败，而且不扣次数
    const veto = await api.post(`/api/dates/${date.id}/veto`).set(him.auth).send({ slot: 'eat' }).expect(409);
    assert.match(veto.body.error, /没有符合条件/);
    const view = await api.get(`/api/dates/${date.id}`).set(him.auth).expect(200);
    assert.equal(view.body.vetoesLeft[him.user.id], 2);
  }
});

// ---------- 盲盒、刮刮乐、否决 ----------

test('盲盒按稀有度加权抽，只能开一次', async () => {
  const { api, rng } = makeApp();
  const { inviter } = await makeCouple(api);
  const date = await newDate(api, inviter);
  rng.values = [0.99];
  await api.post(`/api/dates/${date.id}/dice`).set(inviter.auth).expect(200);
  rng.values = [0.99, 0];
  const res = await api.post(`/api/dates/${date.id}/draw`).set(inviter.auth).send({ game: 'blindbox' }).expect(200);
  assert.equal(res.body.cards.blindbox.rarity, 'surprise');
  await api.post(`/api/dates/${date.id}/draw`).set(inviter.auth).send({ game: 'blindbox' }).expect(409);
  await api.post(`/api/dates/${date.id}/draw`).set(inviter.auth).send({ game: 'wheel' }).expect(400);
});

test('刮刮乐得到一条小任务，只能刮一次', async () => {
  const { api, rng } = makeApp();
  const { inviter } = await makeCouple(api);
  const date = await newDate(api, inviter);
  rng.values = [0.5];
  const res = await api.post(`/api/dates/${date.id}/scratch`).set(inviter.auth).expect(200);
  assert.equal(res.body.task.id, 'task-2');
  await api.post(`/api/dates/${date.id}/scratch`).set(inviter.auth).expect(409);
});

test('否决：每人 2 次、两人分开计算，被否决的卡不会再抽到', async () => {
  const { api, rng } = makeApp();
  const { inviter: her, invitee: him } = await makeCouple(api);
  const date = await newDate(api, her);
  rng.values = [0.99];
  await api.post(`/api/dates/${date.id}/dice`).set(her.auth).expect(200);
  const first = await api.post(`/api/dates/${date.id}/draw`).set(her.auth).send({ game: 'split' }).expect(200);

  const seen = [first.body.cards.play.id];
  for (let i = 0; i < 2; i++) {
    const r = await api.post(`/api/dates/${date.id}/veto`).set(her.auth).send({ slot: 'play' }).expect(200);
    assert.ok(!seen.includes(r.body.cards.play.id), '被否决的卡又出现了');
    seen.push(r.body.cards.play.id);
  }
  const third = await api.post(`/api/dates/${date.id}/veto`).set(her.auth).send({ slot: 'play' }).expect(409);
  assert.match(third.body.error, /用完/);

  // 男方的次数不受影响，也可以否决女方抽的卡
  const his = await api.post(`/api/dates/${date.id}/veto`).set(him.auth).send({ slot: 'play' }).expect(200);
  assert.deepEqual(his.body.vetoesLeft, { [him.user.id]: 1, [her.user.id]: 0 });

  await api.post(`/api/dates/${date.id}/veto`).set(him.auth).send({ slot: 'eat' }).expect(409);
  await api.post(`/api/dates/${date.id}/veto`).set(him.auth).send({ slot: 'xx' }).expect(400);
});

// ---------- 确认与行程 ----------

async function readyDate(api, rng) {
  const { inviter: her, invitee: him } = await makeCouple(api);
  const date = await newDate(api, her);
  rng.values = [0.99];
  await api.post(`/api/dates/${date.id}/dice`).set(her.auth).expect(200);
  await api.post(`/api/dates/${date.id}/draw`).set(her.auth).send({ game: 'split' }).expect(200);
  await api.post(`/api/dates/${date.id}/draw`).set(him.auth).send({ game: 'split' }).expect(200);
  await api.post(`/api/dates/${date.id}/scratch`).set(her.auth).expect(200);
  return { her, him, date };
}

test('两张卡没抽齐不能确认', async () => {
  const { api } = makeApp();
  const { inviter } = await makeCouple(api);
  const date = await newDate(api, inviter);
  await api.post(`/api/dates/${date.id}/confirm`).set(inviter.auth).expect(409);
});

test('两人都确认才生成行程；AI 失败时走兜底；定下后不能再改', async () => {
  const { api, rng } = makeApp();
  const { her, him, date } = await readyDate(api, rng);

  const one = await api.post(`/api/dates/${date.id}/confirm`).set(her.auth).expect(200);
  assert.deepEqual(one.body.confirmedBy, [her.user.id]);
  assert.equal(one.body.itinerary, null);

  const both = await api.post(`/api/dates/${date.id}/confirm`).set(him.auth).expect(200);
  assert.equal(both.body.itinerary.source, 'fallback');
  assert.equal(both.body.itinerary.items.length, 2);
  assert.equal(both.body.itinerary.items[0].start, '14:00');

  await api.post(`/api/dates/${date.id}/veto`).set(him.auth).send({ slot: 'eat' }).expect(409);
  await api.post(`/api/dates/${date.id}/draw`).set(him.auth).send({ game: 'blindbox' }).expect(409);
  const list = await api.get('/api/dates').set(him.auth).expect(200);
  assert.equal(list.body.length, 1);
});

test('一方确认后卡片又变了，确认作废，要重新确认', async () => {
  const { api, rng } = makeApp();
  const { her, him, date } = await readyDate(api, rng);
  await api.post(`/api/dates/${date.id}/confirm`).set(her.auth).expect(200);
  const vetoed = await api.post(`/api/dates/${date.id}/veto`).set(him.auth).send({ slot: 'eat' }).expect(200);
  assert.deepEqual(vetoed.body.confirmedBy, []);
  const res = await api.post(`/api/dates/${date.id}/confirm`).set(him.auth).expect(200);
  assert.equal(res.body.itinerary, null);
});

test('AI 正常返回时使用 AI 行程，并把卡片、小任务、备注传给它', async () => {
  let received;
  const { api, rng } = makeApp({
    planItinerary: async (context) => {
      received = context;
      return { items: [{ start: '14:00', end: '16:00', title: 'AI 排的第一站' }], tips: ['带伞'] };
    },
  });
  const { her, him, date } = await readyDate(api, rng);
  await setPrefs(api, her, [], '不想走太远');
  await api.post(`/api/dates/${date.id}/confirm`).set(her.auth).expect(200);
  const res = await api.post(`/api/dates/${date.id}/confirm`).set(him.auth).expect(200);
  assert.equal(res.body.itinerary.source, 'ai');
  assert.equal(res.body.itinerary.items[0].title, 'AI 排的第一站');
  assert.equal(received.cards.length, 2);
  assert.ok(received.task.text);
  assert.deepEqual(received.notes, ['不想走太远']);
});

test('AI 超时走兜底，并中止请求', async () => {
  let signalSeen;
  const { api, rng } = makeApp({
    aiTimeoutMs: 50,
    planItinerary: (context, signal) => {
      signalSeen = signal;
      return new Promise(() => {});
    },
  });
  const { her, him, date } = await readyDate(api, rng);
  await api.post(`/api/dates/${date.id}/confirm`).set(her.auth).expect(200);
  const res = await api.post(`/api/dates/${date.id}/confirm`).set(him.auth).expect(200);
  assert.equal(res.body.itinerary.source, 'fallback');
  assert.equal(signalSeen.aborted, true);
});

test('AI 返回格式不对也走兜底', async () => {
  const { api, rng } = makeApp({ planItinerary: async () => ({ items: [] }) });
  const { her, him, date } = await readyDate(api, rng);
  await api.post(`/api/dates/${date.id}/confirm`).set(her.auth).expect(200);
  const res = await api.post(`/api/dates/${date.id}/confirm`).set(him.auth).expect(200);
  assert.equal(res.body.itinerary.source, 'fallback');
});

// ---------- 分享页 ----------

test('分享页：无需登录，返回带时间线的 HTML；未知链接 404', async () => {
  const { api, rng } = makeApp();
  const { her, him, date } = await readyDate(api, rng);
  const before = await api.get(date.sharePath).expect(200);
  assert.match(before.text, /行程还在商量中/);

  await api.post(`/api/dates/${date.id}/confirm`).set(her.auth).expect(200);
  const done = await api.post(`/api/dates/${date.id}/confirm`).set(him.auth).expect(200);
  const page = await api.get(date.sharePath).expect(200).expect('Content-Type', /html/);
  assert.match(page.text, /name="viewport"/);
  assert.match(page.text, /行程时间线/);
  assert.ok(page.text.includes(done.body.itinerary.items[0].title));

  await api.get('/s/not-exist').expect(404);
});

test('分享页对用户内容做 HTML 转义', async () => {
  const { api, rng } = makeApp();
  const a = await register(api, '<script>x</script>', 'female');
  const b = await register(api, 'B', 'male');
  const { body } = await api.post('/api/couple/invite').set(a.auth).expect(201);
  await api.post('/api/couple/join').set(b.auth).send({ code: body.code }).expect(200);
  const date = await newDate(api, a);
  rng.values = [0.99];
  const page = await api.get(date.sharePath).expect(200);
  assert.ok(!page.text.includes('<script>x</script>'));
  assert.ok(page.text.includes('&lt;script&gt;'));
});
