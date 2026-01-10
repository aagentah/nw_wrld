import { HELP_TEXT } from "@shared/helpText.ts";

describe("HELP_TEXT", () => {
  it("should export HELP_TEXT constant", () => {
    expect(HELP_TEXT).toBeDefined();
    expect(typeof HELP_TEXT).toBe("object");
  });

  it("should have all expected help text keys", () => {
    const expectedKeys = [
      "trackNote",
      "modules",
      "methods",
      "executeOnLoadMethods",
      "aspectRatio",
      "debugOverlay",
      "autoRefresh",
      "channelTrigger",
      "emulateMidiPlayback",
      "editorMethods",
      "inputType",
      "trackTrigger",
      "trackSlot",
      "addChannel",
      "channelSlot",
      "velocitySensitive",
      "oscPort",
      "sequencerMode",
      "sequencerBpm",
    ];

    expectedKeys.forEach((key) => {
      expect(HELP_TEXT).toHaveProperty(key);
    });
  });

  it("should have non-empty string values for all keys", () => {
    Object.values(HELP_TEXT).forEach((value) => {
      expect(typeof value).toBe("string");
      expect(value.length).toBeGreaterThan(0);
    });
  });

  it("should have helpful descriptions for trackNote", () => {
    expect(HELP_TEXT.trackNote).toContain("MIDI");
    expect(HELP_TEXT.trackNote).toContain("OSC");
  });

  it("should have helpful descriptions for modules", () => {
    expect(HELP_TEXT.modules).toContain("modules");
    expect(HELP_TEXT.modules).toContain("Projector");
  });

  it("should have helpful descriptions for methods", () => {
    expect(HELP_TEXT.methods).toContain("method");
    expect(HELP_TEXT.methods).toContain("MIDI");
    expect(HELP_TEXT.methods).toContain("OSC");
  });

  it("should have all values defined", () => {
    Object.keys(HELP_TEXT).forEach((key) => {
      expect(HELP_TEXT[key as keyof typeof HELP_TEXT]).toBeDefined();
    });
  });

  it("should have consistent help text format", () => {
    Object.values(HELP_TEXT).forEach((value) => {
      expect(value).toMatch(/^[A-Z0-9]/);
      expect(value).not.toMatch(/\s$/);
    });
  });

  it("should contain relevant keywords for each section", () => {
    expect(HELP_TEXT.sequencerMode.toLowerCase()).toContain("sequencer");
    expect(HELP_TEXT.oscPort).toContain("8000");
    expect(HELP_TEXT.velocitySensitive).toContain("velocity");
  });
});
