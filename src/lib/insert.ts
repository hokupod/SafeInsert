import type { SafeInsertSettings } from './settings';
import type { TargetSnapshot, SupportedTargetElement } from './target';
import { isTargetUsable } from './target';

export interface SelectionReplaceResult {
  value: string;
  nextCaret: number;
}

export interface InsertResult {
  ok: boolean;
  message?: string;
}

export function replaceSelection(value: string, selectionStart: number, selectionEnd: number, inserted: string): SelectionReplaceResult {
  const start = Math.max(0, Math.min(selectionStart, value.length));
  const end = Math.max(start, Math.min(selectionEnd, value.length));
  const nextValue = `${value.slice(0, start)}${inserted}${value.slice(end)}`;
  const nextCaret = start + inserted.length;

  return { value: nextValue, nextCaret };
}

export function normalizeForSingleLine(value: string, policy: SafeInsertSettings['newlinePolicyForSingleLine']): string | null {
  if (!/[\r\n]/.test(value)) {
    return value;
  }

  if (policy === 'remove') {
    return value.replace(/\r?\n/g, '');
  }

  if (policy === 'space') {
    return value.replace(/\r?\n/g, ' ');
  }

  return null;
}

function setNativeValue(element: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), 'value');
  if (descriptor?.set) {
    descriptor.set.call(element, value);
    return;
  }

  element.value = value;
}

function dispatchInputEvent(element: SupportedTargetElement, data: string): void {
  try {
    const ev = new InputEvent('input', {
      bubbles: true,
      composed: true,
      data,
      inputType: 'insertText'
    });
    element.dispatchEvent(ev);
  } catch {
    element.dispatchEvent(
      new Event('input', {
        bubbles: true,
        composed: true
      })
    );
  }
}

function applyWholeReplacement(
  snapshot: TargetSnapshot,
  rawText: string,
  settings: SafeInsertSettings
): InsertResult {
  const element = snapshot.elementRef;
  if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) {
    return {
      ok: false,
      message: '対象が単純入力欄ではありません。'
    };
  }

  const normalized = snapshot.isTextarea ? rawText : normalizeForSingleLine(rawText, settings.newlinePolicyForSingleLine);

  if (normalized === null) {
    return {
      ok: false,
      message: '単一行inputに改行は挿入できません。'
    };
  }

  setNativeValue(element, normalized);
  dispatchInputEvent(element, normalized);

  const caret = normalized.length;
  if (typeof element.setSelectionRange === 'function') {
    element.setSelectionRange(caret, caret);
  }

  element.scrollTop = snapshot.scrollTop;
  element.scrollLeft = snapshot.scrollLeft;

  return { ok: true };
}

function createTextFragment(doc: Document, text: string): DocumentFragment {
  const fragment = doc.createDocumentFragment();
  const lines = text.split(/\r?\n/);

  lines.forEach((line, index) => {
    if (index > 0) {
      fragment.appendChild(doc.createElement('br'));
    }
    fragment.appendChild(doc.createTextNode(line));
  });

  return fragment;
}

function applyContentEditableInsert(snapshot: TargetSnapshot, rawText: string): InsertResult {
  const element = snapshot.elementRef;
  if (!(element instanceof HTMLElement) || !element.isContentEditable) {
    return {
      ok: false,
      message: 'contenteditable が利用できません。'
    };
  }

  const selection = element.ownerDocument.getSelection?.();
  if (!selection) {
    return {
      ok: false,
      message: '選択範囲が取得できません。'
    };
  }

  const range = snapshot.editableRange?.cloneRange() ?? element.ownerDocument.createRange();
  if (!snapshot.editableRange) {
    range.selectNodeContents(element);
    range.collapse(false);
  }

  if (!element.contains(range.startContainer) || !element.contains(range.endContainer)) {
    range.selectNodeContents(element);
    range.collapse(false);
  }

  element.focus();
  selection.removeAllRanges();
  selection.addRange(range);

  range.deleteContents();
  const fragment = createTextFragment(element.ownerDocument, rawText);
  range.insertNode(fragment);
  range.collapse(false);

  selection.removeAllRanges();
  selection.addRange(range);

  dispatchInputEvent(element, rawText);

  return { ok: true };
}

export function insertFromModal(snapshot: TargetSnapshot | null, modalText: string, settings: SafeInsertSettings): InsertResult {
  if (!isTargetUsable(snapshot)) {
    return {
      ok: false,
      message: '元入力欄が利用できなくなりました。'
    };
  }

  if (snapshot.kind === 'contenteditable') {
    return applyContentEditableInsert(snapshot, modalText);
  }

  return applyWholeReplacement(snapshot, modalText, settings);
}
