<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app'
import { computed, reactive, ref } from 'vue'
import { api, showError } from '@/api'
import { store } from '@/store'
import type { Gender, OutfitRequest, OutfitStyle, Outfits } from '@/types'

type Tab = 'inbox' | 'send' | 'wardrobe'

const data = ref<Outfits | null>(null)
const tab = ref<Tab>('send')
const busy = ref(false)
let firstLoad = true

// 点给 TA
const picked = ref('')
const message = ref('')
// 我的衣橱（编辑中的副本，点保存才提交）
const myStyles = ref<string[]>([])
const myNote = ref('')
const newStyle = ref('')
// 每条收到的请求各自的回复草稿
const replyDraft = reactive<Record<string, string>>({})

const partnerName = computed(() => data.value?.partner?.user.nickname || 'TA')
const styleById = computed(() => new Map((data.value?.styles || []).map((s) => [s.id, s])))
// 请求里存了当时的风格名，自定义风格删掉以后也能显示
const styleName = (r: OutfitRequest) => r.styleName || styleById.value.get(r.styleId)?.name || '一套衣服'

const fitsGender = (s: OutfitStyle, g?: Gender) => s.for === 'any' || !g || s.for === g

// 适合 TA 穿的风格（内置的按性别筛，自定义的只看 TA 自己加的），TA 衣橱里有的排前面
const stylesForPartner = computed(() => {
  const d = data.value
  if (!d?.partner) return []
  const owned = new Set(d.partner.styles)
  return d.styles
    .filter((s) => (s.custom ? !s.mine : fitsGender(s, d.partner!.user.gender)))
    .map((s) => ({ ...s, owned: owned.has(s.id) }))
    .sort((a, b) => Number(b.owned) - Number(a.owned))
})
const stylesForMe = computed(() =>
  (data.value?.styles || []).filter((s) => !s.custom && fitsGender(s, store.me?.user.gender)),
)
const myCustomStyles = computed(() => (data.value?.styles || []).filter((s) => s.custom && s.mine))

const inbox = computed(() => (data.value?.requests || []).filter((r) => !r.fromMe))
const sent = computed(() => (data.value?.requests || []).filter((r) => r.fromMe))
const pendingCount = computed(() => inbox.value.filter((r) => r.status === 'pending').length)
const pickedStyle = computed(() => stylesForPartner.value.find((s) => s.id === picked.value))

// 心有灵犀：两人最近一次点给对方的是同一种风格（请求按时间倒序返回）
const sameMind = computed(() => {
  const mine = sent.value[0]
  const theirs = inbox.value[0]
  return mine && theirs && mine.styleId === theirs.styleId ? styleName(mine) : ''
})

async function load() {
  try {
    if (!store.me) store.me = await api.me()
    data.value = await api.outfits()
    if (firstLoad) {
      // 衣橱勾选只在第一次进来时取，之后加删自定义风格不会冲掉还没保存的勾选
      myStyles.value = [...data.value.mine.styles]
      myNote.value = data.value.mine.note
      // 有没回的就先看收到的
      if (pendingCount.value > 0) tab.value = 'inbox'
    }
    firstLoad = false
  } catch (e) {
    showError(e)
  }
}

onShow(load)

async function run(fn: () => Promise<unknown>, done: string) {
  if (busy.value) return
  busy.value = true
  try {
    await fn()
    uni.showToast({ title: done, icon: 'none' })
    await load()
  } catch (e) {
    showError(e)
  } finally {
    busy.value = false
  }
}

// 只是帮忙预选，发不发还是自己定
function randomPick() {
  const list = stylesForPartner.value
  const owned = list.filter((s) => s.owned)
  const pool = owned.length ? owned : list
  if (!pool.length) return
  picked.value = pool[Math.floor(Math.random() * pool.length)].id
}

function send() {
  if (!picked.value) return showError('先选一种风格')
  run(async () => {
    await api.sendOutfit(picked.value, message.value.trim())
    picked.value = ''
    message.value = ''
  }, `已经发给${partnerName.value}啦`)
}

