<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useTravelStore } from '@/store/travelStore';
import {
  deleteItineraryItem,
  patchItineraryItem,
  postItineraryItem,
} from '@/api/itinerary';
import { uploadImage } from '@/api/storage';
import {
  getItineraryTypeOption,
  ITINERARY_CATEGORY_OPTIONS,
  ITINERARY_TYPE_OPTIONS,
} from '@/constants/itineraryOptions';
import {
  Clock,
  Image,
  Layers,
  Loader2,
  MapPin,
  Plus,
  Trash2,
  Upload,
} from 'lucide-vue-next';

const props = defineProps({
  item: { type: Object, default: null },
  mode: { type: String, default: 'create' },
  compact: { type: Boolean, default: false },
});

const emit = defineEmits(['cancel', 'deleted', 'saved']);

const travelStore = useTravelStore();
const currentItem = ref(null);
const isSaving = ref(false);
const isDeleting = ref(false);
const isUploadingCover = ref(false);
const isUploadingImages = ref(false);
const coverInput = ref(null);
const imagesInput = ref(null);

const isEditMode = computed(() => props.mode === 'edit' && !!currentItem.value?.id);
const hasUnknownCategory = computed(
  () =>
    currentItem.value?.category &&
    !ITINERARY_CATEGORY_OPTIONS.some(
      (option) => option.value === currentItem.value.category
    )
);

const cloneItem = (item) => JSON.parse(JSON.stringify(item || {}));

const getDefaultDay = () =>
  travelStore.selectedDay || travelStore.config[0]?.day || 1;

const getNextOrder = (day) => {
  const orders = travelStore.itinerary
    .filter((item) => Number(item.day) === Number(day))
    .map((item) => Number(item.order) || 0);
  return orders.length ? Math.max(...orders) + 1 : 1;
};

const createDefaultItem = () => {
  const day = getDefaultDay();
  return {
    day,
    type: 'point',
    order: getNextOrder(day),
    parentId: '',
    location: '',
    category: '景點',
    cover: '',
    map: '',
    duration: 0,
    delay: 0,
    nextDrive: { time: 0, km: '' },
    description: '',
    detail: '',
    images: [],
  };
};

const resetForm = () => {
  if (props.mode === 'edit' && props.item) {
    const item = cloneItem(props.item);
    currentItem.value = {
      ...item,
      nextDrive: item.nextDrive || { time: 0, km: 0 },
      images: Array.isArray(item.images) ? item.images : [],
      parentId: item.parentId || '',
      category:
        item.category || getItineraryTypeOption(item.type).defaultCategory,
    };
    return;
  }

  currentItem.value = createDefaultItem();
};

onMounted(async () => {
  if (!travelStore.config.length && !travelStore.itinerary.length) {
    await travelStore.init();
  }
  resetForm();
});

watch(
  () => [props.item, props.mode],
  () => resetForm(),
  { deep: true }
);

watch(
  () => currentItem.value?.day,
  (day, oldDay) => {
    if (!currentItem.value || isEditMode.value || !day || day === oldDay) return;
    currentItem.value.order = getNextOrder(day);
    currentItem.value.parentId = '';
  }
);

watch(
  () => currentItem.value?.type,
  (type, oldType) => {
    if (!currentItem.value || !type || type === oldType) return;
    const oldDefault = getItineraryTypeOption(oldType).defaultCategory;
    if (!currentItem.value.category || currentItem.value.category === oldDefault) {
      currentItem.value.category = getItineraryTypeOption(type).defaultCategory;
    }
  }
);

const availableParents = computed(() => {
  if (!currentItem.value) return [];
  return travelStore.itinerary.filter(
    (item) =>
      Number(item.day) === Number(currentItem.value.day) &&
      item.id !== currentItem.value.id &&
      item.type !== 'transport' &&
      !item.parentId
  );
});

const addImage = () => {
  if (!currentItem.value.images) currentItem.value.images = [];
  currentItem.value.images.push('');
};

const removeImage = (index) => {
  currentItem.value.images.splice(index, 1);
};

