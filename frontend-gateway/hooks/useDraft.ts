import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import {
  safeLocalGet,
  safeLocalRemove,
  safeLocalSet,
} from "../utils/localStorage.ts";

/**
 * useDraft — persist form state to localStorage as the user types.
 *
 * Usage:
 *   const { draft, updateDraft, clearDraft, hasDraft } = useDraft<MyForm>("room_draft");
 *
 * - `draft`        : the current saved draft (or null if none)
 * - `hasDraft`     : true when a non-empty draft exists on mount
 * - `updateDraft`  : call this with partial form state on every change
 * - `clearDraft`   : call on successful submit or manual discard
 */
function hasMeaningfulContent(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return !Number.isNaN(value);
  if (typeof value === "boolean") return value === true;
  if (Array.isArray(value)) return value.some(hasMeaningfulContent);
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).some(
      hasMeaningfulContent,
    );
  }
  return false;
}

export function useDraft<T extends Record<string, unknown>>(
  storageKey: string,
): {
  draft: T | null;
  hasDraft: boolean;
  updateDraft: (partial: Partial<T>) => void;
  clearDraft: () => void;
} {
  const [hasDraft, setHasDraft] = useState(false);
  const [draft, setDraft] = useState<T | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const parsed = safeLocalGet<T | null>(storageKey, null);
    if (parsed && Object.values(parsed).some(hasMeaningfulContent)) {
      setDraft(parsed);
      setHasDraft(true);
    }
  }, [storageKey]);

  const updateDraft = useCallback((partial: Partial<T>) => {
    setDraft((prev) => {
      const next = { ...(prev ?? {}), ...partial } as T;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        safeLocalSet(storageKey, next);
      }, 400);
      return next;
    });
  }, [storageKey]);

  const clearDraft = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setDraft(null);
    setHasDraft(false);
    safeLocalRemove(storageKey);
  }, [storageKey]);

  return { draft, hasDraft, updateDraft, clearDraft };
}
