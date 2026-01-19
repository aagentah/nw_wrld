import { useMemo, useCallback } from "react";

export const useNameValidation = (
  items: Array<Record<string, unknown>>,
  currentItemId: string | number | null = null,
  nameKey: string = "name"
) => {
  const existingNames = useMemo(() => {
    const set = new Set<string>();
    const currentId = currentItemId == null ? null : String(currentItemId);
    for (const item of items) {
      if (!item || typeof item !== "object") continue;
      const itemIdRaw = (item as Record<string, unknown>).id;
      const itemId = itemIdRaw == null ? null : String(itemIdRaw);
      if (currentId && itemId === currentId) continue;
      const raw = (item as Record<string, unknown>)[nameKey];
      if (typeof raw !== "string") continue;
      const s = raw.trim();
      if (!s) continue;
      set.add(s.toLowerCase());
    }
    return set;
  }, [items, currentItemId, nameKey]);

  const validate = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      const isDuplicate = existingNames.has(trimmed.toLowerCase());
      const isEmpty = trimmed.length === 0;

      return {
        isValid: !isEmpty && !isDuplicate,
        isEmpty,
        isDuplicate,
        errorMessage: isDuplicate
          ? "A name with this value already exists"
          : isEmpty
            ? "Name cannot be empty"
            : null,
      };
    },
    [existingNames]
  );

  return { validate, existingNames };
};