function answer(r: OutfitRequest, status: 'accepted' | 'declined') {
  run(() => api.replyOutfit(r.id, status, (replyDraft[r.id] || '').trim()), status === 'accepted' ? '说定了！' : '已回复')
}

function toggleMine(id: string) {
  const i = myStyles.value.indexOf(id)
  if (i >= 0) myStyles.value.splice(i, 1)
  else myStyles.value.push(id)
}

async function withdraw(r: OutfitRequest) {
  const res = await uni.showModal({ title: '撤回这条？', content: `「${styleName(r)}」，${partnerName.value}就看不到了`, confirmText: '撤回' })
  if (res.confirm) run(() => api.withdrawOutfit(r.id), '已撤回')
}

function addCustom() {
  const name = newStyle.value.trim()
  if (!name) return showError('写个风格名字，比如：森系露营风')
  run(async () => {
    await api.addStyle(name)
    newStyle.value = ''
  }, '加好了')
}

async function removeCustom(s: OutfitStyle) {
  const res = await uni.showModal({ title: '删掉这种风格？', content: s.name, confirmText: '删掉', confirmColor: '#E84F45' })
  if (res.confirm) run(() => api.deleteStyle(s.id), '已删掉')
}

function saveWardrobe() {
  // 只传内置风格；自己加的风格本来就在衣橱里，删掉的也不能再传
  const builtinIds = new Set(stylesForMe.value.map((s) => s.id))
  const styles = myStyles.value.filter((id) => builtinIds.has(id))
  run(() => api.saveWardrobe(styles, myNote.value.trim()), '衣橱已保存')
}

