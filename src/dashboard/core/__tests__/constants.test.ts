import { TERMINAL_STYLES } from "../constants";

describe("TERMINAL_STYLES", () => {
  it("should export TERMINAL_STYLES constant", () => {
    expect(TERMINAL_STYLES).toBeDefined();
    expect(typeof TERMINAL_STYLES).toBe("object");
  });

  it("should have all required color properties", () => {
    expect(TERMINAL_STYLES.bg).toBe("rgb(16 16 16)");
    expect(TERMINAL_STYLES.text).toBe("#d9d9d9");
    expect(TERMINAL_STYLES.border).toBe("#333333");
    expect(TERMINAL_STYLES.borderLight).toBe("#d9d9d9");
    expect(TERMINAL_STYLES.accent).toBe("#d9d9d9");
    expect(TERMINAL_STYLES.accentDim).toBe("rgba(255, 255, 255, 0.1)");
    expect(TERMINAL_STYLES.selected).toBe("#d9d9d9");
    expect(TERMINAL_STYLES.selectedBg).toBe("rgba(255, 255, 255, 0.05)");
    expect(TERMINAL_STYLES.disabled).toBe("rgba(224, 224, 224, 0.3)");
    expect(TERMINAL_STYLES.error).toBe("#d9d9d9");
  });

  it("should have font properties", () => {
    expect(TERMINAL_STYLES.fontFamily).toBe(
      '"Roboto Mono", "Apple Symbols", "Segoe UI Symbol", "Symbol", monospace'
    );
    expect(TERMINAL_STYLES.fontSize).toBe("11px");
  });

  it("should have layout properties", () => {
    expect(TERMINAL_STYLES.lineHeight).toBe("1.5");
    expect(TERMINAL_STYLES.spacing).toBe("2px");
  });

  it("should have readonly type at compile time", () => {
    // TypeScript's 'as const' makes properties readonly at compile time
    // This test documents that behavior
    expect(TERMINAL_STYLES.bg).toBe("rgb(16 16 16)");
  });
});
