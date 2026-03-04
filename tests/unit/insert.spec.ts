import { describe, expect, it } from 'vitest';

import { insertFromModal, normalizeForSingleLine, replaceSelection } from '../../src/lib/insert';
import { DEFAULT_SETTINGS } from '../../src/lib/settings';
import { createTargetSnapshot } from '../../src/lib/target';

describe('insert helpers', () => {
  it('replaces selected range with inserted value', () => {
    const next = replaceSelection('abcdef', 2, 4, 'XYZ');
    expect(next.value).toBe('abXYZef');
    expect(next.nextCaret).toBe(5);
  });

  it('converts newlines for single-line input with space policy', () => {
    const result = normalizeForSingleLine('a\nb', 'space');
    expect(result).toBe('a b');
  });

  it('applies full replacement and dispatches input event', () => {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = 'before';
    document.body.appendChild(input);

    const snapshot = createTargetSnapshot(input);
    let fired = false;
    input.addEventListener('input', () => {
      fired = true;
    });

    const result = insertFromModal(snapshot, 'after', DEFAULT_SETTINGS);
    expect(result.ok).toBe(true);
    expect(input.value).toBe('after');
    expect(fired).toBe(true);
  });
});
