import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeApp, register, makeCouple, newDate } from './helpers.js';
import { pickWithWishes, pickOne } from '../src/game.js';

function addWish(api, user, wish) {
  return api.post('/api/wishes').set(user.auth).send(wish);
}

test('心愿卡：添加时校验名字、吃/玩和人均价格', async () => {
  const { api } = makeApp();
  const me = await register(api, '小明', 'male');
  const r1 = await addWish(api, me, { title: '', kind: 'eat' }).expect(400);
  assert.match(r1.body.error, /名字/);
  await addWish(api, me, { title: '烤肉', kind: 'drink' }).expect(400);
  await addWish(api, me, { title: '烤肉', kind: 'eat', budgetPerPerson: 'abc' }).expect(400);

  const ok = await addWish(api, me, { title: '  烤肉  ', kind: 'eat', budgetPerPerson: '' }).expect(201);
  assert.equal(ok.body.title, '烤肉');
  assert.equal(ok.body.budgetPerPerson, null);
  assert.equal(ok.body.addedBy.nickname, '小明');
  const priced = await addWish(api, me, { title: '日料', kind: 'eat', budgetPerPerson: 180 }).expect(201);
  assert.equal(priced.body.budgetPerPerson, 180);
});

test('心愿卡：绑定的两人共用，谁都能删；外人看不到也删不了', async () => {
  const { api } = makeApp();
  const { inviter, invitee } = await makeCouple(api);
  const outsider = await register(api, '路人', 'male');
  const wish = (await addWish(api, inviter, { title: '去看海', kind: 'play' }).expect(201)).body;
  await addWish(api, invitee, { title: '吃烤肉', kind: 'eat' }).expect(201);

  const seen = await api.get('/api/wishes').set(invitee.auth).expect(200);
  assert.deepEqual(seen.body.map((w) => w.title).sort(), ['去看海', '吃烤肉'].sort());
  const outsiderSeen = await api.get('/api/wishes').set(outsider.auth).expect(200);
  assert.equal(outsiderSeen.body.length, 0);

  await api.delete(`/api/wishes/${wish.id}`).set(outsider.auth).expect(404);
  await api.delete(`/api/wishes/${wish.id}`).set(invitee.auth).expect(200);
  const after = await api.get('/api/wishes').set(inviter.auth).expect(200);
  assert.deepEqual(after.body.map((w) => w.title), ['吃烤肉']);
});

test('心愿卡：解绑后卡还在自己名下，只是不再共用', async () => {
  const { api } = makeApp();
  const { inviter, invitee } = await makeCouple(api);
  await addWish(api, inviter, { title: '去看海', kind: 'play' }).expect(201);
  await api.delete('/api/couple').set(invitee.auth).expect(200);

  assert.equal((await api.get('/api/wishes').set(inviter.auth).expect(200)).body.length, 1);
  assert.equal((await api.get('/api/wishes').set(invitee.auth).expect(200)).body.length, 0);
});

test('抽卡：有合适的心愿卡时一半概率抽到它，对方加的也算', async () => {
  const { api, rng } = makeApp();
  // 邀请方是女生、被邀请方是男生 → 男生抽吃
  const { inviter, invitee } = await makeCouple(api);
  await addWish(api, inviter, { title: '她想吃的烤肉', kind: 'eat' }).expect(201);
  await addWish(api, inviter, { title: '她想玩的卡丁车', kind: 'play' }).expect(201);
  const date = await newDate(api, inviter);
  rng.values.push(0.99); // 骰子 6 点，预算不限
  await api.post(`/api/dates/${date.id}/dice`).set(inviter.auth).expect(200);

  rng.values.push(0.1, 0); // < 0.5 → 抽心愿卡
  const res = await api.post(`/api/dates/${date.id}/draw`).set(invitee.auth).send({ game: 'split' }).expect(200);
  assert.equal(res.body.cards.eat.title, '她想吃的烤肉');
  assert.equal(res.body.cards.eat.category, '心愿卡');

  rng.values.push(0.7, 0); // >= 0.5 → 抽内置卡
  const res2 = await api.post(`/api/dates/${date.id}/draw`).set(inviter.auth).send({ game: 'split' }).expect(200);
  assert.notEqual(res2.body.cards.play.category, '心愿卡');
});

test('抽卡：心愿卡超出骰子预算就不参与', async () => {
  const { api, rng } = makeApp();
  const { inviter, invitee } = await makeCouple(api);
  await addWish(api, invitee, { title: '米其林', kind: 'eat', budgetPerPerson: 800 }).expect(201);
  const date = await newDate(api, inviter);
  rng.values.push(0); // 骰子 1 点，人均 50 以内
  await api.post(`/api/dates/${date.id}/dice`).set(inviter.auth).expect(200);

  rng.values.push(0); // 心愿卡池为空，这个值直接用来抽内置卡
  const res = await api.post(`/api/dates/${date.id}/draw`).set(invitee.auth).send({ game: 'split' }).expect(200);
  assert.notEqual(res.body.cards.eat.title, '米其林');
  assert.ok(res.body.cards.eat.budgetPerPerson <= 50);
});

test('pickWithWishes：某一边没卡就只用另一边', () => {
  const always = () => 0.9;
  assert.equal(pickWithWishes([], [{ id: 'w' }], always, pickOne).id, 'w');
  assert.equal(pickWithWishes([{ id: 'b' }], [], () => 0.1, pickOne).id, 'b');
});