function when(ms: number) {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const STATUS_TEXT = { pending: '等回应', accepted: '安排！', declined: '下次吧' }
</script>

<template>
  <view class="page" v-if="data">
    <view class="title hand">想看你穿</view>
    <view class="subtitle">点一套想看 TA 穿的风格，TA 会收到</view>

    <view v-if="!data.partner" class="sticker empty-card">先绑定另一半，才能互相点穿搭哦</view>

    <template v-else>
      <view v-if="sameMind" class="same-mind pop-in">
        <text class="hand">心有灵犀！</text>你们都想看对方穿「{{ sameMind }}」，干脆一起穿吧
      </view>

      <view class="tabs">
        <view class="tab" :class="{ on: tab === 'inbox' }" @tap="tab = 'inbox'">
          TA 点给我的<text v-if="pendingCount" class="dot">{{ pendingCount }}</text>
        </view>
        <view class="tab" :class="{ on: tab === 'send' }" @tap="tab = 'send'">点一套给 TA</view>
        <view class="tab" :class="{ on: tab === 'wardrobe' }" @tap="tab = 'wardrobe'">我的衣橱</view>
      </view>

      <!-- 点一套给 TA -->
      <view v-if="tab === 'send'" class="pop-in">
        <view class="row-between">
          <view class="section-label">想看{{ partnerName }}穿…</view>
          <view class="btn small butter random" @tap="randomPick">🎲 随机帮我挑</view>
        </view>
        <view v-if="!data.partner.styles.length" class="hint left">{{ partnerName }}还没填衣橱，先看看全部风格</view>
        <view class="grid">
          <view
            v-for="s in stylesForPartner"
            :key="s.id"
            class="style"
            :class="{ on: picked === s.id }"
            @tap="picked = s.id"
          >
            <view class="style-head">
              <text class="style-name">{{ s.name }}</text>
              <text v-if="s.owned" class="owned">TA 有</text>
            </view>
            <view class="style-desc">{{ s.desc }}</view>
          </view>
        </view>

        <view class="sticker compose">
          <view v-if="pickedStyle" class="picked">
            选了「{{ pickedStyle.name }}」
            <view v-if="!pickedStyle.owned" class="gift">{{ partnerName }}衣橱里还没有，可以当小礼物送 🎁</view>
          </view>
          <input v-model="message" class="input" maxlength="60" placeholder="想说的话（选填）" />
          <view class="btn" :class="{ disabled: busy || !picked }" @tap="send">发给{{ partnerName }} ♥</view>
        </view>

        <view v-if="sent.length" class="section-label list-label">我点过的</view>
        <view v-for="r in sent" :key="r.id" class="sticker item">
          <view class="item-head">
            <text class="item-style">{{ styleName(r) }}</text>
            <text class="badge" :class="r.status">{{ STATUS_TEXT[r.status] }}</text>
          </view>
          <view v-if="r.message" class="item-msg">我：{{ r.message }}</view>
          <view v-if="r.reply" class="item-msg">{{ partnerName }}：{{ r.reply }}</view>
          <view class="item-foot">
            <text class="item-time">{{ when(r.createdAt) }}</text>
            <text v-if="r.status === 'pending'" class="withdraw" @tap="withdraw(r)">撤回</text>
          </view>
        </view>
      </view>

      <!-- TA 点给我的 -->
      <view v-if="tab === 'inbox'" class="pop-in">
        <view v-if="!inbox.length" class="empty">{{ partnerName }}还没给你点过，先给 TA 点一套吧</view>
        <view v-for="r in inbox" :key="r.id" class="sticker item" :class="{ fresh: r.status === 'pending' }">
          <view class="item-head">
            <text class="item-style">{{ partnerName }}想看你穿「{{ styleName(r) }}」</text>
            <text v-if="r.status !== 'pending'" class="badge" :class="r.status">{{ STATUS_TEXT[r.status] }}</text>
          </view>
          <view v-if="r.message" class="item-msg">「{{ r.message }}」</view>
          <view class="item-time">{{ when(r.createdAt) }}</view>
          <view v-if="r.status === 'pending'" class="answer">
            <input v-model="replyDraft[r.id]" class="input small-input" maxlength="60" placeholder="回一句（选填）" />
            <view class="answer-btns">
              <view class="btn small" :class="{ disabled: busy }" @tap="answer(r, 'accepted')">安排！</view>
              <view class="btn small ghost" :class="{ disabled: busy }" @tap="answer(r, 'declined')">下次吧</view>
            </view>
          </view>
          <view v-else-if="r.reply" class="item-msg">我：{{ r.reply }}</view>
        </view>
      </view>

      <!-- 我的衣橱 -->
      <view v-if="tab === 'wardrobe'" class="pop-in">
        <view class="hint left">勾上你有的风格，{{ partnerName }}点穿搭时会看到「TA 有」</view>
        <view class="chips">
          <view
            v-for="s in stylesForMe"
            :key="s.id"
            class="chip"
            :class="{ on: myStyles.includes(s.id) }"
            @tap="toggleMine(s.id)"
            >{{ s.name }}</view
          >
        </view>
        <input v-model="myNote" class="input" maxlength="100" placeholder="备注（选填），如：JK 有两套" />
        <view class="btn save" :class="{ disabled: busy }" @tap="saveWardrobe">保存衣橱</view>

        <view class="section-label list-label">我自己加的风格</view>
        <view class="hint left">清单里没有的，自己加上，{{ partnerName }}也能点</view>
        <view v-if="myCustomStyles.length" class="chips">
          <view v-for="s in myCustomStyles" :key="s.id" class="chip on custom-chip">
            {{ s.name }}<text class="chip-del" @tap.stop="removeCustom(s)">×</text>
          </view>
        </view>
        <view class="add-row">
          <input v-model="newStyle" class="input add-input" maxlength="12" placeholder="比如：森系露营风" />
          <view class="btn small" :class="{ disabled: busy }" @tap="addCustom">加上</view>
        </view>
      </view>
    </template>
  </view>
</template>

<style scoped>
.empty-card {
  margin-top: 20px;
  text-align: center;
}
.same-mind {
  margin-top: 16px;
  padding: 10px 14px;
  border: 2px solid var(--ink);
  border-radius: 14px;
  background: var(--butter);
  font-size: 13px;
  font-weight: 700;
}
.same-mind .hand {
  margin-right: 6px;
  font-size: 16px;
  color: var(--coral-deep);
}
.tabs {
  display: flex;
  margin: 18px 0 16px;
  border: 2.5px solid var(--ink);
  border-radius: 16px;
  overflow: hidden;
  background: var(--paper);
}
.tab {
  flex: 1;
  padding: 9px 2px;
  text-align: center;
  font-size: 13px;
  font-weight: 800;
  white-space: nowrap;
}
.tab + .tab {
  border-left: 2px solid var(--ink);
}
.tab.on {
  background: var(--coral);
}
.dot {
  display: inline-block;
  min-width: 16px;
  height: 16px;
  line-height: 16px;
  margin-left: 3px;
  padding: 0 4px;
  border-radius: 999px;
  background: var(--ink);
  color: var(--butter);
  font-size: 11px;
  box-sizing: border-box;
}
.row-between {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 4px;
}
.row-between .section-label {
  margin-bottom: 0;
}
.random {
  flex-shrink: 0;
  height: 34px;
  padding: 0 12px;
  font-size: 13px;
}
.hint {
  font-size: 12px;
  color: var(--ink-soft);
}
.hint.left {
  margin: 6px 0 10px;
}
.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 10px;
}
.style {
  min-width: 0;
  padding: 10px 12px;
  border: 2px solid var(--ink);
  border-radius: 14px;
  background: var(--paper);
  transition: transform 0.15s;
}
.style.on {
  background: var(--blush);
  box-shadow: 3px 3px 0 var(--ink);
  transform: rotate(-1.5deg);
}
.style-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
}
.style-name {
  font-weight: 900;
  font-size: 15px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.owned {
  flex-shrink: 0;
  padding: 0 6px;
  border: 1.5px solid var(--ink);
  border-radius: 999px;
  background: var(--mint);
  font-size: 11px;
  font-weight: 800;
}
.style-desc {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.4;
  color: var(--ink-soft);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.compose {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 18px;
  background: var(--blush);
}
.picked {
  font-size: 14px;
  font-weight: 800;
}
.gift {
  margin-top: 2px;
  font-weight: 600;
  font-size: 12px;
  color: var(--ink-soft);
}
.list-label {
  margin-top: 24px;
}
.empty {
  color: var(--ink-soft);
  font-size: 14px;
}
.item {
  margin-bottom: 12px;
  padding: 12px 14px;
}
.item.fresh {
  background: var(--blush);
}
.item-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
}
.item-style {
  flex: 1;
  min-width: 0;
  font-weight: 900;
}
.badge {
  flex-shrink: 0;
  font-size: 12px;
  padding: 1px 8px;
  border: 2px solid var(--ink);
  border-radius: 999px;
  font-weight: 700;
  background: var(--paper);
}
.badge.accepted {
  background: var(--mint);
}
.badge.pending {
  background: var(--butter);
}
.item-msg {
  margin-top: 4px;
  font-size: 13px;
  word-break: break-all;
}
.item-time {
  margin-top: 4px;
  font-size: 11px;
  color: var(--ink-soft);
}
.item-foot {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
}
.withdraw {
  padding: 2px 10px;
  border: 2px dashed var(--ink);
  border-radius: 999px;
  font-size: 12px;
  font-weight: 800;
}
.custom-chip {
  background: var(--butter);
  transform: none;
}
.chip-del {
  margin-left: 8px;
  padding: 0 2px;
  font-size: 16px;
  line-height: 1;
  font-weight: 900;
  color: var(--coral-deep);
}
.add-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.add-input {
  flex: 1;
  min-width: 0;
  height: 42px;
  font-size: 15px;
}
.add-row .btn {
  flex-shrink: 0;
}
.answer {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 10px;
}
.small-input {
  height: 40px;
  font-size: 14px;
}
.answer-btns {
  display: flex;
  gap: 10px;
}
.answer-btns .btn {
  flex: 1;
}
.chips {
  margin-bottom: 4px;
}
.save {
  margin-top: 16px;
}
</style>
