<script setup lang="ts">
import { onHide, onLoad, onShow, onUnload } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { api, showError } from '@/api'
import { store } from '@/store'
import type { DateSession, Slot } from '@/types'
import DiceRoll from '@/components/DiceRoll.vue'
import IdeaCard from '@/components/IdeaCard.vue'
import ScratchCard from '@/components/ScratchCard.vue'

const BUDGETS = ['人均 50 以内', '人均 100 以内', '人均 150 以内', '人均 200 以内', '人均 300 以内', '预算不限']
const VETOES_PER_PERSON = 2
const SPLIT_SLOTS: Slot[] = ['eat', 'play']

let id = ''
let timer: ReturnType<typeof setInterval> | undefined
const d = ref<DateSession | null>(null)
const busy = ref(false)
const rolling = ref(false)

const myId = computed(() => String(store.me?.user.id ?? ''))
const partnerName = computed(() => store.me?.partner?.nickname || 'TA')

// split 由服务端决定我抽吃还是玩；roles 有就用它显示，没有就两边都给按钮，交给服务端判断
const mySlot = computed<Slot | null>(() => {
  const roles = d.value?.roles
  if (!roles) return null
  return String(roles.eat) === myId.value ? 'eat' : 'play'
})
const canDrawSplit = computed(() => {
  const s = d.value?.cards
  if (!s || !d.value?.dice) return false
  return mySlot.value ? !s[mySlot.value] : !s.eat || !s.play
})
const splitDone = computed(() => !!(d.value?.cards.eat && d.value?.cards.play))
const vetoesLeft = computed(() => d.value?.vetoesLeft?.[myId.value] ?? VETOES_PER_PERSON)
const iConfirmed = computed(() => !!d.value?.confirmedBy.some((u) => String(u) === myId.value))
const partnerConfirmed = computed(() => !!d.value?.confirmedBy.some((u) => String(u) !== myId.value))

async function refresh() {
  try {
    d.value = await api.getDate(id)
    if (d.value.itinerary) {
      stopPolling()
      uni.redirectTo({ url: `/pages/plan/plan?id=${id}` })
    }
  } catch (e) {
    showError(e)
  }
}

function stopPolling() {
  if (timer) clearInterval(timer)
  timer = undefined
}

onLoad((query) => {
  id = String(query?.id || '')
})
// 页面可见时每 2 秒同步一次，离开（隐藏或卸载）就停
onShow(async () => {
  // 直接刷新这一页时 store 是空的，先拿到“我是谁”，否则会把身份和对方名字显示错
  if (!store.me) store.me = await api.me().catch(() => null)
  refresh()
  stopPolling()
  timer = setInterval(refresh, 2000)
})
onHide(stopPolling)
onUnload(stopPolling)

async function act(fn: () => Promise<unknown>) {
  if (busy.value) return
  busy.value = true
  try {
    await fn()
    await refresh()
  } catch (e) {
    showError(e)
  } finally {
    busy.value = false
  }
}

async function rollDice() {
  rolling.value = true
  const minSpin = new Promise((r) => setTimeout(r, 2000))
  await act(() => api.dice(id))
  await minSpin
  rolling.value = false
}

const drawSplit = () => act(() => api.draw(id, 'split'))
const drawBlindbox = () => act(() => api.draw(id, 'blindbox'))
const scratch = () => act(() => api.scratch(id))
const confirm = () => act(() => api.confirm(id))

async function veto(slot: Slot) {
  const res = await uni.showModal({
    title: '换一张？',
    content: `会用掉你 1 次否决机会，还剩 ${vetoesLeft.value} 次`,
    confirmText: '换！',
  })
  if (res.confirm) act(() => api.veto(id, slot))
}
</script>

