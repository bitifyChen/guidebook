<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import {
  Clock,
  X,
  FileText,
  ChevronRight,
  ChevronLeft,
  CarFront,
  Image,
  LogIn,
  LogOut,
  Navigation,
} from 'lucide-vue-next';
// 引入 Swiper Vue 元件
import { Swiper, SwiperSlide } from 'swiper/vue';
import { Pagination, Zoom } from 'swiper/modules';

// 引入 Swiper 樣式
import 'swiper/css';
import 'swiper/css/pagination';
import 'swiper/css/zoom';
import { calculateStayMinutes } from '@/utils/itineraryTiming';

const props = defineProps({
  item: {
    type: Object,
    default: () => ({}),
  },
  parentItem: {
    type: Object,
    default: null,
  },
  timeLine: {
    type: Boolean,
    default: true,
  },
  isLast: {
    type: Boolean,
    default: false,
  },
  isNow: {
    type: Boolean,
    default: false,
  },
  isNext: {
    type: Boolean,
    default: false,
  },
  easyMode: {
    type: Boolean,
    default: false,
  },
  canManageTiming: {
    type: Boolean,
    default: false,
  },
  featured: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['adjust-timing']);

const drawerVisible = ref(false);
const galleryVisible = ref(false);
const galleryIndex = ref(0);
const gallerySwiper = ref(null);
const galleryCloseButton = ref(null);
let galleryTrigger = null;
let gallerySwipeStart = null;
let gallerySwipeTimer = null;
const openGallery = (index, event) => {
  galleryTrigger = event.currentTarget;
  galleryIndex.value = index;
  galleryVisible.value = true;
  nextTick(() => galleryCloseButton.value?.focus());
};
const closeGallery = () => {
  window.clearTimeout(gallerySwipeTimer);
  gallerySwipeStart = null;
  galleryVisible.value = false;
  gallerySwiper.value = null;
  nextTick(() => galleryTrigger?.focus());
};
const stepGallery = (direction) => {
  if (direction < 0) gallerySwiper.value?.slidePrev();
  else gallerySwiper.value?.slideNext();
};
const startGallerySwipe = (event) => {
  if (event.touches.length !== 1) {
    gallerySwipeStart = null;
    return;
  }
  const touch = event.touches[0];
  gallerySwipeStart = {
    x: touch.clientX,
    y: touch.clientY,
    index: gallerySwiper.value?.activeIndex,
  };
};
const finishGallerySwipe = (event) => {
  const start = gallerySwipeStart;
  gallerySwipeStart = null;
  if (!start || event.touches.length || gallerySwiper.value?.zoom?.scale > 1.01)
    return;
  const touch = event.changedTouches[0];
  if (!touch) return;
  const dx = touch.clientX - start.x;
  const dy = touch.clientY - start.y;
  if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.25) return;

  // If Swiper already handled the gesture, avoid advancing a second photo.
  gallerySwipeTimer = window.setTimeout(() => {
    if (
      galleryVisible.value &&
      gallerySwiper.value?.activeIndex === start.index
    )
      stepGallery(dx < 0 ? 1 : -1);
  }, 60);
};
const sheetExpanded = ref(false);
const sheetDragTop = ref(null);
const sheetDragging = ref(false);
const sheetTop = computed(() =>
  sheetDragTop.value !== null
    ? `${sheetDragTop.value}px`
    : sheetExpanded.value
      ? '25%'
      : 'calc(100% - 176px - env(safe-area-inset-bottom))'
);
const detailHistoryKey = '__guidebookItineraryDetail';
const detailHistoryToken = `${props.item?.id || 'item'}-${Math.random().toString(36).slice(2)}`;
let ownsDetailHistory = false;
let activeSheetGesture = null;
let sheetHandleDragged = false;

