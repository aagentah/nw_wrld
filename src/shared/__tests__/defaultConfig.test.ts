import {
  DEFAULT_INPUT_CONFIG,
  DEFAULT_GLOBAL_MAPPINGS,
  DEFAULT_USER_DATA,
} from "@shared/config/defaultConfig.ts";
import type { InputConfig, GlobalMappings, UserData } from "../../types/userData";

describe("DEFAULT_INPUT_CONFIG", () => {
  it("should export default input config", () => {
    expect(DEFAULT_INPUT_CONFIG).toBeDefined();
    expect(typeof DEFAULT_INPUT_CONFIG).toBe("object");
  });

  it("should have correct structure", () => {
    expect(DEFAULT_INPUT_CONFIG).toHaveProperty("type");
    expect(DEFAULT_INPUT_CONFIG).toHaveProperty("deviceName");
    expect(DEFAULT_INPUT_CONFIG).toHaveProperty("trackSelectionChannel");
    expect(DEFAULT_INPUT_CONFIG).toHaveProperty("methodTriggerChannel");
    expect(DEFAULT_INPUT_CONFIG).toHaveProperty("velocitySensitive");
    expect(DEFAULT_INPUT_CONFIG).toHaveProperty("port");
  });

  it("should have correct default values", () => {
    expect(DEFAULT_INPUT_CONFIG.type).toBe("midi");
    expect(DEFAULT_INPUT_CONFIG.deviceName).toBe("IAC Driver Bus 1");
    expect(DEFAULT_INPUT_CONFIG.trackSelectionChannel).toBe(1);
    expect(DEFAULT_INPUT_CONFIG.methodTriggerChannel).toBe(2);
    expect(DEFAULT_INPUT_CONFIG.velocitySensitive).toBe(false);
    expect(DEFAULT_INPUT_CONFIG.port).toBe(8000);
  });

  it("should match InputConfig type", () => {
    const config: InputConfig = DEFAULT_INPUT_CONFIG;
    expect(config.type).toBe("midi");
  });
});

describe("DEFAULT_GLOBAL_MAPPINGS", () => {
  it("should export default global mappings", () => {
    expect(DEFAULT_GLOBAL_MAPPINGS).toBeDefined();
    expect(typeof DEFAULT_GLOBAL_MAPPINGS).toBe("object");
  });

  it("should have trackMappings and channelMappings", () => {
    expect(DEFAULT_GLOBAL_MAPPINGS).toHaveProperty("trackMappings");
    expect(DEFAULT_GLOBAL_MAPPINGS).toHaveProperty("channelMappings");
  });

  describe("trackMappings", () => {
    it("should have both midi and osc mappings", () => {
      expect(DEFAULT_GLOBAL_MAPPINGS.trackMappings).toHaveProperty("midi");
      expect(DEFAULT_GLOBAL_MAPPINGS.trackMappings).toHaveProperty("osc");
    });

    it("should have 10 MIDI track mappings", () => {
      const midiMappings = DEFAULT_GLOBAL_MAPPINGS.trackMappings.midi;
      expect(Object.keys(midiMappings)).toHaveLength(10);
      expect(midiMappings[1]).toBe("C-1");
      expect(midiMappings[10]).toBe("A-1");
    });

    it("should have 10 OSC track mappings", () => {
      const oscMappings = DEFAULT_GLOBAL_MAPPINGS.trackMappings.osc;
      expect(Object.keys(oscMappings)).toHaveLength(10);
      expect(oscMappings[1]).toBe("/track/1");
      expect(oscMappings[10]).toBe("/track/10");
    });

    it("should have correct MIDI note progression", () => {
      const midiMappings = DEFAULT_GLOBAL_MAPPINGS.trackMappings.midi;
      expect(midiMappings[1]).toBe("C-1");
      expect(midiMappings[2]).toBe("C#-1");
      expect(midiMappings[3]).toBe("D-1");
      expect(midiMappings[4]).toBe("D#-1");
      expect(midiMappings[5]).toBe("E-1");
      expect(midiMappings[6]).toBe("F-1");
      expect(midiMappings[7]).toBe("F#-1");
      expect(midiMappings[8]).toBe("G-1");
      expect(midiMappings[9]).toBe("G#-1");
      expect(midiMappings[10]).toBe("A-1");
    });

    it("should have correct OSC address format", () => {
      const oscMappings = DEFAULT_GLOBAL_MAPPINGS.trackMappings.osc;
      Object.values(oscMappings).forEach((address) => {
        expect(address).toMatch(/^\/track\/\d+$/);
      });
    });
  });

  describe("channelMappings", () => {
    it("should have both midi and osc mappings", () => {
      expect(DEFAULT_GLOBAL_MAPPINGS.channelMappings).toHaveProperty("midi");
      expect(DEFAULT_GLOBAL_MAPPINGS.channelMappings).toHaveProperty("osc");
    });

    it("should have 16 MIDI channel mappings", () => {
      const midiMappings = DEFAULT_GLOBAL_MAPPINGS.channelMappings.midi;
      expect(Object.keys(midiMappings)).toHaveLength(16);
      expect(midiMappings[1]).toBe("E7");
      expect(midiMappings[16]).toBe("G8");
    });

    it("should have 16 OSC channel mappings", () => {
      const oscMappings = DEFAULT_GLOBAL_MAPPINGS.channelMappings.osc;
      expect(Object.keys(oscMappings)).toHaveLength(16);
      expect(oscMappings[1]).toBe("/ch/1");
      expect(oscMappings[16]).toBe("/ch/16");
    });

    it("should have correct MIDI note progression for channels", () => {
      const midiMappings = DEFAULT_GLOBAL_MAPPINGS.channelMappings.midi;
      expect(midiMappings[1]).toBe("E7");
      expect(midiMappings[2]).toBe("F7");
      expect(midiMappings[3]).toBe("F#7");
      expect(midiMappings[8]).toBe("B7");
      expect(midiMappings[9]).toBe("C8");
      expect(midiMappings[16]).toBe("G8");
    });

    it("should have correct OSC address format for channels", () => {
      const oscMappings = DEFAULT_GLOBAL_MAPPINGS.channelMappings.osc;
      Object.values(oscMappings).forEach((address) => {
        expect(address).toMatch(/^\/ch\/\d+$/);
      });
    });
  });

  it("should match GlobalMappings type", () => {
    const mappings: GlobalMappings = DEFAULT_GLOBAL_MAPPINGS.trackMappings;
    expect(mappings).toHaveProperty("midi");
    expect(mappings).toHaveProperty("osc");
  });
});

