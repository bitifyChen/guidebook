<script setup>
import { Loader2, Save } from 'lucide-vue-next';
import AdminDrawer from '@/components/admin/shared/AdminDrawer.vue';

defineProps({
  open: { type: Boolean, default: false },
  isEditing: { type: Boolean, default: false },
  isSaving: { type: Boolean, default: false },
  form: { type: Object, required: true },
  countryOptions: { type: Array, default: () => [] },
  weatherCityOptions: { type: Array, default: () => [] },
  hasUnknownWeatherCity: { type: Boolean, default: false },
  selectedCountry: { type: Object, required: true },
});

const emit = defineEmits(['update:open', 'close', 'save']);
</script>

<template>
  <AdminDrawer
    :model-value="open"
    :title="isEditing ? '編輯旅程' : '新增旅程'"
    size="md"
    :z-index="80"
    @update:model-value="emit('update:open', $event)"
    @close="emit('close')"
  >
    <div class="flex h-full min-h-0 flex-col bg-white">
      <div class="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label class="space-y-1 md:col-span-2">
            <span class="field-label">旅程名稱</span>
            <input
              v-model="form.title"
              class="admin-input"
              placeholder="例如：北海道之旅"
            />
          </label>
          <label class="space-y-1">
            <span class="field-label">目的地</span>
            <input
              v-model="form.destination"
              class="admin-input"
              placeholder="例如：Hokkaido"
            />
          </label>
          <label class="space-y-1">
            <span class="field-label">國家代碼</span>
            <select v-model="form.countryCode" class="admin-input">
              <option
                v-for="country in countryOptions"
                :key="country.code"
                :value="country.code"
              >
                {{ country.code }} · {{ country.name }}
              </option>
            </select>
          </label>
          <label class="space-y-1 md:col-span-2">
            <span class="field-label">天氣城市</span>
            <select v-model="form.weatherCity" class="admin-input">
              <option v-if="hasUnknownWeatherCity" :value="form.weatherCity">
                既有設定 · {{ form.weatherCity }}
              </option>
              <option
                v-for="city in weatherCityOptions"
                :key="city.name"
                :value="city.name"
              >
                {{ city.label }} · {{ city.name }}
              </option>
            </select>
          </label>
          <div
            class="rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs font-bold text-slate-500 md:col-span-2"
          >
            {{ selectedCountry.name }} 會自動寫入時區
            {{ selectedCountry.timezone }}、幣別
            {{ selectedCountry.currencyCode }}
            {{ selectedCountry.currencySymbol }}。選擇天氣城市會同步帶入經緯度。
          </div>
          <label
            v-for="coordinate in [
              { key: 'latitude', label: '緯度', placeholder: '33.5097' },
              { key: 'longitude', label: '經度', placeholder: '126.5219' },
            ]"
            :key="coordinate.key"
            class="space-y-1"
          >
            <span class="field-label">{{ coordinate.label }}</span>
            <input
              v-model="form[coordinate.key]"
              type="number"
              class="admin-input"
              :placeholder="coordinate.placeholder"
            />
          </label>
          <label
            v-for="date in [
              { key: 'startDate', label: '開始日期' },
              { key: 'endDate', label: '結束日期' },
            ]"
            :key="date.key"
            class="space-y-1"
          >
            <span class="field-label">{{ date.label }}</span>
            <input v-model="form[date.key]" type="date" class="admin-input" />
          </label>
          <label class="space-y-1 md:col-span-2">
            <span class="field-label">旅程狀態</span>
            <select v-model="form.status" class="admin-input">
              <option value="draft">草稿中</option>
              <option value="active">進行中</option>
              <option value="completed">已完成</option>
              <option value="archived">已封存</option>
            </select>
          </label>
          <label
            v-for="code in [
              {
                key: 'publicCode',
                label: '公開瀏覽碼',
                placeholder: '空白時自動產生 6 碼',
              },
              {
                key: 'inviteCode',
                label: '加入旅程碼',
                placeholder: '空白時自動產生 6 碼',
              },
            ]"
            :key="code.key"
            class="space-y-1"
          >
            <span class="field-label">{{ code.label }}</span>
            <input
              v-model="form[code.key]"
              maxlength="6"
              class="admin-input font-mono uppercase"
              :placeholder="code.placeholder"
            />
          </label>
        </div>
      </div>
      <footer
        class="admin-drawer-footer flex justify-end gap-3 border-t border-slate-200 p-5"
      >
        <button
          type="button"
          class="h-11 rounded-xl bg-slate-50 px-5 text-sm font-black text-slate-600"
          @click="emit('close')"
        >
          取消
        </button>
        <button
          type="button"
          :disabled="isSaving"
          class="flex h-11 items-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-black text-white hover:bg-indigo-700 disabled:opacity-50"
          @click="emit('save')"
        >
          <Loader2 v-if="isSaving" class="animate-spin" :size="16" />
          <Save v-else :size="16" /> 儲存
        </button>
      </footer>
    </div>
  </AdminDrawer>
</template>

<style scoped>
.field-label {
  font-size: 11px;
  font-weight: 900;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}
.admin-input {
  width: 100%;
  height: 44px;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #f8fafc;
  padding: 0 12px;
  color: #334155;
  font-size: 14px;
  font-weight: 700;
  outline: none;
}
.admin-input:focus {
  border-color: #a5b4fc;
  background: white;
}
</style>
