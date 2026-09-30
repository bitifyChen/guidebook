import { ElMessageBox } from 'element-plus';

// Keep the promise contract explicit: dismissing a confirmation always returns false.
const context = () =>
  typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')
    ? 'admin'
    : 'frontend';

const actionLabel = (message) => {
  if (/同步|套用/.test(message)) return '確認套用';
  if (/刪除/.test(message)) return '確認刪除';
  if (/清空/.test(message)) return '清空';
  if (/還原/.test(message)) return '還原清單';
  if (/移除/.test(message)) return '移除';
  if (/離開/.test(message)) return '離開旅程';
  if (/關閉/.test(message)) return '關閉通知';
  if (/允許/.test(message)) return '允許';
  return '確認';
};

function optionsFor(message, options, confirm) {
  const label = options.confirmButtonText || actionLabel(message);
  const danger =
    options.danger ?? /刪除|清空|還原|移除|放棄/.test(`${label} ${message}`);
  return {
    title: confirm ? '確認操作' : '提示',
    message,
    showCancelButton: confirm,
    confirmButtonText: confirm ? label : '知道了',
    cancelButtonText: '取消',
    closeOnClickModal: !confirm,
    closeOnPressEscape: true,
    distinguishCancelAndClose: true,
    // Focus the dialog, not the destructive button, so Enter cannot confirm by accident.
    autofocus: !confirm,
    buttonSize: 'large',
    ...options,
    dangerouslyUseHTMLString: false,
    customClass: `guidebook-dialog guidebook-dialog--${options.theme || context()}${danger && confirm ? ' guidebook-dialog--danger' : ''}`,
    modalClass: 'guidebook-dialog-overlay',
    confirmButtonClass: 'guidebook-dialog__confirm',
    cancelButtonClass: 'guidebook-dialog__cancel',
  };
}

export async function appConfirm(message, options = {}) {
  try {
    const config = optionsFor(message, options, true);
    await ElMessageBox.confirm(message, config.title, config);
    return true;
  } catch (action) {
    if (action === 'cancel' || action === 'close') return false;
    throw action;
  }
}

export async function appAlert(message, options = {}) {
  try {
    const config = optionsFor(message, options, false);
    await ElMessageBox.alert(message, config.title, config);
  } catch (action) {
    if (action !== 'cancel' && action !== 'close') throw action;
  }
}

// Existing Element Plus flows use rejected cancellation in their try/catch.
export async function confirmAction(message, title, options = {}) {
  if (!(await appConfirm(message, { ...options, title }))) throw 'cancel';
}
