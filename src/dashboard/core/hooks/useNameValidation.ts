import { useMemo, useCallback } from "react";

export interface NameValidationResult {
  isValid: boolean;
  isEmpty: boolean;
  isDuplicate: boolean;
  errorMessage: string | null;
}

export interface UseNameValidationReturn<T> {
  validate: (name: string) => NameValidationResult;
  existingNames: Set<string>;
}

export const useNameValidation = <
  T extends Record<string, unknown> = { id: number | string; name: string }
>(
  items: T[],
  currentItemId: T["id"] | null = null,
  nameKey: keyof T = "name"
): UseNameValidationReturn<T> => {
  const existingNames = useMemo(() => {
    return new Set(
      items
        .filter((item) => !currentItemId || item.id !== currentItemId)
        .map((item) => String(item[nameKey] as string).toLowerCase())
    );
  }, [items, currentItemId, nameKey]);

  const validate = useCallback(
    (name: string): NameValidationResult => {
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
