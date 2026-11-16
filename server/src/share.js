// 公开分享页：服务端渲染的 HTML，手机浏览器直接打开。

const KIND_LABELS = { eat: '吃', play: '玩' };

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

const STYLE = `
  :root { --coral: #ff7a6b; --coral-soft: #ffe3de; --cream: #fff8f4; --ink: #4a3530; --muted: #9a7b74; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--cream); color: var(--ink);
    font-family: -apple-system, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif; line-height: 1.6; }
  .page { max-width: 480px; margin: 0 auto; padding: 24px 18px 40px; }
  .hero { background: linear-gradient(135deg, #ff8f80, var(--coral)); color: #fff; border-radius: 24px;
    padding: 28px 22px; box-shadow: 0 10px 24px rgba(255, 122, 107, .28); }
  .hero h1 { margin: 0 0 6px; font-size: 24px; }
  .hero p { margin: 0; opacity: .92; font-size: 14px; }
  .chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
  .chip { background: rgba(255,255,255,.22); border-radius: 999px; padding: 3px 12px; font-size: 13px; }
  h2 { font-size: 17px; margin: 28px 0 12px; }
  .timeline { list-style: none; margin: 0; padding: 0 0 0 22px; border-left: 3px dashed var(--coral-soft); }
  .stop { position: relative; background: #fff; border-radius: 18px; padding: 14px 16px; margin-bottom: 14px;
    box-shadow: 0 4px 14px rgba(74, 53, 48, .06); }
  .stop::before { content: ""; position: absolute; left: -32px; top: 18px; width: 15px; height: 15px; border-radius: 50%;
    background: var(--coral); border: 3px solid var(--cream); }
  .time { color: var(--coral); font-weight: 700; font-size: 14px; }
  .stop h3 { margin: 2px 0 4px; font-size: 16px; }
  .addr { color: var(--muted); font-size: 13px; }
  .detail { margin: 6px 0 0; font-size: 14px; }
  .travel { color: var(--muted); font-size: 13px; margin: -6px 0 14px 4px; }
  .box { background: #fff; border-radius: 18px; padding: 14px 16px; box-shadow: 0 4px 14px rgba(74, 53, 48, .06); }
  .box ul { margin: 0; padding-left: 20px; }
  .task { background: var(--coral-soft); border-radius: 18px; padding: 14px 16px; }
  footer { text-align: center; color: var(--muted); font-size: 12px; margin-top: 32px; }
`;

function layout(title, content) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#ff7a6b">
<title>${escapeHtml(title)}</title>
<style>${STYLE}</style>
</head>
<body><main class="page">${content}<footer>由「我们约会吧」生成 · 一起出门吧 ♥</footer></main></body>
</html>`;
}

export function renderSharePage(state, names) {
  const title = `${names.join(' & ')} 的约会`;
  const budget = state.budgetMax === null ? '预算不限' : `人均 ≤ ${state.budgetMax} 元`;
  const cards = ['eat', 'play', 'blindbox'].map((slot) => state.cards[slot]).filter(Boolean);
  const chips = cards.map((c) => `<span class="chip">${KIND_LABELS[c.kind] || ''} · ${escapeHtml(c.title)}</span>`).join('');

  const hero = `<section class="hero">
  <h1>${escapeHtml(title)}</h1>
  <p>${escapeHtml(state.date)} · ${escapeHtml(state.startTime)} 出发 · ${state.dice ? escapeHtml(budget) : '还没掷骰子'}</p>
  <div class="chips">${chips}</div>
</section>`;

  if (!state.itinerary) {
    return layout(title, `${hero}<h2>行程还在商量中</h2><div class="box">两个人都点「就这么定了」以后，这里会出现完整行程。</div>`);
  }

  const stops = state.itinerary.items
    .map(
      (item) => `<li class="stop">
  <div class="time">${escapeHtml(item.start)}${item.end ? ` – ${escapeHtml(item.end)}` : ''}</div>
  <h3>${escapeHtml(item.title)}</h3>
  ${item.address ? `<div class="addr">📍 ${escapeHtml(item.address)}</div>` : ''}
  ${item.detail ? `<p class="detail">${escapeHtml(item.detail)}</p>` : ''}
</li>${item.travel ? `<div class="travel">🚶 ${escapeHtml(item.travel)}</div>` : ''}`,
    )
    .join('\n');

  const tips = (state.itinerary.tips || []).map((t) => `<li>${escapeHtml(t)}</li>`).join('');
  const task = state.task ? `<h2>今日小任务</h2><div class="task">🎁 ${escapeHtml(state.task.text)}</div>` : '';

  return layout(
    title,
    `${hero}
<h2>行程时间线</h2>
<ol class="timeline">${stops}</ol>
${task}
${tips ? `<h2>小贴士</h2><div class="box"><ul>${tips}</ul></div>` : ''}`,
  );
}

export function renderNotFoundPage() {
  return layout('找不到这份行程', `<section class="hero"><h1>找不到这份行程</h1><p>链接可能不完整，找对方再要一次吧。</p></section>`);
}
