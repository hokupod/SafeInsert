export const SAFEINSERT_SETTINGS_UPDATED = 'SAFEINSERT_SETTINGS_UPDATED';
export const SAFEINSERT_OPEN_UI_SURFACE_REQUEST = 'SAFEINSERT_OPEN_UI_SURFACE_REQUEST';
export const SAFEINSERT_UI_SURFACE_ACTIVATED = 'SAFEINSERT_UI_SURFACE_ACTIVATED';
export const SAFEINSERT_UI_SURFACE_READY = 'SAFEINSERT_UI_SURFACE_READY';
export const SAFEINSERT_GET_TARGET_STATE = 'SAFEINSERT_GET_TARGET_STATE';
export const SAFEINSERT_INSERT_TEXT = 'SAFEINSERT_INSERT_TEXT';
export const SAFEINSERT_GET_ACTIVE_TAB = 'SAFEINSERT_GET_ACTIVE_TAB';
export const SAFEINSERT_TRACK_TARGET = 'SAFEINSERT_TRACK_TARGET';
export const SAFEINSERT_GET_LAST_TARGET = 'SAFEINSERT_GET_LAST_TARGET';
export const SAFEINSERT_GET_TARGET_STATE_FROM_TRACKED = 'SAFEINSERT_GET_TARGET_STATE_FROM_TRACKED';
export const SAFEINSERT_INSERT_TEXT_TO_TRACKED = 'SAFEINSERT_INSERT_TEXT_TO_TRACKED';
export const SAFEINSERT_REQUEST_TRACK_TARGET = 'SAFEINSERT_REQUEST_TRACK_TARGET';
export const SAFEINSERT_TARGET_CLEARED = 'SAFEINSERT_TARGET_CLEARED';

export type SafeInsertRuntimeMessage =
  | { type: typeof SAFEINSERT_SETTINGS_UPDATED }
  | { type: typeof SAFEINSERT_OPEN_UI_SURFACE_REQUEST }
  | { type: typeof SAFEINSERT_UI_SURFACE_ACTIVATED }
  | { type: typeof SAFEINSERT_UI_SURFACE_READY; surface: 'sidepanel' | 'popup'; innerWidth: number; innerHeight: number }
  | { type: typeof SAFEINSERT_GET_ACTIVE_TAB }
  | { type: typeof SAFEINSERT_TRACK_TARGET; inputType: string; isTextarea: boolean }
  | { type: typeof SAFEINSERT_GET_LAST_TARGET }
  | { type: typeof SAFEINSERT_GET_TARGET_STATE_FROM_TRACKED }
  | { type: typeof SAFEINSERT_INSERT_TEXT_TO_TRACKED; text: string }
  | { type: typeof SAFEINSERT_REQUEST_TRACK_TARGET }
  | { type: typeof SAFEINSERT_TARGET_CLEARED; tabId?: number }
  | { type: typeof SAFEINSERT_GET_TARGET_STATE }
  | { type: typeof SAFEINSERT_INSERT_TEXT; text: string };

export type SafeInsertTargetStateResponse =
  | {
      ok: true;
      value: string;
      inputType: string;
      isTextarea: boolean;
    }
  | {
      ok: false;
      message: string;
    };

export type SafeInsertInsertResponse =
  | { ok: true }
  | { ok: false; message: string };

export interface SafeInsertActiveTabResponse {
  tabId: number | null;
}

export interface SafeInsertLastTargetResponse {
  tabId: number | null;
  frameId: number | null;
  windowId?: number;
  inputType?: string;
  isTextarea?: boolean;
}
