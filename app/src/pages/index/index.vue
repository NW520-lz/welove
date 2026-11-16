<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { api } from '@/api'
import { store, nextStepUrl } from '@/store'

const failed = ref(false)

async function start() {
  failed.value = false
  if (!store.token) {
    uni.reLaunch({ url: '/pages/welcome/welcome' })
    return
  }
  try {
    store.me = await api.me()
    uni.reLaunch({ url: nextStepUrl(store.me) })
  } catch {
    failed.value = true
  }
}

onLoad(start)
</script>

<template>
  <view class="splash">
    <view class="heart">♥</view>
    <view class="title hand">我们约会吧</view>
    <view v-if="failed" class="retry">
      <view class="subtitle">连不上服务器</view>
      <view class="btn small ghost" @tap="start">再试一次</view>
    </view>
  </view>
</template>

<style scoped>
.splash {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
}
.heart {
  font-size: 64px;
  color: var(--coral);
  animation: beat 1s ease-in-out infinite;
}
@keyframes beat {
  50% {
    transform: scale(1.18) rotate(-6deg);
  }
}
.retry {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}
</style>
