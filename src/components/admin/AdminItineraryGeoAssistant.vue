<script setup>
import { computed, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import AdminDrawer from '@/components/admin/AdminDrawer.vue';
import {
  buildCoordinateAssistantItems,
  buildCoordinateAssistantPrompt,
  parseCoordinateAssistantText,
} from '@/utils/itineraryRoute';
import { Check, Clipboard, ClipboardPaste } from 'lucide-vue-next';

const props = defineProps({
  open: { type: Boolean, default: false },
  items: { type: Array, default: () => [] },
  isSaving: { type: Boolean, default: false },
});

const emit = defineEmits(['update:open', 'apply']);
const jsonText = ref('');
const parseError = ref('');

const drawerOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value),
});

const resetJson = () => {
  jsonText.value = JSON.stringify(
    buildCoordinateAssistantItems(props.items),
    null,
    2
  );
  parseError.value = '';
};

const copyPrompt = async () => {
  try {
    await navigator.clipboard.writeText(
      buildCoordinateAssistantPrompt(props.items)
    );
    ElMessage.success('座標補齊指令已複製');
  } catch {
    ElMessage.error('複製失敗，請手動選取內容');
  }
};

const pasteResponse = async () => {
  try {
    if (!navigator.clipboard?.readText) {
      throw new Error('目前瀏覽器不支援讀取剪貼簿。');
    }
    const text = await navigator.clipboard.readText();
    if (!text.trim()) throw new Error('剪貼簿沒有文字內容。');
    jsonText.value = text;
    parseError.value = '';
    ElMessage.success('已貼上 AI 回覆');
  } catch (error) {
    parseError.value = error.message || '無法讀取剪貼簿';
    ElMessage.error('無法讀取剪貼簿，請在文字區手動貼上');
  }
};

const applyJson = () => {
  try {
    const payload = parseCoordinateAssistantText(jsonText.value);
    jsonText.value = JSON.stringify(payload, null, 2);
    parseError.value = '';
    emit('apply', payload);
  } catch (error) {
    parseError.value = error.message || 'JSON 格式錯誤';
  }
};

watch(
  () => props.open,
  (open) => {
    if (open) resetJson();
  }
);
</script>

<template>
  <AdminDrawer
    v-model="drawerOpen"
    size="md"
    :z-index="130"
    title="補齊景點座標"
    subtitle="補齊後會自動繼續計算本日行車時間"
    :close-on-click-modal="false"
  >
    <div class="flex h-full min-h-0 flex-col">
      <div class="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
        <section class="rounded-xl border border-slate-200 bg-white p-4">
          <p class="text-sm font-black text-slate-800">
            尚有 {{ items.length }} 個路線端點缺少座標
          </p>
          <p class="mt-1 text-xs font-bold leading-relaxed text-slate-400">
            複製指令交給 AI 補齊，再將完整 JSON
            貼回。景點名稱、地圖連結與項目數量不可變更。
          </p>
        </section>

        <textarea
          v-model="jsonText"
          rows="18"
          spellcheck="false"
          class="w-full resize-none rounded-xl bg-slate-950 p-4 font-mono text-xs leading-relaxed text-slate-100 outline-none focus:ring-2 focus:ring-indigo-300"
        ></textarea>
        <p v-if="parseError" class="text-xs font-bold text-red-500">
          {{ parseError }}
        </p>
      </div>

      <footer
        class="grid shrink-0 grid-cols-2 gap-2 border-t border-slate-200 bg-white p-4 sm:grid-cols-3"
      >
        <button
          type="button"
          class="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 text-sm font-black text-slate-600"
          @click="copyPrompt"
        >
          <Clipboard :size="16" />
          複製 AI 指令
        </button>
        <button
          type="button"
          class="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 text-sm font-black text-slate-600"
          @click="pasteResponse"
        >
          <ClipboardPaste :size="16" />
          貼上回覆
        </button>
        <button
          type="button"
          :disabled="isSaving"
          class="col-span-2 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 text-sm font-black text-white disabled:opacity-60 sm:col-span-1"
          @click="applyJson"
        >
          <Check :size="16" />
          {{ isSaving ? '套用中' : '套用並計算' }}
        </button>
      </footer>
    </div>
  </AdminDrawer>
</template>
