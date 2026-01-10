import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getMethodsByLayer,
  getMethodCode,
  generateTrackNotes,
} from "../utils";

describe("getMethodsByLayer", () => {
  it("should return empty array when module is null or undefined", () => {
    expect(getMethodsByLayer(null, [], [])).toEqual([]);
    expect(getMethodsByLayer(undefined, [], [])).toEqual([]);
  });

  it("should return empty array when module has no methods", () => {
    const module = { name: "TestModule" };
    expect(getMethodsByLayer(module, [], [])).toEqual([]);
  });

  it("should categorize methods into Base layer", () => {
    const module = {
      name: "TestModule",
      methods: [
        { name: "method1" },
        { name: "method2" },
        { name: "customMethod" },
      ],
    };
    const moduleBase = ["method1", "method2"];
    const threeBase = ["threeMethod1"];

    const result = getMethodsByLayer(module, moduleBase, threeBase);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      name: "Base",
      methods: ["method1", "method2"],
    });
  });

  it("should categorize methods into Three.js Base layer", () => {
    const module = {
      name: "TestModule",
      methods: [
        { name: "method1" },
        { name: "threeMethod1" },
        { name: "threeMethod2" },
      ],
    };
    const moduleBase = ["method1"];
    const threeBase = ["threeMethod1", "threeMethod2", "threeMethod3"];

    const result = getMethodsByLayer(module, moduleBase, threeBase);

    expect(result).toHaveLength(2);
    expect(result[1]).toEqual({
      name: "Three.js Base",
      methods: ["threeMethod1", "threeMethod2"],
    });
  });

  it("should not duplicate methods in both Base and Three.js Base", () => {
    const module = {
      name: "TestModule",
      methods: [{ name: "sharedMethod" }, { name: "method1" }],
    };
    const moduleBase = ["sharedMethod", "method1"];
    const threeBase = ["sharedMethod", "threeMethod1"];

    const result = getMethodsByLayer(module, moduleBase, threeBase);

    // sharedMethod should only be in Base, not in Three.js Base
    expect(result[0].methods).toContain("sharedMethod");
    expect(result[0].methods).toContain("method1");
    if (result.length > 1) {
      expect(result[1].methods).not.toContain("sharedMethod");
    }
  });

  it("should categorize module-specific methods", () => {
    const module = {
      name: "CustomModule",
      methods: [
        { name: "baseMethod" },
        { name: "customMethod1" },
        { name: "customMethod2" },
      ],
    };
    const moduleBase = ["baseMethod"];
    const threeBase = ["threeMethod"];

    const result = getMethodsByLayer(module, moduleBase, threeBase);

    expect(result).toHaveLength(2);
    expect(result[1]).toEqual({
      name: "CustomModule",
      methods: ["customMethod1", "customMethod2"],
    });
  });

  it("should handle all three layers", () => {
    const module = {
      name: "TestModule",
      methods: [
        { name: "base1" },
        { name: "base2" },
        { name: "three1" },
        { name: "three2" },
        { name: "custom1" },
      ],
    };
    const moduleBase = ["base1", "base2"];
    const threeBase = ["three1", "three2", "three3"];

    const result = getMethodsByLayer(module, moduleBase, threeBase);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ name: "Base", methods: ["base1", "base2"] });
    expect(result[1]).toEqual({ name: "Three.js Base", methods: ["three1", "three2"] });
    expect(result[2]).toEqual({
      name: "TestModule",
      methods: ["custom1"],
    });
  });
});

