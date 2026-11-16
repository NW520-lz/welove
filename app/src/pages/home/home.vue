<script setup lang="ts">
import { onHide, onShow, onUnload } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { api, showError } from '@/api'
import { store } from '@/store'
import type { DateSession } from '@/types'

function today() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const date = ref(today())
const startTime = ref('14:00')
const dates = ref<DateSession[]>([])
const busy = ref(false)
let timer: ReturnType<typeof setInterval> | undefined

async function loadDates() {
  try {
    dates.value = await api.listDates()
  } catch {
    // 列表刷新失败不弹窗，下一轮再试
  }
}

function stopPolling() {
  if (timer) clearInterval(timer)
  timer = undefined
}

// 首页也每 2 秒刷新一次列表，这样对方发起的约会能马上出现
onShow(async () => {
  try {
    store.me = await api.me()
    if (!store.me.partner) {
      uni.reLaunch({ url: '/pages/bind/bind' })
      return
    }
  } catch (e) {
    showError(e)
  }
  loadDates()
  stopPolling()
  timer = setInterval(loadDates, 2000)
})
onHide(stopPolling)
onUnload(stopPolling)

async function startDate() {
  busy.value = true
  try {
    const created = await api.createDate(date.value, startTime.value)
    open(created)
  } catch (e) {
    showError(e)
  } finally {
    busy.value = false
  }
}

function goWishes() {
  uni.navigateTo({ url: '/pages/wishes/wishes' })
}

function goMe() {
  uni.navigateTo({ url: '/pages/me/me' })
}

function open(d: DateSession) {
  const page = d.itinerary ? 'plan/plan' : 'date/date'
  uni.navigateTo({ url: `/pages/${page}?id=${d.id}` })
}

function summary(d: DateSession) {
  const titles = [d.cards?.eat, d.cards?.play, d.cards?.blindbox].filter(Boolean).map((i) => i!.title)
  return titles.length ? titles.join(' · ') : '还没开始抽卡'
}
</script>

<template>
  <view class="page">
    <view class="top">
      <view class="pair hand">
        <text>{{ store.me?.user.nickname }}</text>
        <text class="heart">♥</text>
        <text>{{ store.me?.partner?.nickname }}</text>
      </view>
      <view class="me-btn" @tap="goMe">我的</view>
    </view>

    <view class="sticker new pop-in">
      <view class="title hand">今天约会<br />做点什么？</view>
      <view class="pickers">
        <picker mode="date" :value="date" :start="today()" @change="date = $event.detail.value">
          <view class="pick"><text class="pick-label">日期</text>{{ date }}</view>
        </picker>
        <picker mode="time" :value="startTime" @change="startTime = $event.detail.value">
          <view class="pick"><text class="pick-label">出发</text>{{ startTime }}</view>
        </picker>
      </view>
      <view class="btn" :class="{ disabled: busy }" @tap="startDate">发起新约会 🎲</view>
    </view>

    <view class="sticker wish-entry" @tap="goWishes">
      <view>
        <view class="wish-title">我们的心愿卡 ♥</view>
        <view class="wish-sub">加上你们想吃、想玩的，抽卡时优先抽到</view>
      </view>
      <text class="wish-arrow">›</text>
    </view>

    <view class="section-label history-label">我们的约会</view>
    <view v-if="!dates.length" class="empty">还没有约会记录，发起第一次吧</view>
    <view v-for="d in dates" :key="d.id" class="sticker item" @tap="open(d)">
      <view class="item-head">
        <text class="item-date">{{ d.date }} {{ d.startTime }}</text>
        <text class="badge" :class="d.itinerary ? 'done' : 'doing'">{{ d.itinerary ? '已排好' : '进行中' }}</text>
      </view>
      <view class="item-sum">{{ summary(d) }}</view>
    </view>
  </view>
</template>

<style scoped>
.top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 20px;
  margin-bottom: 20px;
}
.pair {
  font-size: 18px;
  font-weight: 800;
}
.heart {
  color: var(--coral);
  margin: 0 8px;
}
.me-btn {
  padding: 6px 14px;
  border: 2px solid var(--ink);
  border-radius: 999px;
  background: var(--paper);
  font-weight: 800;
  font-size: 13px;
}
.new {
  display: flex;
  flex-direction: column;
  gap: 16px;
  background: var(--blush);
  transform: rotate(-1deg);
}
.pickers {
  display: flex;
  gap: 10px;
}
.pickers picker {
  flex: 1;
}
.pick {
  padding: 10px 12px;
  border: 2px solid var(--ink);
  border-radius: 14px;
  background: var(--paper);
  font-weight: 800;
}
.pick-label {
  display: block;
  font-size: 11px;
  color: var(--ink-soft);
  font-weight: 600;
}
.wish-entry {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 20px;
  padding: 12px 16px;
  background: var(--butter);
  transform: rotate(0.8deg);
}
.wish-title {
  font-weight: 900;
}
.wish-sub {
  margin-top: 2px;
  font-size: 12px;
  color: var(--ink-soft);
}
.wish-arrow {
  font-size: 24px;
  font-weight: 900;
}
.history-label {
  margin-top: 32px;
}
.empty {
  color: var(--ink-soft);
  font-size: 14px;
}
.item {
  margin-bottom: 14px;
  padding: 12px 14px;
}
.item-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.item-date {
  font-weight: 800;
}
.badge {
  font-size: 12px;
  padding: 2px 8px;
  border: 2px solid var(--ink);
  border-radius: 999px;
  font-weight: 700;
}
.badge.done {
  background: var(--mint);
}
.badge.doing {
  background: var(--butter);
}
.item-sum {
  margin-top: 4px;
  font-size: 13px;
  color: var(--ink-soft);
}
</style>
