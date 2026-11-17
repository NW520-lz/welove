// 接口返回结构，字段名以 server/src/app.js 的返回为准。
export type Id = string | number

export type Gender = 'male' | 'female'

export interface User {
  id: Id
  nickname: string
  gender: Gender
}

export interface Preferences {
  excludeTags: string[]
  note: string
}

export interface Me {
  user: User
  recoveryCode: string
  partner: User | null
  preferencesSet: boolean
  preferences?: Preferences | null
}

export type Rarity = 'common' | 'rare' | 'surprise'

export interface Idea {
  id: string
  title: string
  kind: 'eat' | 'play'
  category: string
  city: string
  area?: string
  address?: string
  budgetPerPerson: number
  durationMin: number
  rarity: Rarity
  description: string
  source?: string
}

export interface Wish {
  id: string
  title: string
  kind: 'eat' | 'play'
  budgetPerPerson: number | null
  addedBy: User
  createdAt: number
}

export type Slot = 'eat' | 'play' | 'blindbox'

export interface TimelineItem {
  start: string
  end: string
  title: string
  address?: string
  detail?: string
  travel?: string
}

export interface Itinerary {
  items: TimelineItem[]
  tips: string[]
  source?: 'ai' | 'fallback'
}

export interface DateSession {
  id: Id
  date: string
  startTime: string
  dice: number | null
  cards: Record<Slot, Idea | null>
  task: { id: string; text: string } | null
  roles?: { eat: Id; play: Id }
  vetoesLeft: Record<string, number>
  confirmedBy: Id[]
  itinerary: Itinerary | null
  shareId: string | null
}

export interface OutfitStyle {
  id: string
  name: string
  for: Gender | 'any'
  desc: string
  custom?: boolean // 自己加的风格
  mine?: boolean // 自定义风格是不是我加的
}

export interface Wardrobe {
  styles: string[]
  note: string
}

export interface OutfitRequest {
  id: string
  fromMe: boolean
  styleId: string
  styleName: string
  message: string
  status: 'pending' | 'accepted' | 'declined'
  reply: string
  createdAt: number
  repliedAt: number | null
}

export interface Outfits {
  styles: OutfitStyle[]
  mine: Wardrobe
  partner: (Wardrobe & { user: User }) | null
  requests: OutfitRequest[]
}