const isGestureControl = (target) => {
  const element = target instanceof Element ? target : target?.parentElement;
  if (!element || element.closest('.detail-sheet-handle')) return false;
  return Boolean(
    element.closest(
      'button, a, input, select, textarea, [role="button"], .gallery-swiper'
    )
  );
};
const beginSheetGesture = (x, y, surface, target, kind) => {
  if (!hasImmersiveCover.value || isGestureControl(target)) return;
  const drawer = surface.closest('.itinerary-detail-drawer');
  const panel = drawer?.querySelector('.detail-scroll');
  if (!drawer || !panel) return;
  const element = target instanceof Element ? target : target?.parentElement;
  activeSheetGesture = {
    kind,
    startX: x,
    startY: y,
    startTop:
      panel.getBoundingClientRect().top - drawer.getBoundingClientRect().top,
    minTop: drawer.clientHeight * 0.25,
    maxTop: drawer.clientHeight - 176,
    startedExpanded: sheetExpanded.value,
    fromPanel: Boolean(element?.closest('.detail-scroll')),
    fromHandle: Boolean(element?.closest('.detail-sheet-handle')),
    scrollTop: panel.scrollTop,
    panel,
    axis: '',
    dragged: false,
  };
  sheetHandleDragged = false;
};
const moveSheetGesture = (x, y, event) => {
  const gesture = activeSheetGesture;
  if (!gesture) return;
  const dx = x - gesture.startX;
  const dy = y - gesture.startY;
  if (!gesture.axis) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 9) return;
    gesture.axis =
      Math.abs(dx) > Math.abs(dy) * 1.25 ? 'horizontal' : 'vertical';
  }
  if (gesture.axis === 'horizontal') {
    if (dx < 0 && event.cancelable) event.preventDefault();
    return;
  }
  if (
    gesture.startedExpanded &&
    gesture.fromPanel &&
    (dy <= 0 || gesture.scrollTop > 0 || gesture.panel.scrollTop > 0)
  ) {
    return;
  }
  if (event.cancelable) event.preventDefault();
  sheetDragging.value = true;
  gesture.dragged = true;
  sheetDragTop.value = Math.max(
    gesture.minTop,
    Math.min(gesture.maxTop, gesture.startTop + dy)
  );
  if (gesture.fromHandle) sheetHandleDragged = true;
};
const finishSheetGesture = (x, y) => {
  const gesture = activeSheetGesture;
  if (!gesture) return;
  const dx = x - gesture.startX;
  const dy = y - gesture.startY;
  if (
    gesture.axis === 'horizontal' &&
    dx < -72 &&
    Math.abs(dx) > Math.abs(dy) * 1.3
  ) {
    if (gesture.fromHandle) sheetHandleDragged = true;
    drawerVisible.value = false;
  } else if (gesture.dragged && Math.abs(dy) > 36) {
    sheetExpanded.value = dy < 0;
  }
  activeSheetGesture = null;
  sheetDragging.value = false;
  sheetDragTop.value = null;
};
const cancelSheetGesture = () => {
  activeSheetGesture = null;
  sheetDragging.value = false;
  sheetDragTop.value = null;
};
const startSheetPointer = (event) => {
  if (event.pointerType === 'touch' || event.button !== 0) return;
  beginSheetGesture(
    event.clientX,
    event.clientY,
    event.currentTarget,
    event.target,
    'pointer'
  );
  if (activeSheetGesture) {
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }
};
const moveSheetPointer = (event) => {
  if (activeSheetGesture?.kind !== 'pointer') return;
  moveSheetGesture(event.clientX, event.clientY, event);
};
const finishSheetPointer = (event) => {
  if (activeSheetGesture?.kind !== 'pointer') return;
  finishSheetGesture(event.clientX, event.clientY);
};
const cancelSheetPointer = () => {
  if (activeSheetGesture?.kind === 'pointer') cancelSheetGesture();
};
const startSheetTouch = (event) => {
  if (event.touches.length !== 1) return;
  const touch = event.touches[0];
  beginSheetGesture(
    touch.clientX,
    touch.clientY,
    event.currentTarget,
    event.target,
    'touch'
  );
};
const moveSheetTouch = (event) => {
  if (activeSheetGesture?.kind !== 'touch' || event.touches.length !== 1)
    return;
  const touch = event.touches[0];
  moveSheetGesture(touch.clientX, touch.clientY, event);
};
const finishSheetTouch = (event) => {
  if (activeSheetGesture?.kind !== 'touch') return;
  const touch = event.changedTouches[0];
  if (touch) finishSheetGesture(touch.clientX, touch.clientY);
  else cancelSheetGesture();
};
const cancelSheetTouch = () => {
  if (activeSheetGesture?.kind === 'touch') cancelSheetGesture();
};
const toggleSheet = () => {
  if (sheetHandleDragged) {
    sheetHandleDragged = false;
    return;
  }
  sheetExpanded.value = !sheetExpanded.value;
};

import { lockScroll, unlockScroll } from '@/utils/scrollLock';
watch(drawerVisible, (val) => {
  if (val) {
    sheetExpanded.value = false;
    sheetDragTop.value = null;
    lockScroll();
  } else {
    galleryVisible.value = false;
    gallerySwiper.value = null;
    unlockScroll();
    cancelSheetGesture();
    if (ownsDetailHistory) {
      ownsDetailHistory = false;
      if (window.history.state?.[detailHistoryKey] === detailHistoryToken) {
        window.history.back();
      }
    }
  }
});
const handleDetailPopstate = (event) => {
  if (event.state?.[detailHistoryKey] === detailHistoryToken) {
    ownsDetailHistory = true;
    drawerVisible.value = true;
  } else if (ownsDetailHistory) {
    ownsDetailHistory = false;
    drawerVisible.value = false;
  }
};
onMounted(() => window.addEventListener('popstate', handleDetailPopstate));
onUnmounted(() => {
  window.clearTimeout(gallerySwipeTimer);
  window.removeEventListener('popstate', handleDetailPopstate);
  if (drawerVisible.value) unlockScroll();
});

