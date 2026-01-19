export const HELP_TEXT: Record<string, string> = {
  trackNote:
    "The MIDI note or OSC address that activates this track. When triggered, the track becomes active and its modules load.",
  modules:
    "Modules that appear in the Projector window. Create your own in your project folder under modules/.",
  constructor:
    "Runs when a module is created/loaded. Use this for one-time setup (e.g., initial colors, text, sizes).",
  methods:
    "Actions a module can perform (e.g., change color, show, hide). Trigger methods via sequencer patterns or external MIDI/OSC.",
  executeOnLoadMethods:
    "Methods with executeOnLoad: true run automatically when the module loads. Use these for initial setup (colors, text, sizes).",
  aspectRatio:
    "Controls the dimensions of the Projector output. Choose based on your display (9:16 for vertical, landscape for projectors).",
  debugOverlay:
    "Shows real-time MIDI activity, method triggers, and system logs. Useful for troubleshooting MIDI routing.",
  autoRefresh:
    "When enabled, the projector automatically refreshes when you make changes in the dashboard (add modules, modify settings, etc.).",
  channelTrigger:
    "Channels trigger methods on active modules. In Sequencer mode, use the 16-step grid. In External mode, use MIDI notes or OSC addresses.",
  midiChannel:
    "This channel slot is what triggers these methods (1-16). The actual trigger mapping is configured in Settings → Configure Mappings.",
  emulateMidiPlayback:
    "Triggers current track's MIDI configuration from dashboard. For prototyping only, not designed for live sets.",
  editorMethods:
    "Triggerable methods here are from the static methods array in your file. Click the play icon to test methods with their current parameter values.",
  inputType:
    "Choose how the app receives triggers: MIDI (hardware/IAC Driver), OSC (network messages from TouchOSC, Max/MSP, etc.).",
  midiChannels:
    "MIDI message channels used for external triggers. Track Select chooses which MIDI channel activates tracks; Triggers chooses which MIDI channel fires channel slots on the active track.",
  midiNoteMatchMode:
    "Controls how nw_wrld matches MIDI notes to your mappings. Pitch Class: any octave of C..B triggers the same mapping. Exact Note: match full MIDI note numbers (0–127), enabling octave-specific triggers.",
  trackTrigger:
    "The identifier that activates this track. For MIDI: Pitch Class mode uses C..B or 0–11; Exact Note mode uses 0–127. For OSC: use /track/name pattern (e.g., /track/intro).",
  trackSlot:
    "Choose a track number. The actual trigger is defined in Settings → Configure Mappings. This allows you to quickly change all your MIDI/OSC mappings globally.",
  addChannel:
    "Add a channel to trigger methods on this track's modules. For MIDI: Pitch Class mode uses C..B; Exact Note mode uses 0–127. For OSC: use /ch/name or /channel/name pattern (e.g., /ch/bass).",
  channelSlot:
    "Choose a channel number (1-12). The actual trigger is defined in Settings → Configure Mappings. This allows consistent channel mapping across all tracks.",
  velocitySensitive:
    "When enabled, MIDI note velocity affects trigger intensity. When disabled, all triggers use maximum velocity (127).",
  oscPort:
    "UDP port for receiving OSC messages. Default: 8000. Configure your OSC sender to match this port. OSC naming: use /track/name for tracks, /ch/name for channels.",
  sequencerMode:
    "Choose your signal source. Sequencer (default): program patterns with a 16-step grid. External: connect MIDI/OSC hardware for live performance.",
  sequencerGrid:
    "Program 16-step patterns here. Each row is a channel; lit steps trigger the channel on that beat.",
  sequencerBpm: "Set the sequencer tempo in BPM. Controls playback speed when using the sequencer.",
};
