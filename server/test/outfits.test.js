import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeApp, register, makeCouple } from './helpers.js';

const getOutfits = (api, user) => api.get('/api/outfits').set(user.auth).expect(200);
const sendRequest = (api, user, payload) => api.post('/api/outfits/requests').set(user.auth).send(payload);
const reply = (api, user, id, payload) => api.post(`/api/outfits/requests/${id}/reply`).set(user.auth).send(payload);

test('衣橱：校验风格、去重保存，对象能看到', async () => {
  const { api } = makeApp();
  const { inviter, invitee } = await makeCouple(api);

  await api.put('/api/outfits/wardrobe').set(inviter.auth).send({ styles: ['不存在'] }).expect(400);
  await api.put('/api/outfits/wardrobe').set(inviter.auth).send({ styles: 'jk' }).expect(400);
  await api
    .put('/api/outfits/wardrobe')
    .set(inviter.auth)
    .send({ styles: ['jk'], note: 'x'.repeat(101) })
    .expect(400);

  const saved = await api
    .put('/api/outfits/wardrobe')
    .set(inviter.auth)
    .send({ styles: ['jk', 'lolita', 'jk'], note: '  JK 有两套  ' })
    .expect(200);
  assert.deepEqual(saved.body, { styles: ['jk', 'lolita'], note: 'JK 有两套' });

  // 再存一次是覆盖，不是追加
  await api.put('/api/outfits/wardrobe').set(inviter.auth).send({ styles: ['hanfu'], note: '' }).expect(200);

  const seen = await getOutfits(api, invitee);
  assert.ok(seen.body.styles.length >= 20);
  assert.deepEqual(seen.body.mine, { styles: [], note: '' });
  assert.equal(seen.body.partner.user.nickname, '邀请方');
  assert.deepEqual(seen.body.partner.styles, ['hanfu']);
});

test('穿搭请求：没绑定不能发，风格和留言要合法', async () => {
  const { api } = makeApp();
  const single = await register(api, '单身', 'male');
  const r = await sendRequest(api, single, { styleId: 'jk' }).expect(409);
  assert.match(r.body.error, /绑定/);
  assert.deepEqual((await getOutfits(api, single)).body.partner, null);

  const { inviter } = await makeCouple(api);
  await sendRequest(api, inviter, { styleId: 'nope' }).expect(400);
  await sendRequest(api, inviter, { styleId: 'jk', message: '啊'.repeat(61) }).expect(400);
});

test('穿搭请求：TA 能收到并回一次，自己不能回，外人看不到', async () => {
  const { api, clock } = makeApp();
  const { inviter, invitee } = await makeCouple(api);
  const outsider = await register(api, '路人', 'male');

  const sent = (await sendRequest(api, invitee, { styleId: 'jk', message: ' 周六穿那套灰格子 ' }).expect(201)).body;
  assert.equal(sent.fromMe, true);
  assert.equal(sent.status, 'pending');
  assert.equal(sent.message, '周六穿那套灰格子');

  const inbox = (await getOutfits(api, inviter)).body.requests;
  assert.equal(inbox.length, 1);
  assert.equal(inbox[0].fromMe, false);
  assert.equal(inbox[0].styleId, 'jk');

  await reply(api, invitee, sent.id, { status: 'accepted' }).expect(404);
  await reply(api, outsider, sent.id, { status: 'accepted' }).expect(404);
  await reply(api, inviter, sent.id, { status: 'maybe' }).expect(400);

  clock.now += 1000;
  const done = await reply(api, inviter, sent.id, { status: 'accepted', reply: '安排！' }).expect(200);
  assert.equal(done.body.status, 'accepted');
  assert.equal(done.body.reply, '安排！');
  await reply(api, inviter, sent.id, { status: 'declined' }).expect(409);

  const back = (await getOutfits(api, invitee)).body.requests[0];
  assert.equal(back.status, 'accepted');
  assert.equal(back.reply, '安排！');
  assert.equal((await getOutfits(api, outsider)).body.requests.length, 0);
});