const openDetail = () => {
  if (drawerVisible.value) return;
  window.history.pushState(
    {
      ...(window.history.state || {}),
      [detailHistoryKey]: detailHistoryToken,
    },
    '',
    window.location.href
  );
  ownsDetailHistory = true;
  drawerVisible.value = true;
};
const goUrl = (url) => {
  window.open(url, '_blank');
};
const mapUrl = computed(() => props.item.map || props.item.geo?.mapUrl || '');
const hasImmersiveCover = computed(() => Boolean(props.item.cover));
const hasTimingActions = computed(
  () => props.canManageTiming && !props.item.isGroupChild
);
const navigationActionExpanded = computed(
  () => !hasImmersiveCover.value || sheetExpanded.value
);
const navigationActionTop = computed(() => {
  if (
    hasImmersiveCover.value &&
    sheetDragging.value &&
    !activeSheetGesture?.startedExpanded &&
    sheetDragTop.value !== null
  ) {
    return `${Math.max(0, sheetDragTop.value - 28)}px`;
  }

  if (!navigationActionExpanded.value) {
    return 'calc(100% - 204px - env(safe-area-inset-bottom))';
  }

  return hasTimingActions.value
    ? 'calc(100% - 144px - env(safe-area-inset-bottom))'
    : 'calc(100% - 80px - env(safe-area-inset-bottom))';
});
const scheduledStartTime = computed(
  () => props.item.scheduledStartTime || props.item.startTime || '--:--'
);
const scheduledEndTime = computed(
  () => props.item.scheduledEndTime || props.item.endTime || '--:--'
);
const hasStartTimeChange = computed(
  () =>
    Boolean(props.item.actualTiming?.arrivalTime) &&
    scheduledStartTime.value !== props.item.startTime
);
const hasEndTimeChange = computed(
  () =>
    Boolean(
      props.item.actualTiming?.arrivalTime ||
      props.item.actualTiming?.departureTime
    ) && scheduledEndTime.value !== props.item.endTime
);
const effectiveStayMinutes = computed(() =>
  calculateStayMinutes(props.item.startTime, props.item.endTime)
);
const requestTimingAdjustment = (mode) => {
  drawerVisible.value = false;
  nextTick(() => emit('adjust-timing', { item: props.item, mode }));
};
// 設定 Swiper 模組
const modules = [Pagination];
const galleryModules = [Zoom];
</script>