describe("getMethodCode", () => {
  const mockBridge = {
    app: {
      getMethodCode: vi.fn(),
    },
  };

  beforeEach(() => {
    (globalThis as any).nwWrldBridge = mockBridge;
  });

  afterEach(() => {
    delete (globalThis as any).nwWrldBridge;
    vi.clearAllMocks();
  });

  it("should return null when bridge is not available", () => {
    delete (globalThis as any).nwWrldBridge;

    const result = getMethodCode("TestModule", "testMethod");

    expect(result).toEqual({ code: null, filePath: null });
  });

  it("should return null when bridge.app is not available", () => {
    (globalThis as any).nwWrldBridge = {};

    const result = getMethodCode("TestModule", "testMethod");

    expect(result).toEqual({ code: null, filePath: null });
  });

  it("should return null when getMethodCode is not a function", () => {
    (globalThis as any).nwWrldBridge = { app: {} };

    const result = getMethodCode("TestModule", "testMethod");

    expect(result).toEqual({ code: null, filePath: null });
  });

  it("should call bridge.app.getMethodCode with correct arguments", () => {
    mockBridge.app.getMethodCode.mockReturnValue({
      code: "function test() {}",
      filePath: "/path/to/file.js",
    });

    const result = getMethodCode("TestModule", "testMethod");

    expect(mockBridge.app.getMethodCode).toHaveBeenCalledWith(
      "TestModule",
      "testMethod"
    );
    expect(result).toEqual({
      code: "function test() {}",
      filePath: "/path/to/file.js",
    });
  });

  it("should handle null response from bridge", () => {
    mockBridge.app.getMethodCode.mockReturnValue(null);

    const result = getMethodCode("TestModule", "testMethod");

    expect(result).toEqual({ code: null, filePath: null });
  });

  it("should handle response with missing properties", () => {
    mockBridge.app.getMethodCode.mockReturnValue({});

    const result = getMethodCode("TestModule", "testMethod");

    expect(result).toEqual({ code: null, filePath: null });
  });

  it("should handle errors gracefully", () => {
    mockBridge.app.getMethodCode.mockImplementation(() => {
      throw new Error("Bridge error");
    });

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = getMethodCode("TestModule", "testMethod");

    expect(result).toEqual({ code: null, filePath: null });
    expect(consoleSpy).toHaveBeenCalledWith(
      "Error extracting method code:",
      expect.any(Error)
    );

    consoleSpy.mockRestore();
  });
});

describe("generateTrackNotes", () => {
  it("should generate an array of notes", () => {
    const notes = generateTrackNotes();

    expect(Array.isArray(notes)).toBe(true);
    expect(notes.length).toBeGreaterThan(0);
  });

  it("should start with channel notes", () => {
    const notes = generateTrackNotes();

    expect(notes[0]).toBe("G8");
    expect(notes[1]).toBe("F#8");
    expect(notes[2]).toBe("F8");
    expect(notes[3]).toBe("E8");
  });

  it("should contain all expected channel notes", () => {
    const notes = generateTrackNotes();
    const expectedChannelNotes = [
      "G8",
      "F#8",
      "F8",
      "E8",
      "D#8",
      "D8",
      "C#8",
      "C8",
      "B7",
      "A#7",
      "A7",
      "G#7",
      "G7",
      "F#7",
      "F7",
      "E7",
    ];

    expectedChannelNotes.forEach((note) => {
      expect(notes).toContain(note);
    });
  });

  it("should contain standard notes across octaves -1, 0, 1, 2", () => {
    const notes = generateTrackNotes();

    // Check for notes in octave -1
    expect(notes).toContain("C-1");
    expect(notes).toContain("G#-1");

    // Check for notes in octave 0
    expect(notes).toContain("C0");
    expect(notes).toContain("A0");

    // Check for notes in octave 1
    expect(notes).toContain("C1");
    expect(notes).toContain("B1");

    // Check for notes in octave 2
    expect(notes).toContain("C2");
    expect(notes).toContain("G#2");
  });

  it("should have total of 64 notes (16 channel + 48 standard)", () => {
    const notes = generateTrackNotes();

    // 16 channel notes + (12 notes * 4 octaves) = 16 + 48 = 64
    expect(notes.length).toBe(64);
  });

  it("should maintain consistent order", () => {
    const notes1 = generateTrackNotes();
    const notes2 = generateTrackNotes();

    expect(notes1).toEqual(notes2);
  });
});
