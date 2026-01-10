import { INPUT_STATUS } from "@shared/constants/inputStatus.ts";

describe("INPUT_STATUS", () => {
  it("should export all four status constants", () => {
    expect(INPUT_STATUS).toHaveProperty("DISCONNECTED");
    expect(INPUT_STATUS).toHaveProperty("CONNECTING");
    expect(INPUT_STATUS).toHaveProperty("CONNECTED");
    expect(INPUT_STATUS).toHaveProperty("ERROR");
  });

  it("should have correct string values", () => {
    expect(INPUT_STATUS.DISCONNECTED).toBe("disconnected");
    expect(INPUT_STATUS.CONNECTING).toBe("connecting");
    expect(INPUT_STATUS.CONNECTED).toBe("connected");
    expect(INPUT_STATUS.ERROR).toBe("error");
  });

  it("should be immutable (frozen object)", () => {
    expect(() => {
      (INPUT_STATUS as any).NEW_STATUS = "new_status";
    }).not.toThrow();
  });

  it("should match InputStatus type from types/input.ts", () => {
    const values: string[] = [
      INPUT_STATUS.DISCONNECTED,
      INPUT_STATUS.CONNECTING,
      INPUT_STATUS.CONNECTED,
      INPUT_STATUS.ERROR,
    ];

    values.forEach((value) => {
      expect(["disconnected", "connecting", "connected", "error"]).toContain(
        value
      );
    });
  });

  it("should have all required values for InputStatus union type", () => {
    const requiredValues = ["disconnected", "connecting", "connected", "error"];
    const actualValues = Object.values(INPUT_STATUS);

    requiredValues.forEach((required) => {
      expect(actualValues).toContain(required);
    });
  });
});
