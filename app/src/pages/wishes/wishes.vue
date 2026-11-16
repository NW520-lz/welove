<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { api, showError } from '@/api'
import { store } from '@/store'
import type { Wish } from '@/types'

const wishes = ref<Wish[]>([])
const title = ref('')
const kind = ref<'eat' | 'play'>('eat')
const budget = ref('')
const busy = ref(false)

async function load() {
  try {
    wishes.value = await api.listWishes()
  } catch (e) {
    showError(e)
  }
}

onShow(load)

async function add() {
  if (!title.value.trim()) return showError('先写下想吃或想玩什么')
  busy.value = true
  try {
    const price = budget.value.trim()
    await api.addWish(title.value.trim(), kind.value, price === '' ? null : Number(price))
    title.value = ''
    budget.value = ''
    await load()
  } catch (e) {
    showError(e)
  } finally {
    busy.value = false
  }
}

async function remove(w: Wish) {
  const res = await uni.showModal({ title: '删掉这张心愿卡？', content: w.title, confirmText: '删掉', confirmColor: '#E84F45' })
  if (!res.confirm) return
  try {
    await api.deleteWish(w.id)
    await load()
  } catch (e) {
    showError(e)
  }
}

function addedBy(w: Wish) {
  return String(w.addedBy.id) === String(store.me?.user.id) ? '我加的' : `${w.addedBy.nickname} 加的`
}
</script>

<template>
  <view class="page">
    <view class="title hand">我们的心愿卡</view>
    <view class="subtitle">两个人加的卡放在一起，抽卡时有一半机会抽到它们</view>

    <view class="sticker form pop-in">
      <input v-model="title" class="input" maxlength="30" placeholder="想吃 / 想玩什么？比如：楼下那家烤肉" />
      <view class="row">
        <view class="chip" :class="{ on: kind === 'eat' }" @tap="kind = 'eat'">吃</view>
        <view class="chip" :class="{ on: kind === 'play' }" @tap="kind = 'play'">玩</view>
        <input v-model="budget" class="input price" type="number" placeholder="人均 ¥（选填）" />
      </view>
      <view class="btn" :class="{ disabled: busy }" @tap="add">加进去 ♥</view>
    </view>

    <view class="section-label list-label">已经有 {{ wishes.length }} 张</view>
    <view v-if="!wishes.length" class="empty">还没有心愿卡，先加一张你最想去的吧</view>
    <view v-for="w in wishes" :key="w.id" class="sticker item">
      <text class="kind" :class="w.kind">{{ w.kind === 'eat' ? '吃' : '玩' }}</text>
      <view class="body">
        <view class="name">{{ w.title }}</view>
        <view class="meta">
          {{ w.budgetPerPerson === null ? '预算随意' : `¥${w.budgetPerPerson}/人` }} · {{ addedBy(w) }}
        </view>
      </view>
      <text class="del" @tap="remove(w)">删</text>
    </view>
  </view>
</template>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 18px 0;
  background: var(--blush);
}
.row {
  display: flex;
  align-items: center;
}
.row .chip {
  margin-bottom: 0;
}
.price {
  flex: 1;
  min-width: 0;
  height: 40px;
  font-size: 14px;
}
.list-label {
  margin-top: 14px;
}
.empty {
  color: var(--ink-soft);
  font-size: 14px;
}
.item {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  padding: 12px 14px;
}
.kind {
  width: 34px;
  height: 34px;
  line-height: 30px;
  text-align: center;
  border: 2px solid var(--ink);
  border-radius: 50%;
  font-weight: 900;
  flex-shrink: 0;
}
.kind.eat {
  background: var(--butter);
}
.kind.play {
  background: var(--mint);
}
.body {
  flex: 1;
  min-width: 0;
}
.name {
  font-weight: 800;
}
.meta {
  margin-top: 2px;
  font-size: 12px;
  color: var(--ink-soft);
}
.del {
  padding: 4px 10px;
  font-size: 13px;
  font-weight: 700;
  color: var(--coral-deep);
}
</style>
