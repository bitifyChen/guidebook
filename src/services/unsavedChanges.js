import { appAlert, appConfirm } from './dialog';

const guards = new Set();
export const drawerGuardKey = Symbol('drawer-guards');
let pending = null;

export const shouldGuardWorkspaceNavigation = (to, from) =>
  from?.meta?.layout === 'admin' && to?.fullPath !== from?.fullPath;

export function registerUnsavedGuard(guard) {
  guards.add(guard);
  return () => guards.delete(guard);
}

export function confirmDiscard() {
  return appConfirm('尚未儲存的內容將會消失。', {
    title: '放棄這次修改？',
    confirmButtonText: '放棄修改',
    cancelButtonText: '繼續編輯',
    danger: true,
  });
}

export async function canLeaveWorkspace() {
  if (pending) return pending;
  pending = (async () => {
    if ([...guards].some((guard) => guard.busy())) {
      await appAlert('正在儲存或上傳，請稍候再離開。');
      return false;
    }
    if ([...guards].some((guard) => guard.dirty())) return confirmDiscard();
    return true;
  })();
  try {
    return await pending;
  } finally {
    pending = null;
  }
}
