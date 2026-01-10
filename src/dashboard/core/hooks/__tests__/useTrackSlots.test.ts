import { renderHook } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { useTrackSlots } from "../useTrackSlots";
import type { Track, GlobalMappings, InputType } from "../../../../types";

describe("useTrackSlots", () => {
  const createMockTrack = (id: number, trackSlot?: number): Track => ({
    id,
    name: `Track ${id}`,
    modules: [],
    modulesData: {},
    ...(trackSlot !== undefined && { trackSlot }),
  });

  const createMockGlobalMappings = (
    inputType: InputType
  ): { trackMappings: GlobalMappings } => ({
    trackMappings: {
      midi: {
        1: "C3",
        2: "D3",
        3: "E3",
      },
      osc: {
        1: "/track/1",
        2: "/track/2",
        3: "/track/3",
      },
    },
  });

  it("should calculate used slots from tracks", () => {
    const tracks: Track[] = [
      createMockTrack(1, 1),
      createMockTrack(2, 3),
      createMockTrack(3, 5),
    ];

    const { result } = renderHook(() =>
      useTrackSlots(tracks, undefined, "midi", null)
    );

    expect(result.current.usedSlots).toBeInstanceOf(Set);
    expect(result.current.usedSlots.has(1)).toBe(true);
    expect(result.current.usedSlots.has(3)).toBe(true);
    expect(result.current.usedSlots.has(5)).toBe(true);
    expect(result.current.usedSlots.has(2)).toBe(false);
  });

  it("should exclude track with specified ID from used slots", () => {
    const tracks: Track[] = [
      createMockTrack(1, 1),
      createMockTrack(2, 2),
      createMockTrack(3, 3),
    ];

    const { result } = renderHook(() =>
      useTrackSlots(tracks, undefined, "midi", 2)
    );

    expect(result.current.usedSlots.has(1)).toBe(true);
    expect(result.current.usedSlots.has(2)).toBe(false); // Excluded
    expect(result.current.usedSlots.has(3)).toBe(true);
  });

  it("should filter out undefined trackSlot values", () => {
    const tracks: Track[] = [
      createMockTrack(1, 1),
      createMockTrack(2), // No trackSlot
      createMockTrack(3, 3),
    ];

    const { result } = renderHook(() =>
      useTrackSlots(tracks, undefined, "midi", null)
    );

    expect(result.current.usedSlots.size).toBe(2);
    expect(result.current.usedSlots.has(1)).toBe(true);
    expect(result.current.usedSlots.has(3)).toBe(true);
  });

  it("should calculate available slots (1-10 excluding used)", () => {
    const tracks: Track[] = [
      createMockTrack(1, 2),
      createMockTrack(2, 5),
      createMockTrack(3, 8),
    ];

    const { result } = renderHook(() =>
      useTrackSlots(tracks, undefined, "midi", null)
    );

    expect(result.current.availableSlots).toEqual([1, 3, 4, 6, 7, 9, 10]);
  });

  it("should return all slots 1-10 when none are used", () => {
    const tracks: Track[] = [createMockTrack(1), createMockTrack(2)];

    const { result } = renderHook(() =>
      useTrackSlots(tracks, undefined, "midi", null)
    );

    expect(result.current.availableSlots).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
  });

  it("should return empty array when all slots are used", () => {
    const tracks: Track[] = Array.from({ length: 10 }, (_, i) =>
      createMockTrack(i + 1, i + 1)
    );

    const { result } = renderHook(() =>
      useTrackSlots(tracks, undefined, "midi", null)
    );

    expect(result.current.availableSlots).toEqual([]);
  });

  it("should get trigger for slot from global mappings (midi)", () => {
    const tracks: Track[] = [createMockTrack(1)];
    const globalMappings = createMockGlobalMappings("midi");

    const { result } = renderHook(() =>
      useTrackSlots(tracks, globalMappings, "midi", null)
    );

    expect(result.current.getTrigger(1)).toBe("C3");
    expect(result.current.getTrigger(2)).toBe("D3");
    expect(result.current.getTrigger(3)).toBe("E3");
    expect(result.current.getTrigger(4)).toBe("");
  });

  it("should get trigger for slot from global mappings (osc)", () => {
    const tracks: Track[] = [createMockTrack(1)];
    const globalMappings = createMockGlobalMappings("osc");

    const { result } = renderHook(() =>
      useTrackSlots(tracks, globalMappings, "osc", null)
    );

    expect(result.current.getTrigger(1)).toBe("/track/1");
    expect(result.current.getTrigger(2)).toBe("/track/2");
    expect(result.current.getTrigger(3)).toBe("/track/3");
    expect(result.current.getTrigger(4)).toBe("");
  });

  it("should return empty string when globalMappings is undefined", () => {
    const tracks: Track[] = [createMockTrack(1)];

    const { result } = renderHook(() =>
      useTrackSlots(tracks, undefined, "midi", null)
    );

    expect(result.current.getTrigger(1)).toBe("");
  });

  it("should return empty string when trackMappings is undefined", () => {
    const tracks: Track[] = [createMockTrack(1)];
    const globalMappings = {};

    const { result } = renderHook(() =>
      useTrackSlots(tracks, globalMappings, "midi", null)
    );

    expect(result.current.getTrigger(1)).toBe("");
  });

  it("should check if slot is available", () => {
    const tracks: Track[] = [createMockTrack(1, 2), createMockTrack(2, 5)];

    const { result } = renderHook(() =>
      useTrackSlots(tracks, undefined, "midi", null)
    );

    expect(result.current.isSlotAvailable(1)).toBe(true);
    expect(result.current.isSlotAvailable(2)).toBe(false);
    expect(result.current.isSlotAvailable(5)).toBe(false);
    expect(result.current.isSlotAvailable(10)).toBe(true);
  });

  it("should update when tracks change", () => {
    const { result, rerender } = renderHook(
      ({ tracks }) => useTrackSlots(tracks, undefined, "midi", null),
      {
        initialProps: {
          tracks: [createMockTrack(1, 1)],
        },
      }
    );

    expect(result.current.usedSlots.has(1)).toBe(true);
    expect(result.current.availableSlots).not.toContain(1);

    rerender({ tracks: [createMockTrack(1, 1), createMockTrack(2, 2)] });

    expect(result.current.usedSlots.has(2)).toBe(true);
    expect(result.current.availableSlots).not.toContain(2);
  });

  it("should update when inputType changes", () => {
    const tracks: Track[] = [createMockTrack(1)];
    const globalMappings = createMockGlobalMappings("midi");

    const { result, rerender } = renderHook(
      ({ inputType }) => useTrackSlots(tracks, globalMappings, inputType, null),
      {
        initialProps: { inputType: "midi" as InputType },
      }
    );

    expect(result.current.getTrigger(1)).toBe("C3");

    rerender({ inputType: "osc" as InputType });

    expect(result.current.getTrigger(1)).toBe("/track/1");
  });
});
