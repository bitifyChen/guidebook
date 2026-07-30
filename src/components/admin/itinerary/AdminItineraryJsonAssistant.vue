<script setup>
import { computed, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import {
  Braces,
  Check,
  Clipboard,
  ClipboardCheck,
  RefreshCw,
  Wand2,
  X,
} from 'lucide-vue-next';
import {
  buildDayItineraryJson,
  buildFullItineraryJson,
  buildItineraryAIPrompt,
} from '@/utils/itineraryJsonAssistant';

const props = defineProps({
  open: { type: Boolean, default: false },
  items: { type: Array, default: () => [] },
  dayOptions: { type: Array, default: () => [] },
  selectedDay: { type: Number, default: 1 },
});

const emit = defineEmits(['update:open', 'apply-json']);

const panelOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value),
});

const mode = ref('day');
const day = ref(props.selectedDay || 1);
const jsonText = ref('');
const parseError = ref('');

const dayChoices = computed(() =>
  props.dayOptions.length
    ? props.dayOptions
    : [{ day: props.selectedDay || 1, title: `Day ${props.selectedDay || 1}` }]
);

const sourceJson = computed(() =>
  mode.value === 'day'
    ? buildDayItineraryJson(props.items, day.value)
    : buildFullItineraryJson(props.items)
);

const seedFromSource = () => {
  jsonText.value = JSON.stringify(sourceJson.value, null, 2);
  parseError.value = '';
};

const copyText = async (value, successMessage) => {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = value;
      textarea.setAttribute('readonly', 'readonly');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    ElMessage.success(successMessage);
  } catch {
    ElMessage.error('複製失敗，請手動選取內容');
  }
};

const handleCopyJson = () => {
  copyText(jsonText.value, 'JSON 已複製');
};

const handleCopyWithPrompt = () => {
  const prompt = buildItineraryAIPrompt({
    mode: mode.value,
    day: day.value,
    jsonText: jsonText.value,
  });
  copyText(prompt, '已複製 AI 指令與 JSON');
};

const handleFormat = () => {
  try {
    const parsed = JSON.parse(jsonText.value);
    jsonText.value = JSON.stringify(parsed, null, 2);
    parseError.value = '';
  } catch (error) {
    parseError.value = error.message || 'JSON 格式錯誤';
    ElMessage.error('JSON 格式錯誤，請先修正');
  }
};

const handleApply = () => {
  try {
    const parsed = JSON.parse(jsonText.value);
    parseError.value = '';
    emit('apply-json', {
      mode: mode.value,
      day: day.value,
      payload: parsed,
    });
  } catch (error) {
    parseError.value = error.message || 'JSON 格式錯誤';
    ElMessage.error('JSON 格式錯誤，請先修正');
  }
};

watch(
  () => props.selectedDay,
  (value) => {
    if (value) day.value = value;
  }
);

watch(
  () => panelOpen.value,
  (value) => {
    if (value) seedFromSource();
  }
);

watch([mode, day], () => {
  if (panelOpen.value) seedFromSource();
});
</script>

<template>
  <div class="itinerary-json-shell" :class="{ open: panelOpen }">
    <button type="button" class="json-fab" @click="panelOpen = !panelOpen">
      <Braces :size="18" />
      <span>JSON 模式</span>
    </button>

    <Teleport to="body">
      <div v-if="panelOpen" class="json-portal">
        <aside class="json-panel">
          <header class="json-header">
            <div>
              <p class="eyebrow">AI 編輯助手</p>
              <h3>行程 JSON</h3>
            </div>
            <button
              type="button"
              class="icon-button"
              title="關閉"
              @click="panelOpen = false"
            >
              <X :size="18" />
            </button>
          </header>

          <div class="json-controls">
            <div class="segmented">
              <button
                type="button"
                :class="{ active: mode === 'day' }"
                @click="mode = 'day'"
              >
                單日
              </button>
              <button
                type="button"
                :class="{ active: mode === 'full' }"
                @click="mode = 'full'"
              >
                整份
              </button>
            </div>

            <select
              v-if="mode === 'day'"
              v-model.number="day"
              class="day-select"
            >
              <option
                v-for="option in dayChoices"
                :key="option.day"
                :value="option.day"
              >
                Day {{ option.day
                }}{{ option.title ? ` - ${option.title}` : '' }}
              </option>
            </select>
          </div>

          <textarea
            v-model="jsonText"
            class="json-editor"
            spellcheck="false"
            placeholder="[ ]"
          ></textarea>

          <p v-if="parseError" class="error-text">{{ parseError }}</p>

          <footer class="json-footer">
            <button type="button" class="ghost-button" @click="seedFromSource">
              <RefreshCw :size="15" />
              重載
            </button>
            <button type="button" class="ghost-button" @click="handleFormat">
              <Wand2 :size="15" />
              格式化
            </button>
            <button type="button" class="ghost-button" @click="handleCopyJson">
              <Clipboard :size="15" />
              複製
            </button>
            <button
              type="button"
              class="ghost-button wide"
              @click="handleCopyWithPrompt"
            >
              <ClipboardCheck :size="15" />
              複製含 AI 指令
            </button>
            <button type="button" class="apply-button" @click="handleApply">
              <Check :size="16" />
              套用
            </button>
          </footer>
        </aside>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.itinerary-json-shell {
  position: relative;
  z-index: 30;
  width: fit-content;
}

