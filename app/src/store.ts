import { reactive } from 'vue'
import type { Me } from './types'

// 全局只有这一份状态：登录 token、注册时拿到的恢复码、最近一次 /api/me 的结果
export const store = reactive({
  token: (uni.getStorageSync('token') as string) || '',
  recoveryCode: (uni.getStorageSync('recoveryCode') as string) || '',
  me: null as Me | null,
})

export function saveSession(token: string, recoveryCode?: string) {
  store.token = token
  uni.setStorageSync('token', token)
  if (recoveryCode) {
    store.recoveryCode = recoveryCode
    uni.setStorageSync('recoveryCode', recoveryCode)
  }
}

export function clearSession() {
  store.token = ''
  store.recoveryCode = ''
  store.me = null
  uni.removeStorageSync('token')
  uni.removeStorageSync('recoveryCode')
}

// 引导流程走到哪一步：没填问卷 → 问卷；没绑定 → 绑定；否则首页
export function nextStepUrl(me: Me) {
  if (!me.preferencesSet) return '/pages/survey/survey'
  if (!me.partner) return '/pages/bind/bind'
  return '/pages/home/home'
}
