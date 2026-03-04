import { browser } from 'wxt/browser';

export const SETTINGS_STORAGE_KEY = 'safeInsert.settings.v1';

export type NewlinePolicyForSingleLine = 'space' | 'remove' | 'block';
export type PrefillPolicy = 'sourceFullValue';

export interface SafeInsertSettings {
  triggerShortcut: string;
  insertShortcut: string;
  newlinePolicyForSingleLine: NewlinePolicyForSingleLine;
  prefillPolicy: PrefillPolicy;
  excludedSites: string[];
  inputTypeAllowlist: string[];
}

export const DEFAULT_SETTINGS: SafeInsertSettings = {
  triggerShortcut: 'Alt+Shift+Space',
  insertShortcut: 'Ctrl+Enter',
  newlinePolicyForSingleLine: 'space',
  prefillPolicy: 'sourceFullValue',
  excludedSites: [],
  inputTypeAllowlist: ['text', 'search', 'email', 'url', 'tel']
};

function normalizeArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((v) => String(v).trim())
    .filter((v) => v.length > 0);
}

export function sanitizeSettings(candidate: Partial<SafeInsertSettings> | null | undefined): SafeInsertSettings {
  const next = candidate ?? {};

  const newlinePolicy: NewlinePolicyForSingleLine =
    next.newlinePolicyForSingleLine === 'remove' || next.newlinePolicyForSingleLine === 'block'
      ? next.newlinePolicyForSingleLine
      : 'space';

  const inputTypeAllowlist = normalizeArray(next.inputTypeAllowlist).map((v) => v.toLowerCase());

  return {
    triggerShortcut: (next.triggerShortcut ?? DEFAULT_SETTINGS.triggerShortcut).trim() || DEFAULT_SETTINGS.triggerShortcut,
    insertShortcut: (next.insertShortcut ?? DEFAULT_SETTINGS.insertShortcut).trim() || DEFAULT_SETTINGS.insertShortcut,
    newlinePolicyForSingleLine: newlinePolicy,
    prefillPolicy: 'sourceFullValue',
    excludedSites: normalizeArray(next.excludedSites),
    inputTypeAllowlist: inputTypeAllowlist.length > 0 ? inputTypeAllowlist : DEFAULT_SETTINGS.inputTypeAllowlist
  };
}

export async function readSettings(): Promise<SafeInsertSettings> {
  const raw = await browser.storage.local.get(SETTINGS_STORAGE_KEY);
  return sanitizeSettings(raw[SETTINGS_STORAGE_KEY] as Partial<SafeInsertSettings> | undefined);
}

export async function writeSettings(next: SafeInsertSettings): Promise<void> {
  await browser.storage.local.set({
    [SETTINGS_STORAGE_KEY]: sanitizeSettings(next)
  });
}

export function hostMatchesRule(hostname: string, rule: string): boolean {
  const normalized = rule.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  if (normalized.startsWith('*.')) {
    const suffix = normalized.slice(2);
    return hostname === suffix || hostname.endsWith(`.${suffix}`);
  }

  return hostname === normalized;
}

export function isExcludedHost(hostname: string, excludedSites: string[]): boolean {
  const h = hostname.toLowerCase();
  return excludedSites.some((rule) => hostMatchesRule(h, rule));
}
