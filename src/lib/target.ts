import type { SafeInsertSettings } from './settings';

export type SupportedTargetElement = HTMLInputElement | HTMLTextAreaElement | HTMLElement;

export type TargetKind = 'input' | 'textarea' | 'contenteditable';

export interface TargetSnapshot {
  elementRef: SupportedTargetElement;
  kind: TargetKind;
  selectionStart: number;
  selectionEnd: number;
  editableRange: Range | null;
  scrollTop: number;
  scrollLeft: number;
  valueAtOpen: string;
  isTextarea: boolean;
  inputType: string;
}

export function isSupportedInputType(type: string, settings: SafeInsertSettings): boolean {
  return settings.inputTypeAllowlist.includes(type.toLowerCase());
}

function resolveContentEditableRoot(element: Element): HTMLElement | null {
  let cursor: Element | null = element;
  while (cursor) {
    if (cursor instanceof HTMLElement && cursor.isContentEditable) {
      return cursor;
    }
    cursor = cursor.parentElement;
  }

  return null;
}

export function resolveSupportedTarget(element: EventTarget | null, settings: SafeInsertSettings): SupportedTargetElement | null {
  if (!(element instanceof Element)) {
    return null;
  }

  if (element instanceof HTMLTextAreaElement) {
    if (element.readOnly || element.disabled) {
      return null;
    }
    return element;
  }

  if (element instanceof HTMLInputElement) {
    const type = (element.type || 'text').toLowerCase();
    if (type === 'password') {
      return null;
    }

    if (!isSupportedInputType(type, settings) || element.readOnly || element.disabled) {
      return null;
    }

    return element;
  }

  const editable = resolveContentEditableRoot(element);
  if (editable) {
    return editable;
  }

  return null;
}

function captureEditableRange(element: HTMLElement): Range | null {
  const selection = element.ownerDocument.getSelection?.();
  if (!selection || selection.rangeCount === 0) {
    return null;
  }

  const range = selection.getRangeAt(0);
  if (!element.contains(range.startContainer) || !element.contains(range.endContainer)) {
    return null;
  }

  return range.cloneRange();
}

export function createTargetSnapshot(element: SupportedTargetElement): TargetSnapshot {
  if (element instanceof HTMLTextAreaElement) {
    const start = element.selectionStart ?? element.value.length;
    const end = element.selectionEnd ?? element.value.length;

    return {
      elementRef: element,
      kind: 'textarea',
      selectionStart: start,
      selectionEnd: end,
      editableRange: null,
      scrollTop: element.scrollTop,
      scrollLeft: element.scrollLeft,
      valueAtOpen: element.value,
      isTextarea: true,
      inputType: 'textarea'
    };
  }

  if (element instanceof HTMLInputElement) {
    const start = element.selectionStart ?? element.value.length;
    const end = element.selectionEnd ?? element.value.length;

    return {
      elementRef: element,
      kind: 'input',
      selectionStart: start,
      selectionEnd: end,
      editableRange: null,
      scrollTop: element.scrollTop,
      scrollLeft: element.scrollLeft,
      valueAtOpen: element.value,
      isTextarea: false,
      inputType: element.type.toLowerCase()
    };
  }

  const editableRange = captureEditableRange(element);
  const selectedText = editableRange && !editableRange.collapsed ? editableRange.toString() : '';

  return {
    elementRef: element,
    kind: 'contenteditable',
    selectionStart: 0,
    selectionEnd: 0,
    editableRange,
    scrollTop: element.scrollTop,
    scrollLeft: element.scrollLeft,
    valueAtOpen: selectedText,
    isTextarea: false,
    inputType: 'contenteditable'
  };
}

export function isTargetUsable(snapshot: TargetSnapshot | null): snapshot is TargetSnapshot {
  if (!snapshot) {
    return false;
  }

  const el = snapshot.elementRef;

  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    return el.isConnected && !el.disabled && !el.readOnly;
  }

  return el.isConnected && el.isContentEditable;
}