<template>
  <div
    class="itinerary-card relative group cursor-pointer mb-2"
    @click="openDetail"
    @keydown.enter.prevent="openDetail"
    @keydown.space.prevent="openDetail"
    role="button"
    tabindex="0"
    :aria-label="`查看${item.location || '行程'}詳情`"
  >
    <div
      v-if="timeLine"
      class="mb-2 flex items-baseline gap-3 px-1 text-[var(--travel-ink)]"
    >
      <span class="font-mono text-[19px] font-black">{{
        item.startTime || '--:--'
      }}</span>
      <span class="h-px flex-1 bg-[#d9e6e1]"></span>
      <span class="font-mono text-xs font-bold text-[#6b8382]">{{
        item.endTime || '--:--'
      }}</span>
    </div>

    <!-- Main Card -->
    <div
      class="bg-white rounded-[24px] overflow-hidden border transition-all duration-300"
      :class="[
        isNow && !easyMode ? 'border-[var(--travel-teal)]' : 'border-[#dfe8e4]',
      ]"
    >
      <!-- Now/Next Banner -->
      <div
        v-if="isNow && !easyMode"
        class="bg-[var(--travel-teal)] px-4 py-2 flex justify-between items-center text-white"
      >
        <div class="flex items-center gap-2">
          <div class="w-2 h-2 bg-white rounded-full"></div>
          <span class="text-[11px] font-black uppercase tracking-[0.2em]"
            >正在進行中</span
          >
        </div>
        <div class="flex items-baseline gap-1">
          <span class="text-[10px] font-bold opacity-80">預計</span>
          <span class="text-base font-black italic font-mono">{{
            item.endTime
          }}</span>
          <span
            class="text-[10px] font-bold opacity-80 px-1 py-0.5 bg-white/20 rounded ml-1"
            >離開</span
          >
        </div>
      </div>

      <div
        v-else-if="isNext && !easyMode"
        class="bg-[var(--travel-ink)] px-4 py-2 flex justify-between items-center text-white border-b border-white/10"
      >
        <div class="flex items-center gap-2">
          <Clock :size="14" class="text-slate-400" />
          <span
            class="text-[11px] font-black uppercase tracking-[0.2em] text-slate-300"
            >下一個行程</span
          >
        </div>
        <div class="flex items-baseline gap-1">
          <span class="text-base font-black italic font-mono text-white">{{
            item.startTime
          }}</span>
          <span class="text-[10px] font-bold text-slate-400 ml-1">抵達</span>
        </div>
      </div>

      <div
        class="flex"
        :class="
          easyMode || (timeLine && !featured)
            ? 'flex-row items-center'
            : 'flex-col'
        "
      >
        <!-- 封面圖片：如果是子景點，縮減高度 -->
        <div
          v-if="item.cover"
          class="relative overflow-hidden bg-[var(--travel-mist)]"
          :class="
            easyMode || (timeLine && !featured)
              ? 'aspect-square w-[112px] shrink-0'
              : featured
                ? 'aspect-[4/3] w-full'
                : 'aspect-video w-full'
          "
        >
          <el-image
            :src="item.cover"
            fit="cover"
            lazy
            class="w-full h-full transition-transform duration-500"
          >
            <template #error
              ><div
                class="flex h-full w-full items-center justify-center bg-[var(--travel-mist)] text-xs font-bold text-[var(--travel-teal)]"
              >
                {{ item.location }}
              </div></template
            >
          </el-image>
          <div
            class="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none"
          ></div>
          <div class="absolute bottom-3 left-4 pointer-events-none">
            <span
              class="text-[10px] font-black px-2 py-0.5 bg-[var(--travel-coral)] text-white rounded-lg uppercase tracking-widest"
            >
              {{ item.category }}
            </span>
          </div>
        </div>

        <div class="px-4 py-3 flex-1">
          <div class="flex justify-between items-center">
            <div class="flex-1 flex items-center gap-2">
              <h4
                class="font-black text-slate-800 leading-tight transition-colors text-lg"
              >
                {{ item.location }}
              </h4>
            </div>
            <div
              class="itinerary-card-chevron shrink-0 pl-3"
              aria-hidden="true"
            >
              <ChevronRight :size="18" :stroke-width="1.7" />
            </div>
          </div>

          <p
            class="mt-1 text-xs text-slate-500 leading-relaxed line-clamp-2 font-medium"
          >
            {{ item.description }}
          </p>
        </div>
      </div>
    </div>
  </div>

  <!-- 車程區塊：只有群組最後一個項目才顯示下一個車程 -->
  <div
    v-if="
      item.nextDrive &&
      timeLine &&
      item?.nextDrive?.km &&
      item?.nextDrive?.time &&
      item.isGroupLast
    "
    class="relative mb-7"
  >
    <div class="hidden">
      <div class="flex justify-center items-center h-full relative">
        <div
          class="absolute left-[calc(50%-1px)] top-0 bottom-0 w-[2px] bg-slate-200 z-[1]"
        ></div>

        <div
          class="flex flex-col items-center p-2 bg-white rounded-xl z-[2] border border-slate-100 shadow-sm scale-90"
        >
          <span
            class="font-black text-slate-500 leading-none text-[16px] w-[2em] text-center"
          >
            {{ item.nextDrive.time }}
          </span>
          <span class="text-[10px] font-bold text-slate-400">MIN</span>
        </div>
      </div>
    </div>

    <div
      class="bg-[var(--travel-mist)] rounded-2xl px-5 py-2 flex items-center relative overflow-hidden border border-[#d7e8e2]"
    >
      <div class="flex-1 flex items-center">
        <div
          class="text-[11px] font-black text-slate-400 uppercase tracking-widest pr-3 border-r border-slate-200 mr-3"
        >
          預計車程
        </div>
        <div class="flex items-baseline gap-1">
          <span class="text-[22px] font-black text-slate-600 font-mono italic">
            {{ item.nextDrive.km }}
          </span>
          <span class="text-[11px] font-black text-slate-400">KM</span>
        </div>
      </div>
      <CarFront
        :size="48"
        class="absolute -bottom-1 -right-1 opacity-[0.05] -rotate-12"
      />
    </div>
  </div>

  <el-drawer
    v-model="drawerVisible"
    direction="btt"
    size="100%"
    :with-header="false"
    :append-to-body="true"
    :lock-scroll="false"
    :close-on-press-escape="!galleryVisible"
    class="itinerary-detail-drawer frontend-contained-drawer"
  >
    <div
      v-if="item"
      class="relative flex h-full flex-col overflow-hidden bg-[var(--travel-paper)]"
      @touchstart="startSheetTouch"
      @touchmove="moveSheetTouch"
      @touchend="finishSheetTouch"
      @touchcancel="cancelSheetTouch"
    >
      <button
        type="button"
        aria-label="關閉行程詳情"
        @click.stop="drawerVisible = false"
        class="absolute top-[calc(12px_+_env(safe-area-inset-top))] right-4 flex h-11 w-11 items-center justify-center rounded-full bg-[#102e35]/70 text-white z-30"
      >
        <X :size="20" />
      </button>
      <!-- 有封面的行程共用照片背景與可展開的資訊層。 -->
      <div
        v-if="item.cover"
        class="detail-hero w-full overflow-hidden"
        @dragstart.prevent
        @pointerdown="startSheetPointer"
        @pointermove="moveSheetPointer"
        @pointerup="finishSheetPointer"
        @pointercancel="cancelSheetPointer"
        :class="[
          hasImmersiveCover
            ? 'absolute inset-0 bg-[#0b4552]'
            : 'relative h-[min(42dvh,390px)] min-h-[240px] shrink-0 bg-[var(--travel-mist)]',
        ]"
      >
        <el-image :src="item.cover" fit="cover" class="w-full h-full">
          <template #error
            ><div
              class="flex h-full w-full items-center justify-center bg-[var(--travel-mist)] text-sm font-bold text-[var(--travel-teal)]"
            >
              {{ item.location }}
            </div></template
          >
        </el-image>
        <div
          v-if="hasImmersiveCover"
          class="absolute inset-0 bg-gradient-to-b from-transparent via-[#092f3b]/10 to-[#092f3b]/88 pointer-events-none"
        ></div>
        <div
          v-if="hasImmersiveCover"
          class="detail-cover-copy absolute left-6 right-6 text-white pointer-events-none"
          :class="sheetDragging ? 'detail-sheet-dragging' : ''"
          :style="{
            bottom:
              sheetExpanded || sheetDragging
                ? `calc(100% - ${sheetTop} + 24px)`
                : 'calc(176px + env(safe-area-inset-bottom) + 24px)',
          }"
        >
          <p class="text-[11px] font-bold tracking-[.2em] text-white/80">
            DESTINATION · {{ item.category }}
          </p>
          <h2
            class="mt-2 line-clamp-2 text-[clamp(27px,7vw,34px)] font-black leading-tight tracking-tight drop-shadow-sm"
          >
            {{ item.location }}
          </h2>
          <p
            v-if="item.description"
            class="mt-2 line-clamp-2 text-sm font-medium leading-relaxed text-white/85"
          >
            {{ item.description }}
          </p>
        </div>
      </div>
      <div
        class="detail-scroll overflow-x-hidden"
        :style="hasImmersiveCover ? { top: sheetTop } : undefined"
        @pointerdown="startSheetPointer"
        @pointermove="moveSheetPointer"
        @pointerup="finishSheetPointer"
        @pointercancel="cancelSheetPointer"
        :class="[
          hasImmersiveCover
            ? 'detail-scroll--immersive absolute inset-x-0 bottom-0 z-10 rounded-t-[28px] bg-white'
            : 'relative flex-1 bg-[var(--travel-paper)]',
          hasImmersiveCover && !sheetExpanded ? 'touch-none' : 'touch-pan-y',
          sheetDragging ? 'detail-sheet-dragging' : '',
          !hasImmersiveCover || sheetExpanded
            ? 'overflow-y-auto'
            : 'overflow-y-hidden',
          !hasImmersiveCover || sheetExpanded
            ? canManageTiming && !item.isGroupChild
              ? 'pb-[185px]'
              : 'pb-[110px]'
            : 'pb-0',
        ]"
      >
        <div
          class="detail-sheet relative min-h-full space-y-6 px-5 pb-4 pt-7"
          :class="hasImmersiveCover ? 'bg-white' : 'bg-[var(--travel-paper)]'"
        >
          <button
            v-if="hasImmersiveCover"
            type="button"
            class="detail-sheet-handle -mt-6 flex h-11 w-full touch-none items-start justify-center pt-3"
            :aria-expanded="sheetExpanded"
            :aria-label="sheetExpanded ? '收合行程詳情' : '展開行程詳情'"
            @click="toggleSheet"
          >
            <span
              class="h-1 w-9 rounded-full bg-[#c9d6d4]"
              aria-hidden="true"
            ></span>
          </button>
          <div
            v-if="!hasImmersiveCover"
            class="detail-info flex justify-between items-end"
          >
            <div>
              <div class="flex items-center gap-2 mb-1">
                <span
                  class="px-2 py-0.5 bg-[var(--travel-mist)] text-[var(--travel-teal)] text-[10px] font-black rounded-md uppercase tracking-wider"
                >
                  {{ item.type || '行程詳情' }}
                </span>
                <span class="text-xs font-bold text-slate-400"
                  >/ {{ item.category }}</span
                >
              </div>
              <h2
                class="text-3xl font-black text-[var(--travel-ink)] leading-tight"
              >
                {{ item.location }}
              </h2>
            </div>
          </div>

          <!-- 時間區塊：以目前有效的抵達與離開時間為主要資訊 -->
          <div
            class="detail-info rounded-2xl bg-[var(--travel-mist)] p-4 !mt-[4px]"
          >
            <template v-if="!item.parentId && !item.isGroupChild">
              <div class="mb-3 flex items-center justify-between">
                <span class="text-[11px] font-black text-slate-400"
                  >本次時間</span
                >
                <span class="text-xs font-black text-slate-600">
                  本次停留
                  {{
                    effectiveStayMinutes === null
                      ? '時間需確認'
                      : `${effectiveStayMinutes} 分鐘`
                  }}
                </span>
              </div>
              <div class="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
                <div>
                  <p
                    class="text-[10px] font-black tracking-widest text-slate-400"
                  >
                    抵達
                  </p>
                  <p
                    v-if="hasStartTimeChange"
                    class="mt-1 font-mono text-xs font-bold text-slate-400 line-through"
                  >
                    {{ scheduledStartTime }}
                  </p>
                  <p
                    class="font-mono text-3xl font-black leading-none"
                    :class="
                      hasStartTimeChange ? 'text-emerald-600' : 'text-slate-800'
                    "
                  >
                    {{ item.startTime }}
                  </p>
                </div>
                <span class="pb-1 text-xl font-black text-slate-300">→</span>
                <div class="text-right">
                  <p
                    class="text-[10px] font-black tracking-widest text-slate-400"
                  >
                    離開
                  </p>
                  <p
                    v-if="hasEndTimeChange"
                    class="mt-1 font-mono text-xs font-bold text-slate-400 line-through"
                  >
                    {{ scheduledEndTime }}
                  </p>
                  <p
                    class="font-mono text-3xl font-black leading-none"
                    :class="
                      hasEndTimeChange
                        ? 'text-[var(--travel-teal)]'
                        : 'text-slate-800'
                    "
                  >
                    {{ item.endTime }}
                  </p>
                </div>
              </div>
            </template>
            <template v-else-if="parentItem">
              <div class="mb-3 flex items-center justify-between gap-3">
                <span class="shrink-0 text-[11px] font-black text-slate-400">
                  主行程時間
                </span>
                <span class="truncate text-xs font-black text-slate-600">
                  {{ parentItem.location }}
                </span>
              </div>
              <div class="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
                <div>
                  <p
                    class="text-[10px] font-black tracking-widest text-slate-400"
                  >
                    抵達
                  </p>
                  <p
                    class="font-mono text-3xl font-black leading-none text-slate-800"
                  >
                    {{ parentItem.startTime || '--:--' }}
                  </p>
                </div>
                <span class="pb-1 text-xl font-black text-slate-300">→</span>
                <div class="text-right">
                  <p
                    class="text-[10px] font-black tracking-widest text-slate-400"
                  >
                    離開
                  </p>
                  <p
                    class="font-mono text-3xl font-black leading-none text-slate-800"
                  >
                    {{ parentItem.endTime || '--:--' }}
                  </p>
                </div>
              </div>
            </template>
            <template v-else>
              <p
                class="text-[12px] font-black text-slate-800 uppercase tracking-tighter text-center py-2"
              >
                隨主行程時間活動
              </p>
            </template>
          </div>

          <div
            v-if="!hasImmersiveCover || sheetExpanded"
            class="detail-info prose prose-slate max-w-none"
          >
            <h3
              class="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2"
            >
              <FileText :size="14" /> 介紹
            </h3>
            <div
              v-if="item.detail"
              v-html="item.detail"
              class="text-slate-600 leading-relaxed font-medium detail-content text-[14px] whitespace-pre-line"
            ></div>
            <p v-else class="text-slate-600 leading-relaxed font-medium">
              {{ item.description }}
            </p>
          </div>

          <div
            v-if="
              (!hasImmersiveCover || sheetExpanded) &&
              item.images &&
              item.images.length > 0
            "
          >
            <h3
              class="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2"
            >
              <Image :size="14" /> 照片
            </h3>

            <swiper
              :modules="modules"
              :slides-per-view="1.5"
              :space-between="4"
              :pagination="{ clickable: true, dynamicBullets: true }"
              class="w-full !overflow-visible gallery-swiper"
            >
              <swiper-slide v-for="(img, idx) in item.images" :key="idx">
                <button
                  type="button"
                  class="gallery-thumbnail block aspect-[4/3] w-full overflow-hidden rounded-[24px] border border-slate-50 bg-slate-100 p-0 text-left shadow-sm"
                  :aria-label="`瀏覽第 ${idx + 1} 張照片，共 ${item.images.length} 張`"
                  @click.stop="openGallery(idx, $event)"
                >
                  <el-image :src="img" fit="cover" lazy class="h-full w-full">
                    <template #error>
                      <div
                        class="flex h-full w-full items-center justify-center text-slate-400"
                      >
                        <Image :size="24" aria-hidden="true" />
                      </div>
                    </template>
                  </el-image>
                </button>
              </swiper-slide>
            </swiper>
          </div>
        </div>
      </div>

      <div
        v-if="!hasImmersiveCover || sheetExpanded"
        class="detail-actions absolute bottom-[0px] left-0 right-0 p-6 pb-[calc(24px_+_env(safe-area-inset-bottom))] bg-gradient-to-t from-white via-white to-transparent pt-10 z-10"
      >
        <div
          class="grid gap-2 max-w-lg mx-auto"
          :class="hasTimingActions ? 'grid-cols-2' : 'grid-cols-1'"
        >
          <div
            v-if="mapUrl"
            class="col-span-full h-14"
            aria-hidden="true"
          ></div>
          <template v-if="hasTimingActions">
            <button
              type="button"
              class="inline-flex h-14 items-center justify-center gap-2 rounded-3xl bg-emerald-500 px-4 text-sm font-black text-white"
              @click.stop="requestTimingAdjustment('arrived')"
            >
              <LogIn :size="18" />
              抵達
            </button>
            <button
              type="button"
              class="inline-flex h-14 items-center justify-center gap-2 rounded-3xl bg-[var(--travel-teal)] px-4 text-sm font-black text-white"
              @click.stop="requestTimingAdjustment('departed')"
            >
              <LogOut :size="18" />
              離開
            </button>
          </template>
        </div>
      </div>
      <button
        v-if="mapUrl"
        type="button"
        class="navigation-action"
        :class="[
          navigationActionExpanded
            ? 'navigation-action-expanded'
            : 'navigation-action-collapsed',
          sheetDragging ? 'detail-sheet-dragging' : '',
        ]"
        :style="{ top: navigationActionTop }"
        :aria-label="`開啟${item.location || '景點'}地圖`"
        @click.stop="goUrl(mapUrl)"
      >
        <Navigation :size="20" aria-hidden="true" />
        <span class="navigation-action-label" aria-hidden="true">開啟地圖</span>
      </button>
    </div>
  </el-drawer>

  <Teleport to="body">
    <div
      v-if="galleryVisible && item.images?.length"
      class="gallery-viewer"
      role="dialog"
      aria-modal="true"
      aria-label="景點照片預覽"
      @keydown.esc.stop.prevent="closeGallery"
      @keydown.left.stop.prevent="stepGallery(-1)"
      @keydown.right.stop.prevent="stepGallery(1)"
    >
      <div
        class="gallery-viewer-canvas"
        @touchstart.capture="startGallerySwipe"
        @touchend.capture="finishGallerySwipe"
        @touchcancel.capture="gallerySwipeStart = null"
      >
        <div class="gallery-viewer-header">
          <span class="gallery-viewer-count" aria-live="polite">
            {{ galleryIndex + 1 }} / {{ item.images.length }}
          </span>
          <button
            ref="galleryCloseButton"
            type="button"
            class="gallery-viewer-close"
            aria-label="關閉照片預覽"
            @click="closeGallery"
          >
            <X :size="22" aria-hidden="true" />
          </button>
        </div>

        <swiper
          :modules="galleryModules"
          :initial-slide="galleryIndex"
          :zoom="{ maxRatio: 3, minRatio: 1, toggle: true }"
          class="gallery-viewer-swiper"
          @swiper="gallerySwiper = $event"
          @slide-change="galleryIndex = $event.activeIndex"
        >
          <swiper-slide v-for="(img, idx) in item.images" :key="idx">
            <div class="swiper-zoom-container">
              <img
                :src="img"
                :alt="`${item.location || '景點'}照片 ${idx + 1}`"
              />
            </div>
          </swiper-slide>
        </swiper>

        <template v-if="item.images.length > 1">
          <button
            type="button"
            class="gallery-viewer-step gallery-viewer-prev"
            :disabled="galleryIndex === 0"
            aria-label="上一張照片"
            @click="stepGallery(-1)"
          >
            <ChevronLeft :size="22" aria-hidden="true" />
          </button>
          <button
            type="button"
            class="gallery-viewer-step gallery-viewer-next"
            :disabled="galleryIndex === item.images.length - 1"
            aria-label="下一張照片"
            @click="stepGallery(1)"
          >
            <ChevronRight :size="22" aria-hidden="true" />
          </button>
        </template>
      </div>
    </div>
  </Teleport>
