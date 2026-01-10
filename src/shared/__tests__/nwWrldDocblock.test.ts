import {
  normalizeDocblockValue,
  parseNwWrldDocblockMetadata,
} from "@shared/nwWrldDocblock.ts";
import type { ModuleMetadata } from "../../types/moduleMetadata";

describe("normalizeDocblockValue", () => {
  it("should handle empty and undefined values", () => {
    expect(normalizeDocblockValue("")).toBe("");
    expect(normalizeDocblockValue(null as any)).toBe("");
    expect(normalizeDocblockValue(undefined as any)).toBe("");
  });

  it("should trim whitespace", () => {
    expect(normalizeDocblockValue("  hello  ")).toBe("hello");
    expect(normalizeDocblockValue("\n  hello  \n")).toBe("hello");
  });

  it("should remove trailing */", () => {
    expect(normalizeDocblockValue("hello */")).toBe("hello");
    expect(normalizeDocblockValue("hello */ ")).toBe("hello");
    expect(normalizeDocblockValue("hello   */   ")).toBe("hello");
  });

  it("should unwrap quoted strings", () => {
    expect(normalizeDocblockValue('"hello"')).toBe("hello");
    expect(normalizeDocblockValue("'hello'")).toBe("hello");
    expect(normalizeDocblockValue('"hello world"')).toBe("hello world");
  });

  it("should unwrap first and last quote regardless of matching", () => {
    // The original regex matches any quote at start and end, not matching pairs
    expect(normalizeDocblockValue('"hello\'')).toBe("hello");
    expect(normalizeDocblockValue("'hello\"")).toBe("hello");
  });

  it("should handle strings with quotes inside", () => {
    expect(normalizeDocblockValue('"hello \'world\'"')).toBe("hello 'world'");
    expect(normalizeDocblockValue("'hello \"world\"'")).toBe('hello "world"');
  });

  it("should convert non-string values to string", () => {
    expect(normalizeDocblockValue(123 as any)).toBe("123");
    // 0 is falsy so it becomes "" due to the || "" in String(value || "")
    expect(normalizeDocblockValue(0 as any)).toBe("");
    expect(normalizeDocblockValue(true as any)).toBe("true");
    expect(normalizeDocblockValue(false as any)).toBe("");
  });
});

