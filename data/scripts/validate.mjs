// 只读校验：node data/scripts/validate.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dataDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (name) => JSON.parse(fs.readFileSync(path.join(dataDir, name), "utf8"));

const KINDS = ["eat", "play"];
const CATEGORIES = ["美食", "小吃", "饮品", "景点", "手作", "娱乐", "运动", "文艺", "夜生活", "宅家"];
const CITIES = ["成都", "通用"];
const TIMES = ["morning", "afternoon", "evening", "night"];
const TAGS = ["辣", "海鲜", "生冷", "高体力", "刺激", "恐怖", "人多", "户外", "早起", "排队", "酒精"];
const RARITIES = ["common", "rare", "surprise"];

const errors = [];
const fail = (msg) => errors.push(msg);
const check = (cond, msg) => { if (!cond) fail(msg); };
const isNonEmptyString = (v) => typeof v === "string" && v.trim() !== "";
const isNonNegInt = (v) => Number.isInteger(v) && v >= 0;

function checkIdea(card, i) {
  const where = `ideas[${i}] ${card.id ?? "(无id)"}`;
  check(isNonEmptyString(card.id), `${where}: id 缺失`);
  check(isNonEmptyString(card.title), `${where}: title 缺失`);
  check(KINDS.includes(card.kind), `${where}: kind 非法 ${card.kind}`);
  check(CATEGORIES.includes(card.category), `${where}: category 非法 ${card.category}`);
  check(CITIES.includes(card.city), `${where}: city 非法 ${card.city}`);
  check(typeof card.area === "string", `${where}: area 必须是字符串`);
  check(typeof card.address === "string", `${where}: address 必须是字符串`);
  if (card.city === "成都") {
    check(isNonEmptyString(card.area), `${where}: 成都卡 area 不能为空`);
  } else {
    check(card.area === "" && card.address === "", `${where}: 通用卡 area/address 必须为空`);
  }
  check(isNonNegInt(card.budgetPerPerson), `${where}: budgetPerPerson 必须是非负整数`);
  check(Number.isInteger(card.durationMin) && card.durationMin > 0, `${where}: durationMin 必须是正整数`);
  check(Array.isArray(card.timeOfDay) && card.timeOfDay.length > 0 && card.timeOfDay.every((t) => TIMES.includes(t)), `${where}: timeOfDay 非法`);
  check(Array.isArray(card.tags) && card.tags.every((t) => TAGS.includes(t)), `${where}: tags 含词表外的值 ${JSON.stringify(card.tags)}`);
  check(Array.isArray(card.tags) && new Set(card.tags).size === card.tags.length, `${where}: tags 有重复`);
  check(RARITIES.includes(card.rarity), `${where}: rarity 非法 ${card.rarity}`);
  check(isNonEmptyString(card.description), `${where}: description 缺失`);
  check(card.source === "ai" || /^https?:\/\//.test(card.source ?? ""), `${where}: source 必须是 URL 或 ai`);
}

function countBy(list, keyFn) {
  const result = {};
  for (const item of list) {
    const key = keyFn(item);
    result[key] = (result[key] ?? 0) + 1;
  }
  return result;
}

const ideas = read("ideas.json");
const tasks = read("tasks.json");

check(Array.isArray(ideas), "ideas.json 必须是数组");
check(Array.isArray(tasks), "tasks.json 必须是数组");
ideas.forEach(checkIdea);

const ideaIds = ideas.map((c) => c.id);
check(new Set(ideaIds).size === ideaIds.length, "ideas id 有重复");

tasks.forEach((t, i) => {
  check(isNonEmptyString(t.id), `tasks[${i}]: id 缺失`);
  check(isNonEmptyString(t.text), `tasks[${i}]: text 缺失`);
});
const taskIds = tasks.map((t) => t.id);
check(new Set(taskIds).size === taskIds.length, "tasks id 有重复");

const chengdu = ideas.filter((c) => c.city === "成都");
const generic = ideas.filter((c) => c.city === "通用");
const chengduEat = chengdu.filter((c) => c.kind === "eat").length;
const chengduPlay = chengdu.length - chengduEat;
const eatShare = chengdu.length ? chengduEat / chengdu.length : 0;
const rarityShare = (list, r) => (list.length ? list.filter((c) => c.rarity === r).length / list.length : 0);

check(chengdu.length >= 150, `成都卡 ${chengdu.length} < 150`);
check(generic.length >= 50, `通用卡 ${generic.length} < 50`);
check(tasks.length >= 30, `任务 ${tasks.length} < 30`);
check(eatShare >= 0.4 && eatShare <= 0.6, `成都卡 eat 占比 ${(eatShare * 100).toFixed(0)}% 不在 40%-60%`);
check(Math.abs(rarityShare(ideas, "common") - 0.7) <= 0.1, "common 占比偏离 70% 超过 10 个百分点");
check(Math.abs(rarityShare(ideas, "rare") - 0.25) <= 0.1, "rare 占比偏离 25% 超过 10 个百分点");
check(Math.abs(rarityShare(ideas, "surprise") - 0.05) <= 0.03, "surprise 占比偏离 5% 超过 3 个百分点");

// 排除逻辑关键词的 tag 抽查：命中关键词却没打 tag 的卡
const MUST_TAG = [
  [/火锅|串串|麻辣|冒菜|钵钵鸡|兔头/, "辣"],
  [/蹦极|过山车|跳伞|卡丁车|滑雪/, "刺激"],
  [/密室/, "恐怖"],
];
for (const card of ideas) {
  const text = `${card.title}${card.description}`;
  for (const [pattern, tag] of MUST_TAG) {
    if (pattern.test(card.title) && !card.tags.includes(tag) && !/不辣|清汤|菌汤|牛肉火锅/.test(text)) {
      fail(`${card.id} 「${card.title}」疑似应打 tag「${tag}」`);
    }
  }
}

const pct = (n, total) => `${((n / total) * 100).toFixed(1)}%`;
console.log("=== 数量统计 ===");
console.log(`点子卡总数 ${ideas.length}（成都 ${chengdu.length} / 通用 ${generic.length}），任务 ${tasks.length}`);
console.log(`成都 eat/play: ${chengduEat}/${chengduPlay}`);
console.log("城市 x kind x rarity:");
console.table(countBy(ideas, (c) => `${c.city}/${c.kind}/${c.rarity}`));
console.log("稀有度占比:", Object.fromEntries(RARITIES.map((r) => [r, `${ideas.filter((c) => c.rarity === r).length} (${pct(ideas.filter((c) => c.rarity === r).length, ideas.length)})`])));
console.log("category:", countBy(ideas, (c) => c.category));
console.log("tag 使用:", countBy(ideas.flatMap((c) => c.tags), (t) => t));
console.log("source=ai:", ideas.filter((c) => c.source === "ai").length, " 有URL:", ideas.filter((c) => c.source !== "ai").length);

if (errors.length > 0) {
  console.log(`\n=== 校验失败 (${errors.length}) ===`);
  errors.forEach((e) => console.log("  - " + e));
  process.exit(1);
}
console.log("\n=== 校验全部通过 ===");
