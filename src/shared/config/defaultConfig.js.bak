const DEFAULT_INPUT_CONFIG = {
  type: "midi",
  deviceName: "IAC Driver Bus 1",
  trackSelectionChannel: 1,
  methodTriggerChannel: 2,
  velocitySensitive: false,
  port: 8000,
};

const DEFAULT_GLOBAL_MAPPINGS = {
  trackMappings: {
    midi: {
      1: "C-1",
      2: "C#-1",
      3: "D-1",
      4: "D#-1",
      5: "E-1",
      6: "F-1",
      7: "F#-1",
      8: "G-1",
      9: "G#-1",
      10: "A-1",
    },
    osc: {
      1: "/track/1",
      2: "/track/2",
      3: "/track/3",
      4: "/track/4",
      5: "/track/5",
      6: "/track/6",
      7: "/track/7",
      8: "/track/8",
      9: "/track/9",
      10: "/track/10",
    },
  },
  channelMappings: {
    midi: {
      1: "E7",
      2: "F7",
      3: "F#7",
      4: "G7",
      5: "G#7",
      6: "A7",
      7: "A#7",
      8: "B7",
      9: "C8",
      10: "C#8",
      11: "D8",
      12: "D#8",
      13: "E8",
      14: "F8",
      15: "F#8",
      16: "G8",
    },
    osc: {
      1: "/ch/1",
      2: "/ch/2",
      3: "/ch/3",
      4: "/ch/4",
      5: "/ch/5",
      6: "/ch/6",
      7: "/ch/7",
      8: "/ch/8",
      9: "/ch/9",
      10: "/ch/10",
      11: "/ch/11",
      12: "/ch/12",
      13: "/ch/13",
      14: "/ch/14",
      15: "/ch/15",
      16: "/ch/16",
    },
  },
};

const DEFAULT_USER_DATA = {
  config: {
    activeSetId: null,
    activeTrackId: null,
    input: DEFAULT_INPUT_CONFIG,
    trackMappings: DEFAULT_GLOBAL_MAPPINGS.trackMappings,
    channelMappings: DEFAULT_GLOBAL_MAPPINGS.channelMappings,
    sequencerMode: true,
    sequencerBpm: 120,
  },
  sets: [],
};

module.exports = {
  DEFAULT_INPUT_CONFIG,
  DEFAULT_GLOBAL_MAPPINGS,
  DEFAULT_USER_DATA,
};
