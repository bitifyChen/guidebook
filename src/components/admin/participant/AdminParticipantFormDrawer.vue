<script setup>
import { ref } from 'vue';
import { Loader2, Route, Save, Trash2, Upload, User } from 'lucide-vue-next';
import AdminDrawer from '@/components/admin/shared/AdminDrawer.vue';
import AdminParticipantFormNotification from './AdminParticipantFormNotification.vue';
import AdminParticipantFormTracking from './AdminParticipantFormTracking.vue';

defineProps({
  open: { type: Boolean, default: false },
  editingId: { type: String, default: '' },
  form: { type: Object, required: true },
  isSaving: { type: Boolean, default: false },
  isUploading: { type: Boolean, default: false },
  tripSearch: { type: String, default: '' },
  selectableTrips: { type: Array, default: () => [] },
  notificationStatusLabel: { type: String, default: '未啟用' },
  notificationStatusClass: { type: String, default: '' },
  pushTokens: { type: Array, default: () => [] },
  pushEnabled: { type: Boolean, default: false },
  isTestPushSending: { type: Boolean, default: false },
  activeTrackingToken: { type: Object, default: null },
  isTrackingLoading: { type: Boolean, default: false },
  isTrackingCreating: { type: Boolean, default: false },
  isTrackingRemoving: { type: Boolean, default: false },
  trackingCopied: { type: Boolean, default: false },
});

const emit = defineEmits([
  'update:open',
  'update:trip-search',
  'close',
  'save',
  'delete',
  'toggle-trip',
  'avatar-paste',
  'avatar-file',
  'send-test',
  'copy-tracking',
  'remove-tracking',
  'enable-tracking',
]);

const fileInput = ref(null);
</script>

