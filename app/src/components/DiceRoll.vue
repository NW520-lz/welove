<script setup lang="ts">
import { computed } from 'vue'

// 纯展示：rolling 时一直翻滚，停下后把 value 那一面转到正面
const props = defineProps<{ value: number | null; rolling: boolean }>()

// 每个点数在 3x3 格子里亮哪些格
const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
}
// 把第 n 面转到正面所需的旋转
const FACE_TO_FRONT: Record<number, string> = {
  1: 'rotateX(0deg) rotateY(0deg)',
  2: 'rotateX(-90deg)',
  3: 'rotateY(-90deg)',
  4: 'rotateY(90deg)',
  5: 'rotateX(90deg)',
  6: 'rotateY(180deg)',
}

const cubeStyle = computed(() => {
  if (props.rolling || !props.value) return {}
  return { transform: `rotateX(-20deg) rotateY(20deg) ${FACE_TO_FRONT[props.value]}` }
})
</script>

<template>
  <view class="stage">
    <view class="cube" :class="{ rolling }" :style="cubeStyle">
      <view v-for="n in 6" :key="n" class="face" :class="`f${n}`">
        <view v-for="cell in 9" :key="cell" class="cell">
          <view v-if="PIPS[n].includes(cell - 1)" class="pip" :class="{ red: n === 1 }" />
        </view>
      </view>
    </view>
    <view class="shadow" :class="{ rolling }" />
  </view>
</template>

<style scoped>
.stage {
  width: 120px;
  height: 140px;
  margin: 0 auto;
  perspective: 600px;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.cube {
  position: relative;
  width: 88px;
  height: 88px;
  margin-top: 10px;
  transform-style: preserve-3d;
  transform: rotateX(-20deg) rotateY(20deg);
  transition: transform 0.7s cubic-bezier(0.2, 1.4, 0.4, 1);
}
.cube.rolling {
  animation: tumble 0.55s linear infinite;
}
@keyframes tumble {
  from {
    transform: translateY(0) rotateX(0deg) rotateY(0deg);
  }
  50% {
    transform: translateY(-18px) rotateX(180deg) rotateY(360deg);
  }
  to {
    transform: translateY(0) rotateX(360deg) rotateY(720deg);
  }
}
.face {
  position: absolute;
  inset: 0;
  box-sizing: border-box;
  padding: 10px;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(3, 1fr);
  background: var(--paper);
  border: 3px solid var(--ink);
  border-radius: 18px;
  backface-visibility: hidden;
}
.f1 {
  transform: translateZ(44px);
}
.f6 {
  transform: rotateY(180deg) translateZ(44px);
}
.f3 {
  transform: rotateY(90deg) translateZ(44px);
}
.f4 {
  transform: rotateY(-90deg) translateZ(44px);
}
.f2 {
  transform: rotateX(90deg) translateZ(44px);
}
.f5 {
  transform: rotateX(-90deg) translateZ(44px);
}
.cell {
  display: flex;
  align-items: center;
  justify-content: center;
}
.pip {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--ink);
}
.pip.red {
  width: 22px;
  height: 22px;
  background: var(--coral);
}
.shadow {
  width: 80px;
  height: 12px;
  margin-top: 22px;
  border-radius: 50%;
  background: rgba(58, 35, 32, 0.18);
}
.shadow.rolling {
  animation: shrink 0.55s linear infinite;
}
@keyframes shrink {
  50% {
    transform: scaleX(0.6);
    opacity: 0.5;
  }
}
</style>
