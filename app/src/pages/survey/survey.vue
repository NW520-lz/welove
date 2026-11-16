<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { api, showError } from '@/api'
import { store, nextStepUrl } from '@/store'

// 问卷写死在客户端：选项 → 要排除的 tag（见 docs/spec.md「问卷」）
const NOT_EAT = [
  { label: '辣', tag: '辣' },
  { label: '海鲜', tag: '海鲜' },
  { label: '生冷', tag: '生冷' },
  { label: '酒', tag: '酒精' },
]
const NOT_DO = [
  { label: '太累/走太多路', tag: '高体力' },
  { label: '刺激项目', tag: '刺激' },
  { label: '恐怖', tag: '恐怖' },
  { label: '人挤人', tag: '人多' },
  { label: '风吹日晒', tag: '户外' },
  { label: '早起', tag: '早起' },
  { label: '排长队', tag: '排队' },
]

const selected = ref<string[]>([])
const note = ref('')
const editing = ref(false)
const busy = ref(false)

onLoad((query) => {
  editing.value = query?.edit === '1'
  const prefs = store.me?.preferences
  if (prefs) {
    selected.value = [...prefs.excludeTags]
    note.value = prefs.note || ''
  }
})

function toggle(tag: string) {
  const i = selected.value.indexOf(tag)
  if (i >= 0) selected.value.splice(i, 1)
  else selected.value.push(tag)
}

async function save() {
  busy.value = true
  try {
    await api.savePreferences(selected.value, note.value.trim())
    store.me = await api.me()
    if (editing.value) {
      uni.showToast({ title: '已更新' })
      uni.navigateBack()
    } else {
      uni.reLaunch({ url: nextStepUrl(store.me) })
    }
  } catch (e) {
    showError(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <view class="page">
    <view class="title hand">说说你的雷区</view>
    <view class="subtitle">踩雷的卡片不会被抽到，两个人的雷区会合在一起</view>

    <view class="sticker block pop-in">
      <view class="section-label">你不吃什么？</view>
      <view>
        <view
          v-for="o in NOT_EAT"
          :key="o.tag"
          class="chip"
          :class="{ on: selected.includes(o.tag) }"
          @tap="toggle(o.tag)"
          >{{ o.label }}</view
        >
      </view>
    </view>

    <view class="sticker block pop-in" style="animation-delay: 0.08s">
      <view class="section-label mint">你不想做什么？</view>
      <view>
        <view
          v-for="o in NOT_DO"
          :key="o.tag"
          class="chip"
          :class="{ on: selected.includes(o.tag) }"
          @tap="toggle(o.tag)"
          >{{ o.label }}</view
        >
      </view>
    </view>

    <view class="sticker block pop-in" style="animation-delay: 0.16s">
      <view class="section-label blush">还有什么特别不喜欢的？</view>
      <textarea v-model="note" class="note" placeholder="比如：不想去商场、怕猫……（选填）" maxlength="200" />
    </view>

    <view class="btn" :class="{ disabled: busy }" @tap="save">{{ editing ? '保存' : '好了，下一步' }}</view>
  </view>
</template>

<style scoped>
.block {
  margin: 18px 0;
}
.section-label.mint {
  background: var(--mint);
  transform: rotate(1.5deg);
}
.section-label.blush {
  background: var(--blush);
}
.note {
  width: 100%;
  height: 90px;
  padding: 10px 12px;
  box-sizing: border-box;
  border: 2px dashed var(--ink-soft);
  border-radius: 14px;
  font-size: 14px;
}
</style>
