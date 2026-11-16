<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app'
import { getCurrentInstance, nextTick, ref } from 'vue'
import { api, shareUrl, showError } from '@/api'
import { store } from '@/store'
import { layoutPoster, POSTER_WIDTH } from '@/poster'
import type { DateSession } from '@/types'

const instance = getCurrentInstance()
const d = ref<DateSession | null>(null)
const posterHeight = ref(600)
const exporting = ref(false)

onLoad(async (query) => {
  try {
    d.value = await api.getDate(String(query?.id || ''))
  } catch (e) {
    showError(e)
  }
})

function names() {
  return `${store.me?.user.nickname || ''} ♥ ${store.me?.partner?.nickname || ''}`
}

function canvasToFile(): Promise<string> {
  return new Promise((resolve, reject) => {
    uni.canvasToTempFilePath(
      {
        canvasId: 'poster',
        fileType: 'png',
        success: (res) => resolve(res.tempFilePath),
        fail: () => reject(new Error('生成图片失败')),
      },
      instance?.proxy,
    )
  })
}

function saveFile(path: string): Promise<void> {
  // #ifdef H5
  // H5 端 tempFilePath 是 base64，用 a 标签触发下载
  const a = document.createElement('a')
  a.href = path
  a.download = `我们约会吧-${d.value?.date || ''}.png`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  return Promise.resolve()
  // #endif
  // #ifndef H5
  return new Promise((resolve, reject) => {
    uni.saveImageToPhotosAlbum({
      filePath: path,
      success: () => resolve(),
      fail: () => reject(new Error('保存失败，请在系统设置里允许访问相册')),
    })
  })
  // #endif
}

async function exportPoster() {
  if (!d.value || exporting.value) return
  exporting.value = true
  uni.showLoading({ title: '正在画长图' })
  try {
    const layout = layoutPoster(d.value, names())
    posterHeight.value = layout.height
    await nextTick()
    await new Promise((r) => setTimeout(r, 100)) // 等 canvas 按新高度重新布局
    const ctx = uni.createCanvasContext('poster', instance?.proxy)
    layout.draw(ctx)
    await new Promise<void>((r) => ctx.draw(false, () => r()))
    await saveFile(await canvasToFile())
    uni.hideLoading()
    uni.showToast({ title: '长图已保存' })
  } catch (e) {
    uni.hideLoading()
    showError(e)
  } finally {
    exporting.value = false
  }
}

function copyLink() {
  if (!d.value?.shareId) return showError('分享链接还没生成')
  uni.setClipboardData({ data: shareUrl(d.value.shareId) })
}

function goHome() {
  uni.reLaunch({ url: '/pages/home/home' })
}
</script>

<template>
  <view class="page" v-if="d">
    <view class="ticket sticker pop-in">
      <image class="ticket-bg" src="/static/plan-receipt-bg.png" mode="aspectFill" />
      <view class="ticket-inner">
        <view class="ticket-top">
          <view class="title hand">{{ d.date }}</view>
          <view class="subtitle">{{ d.startTime }} 出发 · {{ names() }}</view>
        </view>
        <view v-if="d.itinerary?.source === 'fallback'" class="fallback">AI 暂时没空，先按规则帮你们排了一版</view>

        <view class="timeline">
          <view v-for="(item, i) in d.itinerary?.items || []" :key="i" class="tl-item pop-in" :style="{ animationDelay: i * 0.08 + 's' }">
            <view class="tl-time">{{ item.start }}</view>
            <view class="tl-body">
              <view class="tl-title">{{ item.title }}</view>
              <view v-if="item.address" class="tl-sub">📍 {{ item.address }}</view>
              <view v-if="item.detail" class="tl-sub">{{ item.detail }}</view>
              <view v-if="item.travel" class="tl-transit">→ {{ item.travel }}</view>
            </view>
          </view>
        </view>

        <view v-if="d.task" class="task">
          <text class="task-label">今日小任务</text>
          <text class="hand task-text">{{ d.task.text }}</text>
        </view>

        <view v-if="d.itinerary?.tips?.length" class="tips">
          <view class="section-label">小贴士</view>
          <view v-for="(tip, i) in d.itinerary.tips" :key="i" class="tip">· {{ tip }}</view>
        </view>
      </view>
    </view>

    <view class="actions">
      <view class="btn" :class="{ disabled: exporting }" @tap="exportPoster">导出长图</view>
      <view class="btn butter" @tap="copyLink">复制分享链接</view>
      <view class="btn ghost small" @tap="goHome">回首页</view>
    </view>

    <!-- 画长图用的画布，放在屏幕外 -->
    <canvas
      canvas-id="poster"
      id="poster"
      class="poster-canvas"
      :style="{ width: POSTER_WIDTH + 'px', height: posterHeight + 'px' }"
    />
  </view>
</template>

<style scoped>
.ticket {
  position: relative;
  padding: 0;
  overflow: hidden;
}
.ticket-bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0.12;
  pointer-events: none;
  z-index: 0;
}
.ticket-inner {
  position: relative;
  z-index: 1;
}
.ticket-top {
  padding: 20px 18px 16px;
  background: var(--coral);
  color: var(--ink);
}
.ticket-top .subtitle {
  color: var(--ink);
  font-weight: 700;
}
.fallback {
  margin: 12px 18px 0;
  padding: 6px 10px;
  border: 2px dashed var(--ink-soft);
  border-radius: 12px;
  font-size: 12px;
  color: var(--ink-soft);
}
.timeline {
  padding: 18px 18px 4px;
}
.tl-item {
  display: flex;
  gap: 12px;
  padding-bottom: 18px;
  position: relative;
}
.tl-time {
  flex-shrink: 0;
  width: 52px;
  height: 24px;
  line-height: 24px;
  text-align: center;
  border-radius: 8px;
  background: var(--ink);
  color: var(--butter);
  font-size: 13px;
  font-weight: 800;
}
.tl-body {
  flex: 1;
}
.tl-title {
  font-size: 17px;
  font-weight: 900;
}
.tl-sub {
  font-size: 13px;
  color: var(--ink-soft);
}
.tl-transit {
  margin-top: 4px;
  font-size: 12px;
  font-weight: 700;
  color: var(--coral-deep);
}
.task {
  margin: 0 18px 16px;
  padding: 12px;
  border: 2px solid var(--ink);
  border-radius: 14px;
  background: var(--blush);
  display: flex;
  flex-direction: column;
}
.task-label {
  font-size: 12px;
  font-weight: 800;
  color: var(--coral-deep);
}
.task-text {
  font-size: 17px;
  font-weight: 900;
}
.tips {
  padding: 0 18px 18px;
}
.tip {
  font-size: 13px;
  margin-bottom: 4px;
}
.actions {
  margin-top: 24px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.poster-canvas {
  position: fixed;
  left: -2000px;
  top: 0;
}
</style>
