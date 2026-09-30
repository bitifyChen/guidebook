import { inject, onUnmounted } from 'vue';
import {
  drawerGuardKey,
  registerUnsavedGuard,
} from '@/services/unsavedChanges';

export function useWorkspaceGuard(guard) {
  const unregister = registerUnsavedGuard(guard);
  const unregisterParent = inject(drawerGuardKey, null)?.(guard);
  onUnmounted(() => {
    unregister();
    unregisterParent?.();
  });
}
