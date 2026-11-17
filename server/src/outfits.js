import crypto from 'node:crypto';

// 穿搭风格清单。for：适合谁穿（female / male / any），客户端按穿的人性别筛选。
export const STYLES = [
  { id: 'jk', name: 'JK 制服', for: 'female', desc: '水手服或西式制服配百褶裙，青春学生气' },
  { id: 'lolita', name: '洛丽塔', for: 'female', desc: '蓬蓬裙加裙撑和蕾丝头饰，像童话里走出来' },
  { id: 'landmine', name: '地雷系', for: 'female', desc: '黑粉配色、大蝴蝶结，甜里带一点丧' },
  { id: 'sweet', name: '甜美可爱', for: 'female', desc: '粉色、泡泡袖、蝴蝶结，一眼就心软' },
  { id: 'french', name: '法式慵懒', for: 'female', desc: '碎花裙配针织开衫，随性又有味道' },
  { id: 'korean', name: '韩系温柔', for: 'female', desc: '奶油色针织配长裙，温温柔柔' },
  { id: 'mori', name: '日系森女', for: 'female', desc: '棉麻、大地色、宽松叠穿，像去野餐' },
  { id: 'y2k', name: '辣妹 Y2K', for: 'female', desc: '短上衣、低腰裤、亮色配饰，千禧年的张扬' },
  { id: 'chunyu', name: '纯欲风', for: 'female', desc: '白色吊带加薄开衫，干净又有点撩' },
  { id: 'sweetcool', name: '甜酷风', for: 'female', desc: '短裙配马丁靴和皮衣，可爱但不好惹' },
  { id: 'ballet', name: '芭蕾风', for: 'female', desc: '纱裙、绑带平底鞋、丸子头' },
  { id: 'office', name: '御姐通勤', for: 'female', desc: '西装外套、细高跟，气场全开' },
  { id: 'qipao', name: '旗袍', for: 'female', desc: '修身立领，温婉又惊艳' },
  { id: 'gothic', name: '哥特暗黑', for: 'female', desc: '黑色蕾丝、深色唇，神秘感拉满' },
  { id: 'cityboy', name: 'City Boy', for: 'male', desc: '宽松衬衫配阔腿裤，松弛清爽' },
  { id: 'amekaji', name: '美式复古', for: 'male', desc: '牛仔、工装夹克、棒球帽' },
  { id: 'oldmoney', name: '老钱风', for: 'male', desc: '针织 Polo、卡其裤、乐福鞋，低调的贵' },
  { id: 'workwear', name: '工装机能', for: 'male', desc: '多口袋、冲锋衣、机能裤，能打能扛' },
  { id: 'gentleman', name: '西装绅士', for: 'male', desc: '合身西装和皮鞋，正式场合的帅' },
  { id: 'cleanfit', name: '干净少年感', for: 'male', desc: '白 T、浅色牛仔、小白鞋' },
  { id: 'street', name: '街头潮牌', for: 'male', desc: 'oversize 卫衣配球鞋' },
  { id: 'hanfu', name: '汉服', for: 'any', desc: '交领右衽、宽袖飘逸，一起去拍古风照' },
  { id: 'newchinese', name: '新中式', for: 'any', desc: '盘扣立领、马面裙或中式外套' },
  { id: 'hongkong', name: '复古港风', for: 'any', desc: '高腰裤、大垫肩，像老港片' },
  { id: 'sporty', name: '运动休闲', for: 'any', desc: '卫衣运动裤，舒服到能走一天' },
  { id: 'couple', name: '情侣装', for: 'any', desc: '同色或同款，一看就是一对' },
  { id: 'pajamas', name: '居家睡衣', for: 'any', desc: '软乎乎的睡衣，适合宅家约会' },
  { id: 'cosplay', name: 'Cosplay', for: 'any', desc: '扮成 TA 最喜欢的角色' },
];

