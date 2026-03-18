import { cleanup, fireEvent, render, waitFor } from '@testing-library/svelte';
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

import SafeInsertEditor from '../../src/ui/SafeInsertEditor.svelte';

describe('SafeInsertEditor', () => {
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
    mocks.runtimeSendMessageMock.mockImplementation((message: { type: string; text?: string }) => {
      if (message.type === 'SAFEINSERT_GET_TARGET_STATE_FROM_TRACKED') {
        return Promise.resolve({ ok: true, value: 'prefill', inputType: 'textarea', isTextarea: true });
      }

      if (message.type === 'SAFEINSERT_INSERT_TEXT_TO_TRACKED') {
        return Promise.resolve({ ok: true });
      }

      if (message.type === 'SAFEINSERT_UI_SURFACE_READY') {
        return Promise.resolve(undefined);
      }

      if (message.type === 'SAFEINSERT_GET_LAST_TARGET') {
        return Promise.resolve({ tabId: 1, inputType: 'textarea', isTextarea: true });
      }

      return Promise.resolve({ ok: false, message: `unexpected:${message.type}` });
    });
  });

  it('loads tracked text on mount', async () => {
    const { container } = render(SafeInsertEditor, { surface: 'popup' });

    await waitFor(() => {
      const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
      expect(textarea.value).toBe('prefill');
    });
  });

  it('refreshes state when ui surface activated message arrives', async () => {
    render(SafeInsertEditor, { surface: 'popup' });

    await waitFor(() => {
      expect(mocks.addListenerMock).toHaveBeenCalledTimes(1);
    });

    const listener = mocks.addListenerMock.mock.calls[0]?.[0] as ((message: { type: string }) => void) | undefined;
    expect(listener).toBeTypeOf('function');

    listener?.({ type: 'SAFEINSERT_UI_SURFACE_ACTIVATED' });

    await waitFor(() => {
      const readCalls = mocks.runtimeSendMessageMock.mock.calls.filter(
        ([message]) => message?.type === 'SAFEINSERT_GET_TARGET_STATE_FROM_TRACKED'
      );
      expect(readCalls.length).toBeGreaterThan(1);
    });
  });

  it('sends insert message when insert button is clicked', async () => {
    const { getByRole } = render(SafeInsertEditor, { surface: 'sidepanel' });

    await fireEvent.click(getByRole('button', { name: '挿入' }));

    await waitFor(() => {
      const hasInsertCall = mocks.runtimeSendMessageMock.mock.calls.some(
        ([message]) => message?.type === 'SAFEINSERT_INSERT_TEXT_TO_TRACKED'
      );
      expect(hasInsertCall).toBe(true);
    });
  });
});
