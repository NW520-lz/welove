<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app'
import { computed } from 'vue'
import { api, showError } from '@/api'
import { store } from '@/store'

const recoveryCode = computed(() => store.me?.recoveryCode || store.recoveryCode)

onShow(async () => {
  try {
    store.me = await api.me()
  } catch (e) {
    showError(e)
  }
})

function editSurvey() {
  uni.navigateTo({ url: '/pages/survey/survey?edit=1' })
}

function copyRecovery() {
  if (recoveryCode.value) uni.setClipboardData({ data: recoveryCode.value })
}

async function unbind() {
  const res = await uni.showModal({
    title: '确定解绑？',
    content: `解绑后和 ${store.me?.partner?.nickname || 'TA'} 不能再一起发起约会`,
    confirmText: '解绑',
    confirmColor: '#E84F45',
  })
  if (!res.confirm) return
  try {
    await api.unbind()
    store.me = await api.me()
    uni.reLaunch({ url: '/pages/bind/bind' })
  } catch (e) {
    showError(e)
  }
}
</script>

<template>
  <view class="page">
    <view class="sticker profile pop-in">
      <view class="avatar hand">{{ store.me?.user.nickname?.slice(0, 1) }}</view>
      <view>
        <view class="name">{{ store.me?.user.nickname }}</view>
        <view class="subtitle">
          {{ store.me?.partner ? `和 ${store.me.partner.nickname} 绑定中 ♥` : '还没有绑定' }}
        </view>
      </view>
    </view>

    <view class="sticker row" @tap="editSurvey">
      <text>修改我的雷区问卷</text><text class="arrow">›</text>
    </view>

    <view class="sticker row" @tap="copyRecovery">
      <view>
        <view>我的恢复码</view>
        <view class="code">{{ recoveryCode || '本机没有记录' }}</view>
      </view>
      <text v-if="recoveryCode" class="arrow small">复制</text>
    </view>

    <view v-if="store.me?.partner" class="btn ghost danger" @tap="unbind">解除绑定</view>
  </view>
</template>

<style scoped>
.profile {
  display: flex;
  align-items: center;
  gap: 14px;
  background: var(--blush);
  margin-bottom: 20px;
}
.avatar {
  width: 56px;
  height: 56px;
  line-height: 56px;
  text-align: center;
  border: 2.5px solid var(--ink);
  border-radius: 50%;
  background: var(--butter);
  font-size: 26px;
  font-weight: 900;
}
.name {
  font-size: 20px;
  font-weight: 900;
}
.row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
  font-weight: 800;
}
.arrow {
  font-size: 22px;
  color: var(--ink-soft);
}
.arrow.small {
  font-size: 13px;
}
.code {
  margin-top: 4px;
  font-family: monospace;
  font-size: 16px;
  letter-spacing: 2px;
  color: var(--coral-deep);
}
.danger {
  margin-top: 30px;
  color: var(--coral-deep);
}
</style>
