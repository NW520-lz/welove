import { store, clearSession } from './store'
import type { DateSession, Gender, Me, User, Wish } from './types'

export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000'

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE'

function request<T>(method: Method, path: string, data?: object): Promise<T> {
  return new Promise((resolve, reject) => {
    uni.request({
      url: API_BASE + path,
      method,
      data,
      header: store.token ? { Authorization: `Bearer ${store.token}` } : {},
      success(res) {
        const body = res.data as any
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(body as T)
          return
        }
        if (res.statusCode === 401) {
          clearSession()
          uni.reLaunch({ url: '/pages/welcome/welcome' })
        }
        reject(new Error((body && body.error) || `出错了（${res.statusCode}）`))
      },
      fail() {
        reject(new Error('网络开小差了，稍后再试'))
      },
    })
  })
}

export function showError(e: unknown) {
  uni.showToast({ title: e instanceof Error ? e.message : String(e), icon: 'none' })
}

export const api = {
  register: (nickname: string, gender: Gender) =>
    request<{ token: string; user: User; recoveryCode: string }>('POST', '/api/users', { nickname, gender }),
  recover: (recoveryCode: string) =>
    request<{ token: string; user: User }>('POST', '/api/users/recover', { recoveryCode }),
  me: () => request<Me>('GET', '/api/me'),
  savePreferences: (excludeTags: string[], note: string) =>
    request<unknown>('PUT', '/api/me/preferences', { excludeTags, note }),
  invite: () => request<{ code: string; expiresAt?: string }>('POST', '/api/couple/invite'),
  join: (code: string) => request<unknown>('POST', '/api/couple/join', { code }),
  unbind: () => request<unknown>('DELETE', '/api/couple'),
  listWishes: () => request<Wish[]>('GET', '/api/wishes'),
  addWish: (title: string, kind: 'eat' | 'play', budgetPerPerson: number | null) =>
    request<Wish>('POST', '/api/wishes', { title, kind, budgetPerPerson }),
  deleteWish: (id: string) => request<unknown>('DELETE', `/api/wishes/${id}`),
  createDate:(date: string, startTime: string) =>
    request<DateSession>('POST', '/api/dates', { date, startTime }),
  getDate: (id: string) => request<DateSession>('GET', `/api/dates/${id}`),
  listDates: () => request<DateSession[]>('GET', '/api/dates'),
  dice: (id: string) => request<unknown>('POST', `/api/dates/${id}/dice`),
  draw: (id: string, game: 'split' | 'blindbox') => request<unknown>('POST', `/api/dates/${id}/draw`, { game }),
  scratch: (id: string) => request<unknown>('POST', `/api/dates/${id}/scratch`),
  veto: (id: string, slot: string) => request<unknown>('POST', `/api/dates/${id}/veto`, { slot }),
  confirm: (id: string) => request<unknown>('POST', `/api/dates/${id}/confirm`),
}

export function shareUrl(shareId: string) {
  return `${API_BASE}/s/${shareId}`
}