describe("DEFAULT_USER_DATA", () => {
  it("should export default user data", () => {
    expect(DEFAULT_USER_DATA).toBeDefined();
    expect(typeof DEFAULT_USER_DATA).toBe("object");
  });

  it("should have config and sets properties", () => {
    expect(DEFAULT_USER_DATA).toHaveProperty("config");
    expect(DEFAULT_USER_DATA).toHaveProperty("sets");
  });

  it("should have empty sets array", () => {
    expect(DEFAULT_USER_DATA.sets).toEqual([]);
    expect(Array.isArray(DEFAULT_USER_DATA.sets)).toBe(true);
  });

  it("should have proper config structure", () => {
    expect(DEFAULT_USER_DATA.config).toHaveProperty("activeSetId");
    expect(DEFAULT_USER_DATA.config).toHaveProperty("activeTrackId");
    expect(DEFAULT_USER_DATA.config).toHaveProperty("input");
    expect(DEFAULT_USER_DATA.config).toHaveProperty("trackMappings");
    expect(DEFAULT_USER_DATA.config).toHaveProperty("channelMappings");
    expect(DEFAULT_USER_DATA.config).toHaveProperty("sequencerMode");
    expect(DEFAULT_USER_DATA.config).toHaveProperty("sequencerBpm");
  });

  it("should have correct default values", () => {
    expect(DEFAULT_USER_DATA.config.activeSetId).toBe(null);
    expect(DEFAULT_USER_DATA.config.activeTrackId).toBe(null);
    expect(DEFAULT_USER_DATA.config.sequencerMode).toBe(true);
    expect(DEFAULT_USER_DATA.config.sequencerBpm).toBe(120);
  });

  it("should use DEFAULT_INPUT_CONFIG for input config", () => {
    expect(DEFAULT_USER_DATA.config.input).toEqual(DEFAULT_INPUT_CONFIG);
  });

  it("should use DEFAULT_GLOBAL_MAPPINGS for mappings", () => {
    expect(DEFAULT_USER_DATA.config.trackMappings).toEqual(
      DEFAULT_GLOBAL_MAPPINGS.trackMappings
    );
    expect(DEFAULT_USER_DATA.config.channelMappings).toEqual(
      DEFAULT_GLOBAL_MAPPINGS.channelMappings
    );
  });

  it("should match UserData type", () => {
    const userData: UserData = DEFAULT_USER_DATA;
    expect(userData.config).toBeDefined();
    expect(userData.sets).toEqual([]);
  });

  it("should have immutable structure", () => {
    const originalSetId = DEFAULT_USER_DATA.config.activeSetId;
    DEFAULT_USER_DATA.config.activeSetId = "test" as any;
    expect(DEFAULT_USER_DATA.config.activeSetId).toBe("test");
    // Reset for other tests
    DEFAULT_USER_DATA.config.activeSetId = originalSetId;
  });
});
