<script>
let nextGlassId = 0;
</script>
<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { createGlassDisplacement } from '@/utils/glassDisplacement';

// Decorative background only. Use exclusively for navigation and itinerary dates.
const host = ref(null);
const map = ref('');
const enabled = ref(false);
const id = `guidebook-glass-rim-${++nextGlassId}`;
let observer, frame, motion, transparency;
let lastSize = '';
const update = () => {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => {
    if (!host.value || !enabled.value) return;
    const box = host.value.getBoundingClientRect();
    const width = Math.max(1, Math.min(512, Math.round(box.width)));
    const height = Math.max(1, Math.min(160, Math.round(box.height)));
    const size = `${width}:${height}`;
    if (size === lastSize) return;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pixels = ctx.createImageData(width, height);
    pixels.data.set(createGlassDisplacement(width, height));
    ctx.putImageData(pixels, 0, 0);
    map.value = canvas.toDataURL();
    lastSize = size;
  });
};
const preferencesChanged = () => {
  // URL backdrop filters are progressive enhancement, not a Safari/Firefox dependency.
  enabled.value =
    /Chrome|Chromium/.test(navigator.userAgent) &&
    !motion.matches &&
    !transparency.matches;
  update();
};
onMounted(() => {
  motion = matchMedia('(prefers-reduced-motion: reduce)');
  transparency = matchMedia('(prefers-reduced-transparency: reduce)');
  motion.addEventListener('change', preferencesChanged);
  transparency.addEventListener('change', preferencesChanged);
  preferencesChanged();
  observer = new ResizeObserver(update);
  observer.observe(host.value);
});
onUnmounted(() => {
  observer?.disconnect();
  cancelAnimationFrame(frame);
  motion?.removeEventListener('change', preferencesChanged);
  transparency?.removeEventListener('change', preferencesChanged);
});
</script>
<template>
  <div ref="host" class="frontend-glass-surface" aria-hidden="true">
    <svg
      v-if="enabled && map"
      width="0"
      height="0"
      class="glass-filter"
      focusable="false"
    >
      <defs>
        <filter
          :id="id"
          x="0%"
          y="0%"
          width="100%"
          height="100%"
          color-interpolation-filters="sRGB"
        >
          <feImage
            :href="map"
            width="100%"
            height="100%"
            preserveAspectRatio="none"
            result="rim"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="rim"
            scale="22"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
    </svg>
    <div
      class="glass-backdrop"
      :style="
        enabled && map
          ? { backdropFilter: `blur(5px) saturate(150%) url(#${id})` }
          : undefined
      "
    />
    <div class="glass-tint" />
    <div class="glass-rim" />
  </div>
</template>
<style scoped>
.frontend-glass-surface {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  overflow: hidden;
  box-shadow:
    0 12px 32px #0f172a30,
    0 2px 6px #0f172a1a;
}
.glass-filter {
  position: absolute;
}
.glass-backdrop,
.glass-tint,
.glass-rim {
  position: absolute;
  inset: 0;
  border-radius: inherit;
}
.glass-backdrop {
  -webkit-backdrop-filter: blur(16px) saturate(150%);
  backdrop-filter: blur(16px) saturate(150%);
}
.glass-tint {
  background: linear-gradient(145deg, #334155c4, #0f172adb 65%);
}
.glass-rim {
  border: 1px solid #ffffff24;
  background: radial-gradient(ellipse at 12% 0%, #ffffff24, transparent 55%);
  box-shadow:
    inset 0 1px 0 #ffffff75,
    inset 1px 0 0 #ffffff24,
    inset 0 -1px 0 #ffffff30,
    inset -1px 0 0 #fed7aa24;
}
@supports not (
  (backdrop-filter: blur(2px)) or (-webkit-backdrop-filter: blur(2px))
) {
  .glass-tint {
    background: #1e293b;
  }
}
@media (prefers-reduced-transparency: reduce), (forced-colors: active) {
  .glass-backdrop {
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
  }
  .glass-tint {
    background: #1e293b;
  }
  .glass-rim {
    background: none;
  }
}
</style>
