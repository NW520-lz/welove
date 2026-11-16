import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as game from '../src/game.js';
import { fixturesDir } from './helpers.js';

const cards = JSON.parse(fs.readFileSync(path.join(fixturesDir, 'ideas.json'), 'utf8'));
const ids = (list) => list.map((c) => c.id).sort();

test('骰子点数对应预算上限 50/100/150/200/300/不限', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6].map(game.budgetForDice), [50, 100, 150, 200, 300, null]);
  assert.equal(game.rollDice(() => 0), 1);
  assert.equal(game.rollDice(() => 0.999), 6);
});

test('两人的排除 tag 取并集，命中任意一个的卡都不参与', () => {
  const union = game.unionTags(['辣'], ['恐怖', '辣']);
  assert.deepEqual(union.sort(), ['恐怖', '辣'].sort());
  const pool = game.eligibleCards(cards, { excludeTags: union });
  assert.ok(!pool.some((c) => c.tags.includes('辣') || c.tags.includes('恐怖')));
  assert.equal(pool.length, 8); // 去掉火锅和密室
});

test('预算过滤：超过上限的卡不参与，不限时全部参与', () => {
  assert.deepEqual(ids(game.eligibleCards(cards, { kind: 'eat', budgetMax: 50 })), ['t-e3', 't-e4']);
  assert.equal(game.eligibleCards(cards, { budgetMax: null }).length, 10);
  assert.deepEqual(ids(game.eligibleCards(cards, { kind: 'play', budgetMax: 100 })), ['t-p1', 't-p5']);
});

test('各抽一半：异性时男生抽吃，与谁是邀请方无关', () => {
  const her = { id: 'f', gender: 'female' };
  const him = { id: 'm', gender: 'male' };
  assert.deepEqual(game.splitRoles(her, him), { eat: 'm', play: 'f' });
  assert.deepEqual(game.splitRoles(him, her), { eat: 'm', play: 'f' });
});

test('各抽一半：同性时邀请方抽吃', () => {
  assert.deepEqual(game.splitRoles({ id: 'a', gender: 'male' }, { id: 'b', gender: 'male' }), { eat: 'a', play: 'b' });
  assert.deepEqual(game.splitRoles({ id: 'a', gender: 'female' }, { id: 'b', gender: 'female' }), { eat: 'a', play: 'b' });
});

test('盲盒按 70/25/5 加权选稀有度', () => {
  const pick = (r) => game.pickByRarity(cards, () => r).rarity;
  assert.equal(pick(0.0), 'common');
  assert.equal(pick(0.69), 'common');
  assert.equal(pick(0.71), 'rare');
  assert.equal(pick(0.94), 'rare');
  assert.equal(pick(0.96), 'surprise');
});

test('盲盒：某个稀有度没有卡时在剩下的稀有度之间重新分配', () => {
  const noSurprise = cards.filter((c) => c.rarity !== 'surprise');
  assert.equal(game.pickByRarity(noSurprise, () => 0.99).rarity, 'rare');
  const onlySurprise = cards.filter((c) => c.rarity === 'surprise');
  assert.equal(game.pickByRarity(onlySurprise, () => 0).rarity, 'surprise');
});

test('兜底行程：按 durationMin 依次排，每段之间留 30 分钟路程', () => {
  const plan = game.fallbackItinerary({
    startTime: '14:00',
    cards: [cards[2], cards[8]], // 甜品 60 分钟，陶艺 120 分钟
    task: { id: 'x', text: '牵手' },
  });
  assert.deepEqual(
    plan.items.map((i) => [i.start, i.end]),
    [
      ['14:00', '15:00'],
      ['15:30', '17:30'],
    ],
  );
  assert.ok(plan.items[0].travel.includes('30'));
  assert.equal(plan.items[1].travel, '');
  assert.ok(plan.tips.some((t) => t.includes('牵手')));
});

test('兜底行程跨过午夜时显示次日钟点', () => {
  const plan = game.fallbackItinerary({ startTime: '23:30', cards: [cards[4]], task: null });
  assert.deepEqual([plan.items[0].start, plan.items[0].end], ['23:30', '01:30']);
});
