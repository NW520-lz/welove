<script setup lang="ts">
import { ref, watch } from 'vue'
import type { Idea } from '@/types'

const props = defineProps<{ idea: Idea | null; label: string }>()

const RARITY_TEXT = { common: '普通', rare: '稀有', surprise: '惊喜' }

// 每来一张新卡（id 变了）就从背面翻到正面
const showFront = ref(false)
watch(
  () => props.idea?.id,
  (id) => {
    showFront.value = false
    if (id) setTimeout(() => (showFront.value = true), 60)
  },
  { immediate: true },
)
</script>

<template>
  <view class="card-wrap">
    <view class="card" :class="{ flipped: showFront }">
      <view class="face back">
        <image class="back-bg-art" src="/static/idea-card-bg.png" mode="aspectFill" />
        <view class="back-mark hand">?</view>
        <view class="back-label">{{ label }}</view>
      </view>
      <view v-if="idea" class="face front" :class="idea.rarity">
        <image class="front-bg-art" src="/static/idea-card-bg.png" mode="aspectFill" />
        <view class="front-head">
          <text class="kind">{{ label }} · {{ idea.category }}</text>
          <text class="rarity">{{ RARITY_TEXT[idea.rarity] }}</text>
        </view>
        <view class="name">{{ idea.title }}</view>
        <view class="desc">{{ idea.description }}</view>
        <view class="meta">
          <text v-if="idea.budgetPerPerson">¥{{ idea.budgetPerPerson }}/人</text>
          <text v-else>{{ idea.source === 'wish' ? '预算随意' : '免费' }}</text>
          <text>约 {{ idea.durationMin }} 分钟</text>
          <text v-if="idea.area">{{ idea.area }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.card-wrap {
  perspective: 900px;
  height: 196px;
}
.card {
  position: relative;
  height: 100%;
  transform-style: preserve-3d;
  transition: transform 0.7s cubic-bezier(0.3, 1.4, 0.5, 1);
}
.card.flipped {
  transform: rotateY(180deg);
}
.face {
  position: absolute;
  inset: 0;
  box-sizing: border-box;
  border: 2.5px solid var(--ink);
  border-radius: 20px;
  box-shadow: 4px 4px 0 var(--ink);
  backface-visibility: hidden;
  overflow: hidden;
}
.back {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background-color: var(--coral);
  background-image: repeating-linear-gradient(45deg, rgba(255, 255, 255, 0.18) 0 10px, transparent 10px 20px);
  color: var(--ink);
}
.back-mark {
  font-size: 64px;
  font-weight: 900;
  line-height: 1;
}
.back-label {
  margin-top: 6px;
  font-weight: 800;
  letter-spacing: 2px;
  position: relative;
  z-index: 1;
}
.back-mark {
  font-size: 64px;
  font-weight: 900;
  line-height: 1;
  position: relative;
  z-index: 1;
}
.back-bg-art {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0.12;
  pointer-events: none;
}
.front-bg-art {
  position: absolute;
  right: -10px;
  bottom: -10px;
  width: 108px;
  height: 108px;
  opacity: 0.14;
  pointer-events: none;
  transform: rotate(-6deg);
}
.front {
  transform: rotateY(180deg);
  padding: 14px 16px;
  background: var(--paper);
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.front-head {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  font-weight: 800;
}
.kind {
  color: var(--ink-soft);
}
.rarity {
  padding: 1px 8px;
  border: 2px solid var(--ink);
  border-radius: 999px;
  background: var(--blush);
}
.name {
  font-size: 19px;
  font-weight: 900;
  line-height: 1.3;
}
.desc {
  flex: 1;
  font-size: 13px;
  color: var(--ink-soft);
  overflow: hidden;
}
.meta {
  display: flex;
  gap: 10px;
  font-size: 12px;
  font-weight: 700;
}

/* 稀有度：普通奶油、稀有薄荷、惊喜金色带闪光 */
.front.rare {
  background: #e6f8f1;
  border-color: var(--rare);
}
.front.rare .rarity {
  background: var(--mint);
}
.front.surprise {
  background: linear-gradient(135deg, var(--gold-a), var(--gold-b));
}
.front.surprise .rarity {
  background: #fff;
}
.front.surprise .kind,
.front.surprise .desc {
  color: var(--ink);
}
.front.surprise::after {
  content: '';
  position: absolute;
  top: 0;
  left: -60%;
  width: 40%;
  height: 100%;
  background: linear-gradient(100deg, transparent, rgba(255, 255, 255, 0.7), transparent);
  animation: shine 2.2s ease-in-out infinite;
}
@keyframes shine {
  to {
    left: 130%;
  }
}
</style>