.json-fab {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 40px;
  padding: 0 14px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 14px;
  color: #e2e8f0;
  background: linear-gradient(135deg, #111827, #020617);
  box-shadow: 0 16px 36px rgba(15, 23, 42, 0.24);
  font-size: 12px;
  font-weight: 900;
}

.json-portal {
  position: fixed;
  inset: 0;
  z-index: 220;
  pointer-events: none;
}

.json-panel {
  position: fixed;
  left: max(16px, calc((100vw - 1180px) / 2 + 16px));
  top: 92px;
  bottom: 24px;
  display: flex;
  flex-direction: column;
  width: min(420px, calc(100vw - 32px));
  max-height: calc(100vh - 116px);
  overflow: hidden;
  pointer-events: auto;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 24px;
  color: #e2e8f0;
  background:
    radial-gradient(
      circle at top right,
      rgba(79, 70, 229, 0.18),
      transparent 28%
    ),
    linear-gradient(180deg, #111827 0%, #020617 100%);
  box-shadow: 0 32px 80px rgba(2, 6, 23, 0.34);
}

.json-header,
.json-footer {
  flex-shrink: 0;
  border-color: rgba(148, 163, 184, 0.14);
  background: rgba(15, 23, 42, 0.72);
  backdrop-filter: blur(18px);
}

.json-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 20px;
  border-bottom-width: 1px;
}

.eyebrow {
  margin: 0 0 4px;
  color: #94a3b8;
  font-size: 11px;
  font-weight: 900;
}

.json-header h3 {
  margin: 0;
  color: white;
  font-size: 18px;
  font-weight: 900;
}

.icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 12px;
  color: #cbd5e1;
  background: rgba(30, 41, 59, 0.78);
}

.json-controls {
  display: grid;
  grid-template-columns: 150px 1fr;
  gap: 10px;
  padding: 14px 18px 0;
}

.segmented {
  display: grid;
  grid-template-columns: 1fr 1fr;
  padding: 3px;
  border-radius: 14px;
  background: rgba(2, 6, 23, 0.6);
}

.segmented button,
.day-select {
  height: 36px;
  border: 0;
  border-radius: 11px;
  font-size: 12px;
  font-weight: 900;
  outline: none;
}

.segmented button {
  color: #94a3b8;
}

.segmented button.active {
  color: white;
  background: rgba(79, 70, 229, 0.92);
}

.day-select {
  min-width: 0;
  padding: 0 12px;
  color: #e2e8f0;
  background: rgba(30, 41, 59, 0.82);
}

.json-editor {
  flex: 1;
  min-height: 0;
  margin: 14px 18px;
  padding: 16px;
  resize: none;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 18px;
  outline: none;
  color: #e2e8f0;
  background: rgba(2, 6, 23, 0.76);
  font-family:
    'JetBrains Mono', 'Fira Code', 'SFMono-Regular', Consolas, monospace;
  font-size: 12px;
  line-height: 1.65;
}

.error-text {
  margin: -6px 20px 12px;
  color: #fca5a5;
  font-size: 12px;
  font-weight: 700;
}

.json-footer {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  padding: 14px;
  border-top-width: 1px;
}

.ghost-button,
.apply-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-width: 0;
  height: 40px;
  border-radius: 13px;
  font-size: 12px;
  font-weight: 900;
}

.ghost-button {
  border: 1px solid rgba(148, 163, 184, 0.14);
  color: #cbd5e1;
  background: rgba(30, 41, 59, 0.78);
}

.ghost-button.wide,
.apply-button {
  grid-column: span 2;
}

.apply-button {
  color: white;
  background: #4f46e5;
}

@media (max-width: 767px) {
  .json-panel {
    left: 12px;
    right: 12px;
    top: 72px;
    bottom: calc(12px + env(safe-area-inset-bottom));
    width: auto;
    max-height: none;
  }
}
</style>
