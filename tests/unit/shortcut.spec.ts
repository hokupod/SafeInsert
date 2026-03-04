import { describe, expect, it } from 'vitest';

import { formatShortcut, isShortcutMatch, isShortcutMatchLoose, normalizeShortcut, parseShortcut } from '../../src/lib/shortcut';

describe('shortcut helpers', () => {
  it('parses and formats with canonical order', () => {
    const spec = parseShortcut('shift+alt+space');
    expect(spec).not.toBeNull();
    expect(formatShortcut(spec)).toBe('Alt+Shift+Space');
  });

  it('normalizes aliases', () => {
    expect(normalizeShortcut('control+enter')).toBe('Ctrl+Enter');
    expect(normalizeShortcut('alt+spacebar')).toBe('Alt+Space');
  });

  it('matches keyboard event strictly', () => {
    const event = new KeyboardEvent('keydown', {
      key: 'Enter',
      ctrlKey: true
    });

    expect(isShortcutMatch(event, 'Ctrl+Enter')).toBe(true);
    expect(isShortcutMatch(event, 'Alt+Enter')).toBe(false);
  });

  it('loose matcher allows extra modifiers', () => {
    const event = new KeyboardEvent('keydown', {
      key: ' ',
      code: 'Space',
      altKey: true,
      shiftKey: true,
      ctrlKey: true
    });

    expect(isShortcutMatch(event, 'Alt+Shift+Space')).toBe(false);
    expect(isShortcutMatchLoose(event, 'Alt+Shift+Space')).toBe(true);
  });

  it('matches Space by event.code even when key is non-breaking-space', () => {
    const event = new KeyboardEvent('keydown', {
      key: '\u00A0',
      code: 'Space',
      altKey: true,
      shiftKey: true
    });

    expect(isShortcutMatch(event, 'Alt+Shift+Space')).toBe(true);
  });
});
