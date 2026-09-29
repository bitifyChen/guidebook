import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PwaUpdatePrompt from '@/components/PwaUpdatePrompt.vue';

const pwaMocks = vi.hoisted(() => ({
  state: {
    status: 'optional',
    promptType: 'optional',
    currentVersion: '1.0.0',
    targetVersion: '1.1.0',
    error: '',
  },
  apply: vi.fn().mockResolvedValue(undefined),
  dismiss: vi.fn(),
}));

vi.mock('@/services/pwaUpdate', () => ({
  pwaUpdateState: pwaMocks.state,
  applyAppUpdate: pwaMocks.apply,
  dismissAppUpdate: pwaMocks.dismiss,
}));

describe('PwaUpdatePrompt', () => {
  beforeEach(() => {
    pwaMocks.state.status = 'optional';
    pwaMocks.state.promptType = 'optional';
    pwaMocks.state.currentVersion = '1.0.0';
    pwaMocks.state.targetVersion = '1.1.0';
    pwaMocks.state.error = '';
  });

  it('allows an optional update to be postponed', async () => {
    const wrapper = mount(PwaUpdatePrompt);

    expect(wrapper.text()).toContain('有新版可以使用');
    expect(wrapper.text()).toContain('目前 v1.0.0 · 新版 v1.1.0');
    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('稍後再說'))
      .trigger('click');

    expect(pwaMocks.dismiss).toHaveBeenCalledOnce();
  });

  it('does not provide a dismiss action for a required update', async () => {
    pwaMocks.state.status = 'required';
    pwaMocks.state.promptType = 'required';
    pwaMocks.state.currentVersion = '0.9.0';
    const wrapper = mount(PwaUpdatePrompt);

    expect(wrapper.text()).toContain('需要更新應用程式');
    expect(wrapper.text()).not.toContain('稍後再說');
    await wrapper.get('button').trigger('click');

    expect(pwaMocks.apply).toHaveBeenCalledOnce();
  });
});