</template>

<style scoped lang="scss">
.itinerary-card:focus-visible {
  outline: 2px solid var(--travel-coral);
  outline-offset: 4px;
  border-radius: 24px;
}

.itinerary-card:hover :deep(.el-image img) {
  transform: scale(1.035);
}

.navigation-action {
  position: absolute;
  z-index: 20;
  display: inline-flex;
  height: 56px;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 0;
  background: var(--travel-coral);
  color: #fff;
  box-shadow: 0 8px 22px rgb(236 112 65 / 26%);
  transition:
    top 280ms cubic-bezier(0.22, 1, 0.36, 1),
    left 280ms cubic-bezier(0.22, 1, 0.36, 1),
    width 280ms cubic-bezier(0.22, 1, 0.36, 1),
    border-radius 280ms cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow 180ms ease;
}

.navigation-action:hover {
  box-shadow: 0 10px 26px rgb(236 112 65 / 34%);
}

.navigation-action:focus-visible {
  outline: 3px solid #fff;
  outline-offset: 3px;
  box-shadow: 0 0 0 6px rgb(236 112 65 / 36%);
}

.navigation-action-collapsed {
  left: calc(100% - 80px);
  width: 56px;
  border-radius: 50%;
}

.navigation-action-expanded {
  left: 24px;
  width: calc(100% - 48px);
  border-radius: 20px;
  font-size: 15px;
  font-weight: 800;
}

