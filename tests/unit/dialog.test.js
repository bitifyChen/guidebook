import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ElMessageBox } from 'element-plus';
import { appConfirm, appAlert, confirmAction } from '@/services/dialog';
vi.mock('element-plus', () => ({
  ElMessageBox: { confirm: vi.fn(), alert: vi.fn() },
}));
beforeEach(() => vi.resetAllMocks());
describe('shared dialogs', () => {
  it.each(['cancel', 'close'])(
    'treats %s as false without running the action',
    async (reason) => {
      ElMessageBox.confirm.mockRejectedValue(reason);
      const write = vi.fn();
      if (await appConfirm('刪除這筆資料？')) write();
      expect(write).not.toHaveBeenCalled();
    }
  );
  it('uses a safe focus target, explicit action and separate admin theme', async () => {
    ElMessageBox.confirm.mockResolvedValue('confirm');
    expect(await appConfirm('刪除資料？', { theme: 'admin' })).toBe(true);
    expect(ElMessageBox.confirm.mock.calls[0][2]).toMatchObject({
      autofocus: false,
      dangerouslyUseHTMLString: false,
      showCancelButton: true,
      confirmButtonText: '確認刪除',
      customClass:
        'guidebook-dialog guidebook-dialog--admin guidebook-dialog--danger',
    });
  });
  it('retains the legacy rejected cancellation contract and allows dismissing alerts', async () => {
    ElMessageBox.confirm.mockRejectedValue('cancel');
    await expect(confirmAction('內容', '標題')).rejects.toBe('cancel');
    ElMessageBox.alert.mockRejectedValue('close');
    await expect(appAlert('提示')).resolves.toBeUndefined();
  });
});
