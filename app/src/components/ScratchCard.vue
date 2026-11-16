<script setup lang="ts">
import { getCurrentInstance, onMounted, ref } from 'vue'

defineProps<{ text: string }>()

const WIDTH = 300
const HEIGHT = 130
const BRUSH = 20
const MOVES_TO_REVEAL = 30 // 刮够这么多下就整片揭开

const instance = getCurrentInstance()
const revealed = ref(false)
let ctx: UniApp.CanvasContext
let moves = 0
let mouseDown = false
let canvasRect: { left: number; top: number } | null = null

function drawCoating() {
  ctx.setFillStyle('#ffb3a7')
  ctx.fillRect(0, 0, WIDTH, HEIGHT)
  ctx.setFillStyle('#ffcfc6')
  for (let x = 10; x < WIDTH; x += 22) {
    for (let y = 10; y < HEIGHT; y += 22) {
      ctx.beginPath()
      ctx.arc(x + ((y / 22) % 2) * 11, y, 4, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.setFillStyle('#3a2320')
  ctx.setFontSize(18)
  ctx.setTextAlign('center')
  ctx.fillText('用手指刮开今天的小任务', WIDTH / 2, HEIGHT / 2 + 6)
  ctx.draw()
}

onMounted(() => {
  ctx = uni.createCanvasContext('scratch', instance?.proxy)
  drawCoating()
})

// 触摸：uni 的 canvas 触摸点自带相对画布的 x/y（H5 和 App 都有）
function onTouch(e: any) {
  const t = e.touches?.[0]
  if (t && typeof t.x === 'number') scratchAt(t.x, t.y)
}

// 鼠标：H5 在电脑浏览器里验收时用。uni 给的 clientX/clientY 和选择器查到的位置是同一套坐标，
// 每次按下时重新查一次画布位置，页面滚动过也不会错位
function onMouseDown() {
  mouseDown = true
  uni
    .createSelectorQuery()
    .in(instance?.proxy)
    .select('.scratch-canvas')
    .boundingClientRect((r) => {
      const box = r as UniApp.NodeInfo
      canvasRect = { left: box?.left || 0, top: box?.top || 0 }
    })
    .exec()
}
function onMouseMove(e: any) {
  if (mouseDown && canvasRect) scratchAt(e.clientX - canvasRect.left, e.clientY - canvasRect.top)
}
function onMouseUp() {
  mouseDown = false
  canvasRect = null
}

function scratchAt(x: number, y: number) {
  if (revealed.value) return
  // 安卓上 destination-out 只对 fill 生效，所以用填充圆来擦
  ctx.globalCompositeOperation = 'destination-out'
  ctx.beginPath()
  ctx.arc(x, y, BRUSH, 0, Math.PI * 2)
  ctx.fill()
  ctx.draw(true)
  moves += 1
  if (moves >= MOVES_TO_REVEAL) revealed.value = true
}
</script>

<template>
  <view
    class="scratch"
    :style="{ width: WIDTH + 'px', height: HEIGHT + 'px' }"
    @mousedown="onMouseDown"
    @mousemove="onMouseMove"
    @mouseup="onMouseUp"
    @mouseleave="onMouseUp"
  >
    <view class="prize">
      <image class="prize-art" src="/static/scratch-reward.png" mode="aspectFill" />
      <view class="prize-body">
        <text class="prize-label">今日小任务</text>
        <text class="prize-text hand">{{ text }}</text>
      </view>
    </view>
    <canvas
      canvas-id="scratch"
      id="scratch"
      class="scratch-canvas"
      :class="{ gone: revealed }"
      :style="{ width: WIDTH + 'px', height: HEIGHT + 'px' }"
      disable-scroll
      @touchstart="onTouch"
      @touchmove="onTouch"
    />
  </view>
</template>

<style scoped>
.scratch {
  position: relative;
  margin: 0 auto;
  border: 2.5px solid var(--ink);
  border-radius: 18px;
  box-shadow: 4px 4px 0 var(--ink);
  overflow: hidden;
  background: var(--paper);
}
.prize {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.prize-art {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0.22;
  pointer-events: none;
}
.prize-body {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0 18px;
  text-align: center;
}
.prize-label {
  font-size: 12px;
  font-weight: 800;
  color: var(--coral);
  letter-spacing: 2px;
}
.prize-text {
  margin-top: 6px;
  font-size: 19px;
  font-weight: 900;
}
.scratch-canvas {
  position: absolute;
  top: 0;
  left: 0;
  transition: opacity 0.5s;
}
.scratch-canvas.gone {
  opacity: 0;
  pointer-events: none;
}
</style>
