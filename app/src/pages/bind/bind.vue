<script setup lang="ts">
import { onHide, onShow, onUnload } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { api, showError } from '@/api'
import { store } from '@/store'

const myCode = ref('')
const inputCode = ref('')
const busy = ref(false)
const isCelebrating = ref(false)
let timer: ReturnType<typeof setInterval> | undefined

function celebrateAndLeave() {
  if (isCelebrating.value) return
  isCelebrating.value = true
  stopPolling()
  setTimeout(() => {
    uni.reLaunch({ url: '/pages/home/home' })
  }, 2600)
}

// 等对方输入我的邀请码：每 2 秒看一眼自己是否已被绑定
async function checkBound() {
  try {
    store.me = await api.me()
    if (store.me.partner) {
      celebrateAndLeave()
    }
  } catch {
    // 轮询失败不打扰用户，下一轮再试
  }
}

function stopPolling() {
  if (timer) clearInterval(timer)
  timer = undefined
}

onShow(() => {
  stopPolling()
  timer = setInterval(checkBound, 2000)
})
onHide(stopPolling)
onUnload(stopPolling)

async function makeCode() {
  busy.value = true
  try {
    myCode.value = (await api.invite()).code
  } catch (e) {
    showError(e)
  } finally {
    busy.value = false
  }
}

function copyCode() {
  uni.setClipboardData({ data: myCode.value })
}

async function join() {
  const code = inputCode.value.trim()
  if (code.length !== 6) return showError('邀请码是 6 位')
  busy.value = true
  try {
    await api.join(code)
    store.me = await api.me()
    celebrateAndLeave()
  } catch (e) {
    showError(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <view class="page">
    <view class="title hand">把 TA 拉进来</view>
    <view class="subtitle">一个人发邀请码，另一个人输入，就绑在一起啦</view>

    <view class="sticker block pop-in">
      <view class="section-label">我的邀请码</view>
      <view v-if="myCode" class="code-row">
        <view class="code">
          <text v-for="(c, i) in myCode.split('')" :key="i" class="digit">{{ c }}</text>
        </view>
        <view class="btn small ghost" @tap="copyCode">复制</view>
        <view class="hint">24 小时内有效，发给 TA，绑定成功后这里会自动跳转</view>
      </view>
      <view v-else class="btn butter" :class="{ disabled: busy }" @tap="makeCode">生成邀请码</view>
    </view>

    <view class="or hand">—— 或者 ——</view>

    <view class="sticker block pop-in" style="animation-delay: 0.08s">
      <view class="section-label mint">输入 TA 的邀请码</view>
      <input v-model="inputCode" class="input code-input" maxlength="6" placeholder="6 位邀请码" />
      <view class="btn" :class="{ disabled: busy }" @tap="join">绑定</view>
    </view>

    <!-- 绑定成功庆祝弹窗 -->
    <view v-if="isCelebrating" class="celebrate-overlay pop-in">
      <view class="celebrate-card">
        <video
          class="celebrate-video"
          src="/static/bind-success.mp4"
          autoplay
          muted
          :controls="false"
          :show-center-play-btn="false"
          :enable-progress-gesture="false"
          object-fit="contain"
        />
        <view class="celebrate-title hand">🎉 绑定成功！</view>
        <view class="celebrate-subtitle">你们的心意已相连，开启约会吧~</view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.celebrate-overlay {
  position: fixed;
  inset: 0;
  background: rgba(58, 35, 32, 0.65);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
  padding: 20px;
}
.celebrate-card {
  background: var(--paper);
  border: 3px solid var(--ink);
  border-radius: 24px;
  box-shadow: 6px 6px 0 var(--ink);
  padding: 24px 20px;
  text-align: center;
  width: 85%;
  max-width: 320px;
}
.celebrate-video {
  width: 200px;
  height: 200px;
  margin: 0 auto 12px;
  border-radius: 16px;
  display: block;
}
.celebrate-title {
  font-size: 24px;
  color: var(--coral);
  margin-bottom: 6px;
}
.celebrate-subtitle {
  font-size: 13px;
  color: var(--ink-soft);
}
.block {
  margin: 18px 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.section-label {
  align-self: flex-start;
}
.section-label.mint {
  background: var(--mint);
}
.code-row {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.code {
  display: flex;
  gap: 6px;
  justify-content: center;
}
.digit {
  width: 40px;
  height: 52px;
  line-height: 52px;
  text-align: center;
  border: 2.5px solid var(--ink);
  border-radius: 12px;
  background: var(--blush);
  font-size: 26px;
  font-weight: 900;
}
.digit:nth-child(even) {
  transform: rotate(4deg);
  background: var(--butter);
}
.hint {
  font-size: 12px;
  color: var(--ink-soft);
  text-align: center;
}
.or {
  text-align: center;
  color: var(--ink-soft);
}
.code-input {
  text-align: center;
  letter-spacing: 8px;
  font-size: 22px;
  font-weight: 800;
}
</style>
