// 约会玩法的纯规则：不碰数据库，不碰网络，随机函数由调用方传入。

export const TAGS = ['辣', '海鲜', '生冷', '高体力', '刺激', '恐怖', '人多', '户外', '早起', '排队', '酒精'];

// 骰子点数 1–6 对应的人均预算上限，null 表示不限
const DICE_BUDGETS = [50, 100, 150, 200, 300, null];

const RARITY_WEIGHTS = { common: 70, rare: 25, surprise: 5 };

export const VETOES_PER_PERSON = 2;
const TRAVEL_MINUTES = 30;

export function rollDice(random) {
  return Math.floor(random() * 6) + 1;
}

export function budgetForDice(value) {
  return DICE_BUDGETS[value - 1];
}

export function unionTags(...tagLists) {
  return [...new Set(tagLists.flat())];
}

// 过滤出可以参与抽取的卡：kind 对得上、没超预算、不命中任何排除 tag、不在跳过名单里
export function eligibleCards(cards, { kind = null, budgetMax = null, excludeTags = [], skipIds = [] }) {
  return cards.filter((card) => {
    if (kind && card.kind !== kind) return false;
    if (budgetMax !== null && card.budgetPerPerson > budgetMax) return false;
    if (card.tags.some((tag) => excludeTags.includes(tag))) return false;
    return !skipIds.includes(card.id);
  });
}

// 各抽一半：异性时男生抽吃；同性时邀请方抽吃
export function splitRoles(inviter, invitee) {
  if (inviter.gender !== invitee.gender) {
    const male = inviter.gender === 'male' ? inviter : invitee;
    const female = male === inviter ? invitee : inviter;
    return { eat: male.id, play: female.id };
  }
  return { eat: inviter.id, play: invitee.id };
}

export function pickOne(list, random) {
  return list[Math.floor(random() * list.length)];
}

// 盲盒：先按 70/25/5 选稀有度（只在有卡的稀有度之间分配），再在该稀有度里均匀抽
export function pickByRarity(cards, random) {
  const tiers = Object.keys(RARITY_WEIGHTS).filter((rarity) => cards.some((c) => c.rarity === rarity));
  const total = tiers.reduce((sum, rarity) => sum + RARITY_WEIGHTS[rarity], 0);
  let roll = random() * total;
  let chosen = tiers[tiers.length - 1];
  for (const rarity of tiers) {
    if (roll < RARITY_WEIGHTS[rarity]) {
      chosen = rarity;
      break;
    }
    roll -= RARITY_WEIGHTS[rarity];
  }
  return pickOne(cards.filter((c) => c.rarity === chosen), random);
}

// 从内置卡和心愿卡里挑一张：两边都有卡时一半概率抽心愿卡（均匀抽），否则按 pickBuiltin 抽内置卡
export function pickWithWishes(builtin, wishes, random, pickBuiltin) {
  if (wishes.length === 0) return pickBuiltin(builtin, random);
  if (builtin.length === 0 || random() < 0.5) return pickOne(wishes, random);
  return pickBuiltin(builtin, random);
}

// 兜底行程：按卡片顺序排，每段用卡片的 durationMin，段与段之间留 30 分钟路程
export function fallbackItinerary({ startTime, cards, task }) {
  let minutes = toMinutes(startTime);
  const items = cards.map((card, index) => {
    const start = minutes;
    const end = start + (card.durationMin || 60);
    minutes = end + TRAVEL_MINUTES;
    const isLast = index === cards.length - 1;
    return {
      start: formatMinutes(start),
      end: formatMinutes(end),
      title: card.title,
      cardId: card.id,
      address: card.address || card.area || '',
      detail: card.description || '',
      travel: isLast ? '' : `留 ${TRAVEL_MINUTES} 分钟路程去下一站`,
    };
  });
  const tips = ['出门前看一眼天气和营业时间。'];
  if (task) tips.push(`别忘了今天的小任务：${task.text}`);
  return { items, tips };
}

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function formatMinutes(total) {
  const dayMinutes = total % (24 * 60);
  const h = String(Math.floor(dayMinutes / 60)).padStart(2, '0');
  const m = String(dayMinutes % 60).padStart(2, '0');
  return `${h}:${m}`;
}