const STYLE_IDS = new Set(STYLES.map((s) => s.id));
const REPLY_STATUSES = ['accepted', 'declined'];
const MAX_MESSAGE = 60;
const MAX_NOTE = 100;
const MAX_CUSTOM_NAME = 12;
const MAX_CUSTOM_PER_USER = 20;
const RECENT_REQUESTS = 50;

// 「想看你穿」：衣橱 + 穿搭请求。依赖由 app.js 传进来，和其它路由共用鉴权与报错方式。
export function registerOutfitRoutes(app, { db, auth, fail, partnerOf, publicUser, now }) {
  const body = (req) => req.body || {};

  // 自定义风格：谁加的就算谁衣橱里有，只有加的人能删
  const customRows = (userId) =>
    db.prepare('SELECT * FROM custom_styles WHERE owner_id = ? ORDER BY created_at').all(userId);

  const customStyle = (row, owner, me) => ({
    id: row.id,
    name: row.name,
    for: 'any',
    desc: row.owner_id === me.id ? '我自己加的' : `${owner.nickname} 自己加的`,
    custom: true,
    mine: row.owner_id === me.id,
  });

  // 衣橱 = 勾选的内置风格 + 自己加的风格
  function wardrobeOf(userId) {
    const row = db.prepare('SELECT styles, note FROM wardrobes WHERE user_id = ?').get(userId);
    const saved = row ? JSON.parse(row.styles) : [];
    return { styles: [...saved, ...customRows(userId).map((c) => c.id)], note: row ? row.note : '' };
  }

  // 风格 id 对应的名字：内置风格，或者指定的人加的自定义风格
  function styleNameFor(styleId, ownerId) {
    const builtin = STYLES.find((s) => s.id === styleId);
    if (builtin) return builtin.name;
    const custom = db.prepare('SELECT name FROM custom_styles WHERE id = ? AND owner_id = ?').get(styleId, ownerId);
    return custom ? custom.name : null;
  }

  function messageText(value, max, label) {
    const text = String(value ?? '').trim();
    if (text.length > max) fail(400, `${label}最多 ${max} 个字`);
    return text;
  }

  const publicRequest = (row, me) => ({
    id: row.id,
    fromMe: row.from_id === me.id,
    styleId: row.style_id,
    styleName: row.style_name,
    message: row.message,
    status: row.status,
    reply: row.reply,
    createdAt: row.created_at,
    repliedAt: row.replied_at,
  });

  app.get('/api/outfits', auth, (req, res) => {
    const me = req.user;
    const partner = partnerOf(me);
    const requests = partner
      ? db
          .prepare(
            `SELECT * FROM outfit_requests
             WHERE (from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?)
             ORDER BY created_at DESC LIMIT ${RECENT_REQUESTS}`,
          )
          .all(me.id, partner.id, partner.id, me.id)
      : [];
    const customs = [
      ...customRows(me.id).map((r) => customStyle(r, me, me)),
      ...(partner ? customRows(partner.id).map((r) => customStyle(r, partner, me)) : []),
    ];
    res.json({
      styles: [...STYLES, ...customs],
      mine: wardrobeOf(me.id),
      partner: partner ? { user: publicUser(partner), ...wardrobeOf(partner.id) } : null,
      requests: requests.map((r) => publicRequest(r, me)),
    });
  });

  app.put('/api/outfits/wardrobe', auth, (req, res) => {
    const { styles } = body(req);
    // 自己加的风格本来就在衣橱里，传上来就忽略；其它不认识的 id 报错
    const myCustomIds = new Set(customRows(req.user.id).map((c) => c.id));
    if (!Array.isArray(styles) || styles.some((id) => !STYLE_IDS.has(id) && !myCustomIds.has(id))) {
      fail(400, '风格选项不对，请重新选择');
    }
    const note = messageText(body(req).note, MAX_NOTE, '备注');
    const unique = [...new Set(styles)].filter((id) => STYLE_IDS.has(id));
    db.prepare(
      `INSERT INTO wardrobes (user_id, styles, note) VALUES (?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET styles = excluded.styles, note = excluded.note`,
    ).run(req.user.id, JSON.stringify(unique), note);
    res.json(wardrobeOf(req.user.id));
  });

  app.post('/api/outfits/styles', auth, (req, res) => {
    const me = req.user;
    const name = String(body(req).name ?? '').trim();
    if (!name || name.length > MAX_CUSTOM_NAME) fail(400, `风格名字要填，最多 ${MAX_CUSTOM_NAME} 个字`);
    const mine = customRows(me.id);
    if (mine.length >= MAX_CUSTOM_PER_USER) fail(409, `最多加 ${MAX_CUSTOM_PER_USER} 种，先删掉不穿的吧`);
    if (STYLES.some((s) => s.name === name) || mine.some((c) => c.name === name)) fail(409, '已经有这种风格了');
    const row = { id: crypto.randomUUID(), owner_id: me.id, name, created_at: now() };
    db.prepare('INSERT INTO custom_styles (id, owner_id, name, created_at) VALUES (@id, @owner_id, @name, @created_at)').run(row);
    res.status(201).json(customStyle(row, me, me));
  });

  app.delete('/api/outfits/styles/:id', auth, (req, res) => {
    const row = db.prepare('SELECT * FROM custom_styles WHERE id = ?').get(req.params.id);
    if (!row || row.owner_id !== req.user.id) fail(404, '找不到这种风格，只有加的人能删');
    db.prepare('DELETE FROM custom_styles WHERE id = ?').run(row.id);
    res.json({ ok: true });
  });

  app.post('/api/outfits/requests', auth, (req, res) => {
    const me = req.user;
    const partner = partnerOf(me);
    if (!partner) fail(409, '先绑定对象才能点穿搭');
    const styleId = String(body(req).styleId ?? '');
    // 自定义风格只能点 TA 自己加的
    const styleName = styleNameFor(styleId, partner.id);
    if (!styleName) fail(400, '选一种风格再发');
    const row = {
      id: crypto.randomUUID(),
      from_id: me.id,
      to_id: partner.id,
      style_id: styleId,
      style_name: styleName,
      message: messageText(body(req).message, MAX_MESSAGE, '想说的话'),
      status: 'pending',
      reply: '',
      created_at: now(),
      replied_at: null,
    };
    db.prepare(
      `INSERT INTO outfit_requests (id, from_id, to_id, style_id, style_name, message, status, reply, created_at, replied_at)
       VALUES (@id, @from_id, @to_id, @style_id, @style_name, @message, @status, @reply, @created_at, @replied_at)`,
    ).run(row);
    res.status(201).json(publicRequest(row, me));
  });

  // 撤回：只有发的人能撤，TA 还没回应才能撤
  app.delete('/api/outfits/requests/:id', auth, (req, res) => {
    const row = db.prepare('SELECT * FROM outfit_requests WHERE id = ?').get(req.params.id);
    if (!row || row.from_id !== req.user.id) fail(404, '找不到这条穿搭请求');
    if (row.status !== 'pending') fail(409, 'TA 已经回过了，撤不回来啦');
    db.prepare('DELETE FROM outfit_requests WHERE id = ?').run(row.id);
    res.json({ ok: true });
  });

  app.post('/api/outfits/requests/:id/reply', auth, (req, res) => {
    const me = req.user;
    const row = db.prepare('SELECT * FROM outfit_requests WHERE id = ?').get(req.params.id);
    if (!row || row.to_id !== me.id) fail(404, '找不到这条穿搭请求');
    if (row.status !== 'pending') fail(409, '已经回过了');
    const status = body(req).status;
    if (!REPLY_STATUSES.includes(status)) fail(400, '回应只能是「安排」或「下次吧」');
    row.status = status;
    row.reply = messageText(body(req).reply, MAX_MESSAGE, '回复');
    row.replied_at = now();
    db.prepare('UPDATE outfit_requests SET status = ?, reply = ?, replied_at = ? WHERE id = ?').run(
      row.status,
      row.reply,
      row.replied_at,
      row.id,
    );
    res.json(publicRequest(row, me));
  });
}
