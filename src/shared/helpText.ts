export const HELP_TEXT: Record<string, string> = {
  modules:
    "Modules that appear in the Projector window. Create your own in your project folder under modules/.",
  constructor:
    "Runs when a module is created/loaded. Use this for one-time setup (e.g., initial colors, text, sizes).",
  methods:
    "Actions a module can perform (e.g., change color, show, hide). Trigger methods via sequencer patterns or external MIDI/OSC.",
  aspectRatio:
    "Controls the dimensions of the Projector output. Choose based on your display (9:16 for vertical, landscape for projectors).",
  debugOverlay:
    "Shows real-time MIDI activity, method triggers, and system logs. Useful for troubleshooting MIDI routing.",
  midiChannel:
    "This channel slot is what triggers these methods (1-16). The actual trigger mapping is configured in Settings → Configure Mappings.",
  editorMethods:
    "Triggerable methods here are from the static methods array in your file. Click the play icon to test methods with their current parameter values.",
  midiChannels:
    "MIDI message channels used for external triggers. Track Select chooses which MIDI channel activates tracks; Triggers chooses which MIDI channel fires channel slots on the active track.",
  midiNoteMatchMode:
    "Controls how nw_wrld matches MIDI notes to your mappings. Pitch Class: any octave of C..B triggers the same mapping. Exact Note: match full MIDI note numbers (0–127), enabling octave-specific triggers.",
  trackSlot:
    "Choose a track number. The actual trigger is defined in Settings → Configure Mappings. This allows you to quickly change all your MIDI/OSC mappings globally.",
  channelSlot:
    "Choose a channel number (1-12). The actual trigger is defined in Settings → Configure Mappings. This allows consistent channel mapping across all tracks.",
  oscPort:
    "UDP port for receiving OSC messages. Default: 8000. Configure your OSC sender to match this port. OSC naming: use /track/name for tracks, /ch/name for channels.",
  sequencerMode:
    "Choose your signal source. Sequencer (default): program patterns with a 16-step grid. External: connect MIDI/OSC hardware for live performance.",
  sequencerBpm: "Set the sequencer tempo in BPM. Controls playback speed when using the sequencer.",
};
