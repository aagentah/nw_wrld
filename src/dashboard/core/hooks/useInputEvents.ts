import {
  useCallback,
  useEffect,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import { getRecordingForTrack, setRecordingForTrack } from "../../../shared/json/recordingUtils";
import {
  buildMidiConfig,
  normalizeNoteMatchMode,
  noteNumberToTriggerKey,
  parseMidiTriggerValue,
  pitchClassToName,
  resolveChannelTrigger,
} from "../../../shared/midi/midiUtils";
import { getActiveSetTracks } from "../../../shared/utils/setUtils";
import { useIPCListener } from "./useIPC";

type TriggerMaps = ReturnType<typeof buildMidiConfig>;

type RecordingStateEntry = { startTime: number; isRecording: boolean };
type RecordingState = Record<string, RecordingStateEntry | undefined>;

type UseInputEventsArgs = {
  userData: unknown;
  activeSetId: unknown;
  userDataRef: MutableRefObject<unknown>;
  activeTrackIdRef: MutableRefObject<string | null>;
  activeSetIdRef: MutableRefObject<unknown>;
  recordingStateRef: MutableRefObject<RecordingState>;
  triggerMapsRef: MutableRefObject<TriggerMaps>;
  setActiveTrackId: (trackId: string) => void;
  setRecordingData: Dispatch<SetStateAction<Record<string, unknown>>>;
  setRecordingState: Dispatch<SetStateAction<RecordingState>>;
  flashChannel: (channel: string, durationMs: number) => void;
  setFlashingConstructors: Dispatch<SetStateAction<Set<string>>>;
  setInputStatus: (data: unknown) => void;
  setDebugLogs: Dispatch<SetStateAction<string[]>>;
  sendToProjector: (type: string, props: Record<string, unknown>) => void;
  isDebugOverlayOpen: boolean;
  setIsProjectorReady: (ready: boolean) => void;
};

export const useInputEvents = ({
  userData,
  activeSetId,
  userDataRef,
  activeTrackIdRef,
  activeSetIdRef,
  recordingStateRef,
  triggerMapsRef,
  setActiveTrackId,
  setRecordingData,
  setRecordingState,
  flashChannel,
  setFlashingConstructors,
  setInputStatus,
  setDebugLogs,
  sendToProjector,
  isDebugOverlayOpen,
  setIsProjectorReady,
}: UseInputEventsArgs) => {
  useEffect(() => {
    const tracks = getActiveSetTracks(userData, activeSetId);
    const globalMappings =
      userData && typeof userData === "object"
        ? (userData as Record<string, unknown>).config || {}
        : {};
    const gm =
      globalMappings && typeof globalMappings === "object"
        ? (globalMappings as Record<string, unknown>)
        : {};
    const inputRaw = gm.input;
    const inputObj =
      inputRaw && typeof inputRaw === "object" ? (inputRaw as Record<string, unknown>) : null;
    const inputType =
      (inputObj && typeof inputObj.type === "string" ? inputObj.type : null) || "midi";
    triggerMapsRef.current = buildMidiConfig(tracks, globalMappings, inputType);
  }, [
    (userData as { sets?: unknown })?.sets,
    (userData as { config?: { input?: unknown } })?.config?.input,
    (userData as { config?: { trackMappings?: unknown } })?.config?.trackMappings,
    (userData as { config?: { channelMappings?: unknown } })?.config?.channelMappings,
    activeSetId,
  ]);

  useIPCListener("input-status", (_event, statusPayload) => {
    const sp =
      statusPayload && typeof statusPayload === "object"
        ? (statusPayload as Record<string, unknown>)
        : null;
    setInputStatus(sp?.data);
  });

  useIPCListener("from-projector", (_event, data) => {
    const d = data && typeof data === "object" ? (data as Record<string, unknown>) : null;
    const t = typeof d?.type === "string" ? d.type : null;
    if (t === "debug-log") {
      const rawLog =
        typeof d?.log === "string"
          ? d.log
          : d?.props && typeof d.props === "object"
            ? typeof (d.props as Record<string, unknown>).log === "string"
              ? ((d.props as Record<string, unknown>).log as string)
              : ""
            : "";
      const logEntries = rawLog.split("\n\n").filter((entry) => entry.trim());
      setDebugLogs((prev) => {
        const newLogs = [...prev, ...logEntries];
        return newLogs.slice(-200);
      });
    }
  });

  useEffect(() => {
    sendToProjector("debug-overlay-visibility", {
      isOpen: isDebugOverlayOpen,
    });
  }, [isDebugOverlayOpen, sendToProjector]);

  const addDebugLog = useCallback((log: string) => {
    setDebugLogs((prev) => {
      const newLogs = [...prev, log];
      return newLogs.slice(-200);
    });
  }, []);

  const formatDebugLog = useCallback((eventData: Record<string, unknown>) => {
    const timestampRaw = eventData.timestamp;
    const timestamp =
      typeof timestampRaw === "number" && Number.isFinite(timestampRaw) ? timestampRaw : 0;
    const type = typeof eventData.type === "string" ? eventData.type : "";
    const source = typeof eventData.source === "string" ? eventData.source : "";
    const data =
      eventData.data && typeof eventData.data === "object"
        ? (eventData.data as Record<string, unknown>)
        : {};
    const trackName = typeof eventData.trackName === "string" ? eventData.trackName : null;
    const moduleInfo =
      eventData.moduleInfo && typeof eventData.moduleInfo === "object"
        ? (eventData.moduleInfo as Record<string, unknown>)
        : null;
    const methodInfo =
      eventData.methodInfo && typeof eventData.methodInfo === "object"
        ? (eventData.methodInfo as Record<string, unknown>)
        : null;
    const props =
      eventData.props && typeof eventData.props === "object"
        ? (eventData.props as Record<string, unknown>)
        : null;

    const timeStr = timestamp.toFixed(5);
    const sourceLabel =
      source === "midi"
        ? "MIDI"
        : source === "osc"
          ? "OSC"
          : source === "audio"
            ? "AUDIO"
            : source === "file"
              ? "FILE"
              : "Input";
    const eventTypeLabel = type === "track-selection" ? "Track Selection" : "Method Trigger";

    let log = `[${timeStr}] ${sourceLabel} ${eventTypeLabel}\n`;

    if (source === "midi") {
      const noteMatchMode = normalizeNoteMatchMode(
        (userDataRef.current as { config?: { input?: { noteMatchMode?: unknown } } })?.config?.input
          ?.noteMatchMode
      );
      const key = noteNumberToTriggerKey(data.note, noteMatchMode);
      const pcName = noteMatchMode === "pitchClass" && key !== null ? pitchClassToName(key) : null;
      if (type === "track-selection") {
        log += `  Note: ${String(data.note)}${
          key !== null
            ? noteMatchMode === "pitchClass"
              ? ` (pitchClass: ${key} ${pcName || ""})`
              : ` (note: ${key})`
            : ""
        }\n`;
        log += `  Channel: ${String(data.channel || 1)}\n`;
      } else {
        log += `  Note: ${String(data.note)}${
          key !== null
            ? noteMatchMode === "pitchClass"
              ? ` (pitchClass: ${key} ${pcName || ""})`
              : ` (note: ${key})`
            : ""
        }\n`;
        log += `  Channel: ${String(data.channel)}\n`;
      }
    } else if (source === "osc" || source === "audio" || source === "file") {
      const address = typeof data.address === "string" ? (data.address as string) : null;
      const identifier = typeof data.identifier === "string" ? (data.identifier as string) : null;
      const channelName =
        typeof data.channelName === "string" ? (data.channelName as string) : null;
      const value = data.value;
      if (address && source === "osc") {
        log += `  Address: ${address}\n`;
      }
      if (identifier && source === "osc") {
        log += `  Identifier: ${identifier}\n`;
      }
      if (channelName) {
        log += `  Channel: ${channelName}\n`;
      }
      if (value !== undefined) {
        log += `  Value: ${String(value)}\n`;
      }
    }

    if (trackName) {
      log += `  Track: ${trackName}\n`;
    }
    if (moduleInfo) {
      const instanceId = typeof moduleInfo.instanceId === "string" ? moduleInfo.instanceId : "";
      const typeLabel = typeof moduleInfo.type === "string" ? moduleInfo.type : "";
      log += `  Module: ${instanceId} (${typeLabel})\n`;
    }
    if (methodInfo) {
      const name = typeof methodInfo.name === "string" ? methodInfo.name : "";
      log += `  Method: ${name}\n`;
    }
    if (props && Object.keys(props).length > 0) {
      log += `  Props: ${JSON.stringify(props, null, 2)}\n`;
    }
    return log;
  }, []);

  const handleInputEvent = useCallback(
    (_event: unknown, payload: unknown) => {
      if (!payload || typeof payload !== "object") return;
      const p = payload as Record<string, unknown>;
      const type = p.type;
      const dataRaw = p.data;
      if (type !== "track-selection" && type !== "method-trigger") return;
      if (!dataRaw || typeof dataRaw !== "object") return;
      const data = dataRaw as Record<string, unknown>;

      const timestamp =
        typeof data.timestamp === "number" && Number.isFinite(data.timestamp)
          ? data.timestamp
          : performance.now() / 1000;

      const activeConfig =
        userDataRef.current && typeof userDataRef.current === "object"
          ? ((userDataRef.current as Record<string, unknown>).config as
              | Record<string, unknown>
              | undefined) || {}
          : {};
      const isSequencerMode = activeConfig?.sequencerMode === true;
      const inputCfgRaw = activeConfig?.input;
      const inputCfg =
        inputCfgRaw && typeof inputCfgRaw === "object"
          ? (inputCfgRaw as Record<string, unknown>)
          : null;
      const selectedInputType =
        (inputCfg && typeof inputCfg.type === "string" ? inputCfg.type : null) || "midi";
      if (isSequencerMode) {
        return;
      }
      const source = typeof data.source === "string" ? data.source : null;
      if (source && source !== selectedInputType) {
        return;
      }

      const tracks = getActiveSetTracks(userDataRef.current || {}, activeSetIdRef.current);
      const noteMatchMode = normalizeNoteMatchMode(inputCfg?.noteMatchMode);
      let trackName: string | null = null;
      const moduleInfo: Record<string, unknown> | null = null;
      const methodInfo: Record<string, unknown> | null = null;
      const props: Record<string, unknown> | null = null;

      switch (type) {
        case "track-selection": {
          let resolvedTrackName: string | null = null;

          if (source === "midi") {
            const key = noteNumberToTriggerKey(data.note, noteMatchMode);
            const mapped = key !== null ? triggerMapsRef.current.trackTriggersMap[key] : null;
            resolvedTrackName = typeof mapped === "string" ? mapped : null;
          } else if (source === "osc") {
            const identifier =
              typeof data.identifier === "string" ? (data.identifier as string) : null;
            const mapped = identifier ? triggerMapsRef.current.trackTriggersMap[identifier] : null;
            resolvedTrackName = typeof mapped === "string" ? mapped : null;
          }

          if (resolvedTrackName) {
            const targetTrack = (tracks as unknown[]).find((t) => {
              const tr = t && typeof t === "object" ? (t as Record<string, unknown>) : null;
              return tr ? tr.name === resolvedTrackName : false;
            }) as Record<string, unknown> | undefined;
            if (targetTrack) {
              const id = typeof targetTrack.id === "string" ? targetTrack.id : null;
              const name = typeof targetTrack.name === "string" ? targetTrack.name : null;
              if (id && name) {
                trackName = name;
                setActiveTrackId(id);

                const wasRecording = recordingStateRef.current[id];
                if (wasRecording) {
                  setRecordingData((prev) => {
                    const existing = getRecordingForTrack(prev, id);
                    return setRecordingForTrack(prev, id, {
                      ...(existing as Record<string, unknown>),
                      channels: [],
                    });
                  });
                }

                setRecordingState((prev) => ({
                  ...prev,
                  [id]: {
                    startTime: Date.now(),
                    isRecording: true,
                  },
                }));

                const modules = targetTrack.modules;
                if (Array.isArray(modules)) {
                  const keys = modules
                    .map((moduleInstance) => {
                      const mi =
                        moduleInstance && typeof moduleInstance === "object"
                          ? (moduleInstance as Record<string, unknown>)
                          : null;
                      const mid = mi && typeof mi.id === "string" ? mi.id : null;
                      return mid ? `${id}:${mid}` : null;
                    })
                    .filter((k): k is string => Boolean(k));
                  setFlashingConstructors((prev) => {
                    const next = new Set(prev);
                    keys.forEach((k) => next.add(k));
                    return next;
                  });
                  setTimeout(() => {
                    setFlashingConstructors((prev) => {
                      const next = new Set(prev);
                      keys.forEach((k) => next.delete(k));
                      return next;
                    });
                  }, 100);
                }
              }
            }
          }
          break;
        }

        case "method-trigger": {
          const currentActiveTrackId = activeTrackIdRef.current;
          const activeTrack = (tracks as unknown[]).find((t) => {
            const tr = t && typeof t === "object" ? (t as Record<string, unknown>) : null;
            return tr ? tr.id === currentActiveTrackId : false;
          }) as Record<string, unknown> | undefined;

          if (activeTrack && activeTrack.channelMappings) {
            const channelsToFlash: string[] = [];
            const globalMappings = userDataRef.current
              ? ((userDataRef.current as Record<string, unknown>).config as
                  | Record<string, unknown>
                  | undefined) || {}
              : {};
            const gmInputRaw = globalMappings.input;
            const gmInput =
              gmInputRaw && typeof gmInputRaw === "object"
                ? (gmInputRaw as Record<string, unknown>)
                : null;
            const currentInputType =
              (gmInput && typeof gmInput.type === "string" ? gmInput.type : null) || "midi";

            if (source === "midi") {
              const triggerKey = noteNumberToTriggerKey(data.note, noteMatchMode);
              if (triggerKey === null) break;
              Object.entries(activeTrack.channelMappings as Record<string, unknown>).forEach(
                ([channelNumber, slotNumber]) => {
                  const resolvedTrigger = resolveChannelTrigger(
                    slotNumber,
                    currentInputType,
                    globalMappings
                  );
                  const resolvedKey = parseMidiTriggerValue(resolvedTrigger, noteMatchMode);
                  if (resolvedKey === triggerKey) {
                    channelsToFlash.push(channelNumber);
                  }
                }
              );
            } else if (source === "osc") {
              const channelName =
                typeof data.channelName === "string" ? (data.channelName as string) : null;
              if (channelName) {
                Object.entries(activeTrack.channelMappings as Record<string, unknown>).forEach(
                  ([channelNumber, slotNumber]) => {
                    const resolvedTrigger = resolveChannelTrigger(
                      slotNumber,
                      currentInputType,
                      globalMappings
                    );
                    if (resolvedTrigger === channelName) {
                      channelsToFlash.push(channelNumber);
                    }
                  }
                );
              }
            } else if (source === "audio") {
              const channelName =
                typeof data.channelName === "string" ? (data.channelName as string) : null;
              if (channelName) {
                Object.entries(activeTrack.channelMappings as Record<string, unknown>).forEach(
                  ([channelNumber, slotNumber]) => {
                    const resolvedTrigger = resolveChannelTrigger(
                      slotNumber,
                      currentInputType,
                      globalMappings
                    );
                    if (resolvedTrigger === channelName) {
                      channelsToFlash.push(channelNumber);
                    }
                  }
                );
              }
            } else if (source === "file") {
              const channelName =
                typeof data.channelName === "string" ? (data.channelName as string) : null;
              if (channelName) {
                Object.entries(activeTrack.channelMappings as Record<string, unknown>).forEach(
                  ([channelNumber, slotNumber]) => {
                    const resolvedTrigger = resolveChannelTrigger(
                      slotNumber,
                      currentInputType,
                      globalMappings
                    );
                    if (resolvedTrigger === channelName) {
                      channelsToFlash.push(channelNumber);
                    }
                  }
                );
              }
            }

            channelsToFlash.forEach((channel) => {
              flashChannel(channel, 100);
            });

            if (currentActiveTrackId && channelsToFlash.length > 0) {
              const recordingStateForTrack = recordingStateRef.current[currentActiveTrackId];
              if (recordingStateForTrack?.isRecording) {
                const currentTime = Date.now();
                const relativeTime = (currentTime - recordingStateForTrack.startTime) / 1000;

                channelsToFlash.forEach((channelNumber) => {
                  const channelName = `ch${channelNumber}`;
                  setRecordingData((prev) => {
                    const recording = getRecordingForTrack(prev, currentActiveTrackId);
                    const newRecording = { ...(recording as Record<string, unknown>) };

                    const channels = Array.isArray(newRecording.channels)
                      ? (newRecording.channels as unknown[])
                      : [];

                    const channelIndex = channels.findIndex((ch) => {
                      const c =
                        ch && typeof ch === "object" ? (ch as Record<string, unknown>) : null;
                      return c ? c.name === channelName : false;
                    });

                    if (channelIndex === -1) {
                      channels.push({
                        name: channelName,
                        sequences: [{ time: relativeTime, duration: 0.1 }],
                      });
                    } else {
                      const entry = channels[channelIndex] as Record<string, unknown>;
                      const sequences = Array.isArray(entry.sequences)
                        ? (entry.sequences as unknown[])
                        : [];
                      sequences.push({ time: relativeTime, duration: 0.1 });
                      channels[channelIndex] = { ...entry, sequences };
                    }

                    newRecording.channels = channels;

                    return setRecordingForTrack(prev, currentActiveTrackId, newRecording);
                  });
                });
              }
            }
          }
          break;
        }
      }

      const log = formatDebugLog({
        timestamp,
        type: String(type),
        source: source || "",
        data,
        trackName,
        moduleInfo,
        methodInfo,
        props,
      });
      addDebugLog(log);
    },
    [
      flashChannel,
      formatDebugLog,
      addDebugLog,
      setActiveTrackId,
      setRecordingData,
      setRecordingState,
      setFlashingConstructors,
    ]
  );

  useIPCListener("input-event", handleInputEvent);

  useIPCListener("from-projector", (_event, data) => {
    const d = data && typeof data === "object" ? (data as Record<string, unknown>) : null;
    const t = typeof d?.type === "string" ? d.type : null;
    if (t === "projector-ready") {
      setIsProjectorReady(true);
    }
  });
};