const handleCoverUpload = async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  isUploadingCover.value = true;
  try {
    currentItem.value.cover = await uploadImage(file);
  } catch (error) {
    alert(`封面上傳失敗：${error.message}`);
  } finally {
    isUploadingCover.value = false;
    event.target.value = '';
  }
};

const handleImagesUpload = async (event) => {
  const files = Array.from(event.target.files || []);
  if (!files.length) return;

  isUploadingImages.value = true;
  try {
    const urls = await Promise.all(files.map((file) => uploadImage(file)));
    currentItem.value.images.push(...urls);
  } catch (error) {
    alert(`圖片上傳失敗：${error.message}`);
  } finally {
    isUploadingImages.value = false;
    event.target.value = '';
  }
};

const normalizeItem = () => {
  const { id, startTime, endTime, updatedAt, ...data } = cloneItem(currentItem.value);
  data.day = Number(data.day) || getDefaultDay();
  data.order = Number(data.order) || getNextOrder(data.day);
  data.delay = Number(data.delay) || 0;
  data.nextDrive = data.nextDrive || { time: 0, km: '' };
  data.images = Array.isArray(data.images)
    ? data.images.map((url) => String(url || '').trim()).filter(Boolean)
    : [];

  if (data.parentId) {
    data.duration = 0;
    data.nextDrive.time = 0;
    data.nextDrive.km = '0';
  } else {
    data.duration = Number(data.duration) || 0;
    data.nextDrive.time = Number(data.nextDrive.time) || 0;
  }

  return { id, data };
};

const handleSave = async () => {
  if (!currentItem.value?.location?.trim()) {
    alert('請填寫地點名稱');
    return;
  }

  isSaving.value = true;
  try {
    const { id, data } = normalizeItem();
    const timeChanged =
      !isEditMode.value ||
      Number(data.duration || 0) !== Number(props.item?.duration || 0) ||
      Number(data.delay || 0) !== Number(props.item?.delay || 0);
    let savedId = id;
    if (isEditMode.value) {
      await patchItineraryItem(id, data);
    } else {
      const result = await postItineraryItem(data);
      savedId = result.id;
    }
    await travelStore.init();
    emit('saved', {
      item: { ...data, id: savedId },
      timeChanged,
      action: isEditMode.value ? 'updated' : 'created',
    });
  } catch (error) {
    alert(`儲存失敗：${error.message}`);
  } finally {
    isSaving.value = false;
  }
};

const handleDelete = async () => {
  if (!isEditMode.value || !confirm('確定要刪除此行程項目嗎？')) return;

  isDeleting.value = true;
  try {
    const deletedItem = cloneItem(currentItem.value);
    await deleteItineraryItem(currentItem.value.id);
    await travelStore.init();
    emit('deleted', {
      item: deletedItem,
      timeChanged: true,
      action: 'deleted',
    });
  } catch (error) {
    alert(`刪除失敗：${error.message}`);
  } finally {
    isDeleting.value = false;
  }
};
</script>

