<template>
  <div class="window-controls">
    <button class="ctrl-btn minimize" @click="minimize" title="最小化">
      <svg width="12" height="12" viewBox="0 0 12 12">
        <rect x="2" y="5.5" width="8" height="1" fill="currentColor" />
      </svg>
    </button>
    <button class="ctrl-btn maximize" @click="toggleMaximize" title="最大化/还原">
      <svg width="12" height="12" viewBox="0 0 12 12">
        <rect x="2" y="2" width="8" height="8" fill="none" stroke="currentColor" stroke-width="1.2" />
      </svg>
    </button>
    <button class="ctrl-btn close" @click="close" title="关闭">
      <svg width="12" height="12" viewBox="0 0 12 12">
        <line x1="2.5" y1="2.5" x2="9.5" y2="9.5" stroke="currentColor" stroke-width="1.3" />
        <line x1="9.5" y1="2.5" x2="2.5" y2="9.5" stroke="currentColor" stroke-width="1.3" />
      </svg>
    </button>
  </div>
</template>

<script setup lang="ts">
// 这些方法会与 JavaFX 的 window.ddmo 对象交互（桌面版）
// 在 Web 版中，这些方法会静默失败或使用浏览器 API
function minimize() {
  if (window.ddmo && window.ddmo.minimize) {
    window.ddmo.minimize()
  } else {
    // Web 版回退：最小化浏览器窗口（非标准，仅作示意）
    window.moveTo?.(0, 0)
  }
}

function toggleMaximize() {
  if (window.ddmo && window.ddmo.maximize) {
    window.ddmo.maximize()
  } else {
    // Web 版回退：全屏切换
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.()
    } else {
      document.exitFullscreen?.()
    }
  }
}

function close() {
  if (window.ddmo && window.ddmo.close) {
    window.ddmo.close()
  } else {
    window.close()
  }
}
</script>

<style scoped>
.window-controls {
  position: fixed;
  top: 8px;
  right: 12px;
  display: flex;
  gap: 6px;
  z-index: 9999;
}

.ctrl-btn {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 6px;
  cursor: pointer;
  color: #666;
  transition: all 0.2s;
}

.ctrl-btn:hover {
  background: rgba(0, 0, 0, 0.1);
  color: #333;
}

.ctrl-btn.close:hover {
  background: #ef4444;
  color: white;
}

/* 暗色主题适配 */
@media (prefers-color-scheme: dark) {
  .ctrl-btn {
    background: rgba(255, 255, 255, 0.1);
    color: #ccc;
  }
  .ctrl-btn:hover {
    background: rgba(255, 255, 255, 0.2);
    color: #fff;
  }
}
</style>