<template>
  <view class="page" v-if="d">
    <view class="head">
      <view class="title hand">{{ d.date }} 的约会</view>
      <view class="subtitle">{{ d.startTime }} 出发 · 我还有 {{ vetoesLeft }} 次否决机会</view>
    </view>

    <!-- 1 骰子定预算：掷完收成一行，把屏幕留给下一步 -->
    <view v-if="d.dice && !rolling" class="step-done pop-in">
      <text class="die hand">{{ d.dice }}</text>
      <text class="budget hand">{{ BUDGETS[d.dice - 1] }}</text>
    </view>
    <view v-else class="step sticker">
      <view class="section-label"><text class="num">1</text>掷骰子定预算</view>
      <DiceRoll :value="d.dice" :rolling="rolling" />
      <view v-if="!rolling" class="btn butter" :class="{ disabled: busy }" @tap="rollDice">掷骰子</view>
    </view>

    <!-- 2 各抽一半 -->
    <view v-if="d.dice" class="step sticker pop-in">
      <view class="section-label"><text class="num">2</text>各抽一半</view>
      <view class="hint">
        {{ mySlot ? `你负责抽「${mySlot === 'eat' ? '吃' : '玩'}」，${partnerName}负责另一半` : '男生抽吃，女生抽玩' }}
      </view>
      <!-- 主按钮放在卡片上方，不用滚屏就能点，点完卡片在下面翻开 -->
      <view v-if="canDrawSplit && !iConfirmed" class="btn" :class="{ disabled: busy }" @tap="drawSplit">
        抽我的那一半
      </view>
      <view v-else-if="!splitDone" class="waiting">等 {{ partnerName }} 抽卡中…</view>
      <view class="pair">
        <view v-for="slot in SPLIT_SLOTS" :key="slot" class="pair-item">
          <IdeaCard :idea="d.cards[slot]" :label="slot === 'eat' ? '吃' : '玩'" />
          <view
            v-if="d.cards[slot] && !iConfirmed"
            class="veto"
            :class="{ disabled: busy || vetoesLeft <= 0 }"
            @tap="veto(slot)"
            >换一张</view
          >
        </view>
      </view>
    </view>

    <!-- 3 盲盒（可选） -->
    <view v-if="splitDone" class="step sticker pop-in">
      <view class="section-label"><text class="num">3</text>盲盒 · 可选</view>
      <view v-if="d.cards.blindbox">
        <IdeaCard :idea="d.cards.blindbox" label="盲盒" />
        <view v-if="!iConfirmed" class="veto" :class="{ disabled: busy || vetoesLeft <= 0 }" @tap="veto('blindbox')"
          >换一张</view
        >
      </view>
      <view v-else class="btn ghost" :class="{ disabled: busy || iConfirmed }" @tap="drawBlindbox">再抽一张惊喜 🎁</view>
    </view>

    <!-- 4 刮刮乐 -->
    <view v-if="splitDone" class="step sticker pop-in">
      <view class="section-label"><text class="num">4</text>刮刮乐</view>
      <ScratchCard v-if="d.task" :text="d.task.text" :remember-key="`${d.id}:${d.task.id}`" />
      <view v-else class="btn butter" :class="{ disabled: busy }" @tap="scratch">领一张刮刮卡</view>
    </view>

    <!-- 5 确认 -->
    <view v-if="splitDone" class="step confirm">
      <view class="status">
        <text :class="{ ok: iConfirmed }">{{ iConfirmed ? '✓ 我已确认' : '我还没确认' }}</text>
        <text :class="{ ok: partnerConfirmed }">{{ partnerConfirmed ? `✓ ${partnerName}已确认` : `${partnerName}还没确认` }}</text>
      </view>
      <view v-if="!iConfirmed" class="btn" :class="{ disabled: busy }" @tap="confirm">就这么定了！</view>
      <view v-else class="waiting">
        {{ partnerConfirmed ? 'AI 正在排行程，稍等几秒…' : `等 ${partnerName} 点确认…` }}
      </view>
    </view>
  </view>
</template>

<style scoped>
.head {
  margin-bottom: 18px;
}
.step {
  margin-bottom: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.section-label {
  align-self: flex-start;
}
.num {
  display: inline-block;
  width: 18px;
  height: 18px;
  line-height: 18px;
  margin-right: 6px;
  text-align: center;
  border-radius: 50%;
  background: var(--ink);
  color: var(--butter);
  font-size: 12px;
}
.step-done {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
  padding: 8px 14px;
  border: 2px solid var(--ink);
  border-radius: 14px;
  background: var(--butter);
}
.die {
  width: 26px;
  height: 26px;
  line-height: 24px;
  margin-right: 10px;
  text-align: center;
  border: 2px solid var(--ink);
  border-radius: 7px;
  background: var(--paper);
  font-size: 16px;
  box-sizing: border-box;
}
.budget {
  font-size: 18px;
  color: var(--ink);
}
.hint,
.waiting {
  font-size: 13px;
  color: var(--ink-soft);
  text-align: center;
}
.waiting {
  animation: breathe 1.6s ease-in-out infinite;
}
@keyframes breathe {
  50% {
    opacity: 0.4;
  }
}
.pair {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.veto {
  align-self: flex-end;
  margin: 10px 4px 0 auto;
  width: fit-content;
  padding: 4px 12px;
  border: 2px dashed var(--ink);
  border-radius: 999px;
  font-size: 13px;
  font-weight: 800;
}
.veto.disabled {
  opacity: 0.4;
  pointer-events: none;
}
.pair-item {
  display: flex;
  flex-direction: column;
}
.confirm {
  padding-top: 8px;
}
.status {
  display: flex;
  justify-content: space-around;
  font-size: 14px;
  font-weight: 700;
  color: var(--ink-soft);
}
.status .ok {
  color: var(--rare);
}
</style>
