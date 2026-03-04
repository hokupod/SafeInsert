export const LAST_TARGET_STORAGE_KEY = 'safeInsert.lastTarget.v1';

export interface PersistedLastTarget {
  tabId: number;
  frameId: number;
  inputType: string;
  isTextarea: boolean;
  windowId?: number;
  updatedAt: number;
}

export function isPersistedLastTarget(value: unknown): value is PersistedLastTarget {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<PersistedLastTarget>;
  return (
    typeof candidate.tabId === 'number' &&
    typeof candidate.frameId === 'number' &&
    typeof candidate.inputType === 'string' &&
    typeof candidate.isTextarea === 'boolean' &&
    typeof candidate.updatedAt === 'number'
  );
}