test('穿搭请求：解绑后看不到，衣橱还在', async () => {
  const { api } = makeApp();
  const { inviter, invitee } = await makeCouple(api);
  await api.put('/api/outfits/wardrobe').set(inviter.auth).send({ styles: ['jk'] }).expect(200);
  await sendRequest(api, invitee, { styleId: 'jk' }).expect(201);
  await api.delete('/api/couple').set(inviter.auth).expect(200);

  const after = (await getOutfits(api, inviter)).body;
  assert.equal(after.requests.length, 0);
  assert.equal(after.partner, null);
  assert.deepEqual(after.mine.styles, ['jk']);
});

const addStyle = (api, user, name) => api.post('/api/outfits/styles').set(user.auth).send({ name });

test('自定义风格：加的人衣橱里自动有，TA 能看到能点；校验名字、重名、上限', async () => {
  const { api } = makeApp();
  const { inviter, invitee } = await makeCouple(api);

  await addStyle(api, inviter, '').expect(400);
  await addStyle(api, inviter, '啊'.repeat(13)).expect(400);
  await addStyle(api, inviter, 'JK 制服').expect(409); // 和内置重名
  const camp = (await addStyle(api, inviter, ' 森系露营风 ').expect(201)).body;
  assert.equal(camp.name, '森系露营风');
  assert.equal(camp.mine, true);
  await addStyle(api, inviter, '森系露营风').expect(409);

  // 存衣橱时把自己的自定义风格一起传上来也没问题，它始终在衣橱里
  const saved = await api
    .put('/api/outfits/wardrobe')
    .set(inviter.auth)
    .send({ styles: ['jk', camp.id] })
    .expect(200);
  assert.deepEqual(saved.body.styles, ['jk', camp.id]);

  const seen = (await getOutfits(api, invitee)).body;
  const style = seen.styles.find((s) => s.id === camp.id);
  assert.equal(style.mine, false);
  assert.equal(style.desc, '邀请方 自己加的');
  assert.ok(seen.partner.styles.includes(camp.id));

  // 别人的自定义风格不能塞进自己的衣橱，也不能点给它的主人以外的人
  await api.put('/api/outfits/wardrobe').set(invitee.auth).send({ styles: [camp.id] }).expect(400);
  await sendRequest(api, inviter, { styleId: camp.id }).expect(400);
  const sent = (await sendRequest(api, invitee, { styleId: camp.id }).expect(201)).body;
  assert.equal(sent.styleName, '森系露营风');

  for (let i = 1; i < 20; i++) await addStyle(api, inviter, `风格${i}`).expect(201);
  const full = await addStyle(api, inviter, '第二十一种').expect(409);
  assert.match(full.body.error, /最多/);
});

test('自定义风格：只有加的人能删，删了以后历史请求还显示名字', async () => {
  const { api } = makeApp();
  const { inviter, invitee } = await makeCouple(api);
  const camp = (await addStyle(api, inviter, '森系露营风').expect(201)).body;
  await sendRequest(api, invitee, { styleId: camp.id }).expect(201);

  await api.delete(`/api/outfits/styles/${camp.id}`).set(invitee.auth).expect(404);
  await api.delete(`/api/outfits/styles/${camp.id}`).set(inviter.auth).expect(200);

  const after = (await getOutfits(api, inviter)).body;
  assert.ok(!after.styles.some((s) => s.id === camp.id));
  assert.ok(!after.mine.styles.includes(camp.id));
  assert.equal(after.requests[0].styleName, '森系露营风');
});

test('撤回请求：只有发的人能撤，TA 回过就撤不了', async () => {
  const { api } = makeApp();
  const { inviter, invitee } = await makeCouple(api);
  const a = (await sendRequest(api, invitee, { styleId: 'jk' }).expect(201)).body;
  const b = (await sendRequest(api, invitee, { styleId: 'hanfu' }).expect(201)).body;

  await api.delete(`/api/outfits/requests/${a.id}`).set(inviter.auth).expect(404);
  await api.delete(`/api/outfits/requests/${a.id}`).set(invitee.auth).expect(200);
  assert.deepEqual(
    (await getOutfits(api, inviter)).body.requests.map((r) => r.styleId),
    ['hanfu'],
  );

  await reply(api, inviter, b.id, { status: 'accepted' }).expect(200);
  const late = await api.delete(`/api/outfits/requests/${b.id}`).set(invitee.auth).expect(409);
  assert.match(late.body.error, /回过/);
});