describe("parseNwWrldDocblockMetadata", () => {
  const DEFAULT_MAX_BYTES = 16 * 1024;

  it("should parse complete @nwWrld metadata", () => {
    const text = `
      /**
       * @nwWrld name: "MyModule"
       * @nwWrld category: "Effects"
       * @nwWrld imports: "utils,helpers"
       */
    `;

    const result = parseNwWrldDocblockMetadata(text, DEFAULT_MAX_BYTES);

    expect(result.name).toBe("MyModule");
    expect(result.category).toBe("Effects");
    expect(result.imports).toEqual(["utils", "helpers"]);
    expect(result.hasMetadata).toBe(true);
  });

  it("should handle metadata with different quote styles", () => {
    const text = `
      /**
       * @nwWrld name: 'TestModule'
       * @nwWrld category: 'Utilities'
       * @nwWrld imports: 'a,b,c'
       */
    `;

    const result = parseNwWrldDocblockMetadata(text, DEFAULT_MAX_BYTES);

    expect(result.name).toBe("TestModule");
    expect(result.category).toBe("Utilities");
    expect(result.imports).toEqual(["a", "b", "c"]);
  });

  it("should handle metadata without quotes", () => {
    const text = `
      /**
       * @nwWrld name: SimpleModule
       * @nwWrld category: Video
       * @nwWrld imports: one,two,three
       */
    `;

    const result = parseNwWrldDocblockMetadata(text, DEFAULT_MAX_BYTES);

    expect(result.name).toBe("SimpleModule");
    expect(result.category).toBe("Video");
    expect(result.imports).toEqual(["one", "two", "three"]);
  });

  it("should handle metadata with trailing */ on values", () => {
    const text = `
      /**
       * @nwWrld name: "Module1" */
       * @nwWrld category: "Test"
       * @nwWrld imports: "a,b"
       */
    `;

    const result = parseNwWrldDocblockMetadata(text, DEFAULT_MAX_BYTES);

    expect(result.name).toBe("Module1");
    expect(result.category).toBe("Test");
  });

  it("should deduplicate imports", () => {
    const text = `
      /**
       * @nwWrld name: "Test"
       * @nwWrld category: "Test"
       * @nwWrld imports: "a,a,b,b,c,c"
       */
    `;

    const result = parseNwWrldDocblockMetadata(text, DEFAULT_MAX_BYTES);

    expect(result.imports).toEqual(["a", "b", "c"]);
  });

  it("should handle empty imports list", () => {
    const text = `
      /**
       * @nwWrld name: "Test"
       * @nwWrld category: "Test"
       * @nwWrld imports: ""
       */
    `;

    const result = parseNwWrldDocblockMetadata(text, DEFAULT_MAX_BYTES);

    expect(result.imports).toEqual([]);
    expect(result.hasMetadata).toBe(false);
  });

  it("should handle missing imports", () => {
    const text = `
      /**
       * @nwWrld name: "Test"
       * @nwWrld category: "Test"
       */
    `;

    const result = parseNwWrldDocblockMetadata(text, DEFAULT_MAX_BYTES);

    expect(result.imports).toEqual([]);
    expect(result.hasMetadata).toBe(false);
  });

  it("should handle missing name or category", () => {
    const text = `
      /**
       * @nwWrld name: "Test"
       * @nwWrld imports: "a,b"
       */
    `;

    const result = parseNwWrldDocblockMetadata(text, DEFAULT_MAX_BYTES);

    expect(result.name).toBe("Test");
    expect(result.category).toBe(null);
    expect(result.hasMetadata).toBe(false);
  });

  it("should handle case-insensitive @nwWrld tag", () => {
    const text = `
      /**
       * @nwwrld name: "Test"
       * @nwwrld category: "Test"
       * @nwwrld imports: "a,b"
       */
    `;

    const result = parseNwWrldDocblockMetadata(text, DEFAULT_MAX_BYTES);

    expect(result.name).toBe("Test");
    expect(result.category).toBe("Test");
    expect(result.imports).toEqual(["a", "b"]);
    expect(result.hasMetadata).toBe(true);
  });

  it("should handle whitespace in imports", () => {
    const text = `
      /**
       * @nwWrld name: "Test"
       * @nwWrld category: "Test"
       * @nwWrld imports: "a , b , c"
       */
    `;

    const result = parseNwWrldDocblockMetadata(text, DEFAULT_MAX_BYTES);

    expect(result.imports).toEqual(["a", "b", "c"]);
  });

  it("should respect maxBytes parameter", () => {
    const longText = "x".repeat(20000);
    const text = `
      /**
       * @nwWrld name: "Test"
       * @nwWrld category: "Test"
       * @nwWrld imports: "a,b"
       */
      ${longText}
    `;

    const result = parseNwWrldDocblockMetadata(text, 100);

    // At 100 bytes, the imports line is cut off, so it's not found
    expect(result.name).toBe("Test");
    expect(result.category).toBe("Test");
    expect(result.imports).toEqual([]);
    expect(result.hasMetadata).toBe(false);
  });

  it("should handle empty or null input", () => {
    expect(parseNwWrldDocblockMetadata("", DEFAULT_MAX_BYTES)).toEqual({
      name: null,
      category: null,
      imports: [],
      hasMetadata: false,
    });

    expect(parseNwWrldDocblockMetadata(null as any, DEFAULT_MAX_BYTES)).toEqual({
      name: null,
      category: null,
      imports: [],
      hasMetadata: false,
    });
  });

  it("should use default maxBytes when not provided", () => {
    const text = `
      /**
       * @nwWrld name: "Test"
       * @nwWrld category: "Test"
       * @nwWrld imports: "a,b"
       */
    `;

    const result = parseNwWrldDocblockMetadata(text, 0);

    expect(result.name).toBe("Test");
    expect(result.category).toBe("Test");
    expect(result.imports).toEqual(["a", "b"]);
  });

  it("should return ModuleMetadata type", () => {
    const text = `
      /**
       * @nwWrld name: "Test"
       * @nwWrld category: "Test"
       * @nwWrld imports: "a,b"
       */
    `;

    const result: ModuleMetadata = parseNwWrldDocblockMetadata(
      text,
      DEFAULT_MAX_BYTES
    );

    expect(result).toHaveProperty("name");
    expect(result).toHaveProperty("category");
    expect(result).toHaveProperty("imports");
    expect(result).toHaveProperty("hasMetadata");
  });
});
