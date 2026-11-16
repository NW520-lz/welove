<script setup lang="ts">
import { onLaunch } from '@dcloudio/uni-app'
onLaunch(() => {})
</script>

<style>
/* 标题字体：站酷快乐体（SIL OFL 1.1，授权见 static/fonts/ZCOOL-KuaiLe-OFL.txt），
   只保留国标一级常用字和页面、刮刮乐用到的字。系统里没有的字会退回下面的系统字体 */
@font-face {
  font-family: 'ZCOOL KuaiLe';
  src: url('/static/fonts/zcool-kuaile.woff') format('woff');
  font-display: swap;
}

/* 视觉方向：贴纸手账 —— 奶油纸底 + 珊瑚粉 + 可可色描边和错位硬阴影 */
page {
  --coral: #ff6b5e;
  --coral-deep: #e84f45;
  --blush: #ffd9cf;
  --cream: #fff4ea;
  --paper: #fffdf8;
  --ink: #3a2320;
  --ink-soft: #8a6a63;
  --butter: #ffd36b;
  --mint: #7ed8bc;
  --rare: #3fb894;
  --gold-a: #ffcf4a;
  --gold-b: #ff8a5b;
  background-color: var(--cream);
  background-image: radial-gradient(var(--blush) 1.4px, transparent 1.4px);
  background-size: 18px 18px;
  color: var(--ink);
  font-family: 'PingFang SC', 'HarmonyOS Sans SC', 'MiSans', 'Noto Sans SC', 'Microsoft YaHei', sans-serif;
  font-size: 15px;
  line-height: 1.5;
}

.page {
  min-height: 100vh;
  padding: 24px 20px 48px;
  box-sizing: border-box;
}

.hand {
  font-family: 'ZCOOL KuaiLe', 'PingFang SC', 'HarmonyOS Sans SC', 'MiSans', 'Noto Sans SC', 'Microsoft YaHei', sans-serif;
  /* 快乐体只有一个字重，禁止浏览器伪造粗体 */
  font-synthesis: none;
}

.title {
  font-size: 30px;
  font-weight: 900;
  letter-spacing: 1px;
  line-height: 1.25;
}

.subtitle {
  color: var(--ink-soft);
  font-size: 14px;
  margin-top: 6px;
}

.section-label {
  display: inline-block;
  font-size: 13px;
  font-weight: 800;
  padding: 2px 10px;
  border: 2px solid var(--ink);
  border-radius: 999px;
  background: var(--butter);
  transform: rotate(-2deg);
  margin-bottom: 10px;
}

.sticker {
  background: var(--paper);
  border: 2.5px solid var(--ink);
  border-radius: 20px;
  box-shadow: 4px 4px 0 var(--ink);
  padding: 16px;
}

.btn {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 52px;
  padding: 0 20px;
  border: 2.5px solid var(--ink);
  border-radius: 18px;
  background: var(--coral);
  color: var(--ink);
  font-size: 17px;
  font-weight: 800;
  letter-spacing: 1px;
  box-shadow: 4px 4px 0 var(--ink);
  transition: transform 0.08s, box-shadow 0.08s;
}
.btn:active {
  transform: translate(3px, 3px);
  box-shadow: 1px 1px 0 var(--ink);
}
.btn.ghost {
  background: var(--paper);
  color: var(--ink);
}
.btn.butter {
  background: var(--butter);
  color: var(--ink);
}
.btn.small {
  height: 38px;
  font-size: 14px;
  border-radius: 14px;
  box-shadow: 3px 3px 0 var(--ink);
}
.btn.disabled {
  opacity: 0.45;
  pointer-events: none;
}

.input {
  height: 50px;
  padding: 0 16px;
  border: 2.5px solid var(--ink);
  border-radius: 16px;
  background: var(--paper);
  font-size: 16px;
}

.chip {
  display: inline-flex;
  align-items: center;
  padding: 8px 14px;
  margin: 0 10px 10px 0;
  border: 2px solid var(--ink);
  border-radius: 999px;
  background: var(--paper);
  font-size: 14px;
  font-weight: 700;
  transition: transform 0.15s;
}
.chip.on {
  background: var(--coral);
  color: var(--ink);
  transform: rotate(-3deg) scale(1.04);
}

.pop-in {
  animation: pop-in 0.45s cubic-bezier(0.2, 1.6, 0.4, 1) both;
}
@keyframes pop-in {
  from {
    opacity: 0;
    transform: scale(0.85) translateY(12px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
</style>
