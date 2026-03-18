import { cleanup, render, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  runtimeSendMessageMock: vi.fn(),
  storageGetMock: vi.fn(),
  storageSetMock: vi.fn(),
  addListenerMock: vi.fn(),
  removeListenerMock: vi.fn()
}));

vi.mock('wxt/browser', () => {
  return {
    browser: {
      runtime: {
        sendMessage: mocks.runtimeSendMessageMock,
        onMessage: {
          addListener: mocks.addListenerMock,
          removeListener: mocks.removeListenerMock
        }
      },
      storage: {
        local: {
          get: mocks.storageGetMock,
          set: mocks.storageSetMock
        }
      }
    }
  };
});

import PopupPage from '../../src/popup/PopupPage.svelte';

describe('PopupPage', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    mocks.runtimeSendMessageMock.mockReset();
    mocks.storageGetMock.mockReset();
    mocks.storageSetMock.mockReset();
    mocks.addListenerMock.mockReset();
    mocks.removeListenerMock.mockReset();

    mocks.storageGetMock.mockResolvedValue({});
    mocks.runtimeSendMessageMock.mockImplementation((message: { type: string }) => {
      if (message.type === 'SAFEINSERT_GET_TARGET_STATE_FROM_TRACKED') {
        return Promise.resolve({ ok: true, value: 'prefill', inputType: 'textarea', isTextarea: true });
      }

      if (message.type === 'SAFEINSERT_GET_LAST_TARGET') {
        return Promise.resolve({ tabId: 1, inputType: 'textarea', isTextarea: true });
      }

      if (message.type === 'SAFEINSERT_UI_SURFACE_READY') {
        return Promise.resolve(undefined);
      }

      return Promise.resolve({ ok: false, message: `unexpected:${message.type}` });
    });
  });

  it('renders popup page with neutral guidance and popup layout class', async () => {
    const { container, getByText } = render(PopupPage);

    await waitFor(() => {
      expect(getByText('入力して、挿入でページへ反映します。')).toBeTruthy();
    });

    expect(container.querySelector('main')?.classList.contains('popup-page')).toBe(true);
    expect(container.querySelector('.safeinsert-editor__actions')).toBeTruthy();
  });
});
