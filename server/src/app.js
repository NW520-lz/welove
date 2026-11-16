import crypto from 'node:crypto';
import express from 'express';
import cors from 'cors';
import * as game from './game.js';
import { planWithDeepSeek } from './ai.js';
import { renderSharePage, renderNotFoundPage } from './share.js';

const INVITE_TTL_MS = 24 * 60 * 60 * 1000;
const CARD_SLOTS = ['eat', 'play', 'blindbox'];
const GENDERS = { male: 'male', female: 'female', 男: 'male', 女: 'female' };

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function fail(status, message) {
  throw new HttpError(status, message);
}

// random：返回 [0,1) 的函数，所有游戏随机都走它；now：返回毫秒时间戳；
// planItinerary(context, signal)：AI 排行程，失败或超时走兜底。
export function createApp({
  db,
  random = Math.random,
  now = Date.now,
  planItinerary = planWithDeepSeek,
  aiTimeoutMs = 15000,
  log = console,
}) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // ---------- 数据读写 ----------

  const findUserByToken = (token) => db.prepare('SELECT * FROM users WHERE token = ?').get(token);
  const findUser = (id) => db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  const findCouple = (id) => db.prepare('SELECT * FROM couples WHERE id = ?').get(id);

  function loadDate(id) {
    const row = db.prepare('SELECT * FROM dates WHERE id = ?').get(id);
    return row && { ...row, state: JSON.parse(row.state) };
  }

  function saveDate(row) {
    db.prepare('UPDATE dates SET state = ? WHERE id = ?').run(JSON.stringify(row.state), row.id);
  }

  function allIdeas() {
    return db.prepare('SELECT data FROM ideas').all().map((r) => JSON.parse(r.data));
  }

  function partnerOf(user) {
    if (!user.couple_id) return null;
    const couple = findCouple(user.couple_id);
    return findUser(couple.inviter_id === user.id ? couple.invitee_id : couple.inviter_id);
  }

  const publicUser = (u) => ({ id: u.id, nickname: u.nickname, gender: u.gender });

  function randomCode(length, alphabet) {
    let code = '';
    for (let i = 0; i < length; i++) code += alphabet[crypto.randomInt(alphabet.length)];
    return code;
  }

  // ---------- 鉴权 ----------

  function auth(req, res, next) {
    const token = (req.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const user = token && findUserByToken(token);
    if (!user) fail(401, '请先登录');
    req.user = user;
    next();
  }

  const body = (req) => req.body || {};

  // ---------- 用户 ----------

  app.post('/api/users', (req, res) => {
    const nickname = String(body(req).nickname || '').trim();
    const gender = GENDERS[body(req).gender];
    if (!nickname || nickname.length > 20) fail(400, '昵称要填，最多 20 个字');
    if (!gender) fail(400, '请选择性别');

    const user = {
      id: crypto.randomUUID(),
      nickname,
      gender,
      token: crypto.randomBytes(24).toString('hex'),
      recovery_code: randomCode(8, 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'),
      created_at: now(),
    };
    db.prepare(
      'INSERT INTO users (id, nickname, gender, token, recovery_code, created_at) VALUES (@id, @nickname, @gender, @token, @recovery_code, @created_at)',
    ).run(user);
    res.status(201).json({ token: user.token, user: publicUser(user), recoveryCode: user.recovery_code });
  });

  app.post('/api/users/recover', (req, res) => {
    const code = String(body(req).recoveryCode || '').trim().toUpperCase();
    const user = code && db.prepare('SELECT * FROM users WHERE recovery_code = ?').get(code);
    if (!user) fail(404, '恢复码不对，再核对一下');
    res.json({ token: user.token, user: publicUser(user) });
  });

  app.get('/api/me', auth, (req, res) => {
    const me = req.user;
    const partner = partnerOf(me);
    res.json({
      user: publicUser(me),
      recoveryCode: me.recovery_code,
      partner: partner ? publicUser(partner) : null,
      preferencesSet: Boolean(me.preferences_set),
      preferences: { excludeTags: JSON.parse(me.exclude_tags), note: me.note },
    });
  });

  app.put('/api/me/preferences', auth, (req, res) => {
    const { excludeTags, note = '' } = body(req);
    if (!Array.isArray(excludeTags) || excludeTags.some((t) => !game.TAGS.includes(t))) {
      fail(400, '问卷选项不对，请重新选择');
    }
    if (typeof note !== 'string' || note.length > 200) fail(400, '备注最多 200 个字');
    const tags = [...new Set(excludeTags)];
    db.prepare('UPDATE users SET exclude_tags = ?, note = ?, preferences_set = 1 WHERE id = ?').run(
      JSON.stringify(tags),
      note.trim(),
      req.user.id,
    );
    res.json({ preferencesSet: true, preferences: { excludeTags: tags, note: note.trim() } });
  });

  // ---------- 绑定 ----------

  app.post('/api/couple/invite', auth, (req, res) => {
    if (req.user.couple_id) fail(409, '你已经绑定了对象');
    db.prepare('DELETE FROM invites WHERE user_id = ? OR expires_at <= ?').run(req.user.id, now());
    let code;
    do code = randomCode(6, '0123456789');
    while (db.prepare('SELECT 1 FROM invites WHERE code = ?').get(code));
    const expiresAt = now() + INVITE_TTL_MS;
    db.prepare('INSERT INTO invites (code, user_id, expires_at) VALUES (?, ?, ?)').run(code, req.user.id, expiresAt);
    res.status(201).json({ code, expiresAt });
  });

  app.post('/api/couple/join', auth, (req, res) => {
    const me = req.user;
    const code = String(body(req).code || '').trim();
    const invite = code && db.prepare('SELECT * FROM invites WHERE code = ?').get(code);
    if (!invite) fail(404, '邀请码不对，再核对一下');
    if (invite.expires_at <= now()) fail(410, '邀请码已过期，请对方重新生成');
    if (invite.user_id === me.id) fail(400, '不能和自己绑定哦');
    if (me.couple_id) fail(409, '你已经绑定了对象');
    const inviter = findUser(invite.user_id);
    if (inviter.couple_id) fail(409, '对方已经绑定了别人');

    const coupleId = crypto.randomUUID();
    db.transaction(() => {
      db.prepare('INSERT INTO couples (id, inviter_id, invitee_id, created_at) VALUES (?, ?, ?, ?)').run(
        coupleId,
        inviter.id,
        me.id,
        now(),
      );
      db.prepare('UPDATE users SET couple_id = ? WHERE id IN (?, ?)').run(coupleId, inviter.id, me.id);
      db.prepare('DELETE FROM invites WHERE code = ?').run(code);
    })();
    res.json({ partner: publicUser(inviter) });
  });

  app.delete('/api/couple', auth, (req, res) => {
    if (!req.user.couple_id) fail(409, '你还没有绑定对象');
    db.prepare('UPDATE users SET couple_id = NULL WHERE couple_id = ?').run(req.user.couple_id);
    res.json({ ok: true });
  });

  // ---------- 约会 ----------

  function myDate(req) {
    const row = loadDate(req.params.id);
    if (!row || !req.user.couple_id || row.couple_id !== req.user.couple_id) fail(404, '找不到这次约会');
    return row;
  }

  function dateView(row, me) {
    const s = row.state;
    return {
      id: row.id,
      shareId: row.share_id,
      sharePath: `/s/${row.share_id}`,
      date: s.date,
      startTime: s.startTime,
      createdBy: s.createdBy,
      createdAt: row.created_at,
      roles: s.roles,
      myRole: s.roles.eat === me.id ? 'eat' : 'play',
      dice: s.dice,
      budgetMax: s.budgetMax,
      cards: s.cards,
      task: s.task,
      vetoesLeft: s.vetoesLeft,
      confirmedBy: s.confirmedBy,
      generating: s.generating,
      itinerary: s.itinerary,
    };
  }

  function assertEditable(state) {
    if (state.itinerary || state.generating) fail(409, '行程已经定下来了，不能再改');
  }

  function drawCard(state, { kind = null, weighted = false }) {
    const [a, b] = [findUser(state.roles.eat), findUser(state.roles.play)];
    const excludeTags = game.unionTags(JSON.parse(a.exclude_tags), JSON.parse(b.exclude_tags));
    const currentIds = CARD_SLOTS.map((slot) => state.cards[slot]?.id).filter(Boolean);
    const pool = game.eligibleCards(allIdeas(), {
      kind,
      budgetMax: state.budgetMax,
      excludeTags,
      skipIds: [...state.rejectedIds, ...currentIds],
    });
    if (pool.length === 0) fail(409, '没有符合条件的卡片了，放宽问卷或换个预算再试试');
    return weighted ? game.pickByRarity(pool, random) : game.pickOne(pool, random);
  }

  app.post('/api/dates', auth, (req, res) => {
    const me = req.user;
    if (!me.couple_id) fail(409, '先绑定对象才能发起约会');
    const { date, startTime } = body(req);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) fail(400, '日期格式应为 YYYY-MM-DD');
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime || '')) fail(400, '出发时间格式应为 HH:MM');

    const couple = findCouple(me.couple_id);
    const roles = game.splitRoles(findUser(couple.inviter_id), findUser(couple.invitee_id));
    const row = {
      id: crypto.randomUUID(),
      couple_id: couple.id,
      share_id: crypto.randomBytes(6).toString('base64url'),
      created_at: now(),
      state: {
        date,
        startTime,
        createdBy: me.id,
        roles,
        dice: null,
        budgetMax: null,
        cards: { eat: null, play: null, blindbox: null },
        rejectedIds: [],
        task: null,
        vetoesLeft: { [roles.eat]: game.VETOES_PER_PERSON, [roles.play]: game.VETOES_PER_PERSON },
        confirmedBy: [],
        generating: false,
        itinerary: null,
      },
    };
    db.prepare('INSERT INTO dates (id, couple_id, share_id, state, created_at) VALUES (?, ?, ?, ?, ?)').run(
      row.id,
      row.couple_id,
      row.share_id,
      JSON.stringify(row.state),
      row.created_at,
    );
    res.status(201).json(dateView(row, me));
  });

  app.get('/api/dates', auth, (req, res) => {
    if (!req.user.couple_id) return res.json([]);
    const rows = db.prepare('SELECT * FROM dates WHERE couple_id = ? ORDER BY created_at DESC').all(req.user.couple_id);
    res.json(rows.map((r) => dateView({ ...r, state: JSON.parse(r.state) }, req.user)));
  });

  app.get('/api/dates/:id', auth, (req, res) => {
    res.json(dateView(myDate(req), req.user));
  });

  app.post('/api/dates/:id/dice', auth, (req, res) => {
    const row = myDate(req);
    const s = row.state;
    assertEditable(s);
    if (s.dice) fail(409, '这次约会已经掷过骰子了');
    s.dice = game.rollDice(random);
    s.budgetMax = game.budgetForDice(s.dice);
    saveDate(row);
    res.json(dateView(row, req.user));
  });

  app.post('/api/dates/:id/draw', auth, (req, res) => {
    const row = myDate(req);
    const s = row.state;
    const gameName = body(req).game;
    assertEditable(s);
    if (!s.dice) fail(409, '先掷骰子定预算');

    if (gameName === 'split') {
      const kind = s.roles.eat === req.user.id ? 'eat' : 'play';
      if (s.cards[kind]) fail(409, '你已经抽过了，不满意可以否决重抽');
      s.cards[kind] = drawCard(s, { kind });
    } else if (gameName === 'blindbox') {
      if (s.cards.blindbox) fail(409, '盲盒已经开过了');
      s.cards.blindbox = drawCard(s, { weighted: true });
    } else {
      fail(400, '玩法只能是 split 或 blindbox');
    }
    s.confirmedBy = []; // 卡片变了，之前的确认作废
    saveDate(row);
    res.json(dateView(row, req.user));
  });

  app.post('/api/dates/:id/scratch', auth, (req, res) => {
    const row = myDate(req);
    const s = row.state;
    assertEditable(s);
    if (s.task) fail(409, '刮刮乐已经刮过了');
    const tasks = db.prepare('SELECT id, text FROM tasks').all();
    if (tasks.length === 0) fail(409, '还没有小任务可以刮');
    s.task = game.pickOne(tasks, random);
    saveDate(row);
    res.json(dateView(row, req.user));
  });

  app.post('/api/dates/:id/veto', auth, (req, res) => {
    const row = myDate(req);
    const s = row.state;
    const slot = body(req).slot;
    assertEditable(s);
    if (!CARD_SLOTS.includes(slot)) fail(400, '要否决的卡片位置不对');
    if (!s.cards[slot]) fail(409, '这个位置还没有卡片');
    if (s.vetoesLeft[req.user.id] <= 0) fail(409, '你的 2 次否决机会已经用完了，这次就接受吧');

    const replacement = slot === 'blindbox' ? drawCard(s, { weighted: true }) : drawCard(s, { kind: slot });
    s.rejectedIds.push(s.cards[slot].id);
    s.cards[slot] = replacement;
    s.vetoesLeft[req.user.id] -= 1;
    s.confirmedBy = []; // 卡片变了，之前的确认作废
    saveDate(row);
    res.json(dateView(row, req.user));
  });

  app.post('/api/dates/:id/confirm', auth, async (req, res) => {
    const row = myDate(req);
    const s = row.state;
    if (!s.cards.eat || !s.cards.play) fail(409, '吃和玩两张卡都抽好才能确认');
    if (!s.confirmedBy.includes(req.user.id)) s.confirmedBy.push(req.user.id);

    const bothConfirmed = s.confirmedBy.length === 2;
    if (!bothConfirmed || s.itinerary || s.generating) {
      saveDate(row);
      return res.json(dateView(row, req.user));
    }

    s.generating = true;
    saveDate(row);
    const itinerary = await buildItinerary(s);
    const latest = loadDate(row.id);
    latest.state.itinerary = itinerary;
    latest.state.generating = false;
    saveDate(latest);
    res.json(dateView(latest, req.user));
  });

  async function buildItinerary(state) {
    const cards = CARD_SLOTS.map((slot) => state.cards[slot]).filter(Boolean);
    const notes = [findUser(state.roles.eat).note, findUser(state.roles.play).note].filter(Boolean);
    const context = { date: state.date, startTime: state.startTime, cards, task: state.task, notes };
    try {
      const plan = await withTimeout(context);
      if (!isValidPlan(plan)) throw new Error('AI 返回的行程格式不对');
      return { source: 'ai', items: plan.items, tips: Array.isArray(plan.tips) ? plan.tips.map(String) : [] };
    } catch (err) {
      log.warn(`[AI] 行程生成失败，改用兜底行程：${err.message}`);
      return { source: 'fallback', ...game.fallbackItinerary(context) };
    }
  }

  async function withTimeout(context) {
    const controller = new AbortController();
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new Error(`超过 ${aiTimeoutMs / 1000} 秒没有返回`));
      }, aiTimeoutMs);
    });
    try {
      return await Promise.race([planItinerary(context, controller.signal), timeout]);
    } finally {
      clearTimeout(timer);
    }
  }

  // ---------- 分享页 ----------

  app.get('/s/:shareId', (req, res) => {
    const row = db.prepare('SELECT * FROM dates WHERE share_id = ?').get(req.params.shareId);
    if (!row) return res.status(404).type('html').send(renderNotFoundPage());
    const state = JSON.parse(row.state);
    const names = [findUser(state.roles.eat), findUser(state.roles.play)].map((u) => u.nickname);
    res.type('html').send(renderSharePage(state, names));
  });

  // ---------- 兜底 ----------

  app.use('/api', (req, res) => res.status(404).json({ error: '接口不存在' }));

  app.use((err, req, res, next) => {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: '请求内容不是有效的 JSON' });
    log.error(err);
    res.status(500).json({ error: '服务器出错了，请稍后再试' });
  });

  return app;
}

function isValidPlan(plan) {
  return (
    plan &&
    Array.isArray(plan.items) &&
    plan.items.length > 0 &&
    plan.items.every((item) => item && typeof item.start === 'string' && typeof item.title === 'string')
  );
}