<template>
  <form
    v-if="currentItem"
    class="admin-itinerary-form flex h-full min-h-0 flex-col bg-slate-50"
    @submit.prevent="handleSave"
  >
    <div
      class="flex min-h-16 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-5"
    >
      <div class="min-w-0">
        <p class="text-xs font-bold text-slate-400">
          {{ isEditMode ? '編輯行程' : '新增行程' }}
        </p>
        <h3 class="truncate text-lg font-black text-slate-900">
          {{ currentItem.location || '行程項目' }}
        </h3>
      </div>
      <div class="hidden shrink-0 items-center gap-2 pr-14 sm:flex">
        <button
          type="button"
          class="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-50"
          @click="emit('cancel')"
        >
          取消
        </button>
        <button
          type="submit"
          :disabled="isSaving"
          class="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-black text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60"
        >
          {{ isSaving ? '儲存中' : '儲存' }}
        </button>
      </div>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5 sm:py-5">
      <div class="mx-auto max-w-2xl space-y-5">
        <section class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label class="space-y-1">
              <span class="text-[11px] font-black text-slate-400">天數</span>
              <select
                v-model="currentItem.day"
                class="w-full rounded-xl bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700 outline-none"
              >
                <option v-for="day in travelStore.config" :key="day.day" :value="day.day">
                  Day {{ day.day }}
                </option>
              </select>
            </label>
            <label class="space-y-1">
              <span class="text-[11px] font-black text-slate-400">類型</span>
              <select
                v-model="currentItem.type"
                class="w-full rounded-xl bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700 outline-none"
              >
                <option
                  v-for="option in ITINERARY_TYPE_OPTIONS"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </option>
              </select>
            </label>
            <label class="space-y-1">
              <span class="text-[11px] font-black text-slate-400">排序</span>
              <input
                v-model.number="currentItem.order"
                type="number"
                class="w-full rounded-xl bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700 outline-none"
              />
            </label>
          </div>

          <label class="mt-4 flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
            <Layers :size="18" class="text-indigo-500" />
            <div class="min-w-0 flex-1">
              <span class="block text-[11px] font-black text-slate-400">
                歸屬主行程
              </span>
              <select
                v-model="currentItem.parentId"
                class="w-full bg-transparent text-sm font-bold text-slate-700 outline-none"
              >
                <option value="">獨立行程</option>
                <option v-for="parent in availableParents" :key="parent.id" :value="parent.id">
                  {{ parent.location }}
                </option>
              </select>
            </div>
          </label>
        </section>

        <section class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div class="space-y-4">
            <input
              v-model="currentItem.location"
              class="w-full border-b border-slate-100 pb-3 text-xl font-black text-slate-900 outline-none focus:border-indigo-200"
              placeholder="地點名稱"
            />
            <select
              v-model="currentItem.category"
              class="w-full bg-transparent text-sm font-bold text-indigo-600 outline-none"
            >
              <option
                v-if="hasUnknownCategory"
                :value="currentItem.category"
              >
                {{ currentItem.category }}（既有分類）
              </option>
              <option
                v-for="option in ITINERARY_CATEGORY_OPTIONS"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>
          </div>
        </section>

        <section class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div class="space-y-3">
            <div class="flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
              <Image :size="18" class="text-slate-400" />
              <input
                v-model="currentItem.cover"
                class="min-w-0 flex-1 bg-transparent text-xs font-medium outline-none"
                placeholder="封面圖片 URL"
              />
              <input
                ref="coverInput"
                type="file"
                accept="image/*"
                class="hidden"
                @change="handleCoverUpload"
              />
              <button
                type="button"
                :disabled="isUploadingCover"
                class="rounded-lg border border-slate-200 bg-white p-2 text-slate-400 hover:text-indigo-600 disabled:opacity-60"
                @click="coverInput?.click()"
              >
                <Loader2 v-if="isUploadingCover" :size="14" class="animate-spin" />
                <Upload v-else :size="14" />
              </button>
            </div>
            <div
              v-if="currentItem.cover"
              class="aspect-video overflow-hidden rounded-2xl border border-slate-100 bg-slate-100"
            >
              <img :src="currentItem.cover" class="h-full w-full object-cover" />
            </div>
            <div class="flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
              <MapPin :size="18" class="text-slate-400" />
              <input
                v-model="currentItem.map"
                class="min-w-0 flex-1 bg-transparent text-xs font-medium outline-none"
                placeholder="地圖連結"
              />
            </div>
          </div>
        </section>

        <section class="relative rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div
            v-if="currentItem.parentId"
            class="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-white/70 p-6 text-center backdrop-blur-sm"
          >
            <div class="rounded-2xl border border-slate-100 bg-white p-4 shadow-lg">
              <Clock :size="28" class="mx-auto mb-2 text-indigo-500" />
              <p class="text-xs font-black text-slate-700">時間由主行程控制</p>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <label class="rounded-2xl bg-slate-50 p-3">
              <span class="block text-[11px] font-black text-slate-400">停留分鐘</span>
              <input
                v-model.number="currentItem.duration"
                type="number"
                class="w-full bg-transparent font-mono font-black text-slate-700 outline-none"
              />
            </label>
            <label class="rounded-2xl bg-orange-50 p-3">
              <span class="block text-[11px] font-black text-orange-400">延遲分鐘</span>
              <input
                v-model.number="currentItem.delay"
                type="number"
                class="w-full bg-transparent font-mono font-black text-orange-700 outline-none"
              />
            </label>
          </div>
          <div class="mt-3 rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
            <span class="block text-[11px] font-black text-blue-500">
              前往下一站
            </span>
            <div class="mt-2 grid grid-cols-2 gap-3">
              <label>
                <span class="block text-[10px] font-bold text-blue-300">分鐘</span>
                <input
                  v-model.number="currentItem.nextDrive.time"
                  type="number"
                  class="w-full rounded-xl bg-white px-3 py-2 text-sm font-black text-blue-700 outline-none"
                />
              </label>
              <label>
                <span class="block text-[10px] font-bold text-blue-300">公里</span>
                <input
                  v-model="currentItem.nextDrive.km"
                  class="w-full rounded-xl bg-white px-3 py-2 text-sm font-black text-blue-700 outline-none"
                />
              </label>
            </div>
          </div>
        </section>

        <section class="space-y-3">
          <textarea
            v-model="currentItem.description"
            rows="2"
            class="w-full rounded-2xl border border-slate-200 bg-white p-4 text-sm font-bold text-slate-600 outline-none focus:border-indigo-200"
            placeholder="短描述"
          ></textarea>
          <textarea
            v-model="currentItem.detail"
            rows="6"
            class="w-full rounded-2xl border border-slate-200 bg-white p-5 text-sm font-medium leading-relaxed text-slate-600 outline-none focus:border-indigo-200"
            placeholder="詳細內容，可輸入 HTML"
          ></textarea>
        </section>

        <section class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h4 class="text-xs font-black text-slate-400">圖片列表</h4>
            <div class="flex items-center gap-2">
              <input
                ref="imagesInput"
                type="file"
                accept="image/*"
                multiple
                class="hidden"
                @change="handleImagesUpload"
              />
              <button
                type="button"
                :disabled="isUploadingImages"
                class="flex items-center gap-1 rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-black text-indigo-600 disabled:opacity-60"
                @click="imagesInput?.click()"
              >
                <Loader2 v-if="isUploadingImages" :size="12" class="animate-spin" />
                <Upload v-else :size="12" />
                上傳
              </button>
              <button
                type="button"
                class="flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-600"
                @click="addImage"
              >
                <Plus :size="12" />
                新增 URL
              </button>
            </div>
          </div>
          <div class="space-y-3">
            <div
              v-for="(img, index) in currentItem.images"
              :key="index"
              class="rounded-2xl border border-slate-100 bg-slate-50 p-3"
            >
              <div class="flex items-center gap-2">
                <span
                  class="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-xs font-black text-slate-400"
                >
                  {{ index + 1 }}
                </span>
                <input
                  v-model="currentItem.images[index]"
                  class="min-w-0 flex-1 rounded-xl bg-white px-3 py-2 text-xs font-medium outline-none"
                  placeholder="Image URL"
                />
                <button
                  type="button"
                  class="rounded-lg p-2 text-red-300 hover:text-red-500"
                  @click="removeImage(index)"
                >
                  <Trash2 :size="16" />
                </button>
              </div>
              <div
                v-if="img"
                class="mt-3 aspect-video overflow-hidden rounded-xl bg-slate-100"
              >
                <img :src="img" class="h-full w-full object-cover" />
              </div>
            </div>
          </div>
        </section>

        <section v-if="isEditMode" class="border-t border-slate-200 pt-5">
          <button
            type="button"
            :disabled="isDeleting"
            class="w-full rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-black text-red-600 hover:bg-red-100 disabled:opacity-60"
            @click="handleDelete"
          >
            {{ isDeleting ? '刪除中' : '刪除此行程' }}
          </button>
        </section>
      </div>
    </div>

    <footer
      class="grid shrink-0 grid-cols-2 gap-2 border-t border-slate-200 bg-white p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:hidden"
    >
      <button
        type="button"
        class="h-11 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-600"
        @click="emit('cancel')"
      >
        取消
      </button>
      <button
        type="submit"
        :disabled="isSaving"
        class="h-11 rounded-xl bg-indigo-600 text-sm font-black text-white disabled:opacity-60"
      >
        {{ isSaving ? '儲存中' : '儲存' }}
      </button>
    </footer>
  </form>
</template>
