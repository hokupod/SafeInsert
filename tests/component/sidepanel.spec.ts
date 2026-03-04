import { cleanup, fireEvent, render, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  queryMock: vi.fn(),
  tabsSendMessageMock: vi.fn(),
  runtimeSendMessageMock: vi.fn(),
  storageGetMock: vi.fn(),
  storageSetMock: vi.fn()
}));

vi.mock('wxt/browser', () => {
  return {
    browser: {
      tabs: {
        query: mocks.queryMock,
        sendMessage: mocks.tabsSendMessageMock
      },
      runtime: {
        sendMessage: mocks.runtimeSendMessageMock,
        onMessage: {
          addListener: vi.fn(),
          removeListener: vi.fn()
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

import SidePanelPage from '../../src/sidepanel/SidePanelPage.svelte';

describe('SidePanelPage', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    mocks.queryMock.mockReset();
    mocks.tabsSendMessageMock.mockReset();
    mocks.runtimeSendMessageMock.mockReset();
    mocks.storageGetMock.mockReset();
    mocks.storageSetMock.mockReset();

    mocks.queryMock.mockResolvedValue([{ id: 1 }]);
    mocks.storageGetMock.mockResolvedValue({});
    mocks.runtimeSendMessageMock.mockImplementation((message: { type: string; text?: string }) => {
      if (message.type === 'SAFEINSERT_GET_TARGET_STATE_FROM_TRACKED') {
        return Promise.resolve({ ok: true, value: 'prefill', inputType: 'textarea', isTextarea: true });
      }

      if (message.type === 'SAFEINSERT_INSERT_TEXT_TO_TRACKED') {
        return Promise.resolve({ ok: true });
      }

      return Promise.resolve({ ok: false, message: `unexpected:${message.type}` });
    });
  });

  it('loads target text on mount', async () => {
    const { container } = render(SidePanelPage);

    await waitFor(() => {
      const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
      expect(textarea.value).toBe('prefill');
    });
  });

  it('sends insert message when insert button is clicked', async () => {
    const { getByRole } = render(SidePanelPage);

    await fireEvent.click(getByRole('button', { name: '挿入' }));

    await waitFor(() => {
      const hasInsertCall = mocks.runtimeSendMessageMock.mock.calls.some((call) => {
        const [message] = call;
        return message?.type === 'SAFEINSERT_INSERT_TEXT_TO_TRACKED';
      });

      expect(hasInsertCall).toBe(true);
    });
  });
});
