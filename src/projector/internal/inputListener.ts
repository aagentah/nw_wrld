import {
  buildMidiConfig,
  normalizeNoteMatchMode,
  noteNumberToTriggerKey,
  pitchClassToName,
} from "../../shared/midi/midiUtils";
import logger from "../helpers/logger";
import { getMessaging } from "./bridge";

type InputEventPayload = {
  type?: unknown;
  data?: unknown;
};

type InputData = Record<string, unknown>;

type InputListenerContext = {
  config: Record<string, unknown> | null;
  userData: unknown;
  activeTrack: { name?: unknown } | null;
  debugOverlayActive: boolean;
  queueDebugLog: (log: string) => unknown;
  handleTrackSelection: (trackName: unknown) => unknown;
  handleChannelMessage: (channelPath: string, debugContext?: Record<string, unknown>) => unknown;
};

export function initInputListener(this: InputListenerContext) {
  const messaging = getMessaging();
  if (!messaging || typeof messaging.onInputEvent !== "function") return;
  messaging.onInputEvent((event: unknown, payload: unknown) => {
    const p =
      payload && typeof payload === "object" ? (payload as InputEventPayload) : null;
    if (!p) return;

    const type = p.type;
    const data = (p.data && typeof p.data === "object" ? (p.data as InputData) : {}) as InputData;
    const debugEnabled = logger.debugEnabled;

    const config = this.config || {};
    const isSequencerMode = (config as { sequencerMode?: unknown }).sequencerMode === true;
    const selectedInputType =
      (config as { input?: unknown }).input &&
      typeof (config as { input?: unknown }).input === "object"
        ? String(((config as { input?: unknown }).input as { type?: unknown }).type || "midi")
        : "midi";
    const midiConfig = buildMidiConfig(this.userData, config, selectedInputType);
    if (isSequencerMode) {
      return;
    }
    if (data.source && data.source !== selectedInputType) {
      return;
    }

    if (debugEnabled) {
      logger.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      logger.log(`🎵 [INPUT] Event type: ${type}, source: ${data.source}`);
    }

    let trackName: unknown = null;
    const timestamp =
      (data as { timestamp?: unknown }).timestamp || performance.now() / 1000;
    const noteMatchMode = normalizeNoteMatchMode(
      (config as { input?: unknown }).input &&
        typeof (config as { input?: unknown }).input === "object"
        ? ((config as { input?: unknown }).input as { noteMatchMode?: unknown }).noteMatchMode
        : undefined
    );

    switch (type) {
      case "track-selection":
        if (debugEnabled) logger.log("🎯 [INPUT] Track selection event...");

        if (data.source === "midi") {
          const key = noteNumberToTriggerKey(
            (data as { note?: unknown }).note,
            noteMatchMode
          );
          const trackNameFromNote =
            key !== null ? (midiConfig.trackTriggersMap as Record<string, unknown>)[String(key)] : null;
          if (debugEnabled) {
            logger.log(`🎯 [INPUT] Note ${data.note} maps to track:`, trackNameFromNote);
          }

          if (trackNameFromNote) {
            if (debugEnabled) {
              logger.log(`✅ [INPUT] Activating track: "${trackNameFromNote}"`);
            }
            trackName = trackNameFromNote;
            this.handleTrackSelection(trackNameFromNote);
          } else {
            if (debugEnabled) {
              logger.warn(`⚠️ [INPUT] Note ${data.note} not mapped to any track`);
            }
          }
        } else if (data.source === "osc") {
          const trackNameFromIdentifier = (midiConfig.trackTriggersMap as Record<string, unknown>)[
            String((data as { identifier?: unknown }).identifier)
          ];
          if (debugEnabled) {
            logger.log(
              `🎯 [INPUT] OSC address ${data.identifier} maps to track:`,
              trackNameFromIdentifier
            );
          }

          if (trackNameFromIdentifier) {
            if (debugEnabled) {
              logger.log(`✅ [INPUT] Activating track: "${trackNameFromIdentifier}"`);
            }
            trackName = trackNameFromIdentifier;
            this.handleTrackSelection(trackNameFromIdentifier);
          } else {
            if (debugEnabled) {
              logger.warn(
                `⚠️ [INPUT] OSC address ${data.identifier} not mapped to any track`
              );
              logger.log(
                "📋 [INPUT] Available OSC mappings:",
                Object.keys(midiConfig.trackTriggersMap as Record<string, unknown>)
              );
            }
          }
        }
        break;

      case "method-trigger":
        if (debugEnabled) {
          logger.log("🎯 [INPUT] Method trigger event...");
          logger.log("🎯 [INPUT] Current active track:", this.activeTrack?.name);
        }

        let channelNames: unknown[] = [];
        const activeTrackName = this.activeTrack?.name;

        if (
          activeTrackName &&
          (midiConfig.channelMappings as Record<string, unknown>)[String(activeTrackName)]
        ) {
          const trackMappings = (midiConfig.channelMappings as Record<string, unknown>)[
            String(activeTrackName)
          ] as Record<string, unknown>;

          if (data.source === "midi") {
            const key = noteNumberToTriggerKey(
              (data as { note?: unknown }).note,
              noteMatchMode
            );
            const mappedChannels =
              key !== null ? trackMappings[String(key)] : null;
            if (mappedChannels) {
              channelNames = Array.isArray(mappedChannels)
                ? mappedChannels
                : [mappedChannels];
              if (debugEnabled) {
                logger.log(`🎯 [INPUT] Note ${data.note} maps to channels:`, channelNames);
              }
            }
          } else if (data.source === "osc") {
            const mappedChannels = trackMappings[String((data as { channelName?: unknown }).channelName)];
            if (mappedChannels) {
              channelNames = Array.isArray(mappedChannels)
                ? mappedChannels
                : [mappedChannels];
              if (debugEnabled) {
                logger.log(`🎯 [INPUT] OSC address maps to channels:`, channelNames);
              }
            }
          } else if (data.source === "audio") {
            const mappedChannels = trackMappings[String((data as { channelName?: unknown }).channelName)];
            if (mappedChannels) {
              channelNames = Array.isArray(mappedChannels)
                ? mappedChannels
                : [mappedChannels];
              if (debugEnabled) {
                logger.log(`🎯 [INPUT] AUDIO channel maps to channels:`, channelNames);
              }
            }
          } else if (data.source === "file") {
            const mappedChannels = trackMappings[String((data as { channelName?: unknown }).channelName)];
            if (mappedChannels) {
              channelNames = Array.isArray(mappedChannels)
                ? mappedChannels
                : [mappedChannels];
              if (debugEnabled) {
                logger.log(`🎯 [INPUT] FILE channel maps to channels:`, channelNames);
              }
            }
          }
        } else {
          if (debugEnabled) {
            logger.warn(`⚠️ [INPUT] No channel mappings for track "${activeTrackName}"`);
          }
        }

        if (channelNames.length > 0 && activeTrackName) {
          trackName = activeTrackName;
          channelNames.forEach((channelName) => {
            if (debugEnabled) {
              logger.log(
                `✅ [INPUT] Triggering ${channelName} on track "${activeTrackName}"`
              );
            }
            this.handleChannelMessage(`/Ableton/${channelName}`, {
              note: (data as { note?: unknown }).note,
              channel: (data as { channel?: unknown }).channel,
              velocity: (data as { velocity?: unknown }).velocity || 127,
              timestamp,
              trackName,
              source: data.source,
            });
          });
        } else if (channelNames.length === 0) {
          if (debugEnabled) {
            logger.warn(`⚠️ [INPUT] Event not mapped to any channel`);
          }
        } else if (!activeTrackName) {
          if (debugEnabled) {
            logger.warn(`⚠️ [INPUT] No active track - select a track first`);
          }
        }
        break;
    }

    if (this.debugOverlayActive && debugEnabled) {
      const timeStr = Number(timestamp).toFixed(5);
      const source =
        data.source === "midi"
          ? "MIDI"
          : data.source === "audio"
            ? "AUDIO"
            : data.source === "file"
              ? "FILE"
              : "OSC";
      let log = `[${timeStr}] ${source} Event\n`;
      if (data.source === "midi") {
        const key = noteNumberToTriggerKey(
          (data as { note?: unknown }).note,
          noteMatchMode
        );
        const pcName =
          noteMatchMode === "pitchClass" && key !== null ? pitchClassToName(key) : null;
        log += `  Note: ${(data as { note?: unknown }).note}${
          key !== null
            ? noteMatchMode === "pitchClass"
              ? ` (pitchClass: ${key} ${pcName || ""})`
              : ` (note: ${key})`
            : ""
        }\n`;
        log += `  Channel: ${(data as { channel?: unknown }).channel}\n`;
      } else if (data.source === "osc") {
        log += `  Address: ${(data as { address?: unknown }).address}\n`;
      } else if (data.source === "audio") {
        log += `  Channel: ${(data as { channelName?: unknown }).channelName}\n`;
      } else if (data.source === "file") {
        log += `  Channel: ${(data as { channelName?: unknown }).channelName}\n`;
      }
      if (trackName) {
        log += `  Track: ${trackName}\n`;
      }
      this.queueDebugLog(log);
    }

    if (debugEnabled) logger.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  });
}

