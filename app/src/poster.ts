import type { DateSession } from './types'

// 行程长图：先算出每段文字的位置和总高度（canvas 要先定高度），再统一画出来。
export const POSTER_WIDTH = 375

const PAD = 24
const TEXT_LEFT = PAD + 64 // 时间列右边的正文起点
const COLORS = { cream: '#FFF4EA', coral: '#FF6B5E', ink: '#3A2320', soft: '#8A6A63', butter: '#FFD36B', white: '#FFFFFF' }

interface TextOp {
  text: string
  x: number
  y: number
  size: number
  color: string
  bold?: boolean
}
interface RectOp {
  x: number
  y: number
  w: number
  h: number
  color: string
}

// 按字数折行：中文算 1 个宽度，ASCII 算半个，不依赖 measureText，算高度和绘制用同一套结果
function wrap(text: string, size: number, maxWidth: number): string[] {
  const maxUnits = Math.floor(maxWidth / size)
  const lines: string[] = []
  let line = ''
  let units = 0
  for (const ch of text) {
    const w = ch.charCodeAt(0) < 128 ? 0.55 : 1
    if (units + w > maxUnits) {
      lines.push(line)
      line = ''
      units = 0
    }
    line += ch
    units += w
  }
  if (line) lines.push(line)
  return lines
}

export function layoutPoster(d: DateSession, names: string) {
  const texts: TextOp[] = []
  const rects: RectOp[] = []
  const bodyWidth = POSTER_WIDTH - TEXT_LEFT - PAD

  function addLines(text: string, x: number, y: number, size: number, color: string, width: number, bold = false) {
    const lines = wrap(text, size, width)
    lines.forEach((t, i) => texts.push({ text: t, x, y: y + i * size * 1.45, size, color, bold }))
    return y + lines.length * size * 1.45
  }

  // 头部
  rects.push({ x: 0, y: 0, w: POSTER_WIDTH, h: 150, color: COLORS.coral })
  texts.push({ text: '我们约会吧', x: PAD, y: 56, size: 30, color: COLORS.ink, bold: true })
  texts.push({ text: names, x: PAD, y: 92, size: 15, color: COLORS.ink })
  texts.push({ text: `${d.date}  ${d.startTime} 出发`, x: PAD, y: 122, size: 15, color: COLORS.ink, bold: true })

  let y = 190
  const timeline = d.itinerary?.items || []
  timeline.forEach((item) => {
    rects.push({ x: PAD, y: y - 16, w: 52, h: 22, color: COLORS.ink })
    texts.push({ text: item.start, x: PAD + 6, y, size: 13, color: COLORS.butter, bold: true })
    y = addLines(item.title, TEXT_LEFT, y, 17, COLORS.ink, bodyWidth, true)
    if (item.address) y = addLines(`📍 ${item.address}`, TEXT_LEFT, y + 2, 13, COLORS.soft, bodyWidth)
    if (item.detail) y = addLines(item.detail, TEXT_LEFT, y + 2, 13, COLORS.soft, bodyWidth)
    if (item.travel) y = addLines(`→ ${item.travel}`, TEXT_LEFT, y + 6, 12, COLORS.coral, bodyWidth)
    y += 22
  })

  if (d.task) {
    rects.push({ x: PAD, y: y - 6, w: POSTER_WIDTH - PAD * 2, h: 2, color: COLORS.ink })
    y = addLines('今日小任务', PAD, y + 22, 13, COLORS.coral, POSTER_WIDTH - PAD * 2, true)
    y = addLines(d.task.text, PAD, y + 4, 16, COLORS.ink, POSTER_WIDTH - PAD * 2, true) + 12
  }

  const tips = d.itinerary?.tips || []
  if (tips.length) {
    y = addLines('小贴士', PAD, y + 10, 13, COLORS.coral, POSTER_WIDTH - PAD * 2, true)
    tips.forEach((tip) => {
      y = addLines(`· ${tip}`, PAD, y + 4, 13, COLORS.ink, POSTER_WIDTH - PAD * 2)
    })
  }

  y += 30
  texts.push({ text: '由骰子和缘分共同决定 ♥', x: PAD, y, size: 12, color: COLORS.soft })
  const height = Math.ceil(y + 30)

  function draw(ctx: UniApp.CanvasContext) {
    ctx.setFillStyle(COLORS.cream)
    ctx.fillRect(0, 0, POSTER_WIDTH, height)
    rects.forEach((r) => {
      ctx.setFillStyle(r.color)
      ctx.fillRect(r.x, r.y, r.w, r.h)
    })
    ctx.setTextAlign('left')
    texts.forEach((t) => {
      ctx.font = `${t.bold ? 'bold ' : ''}${t.size}px sans-serif`
      ctx.setFillStyle(t.color)
      ctx.fillText(t.text, t.x, t.y)
    })
  }

  return { height, draw }
}
