// DeepSeek 排行程。OpenAI 兼容接口，模型 deepseek-flash（关闭思考模式），JSON Output 模式。
// deepseek-chat 已于 2026-07-24 下线：https://api-docs.deepseek.com/updates
// 文档：https://api-docs.deepseek.com/zh-cn/guides/json_mode
// 任何失败都直接抛错，由调用方走兜底行程。

const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';

const SYSTEM_PROMPT = `你是一个成都本地的约会行程规划师。用户会给你一次情侣约会的日期、出发时间、抽中的活动卡片、一条小任务和两人的特别备注。
请按合理的先后顺序把卡片排成一天的行程，写清每段的起止时间、两段之间怎么走（交通方式和大约用时），再给 2-4 条贴心小贴士。
只使用用户给出的卡片，不要新增地点。请输出 json，格式如下：
{
  "items": [
    {"start": "14:00", "end": "15:30", "title": "卡片标题", "cardId": "卡片 id", "address": "地址", "detail": "这一段做什么，一两句话", "travel": "去下一站：打车约 20 分钟（最后一段留空）"}
  ],
  "tips": ["小贴士"]
}`;

export async function planWithDeepSeek(context, signal, { apiKey = process.env.DEEPSEEK_API_KEY, fetchImpl = fetch } = {}) {
  if (!apiKey) throw new Error('没有配置 DEEPSEEK_API_KEY');

  const userInput = {
    date: context.date,
    startTime: context.startTime,
    cards: context.cards.map((card) => ({
      id: card.id,
      title: card.title,
      kind: card.kind,
      area: card.area,
      address: card.address,
      durationMin: card.durationMin,
      timeOfDay: card.timeOfDay,
      description: card.description,
    })),
    task: context.task ? context.task.text : null,
    notes: context.notes,
  };

  const response = await fetchImpl(DEEPSEEK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'deepseek-flash',
      thinking: { type: 'disabled' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify(userInput) },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 2000,
    }),
    signal,
  });
  if (!response.ok) throw new Error(`DeepSeek 返回 HTTP ${response.status}`);

  const body = await response.json();
  const content = body.choices?.[0]?.message?.content;
  if (!content) throw new Error('DeepSeek 返回了空内容');
  return JSON.parse(content);
}
