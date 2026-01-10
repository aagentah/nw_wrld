import { renderHook, act } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { useNameValidation } from "../useNameValidation";

interface TestItem {
  id: number;
  name: string;
}

describe("useNameValidation", () => {
  it("should create a set of existing names excluding current item", () => {
    const items: TestItem[] = [
      { id: 1, name: "Track 1" },
      { id: 2, name: "Track 2" },
      { id: 3, name: "Track 3" },
    ];

    const { result } = renderHook(() =>
      useNameValidation(items as unknown as Record<string, unknown>[], 2, "name")
    );

    expect(result.current.existingNames).toBeInstanceOf(Set);
    expect(result.current.existingNames.has("track 1")).toBe(true);
    expect(result.current.existingNames.has("track 2")).toBe(false); // Current item excluded
    expect(result.current.existingNames.has("track 3")).toBe(true);
  });

  it("should include all items when currentItemId is null", () => {
    const items: TestItem[] = [
      { id: 1, name: "Track 1" },
      { id: 2, name: "Track 2" },
    ];

    const { result } = renderHook(() =>
      useNameValidation(items as unknown as Record<string, unknown>[], null, "name")
    );

    expect(result.current.existingNames.has("track 1")).toBe(true);
    expect(result.current.existingNames.has("track 2")).toBe(true);
  });

  it("should validate empty names", () => {
    const items: TestItem[] = [{ id: 1, name: "Existing Track" }];
    const { result } = renderHook(() =>
      useNameValidation(items as unknown as Record<string, unknown>[], null, "name")
    );

    const validation = result.current.validate("");
    expect(validation.isValid).toBe(false);
    expect(validation.isEmpty).toBe(true);
    expect(validation.isDuplicate).toBe(false);
    expect(validation.errorMessage).toBe("Name cannot be empty");
  });

  it("should validate whitespace-only names", () => {
    const items: TestItem[] = [{ id: 1, name: "Existing Track" }];
    const { result } = renderHook(() =>
      useNameValidation(items as unknown as Record<string, unknown>[], null, "name")
    );

    const validation = result.current.validate("   ");
    expect(validation.isValid).toBe(false);
    expect(validation.isEmpty).toBe(true);
    expect(validation.errorMessage).toBe("Name cannot be empty");
  });

  it("should validate duplicate names (case-insensitive)", () => {
    const items: TestItem[] = [
      { id: 1, name: "Track One" },
      { id: 2, name: "Track Two" },
    ];
    const { result } = renderHook(() =>
      useNameValidation(items as unknown as Record<string, unknown>[], null, "name")
    );

    const validation1 = result.current.validate("TRACK ONE");
    expect(validation1.isValid).toBe(false);
    expect(validation1.isDuplicate).toBe(true);
    expect(validation1.errorMessage).toBe("A name with this value already exists");

    const validation2 = result.current.validate("track one");
    expect(validation2.isValid).toBe(false);
    expect(validation2.isDuplicate).toBe(true);
  });

  it("should accept unique valid names", () => {
    const items: TestItem[] = [{ id: 1, name: "Existing Track" }];
    const { result } = renderHook(() =>
      useNameValidation(items as unknown as Record<string, unknown>[], null, "name")
    );

    const validation = result.current.validate("New Track");
    expect(validation.isValid).toBe(true);
    expect(validation.isEmpty).toBe(false);
    expect(validation.isDuplicate).toBe(false);
    expect(validation.errorMessage).toBe(null);
  });

  it("should allow current item's own name", () => {
    const items: TestItem[] = [
      { id: 1, name: "Track 1" },
      { id: 2, name: "Track 2" },
    ];
    const { result } = renderHook(() =>
      useNameValidation(items as unknown as Record<string, unknown>[], 1, "name")
    );

    // Should allow item 1 to keep its name
    const validation = result.current.validate("Track 1");
    expect(validation.isValid).toBe(true);
    expect(validation.isDuplicate).toBe(false);
  });

  it("should use custom name key", () => {
    interface CustomItem {
      id: number;
      title: string;
    }

    const items: CustomItem[] = [
      { id: 1, title: "Item 1" },
      { id: 2, title: "Item 2" },
    ];
    const { result } = renderHook(() =>
      useNameValidation(items as unknown as Record<string, unknown>[], null, "title")
    );

    expect(result.current.existingNames.has("item 1")).toBe(true);

    const validation = result.current.validate("Item 1");
    expect(validation.isDuplicate).toBe(true);
  });

  it("should update existing names when items change", () => {
    const { result, rerender } = renderHook(
      ({ items, currentItemId }) => useNameValidation(items as unknown as Record<string, unknown>[], currentItemId, "name"),
      {
        initialProps: {
          items: [{ id: 1, name: "Track 1" }],
          currentItemId: null as number | null,
        },
      }
    );

    expect(result.current.existingNames.has("track 1")).toBe(true);

    act(() => {
      rerender({
        items: [
          { id: 1, name: "Track 1" },
          { id: 2, name: "Track 2" },
        ],
        currentItemId: null,
      });
    });

    expect(result.current.existingNames.has("track 2")).toBe(true);
  });

  it("should trim whitespace before validation", () => {
    const items: TestItem[] = [{ id: 1, name: "Existing Track" }];
    const { result } = renderHook(() =>
      useNameValidation(items as unknown as Record<string, unknown>[], null, "name")
    );

    const validation = result.current.validate("  New Track  ");
    expect(validation.isValid).toBe(true);
    expect(validation.isEmpty).toBe(false);
  });
});
