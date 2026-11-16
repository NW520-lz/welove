<script setup lang="ts">
import { ref } from 'vue'
import { api, showError } from '@/api'
import { store, saveSession, nextStepUrl } from '@/store'
import type { Gender } from '@/types'

const nickname = ref('')
const gender = ref<Gender | ''>('')
const recovering = ref(false)
const recoveryInput = ref('')
const busy = ref(false)

async function register() {
  if (!nickname.value.trim()) return showError('先起个昵称吧')
  if (!gender.value) return showError('选一下性别')
  busy.value = true
  try {
    const res = await api.register(nickname.value.trim(), gender.value)
    saveSession(res.token, res.recoveryCode)
    await uni.showModal({
      title: '记下你的恢复码',
      content: `${res.recoveryCode}\n换手机或清缓存时，用它找回账号。在「我的」里也能再看到。`,
      showCancel: false,
      confirmText: '记好了',
    })
    uni.reLaunch({ url: '/pages/survey/survey' })
  } catch (e) {
    showError(e)
  } finally {
    busy.value = false
  }
}

async function recover() {
  if (!recoveryInput.value.trim()) return showError('输入恢复码')
  busy.value = true
  try {
    const res = await api.recover(recoveryInput.value.trim())
    saveSession(res.token, recoveryInput.value.trim())
    store.me = await api.me()
    uni.reLaunch({ url: nextStepUrl(store.me) })
  } catch (e) {
    showError(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <view class="welcome-container">
    <video
      class="bg-video"
      src="/static/welcome-bg.mp4"
      autoplay
      loop
      muted
      :controls="false"
      :show-center-play-btn="false"
      :enable-progress-gesture="false"
      object-fit="cover"
    />
    <view class="bg-mask" />
    <view class="page welcome-content">
      <view class="hero">
        <view class="bubble b1">吃什么？</view>
        <view class="bubble b2">去哪玩？</view>
        <view class="bubble b3">交给骰子！</view>
        <view class="title hand big">我们<text class="accent">约会</text>吧</view>
        <view class="subtitle">两个人的选择困难，一起随机解决</view>
      </view>

      <view v-if="!recovering" class="sticker form pop-in">
        <view class="section-label">先认识一下</view>
        <input v-model="nickname" class="input" placeholder="你的昵称" maxlength="12" />
        <view class="genders">
          <view class="gender" :class="{ on: gender === 'male' }" @tap="gender = 'male'">
            <text class="g-icon">♂</text>男生
          </view>
          <view class="gender" :class="{ on: gender === 'female' }" @tap="gender = 'female'">
            <text class="g-icon">♀</text>女生
          </view>
        </view>
        <view class="hint">男生负责抽「吃」，女生负责抽「玩」</view>
        <view class="btn" :class="{ disabled: busy }" @tap="register">开始</view>
        <view class="link" @tap="recovering = true">我有恢复码，找回账号</view>
      </view>

      <view v-else class="sticker form pop-in">
        <view class="section-label">找回账号</view>
        <input v-model="recoveryInput" class="input" placeholder="输入恢复码" />
        <view class="btn" :class="{ disabled: busy }" @tap="recover">找回</view>
        <view class="link" @tap="recovering = false">返回注册</view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.welcome-container {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
}
.bg-video {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 0;
  pointer-events: none;
}
.bg-mask {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: linear-gradient(180deg, rgba(255, 244, 234, 0.72) 0%, rgba(255, 244, 234, 0.9) 65%, rgba(255, 244, 234, 0.98) 100%);
  z-index: 1;
  pointer-events: none;
}
.welcome-content {
  position: relative;
  z-index: 2;
}
.hero {
  position: relative;
  padding: 90px 4px 36px;
}
.big {
  font-size: 44px;
}
.accent {
  color: var(--coral-deep);
}
.bubble {
  position: absolute;
  padding: 6px 12px;
  border: 2px solid var(--ink);
  border-radius: 14px;
  background: var(--paper);
  font-size: 13px;
  font-weight: 800;
  animation: float 3s ease-in-out infinite;
}
.b1 {
  top: 20px;
  left: 6px;
  transform: rotate(-6deg);
}
.b2 {
  top: 36px;
  left: 120px;
  background: var(--mint);
  animation-delay: 0.6s;
}
.b3 {
  top: 12px;
  right: 6px;
  background: var(--butter);
  transform: rotate(5deg);
  animation-delay: 1.2s;
}
@keyframes float {
  50% {
    margin-top: -6px;
  }
}
.form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.genders {
  display: flex;
  gap: 12px;
}
.gender {
  flex: 1;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 2.5px solid var(--ink);
  border-radius: 16px;
  background: var(--paper);
  font-weight: 800;
  transition: all 0.15s;
}
.gender.on {
  background: var(--blush);
  box-shadow: 3px 3px 0 var(--ink);
  transform: rotate(-2deg);
}
.g-icon {
  font-size: 22px;
  color: var(--coral);
}
.hint {
  font-size: 12px;
  color: var(--ink-soft);
}
.link {
  text-align: center;
  font-size: 13px;
  color: var(--ink-soft);
  text-decoration: underline;
}
</style>
