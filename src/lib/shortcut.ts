export interface ShortcutSpec {
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
  key: string;
}

function normalizeKey(rawKey: string): string {
  const key = rawKey.trim();
  if (!key) {
    return '';
  }

  const lower = key.toLowerCase();

  if (lower === ' ') {
    return 'Space';
  }

  if (lower === 'space' || lower === 'spacebar') {
    return 'Space';
  }

  if (lower === 'esc') {
    return 'Escape';
  }

  if (key.length === 1) {
    return key.toUpperCase();
  }

  return key[0].toUpperCase() + key.slice(1).toLowerCase();
}

export function parseShortcut(input: string): ShortcutSpec | null {
  const parts = input
    .split('+')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (parts.length === 0) {
    return null;
  }

  const spec: ShortcutSpec = {
    ctrl: false,
    alt: false,
    shift: false,
    meta: false,
    key: ''
  };

  for (const part of parts) {
    const lower = part.toLowerCase();
    if (lower === 'ctrl' || lower === 'control') {
      spec.ctrl = true;
      continue;
    }

    if (lower === 'alt' || lower === 'option') {
      spec.alt = true;
      continue;
    }

    if (lower === 'shift') {
      spec.shift = true;
      continue;
    }

    if (lower === 'meta' || lower === 'cmd' || lower === 'command') {
      spec.meta = true;
      continue;
    }

    if (spec.key) {
      return null;
    }

    spec.key = normalizeKey(part);
  }

  return spec.key ? spec : null;
}

export function formatShortcut(spec: ShortcutSpec | null): string {
  if (!spec) {
    return '';
  }

  const chunks: string[] = [];
  if (spec.ctrl) chunks.push('Ctrl');
  if (spec.alt) chunks.push('Alt');
  if (spec.shift) chunks.push('Shift');
  if (spec.meta) chunks.push('Meta');
  chunks.push(spec.key);
  return chunks.join('+');
}

export function normalizeShortcut(input: string): string {
  return formatShortcut(parseShortcut(input));
}

function eventKey(event: KeyboardEvent): string {
  if (event.code === 'Space') {
    return 'Space';
  }

  return normalizeKey(event.key);
}

export function isShortcutMatch(event: KeyboardEvent, shortcut: string): boolean {
  const spec = parseShortcut(shortcut);
  if (!spec) {
    return false;
  }

  return (
    spec.ctrl === event.ctrlKey &&
    spec.alt === event.altKey &&
    spec.shift === event.shiftKey &&
    spec.meta === event.metaKey &&
    spec.key === eventKey(event)
  );
}

export function isShortcutMatchLoose(event: KeyboardEvent, shortcut: string): boolean {
  const spec = parseShortcut(shortcut);
  if (!spec) {
    return false;
  }

  if (spec.ctrl && !event.ctrlKey) return false;
  if (spec.alt && !event.altKey) return false;
  if (spec.shift && !event.shiftKey) return false;
  if (spec.meta && !event.metaKey) return false;

  return spec.key === eventKey(event);
}