<template>
  <AdminDrawer
    :model-value="open"
    :title="editingId ? '編輯成員' : '新增成員'"
    size="sm"
    :z-index="80"
    @update:model-value="emit('update:open', $event)"
    @close="emit('close')"
  >
    <div class="flex h-full min-h-0 flex-col bg-white">
      <div class="flex-1 space-y-6 overflow-y-auto p-4 sm:p-5">
        <section
          tabindex="0"
          class="flex flex-col items-center"
          @paste="emit('avatar-paste', $event)"
        >
          <div
            class="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 text-slate-300"
          >
            <img
              v-if="form.avatar"
              :src="form.avatar"
              class="h-full w-full object-cover"
            />
            <User v-else :size="34" />
            <div
              v-if="isUploading"
              class="absolute inset-0 flex items-center justify-center bg-white/80"
            >
              <Loader2 class="animate-spin text-indigo-500" :size="24" />
            </div>
          </div>
          <input
            ref="fileInput"
            type="file"
            class="hidden"
            accept="image/*"
            @change="emit('avatar-file', $event)"
          />
          <div class="mt-3 flex gap-4">
            <button
              type="button"
              class="text-xs font-black text-indigo-600"
              @click="fileInput?.click()"
            >
              <Upload :size="14" class="mr-1 inline" />
              {{ form.avatar ? '更換照片' : '上傳照片' }}
            </button>
            <button
              v-if="form.avatar"
              type="button"
              class="text-xs font-black text-red-500"
              @click="form.avatar = ''"
            >
              移除
            </button>
          </div>
        </section>

        <label class="block space-y-1">
          <span class="field-label">成員名稱</span>
          <input
            v-model="form.name"
            class="admin-input"
            placeholder="例如：陳陳"
          />
        </label>

        <section class="space-y-2">
          <div class="field-label">參加旅程</div>
          <input
            :value="tripSearch"
            class="admin-input"
            placeholder="搜尋旅程名稱、目的地、邀請碼"
            @input="emit('update:trip-search', $event.target.value)"
          />
          <div
            class="max-h-72 space-y-2 overflow-y-auto rounded-2xl border border-slate-100 bg-slate-50 p-2"
          >
            <button
              v-for="trip in selectableTrips"
              :key="trip.id"
              type="button"
              class="flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left"
              :class="
                form.tripIds.includes(trip.id)
                  ? 'border-indigo-200 bg-indigo-50'
                  : 'border-slate-100 bg-white'
              "
              @click="emit('toggle-trip', trip.id)"
            >
              <span class="min-w-0">
                <span
                  class="block truncate text-sm font-black text-slate-700"
                  >{{ trip.title }}</span
                >
                <span
                  class="block truncate text-[10px] font-bold text-slate-400"
                >
                  {{ trip.destination || '未設定目的地' }} ·
                  {{ trip.inviteCode || '未設定邀請碼' }}
                </span>
              </span>
              <span
                class="shrink-0 rounded-lg px-2 py-1 text-[10px] font-black"
                :class="
                  form.tripIds.includes(trip.id)
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-slate-400'
                "
                >{{
                  form.tripIds.includes(trip.id) ? '已加入' : '未加入'
                }}</span
              >
            </button>
            <div
              v-if="!selectableTrips.length"
              class="py-8 text-center text-xs font-bold text-slate-400"
            >
              沒有符合條件的旅程
            </div>
          </div>
        </section>

        <section class="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
          <button
            v-for="role in [
              {
                key: 'isAdmin',
                title: 'Admin',
                description: '可管理旅程資料',
                tone: 'blue',
              },
              {
                key: 'isSuperAdmin',
                title: 'Super Admin',
                description: '可管理旅程與成員',
                tone: 'indigo',
              },
            ]"
            :key="role.key"
            type="button"
            class="rounded-xl border-2 p-4 text-left"
            :class="{
              'border-slate-100 bg-slate-50': !form[role.key],
              'border-blue-500 bg-blue-50':
                form[role.key] && role.tone === 'blue',
              'border-indigo-500 bg-indigo-50':
                form[role.key] && role.tone === 'indigo',
            }"
            @click="form[role.key] = !form[role.key]"
          >
            <span
              class="block text-[11px] font-black"
              :class="{
                'text-slate-400': !form[role.key],
                'text-blue-600': form[role.key] && role.tone === 'blue',
                'text-indigo-600': form[role.key] && role.tone === 'indigo',
              }"
              >{{ role.title }}</span
            >
            <span class="mt-1 block text-[10px] font-bold text-slate-400">{{
              role.description
            }}</span>
          </button>
        </section>

        <label
          class="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4"
        >
          <span
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-indigo-600"
            ><Route :size="18" :stroke-width="2.4"
          /></span>
          <span class="min-w-0 flex-1">
            <span class="block text-sm font-black text-slate-800"
              >查看隊友歷史軌跡</span
            >
            <span class="mt-1 block text-[10px] font-bold text-slate-400"
              >開啟後可在位置頁查看其他成員指定日期的路線</span
            >
          </span>
          <input
            v-model="form.canViewTeamLocationHistory"
            type="checkbox"
            class="h-5 w-5 shrink-0 accent-indigo-600"
          />
        </label>

        <AdminParticipantFormNotification
          v-if="editingId"
          :status-label="notificationStatusLabel"
          :status-class="notificationStatusClass"
          :tokens="pushTokens"
          :enabled="pushEnabled"
          :is-sending="isTestPushSending"
          @send-test="emit('send-test')"
        />
        <AdminParticipantFormTracking
          v-if="editingId"
          :active-token="activeTrackingToken"
          :is-loading="isTrackingLoading"
          :is-creating="isTrackingCreating"
          :is-removing="isTrackingRemoving"
          :copied="trackingCopied"
          @copy="emit('copy-tracking')"
          @remove="emit('remove-tracking')"
          @enable="emit('enable-tracking')"
        />
        <section
          v-if="editingId"
          class="rounded-2xl border border-red-100 bg-red-50 p-4"
        >
          <h4 class="mb-2 font-black text-red-700">刪除成員</h4>
          <p class="mb-3 text-xs font-bold leading-relaxed text-red-400">
            刪除後這位成員不能再用原邀請碼登入，既有錢包資料不會自動刪除。
          </p>
          <button
            type="button"
            class="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-white text-sm font-black text-red-600"
            @click="emit('delete')"
          >
            <Trash2 :size="16" /> 刪除成員
          </button>
        </section>
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
          class="flex h-11 items-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-black text-white disabled:opacity-50"
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