.navigation-action-label {
  width: 0;
  overflow: hidden;
  opacity: 0;
  transform: translateX(6px);
  white-space: nowrap;
  transition:
    width 220ms cubic-bezier(0.22, 1, 0.36, 1),
    margin 220ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 160ms ease,
    transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
}

.navigation-action-expanded .navigation-action-label {
  width: 5em;
  margin-left: 8px;
  opacity: 1;
  transform: translateX(0);
}

.navigation-action:active {
  transform: scale(0.97);
}

.navigation-action.detail-sheet-dragging {
  transition: none;
}

.itinerary-card-chevron {
  color: var(--travel-teal);
  opacity: 0.68;
  transition: transform 200ms cubic-bezier(0.22, 1, 0.36, 1);
}

.itinerary-card:hover .itinerary-card-chevron,
.itinerary-card:focus-visible .itinerary-card-chevron {
  transform: translateX(2px);
}

.itinerary-card:active .itinerary-card-chevron {
  transform: translateX(3px);
}

.detail-hero {
  animation: detail-photo-enter 380ms cubic-bezier(0.22, 1, 0.36, 1) both;
  touch-action: none;
}
.detail-hero :deep(.el-image__inner) {
  object-position: center;
  -webkit-user-drag: none;
}
.detail-cover-copy {
  text-shadow: 0 2px 18px rgba(4, 33, 41, 0.32);
  transition: bottom 360ms cubic-bezier(0.22, 1, 0.36, 1);
}
.detail-scroll {
  overscroll-behavior: contain;
}
.detail-scroll--immersive {
  animation: detail-panel-enter 350ms 40ms cubic-bezier(0.22, 1, 0.36, 1) both;
  box-shadow: 0 -18px 42px rgba(7, 39, 48, 0.14);
  transition: top 360ms cubic-bezier(0.22, 1, 0.36, 1);
}
.detail-sheet-dragging {
  transition: none;
}
.detail-sheet-handle {
  cursor: grab;
}
.detail-sheet-handle:active {
  cursor: grabbing;
}
.detail-sheet-handle:focus-visible {
  outline: none;
}
.detail-sheet-handle:focus-visible span {
  background: var(--travel-teal);
  box-shadow: 0 0 0 5px rgba(19, 106, 112, 0.16);
}
.detail-sheet {
  isolation: isolate;
}
.detail-info {
  animation: detail-content-enter 300ms 50ms cubic-bezier(0.22, 1, 0.36, 1) both;
}
.detail-actions {
  animation: detail-content-enter 300ms 90ms cubic-bezier(0.22, 1, 0.36, 1) both;
}
@keyframes detail-photo-enter {
  from {
    opacity: 0.65;
    transform: scale(1.035);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
@keyframes detail-content-enter {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@keyframes detail-panel-enter {
  from {
    opacity: 0.65;
    transform: translateY(32px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@media (prefers-reduced-motion: reduce) {
  .detail-hero,
  .detail-info,
  .detail-actions {
    animation: none !important;
  }
  .detail-scroll--immersive {
    animation: none !important;
  }
  .detail-cover-copy,
  .detail-scroll--immersive {
    transition: none !important;
  }
  .navigation-action,
  .navigation-action-label,
  .itinerary-card-chevron {
    transition: none !important;
    transform: none !important;
  }
  .navigation-action:active {
    transform: none;
  }
  .itinerary-card :deep(.el-image img),
  .gallery-swiper .swiper-slide {
    transition: none !important;
    transform: none !important;
  }
  :global(.el-drawer-fade-enter-active .itinerary-detail-drawer),
  :global(.el-drawer-fade-leave-active .itinerary-detail-drawer) {
    transition-duration: 0ms !important;
  }
}
/* 確保 Drawer 的自定義樣式 */
:global(.itinerary-detail-drawer) {
  border-radius: 0 !important;
  overflow: hidden;
}
:global(.itinerary-detail-drawer .el-drawer__body) {
  padding: 0 !important;
}

.gallery-swiper:deep() {
  padding-bottom: 30px !important; // 留空間給分頁

  .swiper-pagination {
    bottom: 0 !important;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 6px;
  }

  // 預設的小點點樣式
  .swiper-pagination-bullet {
    width: 6px;
    height: 6px;
    background: #cbd5e1; // slate-300
    opacity: 1;
    border-radius: 10px;
    transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    margin: 0 !important;
  }

  // 當前選中的長條膠囊樣式
  .swiper-pagination-bullet-active {
    width: 24px; // 變長
    background: #136a70;
    box-shadow: none;
  }
}

// 讓圖片滑動時帶有一點縮放感 (選配)
.gallery-swiper .swiper-slide {
  transition: transform 0.3s;
  &:not(.swiper-slide-active) {
    transform: scale(0.95);
    opacity: 0.8;
  }
}

.gallery-thumbnail {
  cursor: zoom-in;
}
.gallery-thumbnail :deep(.el-image__inner) {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.gallery-thumbnail:focus-visible {
  outline: 3px solid var(--travel-coral);
  outline-offset: 3px;
}

.gallery-viewer {
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: flex;
  justify-content: center;
  background: #071b20;
  color: white;
}
.gallery-viewer-canvas {
  position: relative;
  width: min(100vw, var(--frontend-shell-max-width));
  height: 100dvh;
  overflow: hidden;
  background: #071b20;
}
.gallery-viewer-header {
  position: absolute;
  z-index: 2;
  top: 0;
  right: 0;
  left: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: calc(12px + env(safe-area-inset-top)) 20px 12px;
  pointer-events: none;
}
.gallery-viewer-count {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-shadow: 0 2px 10px #000;
}
.gallery-viewer-close,
.gallery-viewer-step {
  display: flex;
  width: 44px;
  height: 44px;
  align-items: center;
  justify-content: center;
  border: 1px solid rgb(255 255 255 / 18%);
  border-radius: 50%;
  background: rgb(7 27 32 / 65%);
  color: white;
  pointer-events: auto;
}
.gallery-viewer-close:focus-visible,
.gallery-viewer-step:focus-visible {
  outline: 3px solid var(--travel-coral);
  outline-offset: 2px;
}
.gallery-viewer-step:disabled {
  opacity: 0.32;
}
.gallery-viewer-step {
  position: absolute;
  z-index: 2;
  top: 50%;
  transform: translateY(-50%);
}
.gallery-viewer-prev {
  left: 12px;
}
.gallery-viewer-next {
  right: 12px;
}
.gallery-viewer-swiper {
  width: 100%;
  height: 100%;
}
.gallery-viewer-swiper .swiper-slide {
  display: flex;
  align-items: center;
  justify-content: center;
}
.gallery-viewer-swiper .swiper-zoom-container {
  width: 100%;
  height: 100%;
}
.gallery-viewer-swiper img {
  display: block;
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

@media (max-width: 640px) {
  .gallery-viewer-step {
    display: none;
  }
}
</style>
