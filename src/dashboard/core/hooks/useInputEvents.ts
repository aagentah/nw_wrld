import { useCallback, useEffect } from "react";
import type {
  UserData,
  SetId,
  TrackId,
  InputType,
  InputConfig,
  DashboardToProjectorMessageMap,
  InputEventPayload,
} from "../../../types";
import { getRecordingForTrack, setRecordingForTrack } from "../../../shared/json/recordingUtils";
import {
  noteNameToNumber,
  resolveChannelTrigger,
  buildMidiConfig,
} from "../../../shared/midi/midiUtils";
import { getActiveSetTracks } from "../../../shared/utils/setUtils";
import { useIPCListener } from "./useIPC";

export interface RecordingState {
  startTime: number;
  isRecording: boolean;
}

export interface UseInputEventsParams {
  userData: UserData;
  activeSetId: SetId | null;
  userDataRef: React.MutableRefObject<UserData>;
  activeTrackIdRef: React.MutableRefObject<TrackId>;
  activeSetIdRef: React.MutableRefObject<SetId | null>;
  recordingStateRef: React.MutableRefObject<Record<TrackId, RecordingState>>;
  triggerMapsRef: React.MutableRefObject<{
    trackTriggersMap: Record<number | string, string>;
    channelTriggersMap: Record<string, unknown>;
  }>;
  setActiveTrackId: (id: TrackId) => void;
  setRecordingData: React.Dispatch<React.SetStateAction<Record<TrackId, unknown>>>;
  setRecordingState: React.Dispatch<React.SetStateAction<Record<TrackId, RecordingState>>>;
  flashChannel: (channel: string, duration?: number) => void;
  setFlashingConstructors: React.Dispatch<React.SetStateAction<Set<string>>>;
  setInputStatus: (status: unknown) => void;
  setDebugLogs: React.Dispatch<React.SetStateAction<string[]>>;
  sendToProjector: <K extends keyof DashboardToProjectorMessageMap>(
    type: K,
    props: DashboardToProjectorMessageMap[K]
  ) => void;
  isDebugOverlayOpen: boolean;
  setIsProjectorReady: (ready: boolean) => void;
}

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
}: UseInputEventsParams): void => {
  useEffect(() => {
    const tracks = getActiveSetTracks(userData, activeSetId);
    const globalMappings = userData?.config;
    const inputType = globalMappings?.input?.type || "midi";
    triggerMapsRef.current = buildMidiConfig(tracks, globalMappings, inputType);
  }, [userData?.sets, userData?.config?.input, activeSetId]);

  useIPCListener("input-status", (event, statusPayload) => {
    setInputStatus((statusPayload as { data?: unknown })?.data);
  });

  useIPCListener("from-projector", (event, data) => {
    const projectorData = data as { type?: string; log?: string; props?: { log?: string } };
    if (projectorData.type === "debug-log") {
      const rawLog =
        typeof projectorData.log === "string"
          ? projectorData.log
          : typeof projectorData.props?.log === "string"
          ? projectorData.props.log
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

  const formatDebugLog = useCallback((eventData: {
    timestamp: number;
    type: string;
    source: string;
    data: unknown;
    trackName?: string;
    moduleInfo?: unknown;
    methodInfo?: unknown;
    props?: unknown;
  }) => {
    const {
      timestamp,
      type,
      source,
      data,
      trackName,
      moduleInfo,
      methodInfo,
      props,
    } = eventData;
    const timeStr = timestamp.toFixed(5);
    const sourceLabel =
      source === "midi" ? "MIDI" : source === "osc" ? "OSC" : "Input";
    const eventTypeLabel =
      type === "track-selection" ? "Track Selection" : "Channel Trigger";

    let log = `[${timeStr}] ${sourceLabel} ${eventTypeLabel}\n`;

    if (source === "midi") {
      const midiData = data as { note?: number; channel?: number };
      if (type === "track-selection") {
        log += `  Note: ${midiData.note}\n`;
        log += `  Channel: ${midiData.channel || 1}\n`;
      } else {
        log += `  Note: ${midiData.note}\n`;
        log += `  Channel: ${midiData.channel}\n`;
      }
    } else if (source === "osc") {
      const oscData = data as {
        address?: string;
        identifier?: string;
        channelName?: string;
        value?: unknown;
      };
      if (oscData.address) {
        log += `  Address: ${oscData.address}\n`;
      }
      if (oscData.identifier) {
        log += `  Identifier: ${oscData.identifier}\n`;
      }
      if (oscData.channelName) {
        log += `  Channel: ${oscData.channelName}\n`;
      }
      if (oscData.value !== undefined) {
        log += `  Value: ${String(oscData.value)}\n`;
      }
    }

    if (trackName) {
      log += `  Track: ${trackName}\n`;
    }
    if (moduleInfo) {
      const info = moduleInfo as { instanceId?: string; type?: string };
      log += `  Module: ${info.instanceId} (${info.type})\n`;
    }
    if (methodInfo) {
      const info = methodInfo as { name?: string };
      log += `  Method: ${info.name}\n`;
    }
    if (props && typeof props === "object" && Object.keys(props).length > 0) {
      log += `  Props: ${JSON.stringify(props, null, 2)}\n`;
    }
    return log;
  }, []);

  const handleInputEvent = useCallback(
    (event: unknown, payload: InputEventPayload) => {
      const { type, data } = payload;
      const inputData = data as { timestamp?: number; source?: string };
      const timestamp = inputData.timestamp || performance.now() / 1000;

      const tracks = getActiveSetTracks(
        userDataRef.current || null,
        activeSetIdRef.current
      );
      let trackName: string | null = null;
      let moduleInfo = null;
      let methodInfo = null;
      let props = null;

      switch (type) {
        case "track-selection": {
          let resolvedTrackName = null;

          if (inputData.source === "midi") {
            const midiData = data as { note?: number };
            resolvedTrackName =
              triggerMapsRef.current.trackTriggersMap[String(midiData.note)];
          } else if (inputData.source === "osc") {
            const oscData = data as { identifier?: string };
            resolvedTrackName =
              triggerMapsRef.current.trackTriggersMap[oscData.identifier || ""];
          }

          if (resolvedTrackName) {
            const targetTrack = tracks.find(
              (t) => t.name === resolvedTrackName
            );
            if (targetTrack) {
              trackName = targetTrack.name;
              setActiveTrackId(targetTrack.id);

              const wasRecording = recordingStateRef.current[targetTrack.id];
              if (wasRecording) {
                setRecordingData((prev) =>
                  setRecordingForTrack(prev as Record<string, any>, String(targetTrack.id), { channels: [] })
                );
              }

              setRecordingState((prev) => ({
                ...prev,
                [targetTrack.id]: {
                  startTime: Date.now(),
                  isRecording: true,
                },
              }));

              if (Array.isArray(targetTrack.modules)) {
                const keys = targetTrack.modules.map(
                  (moduleInstance) => `${targetTrack.id}:${moduleInstance.id}`
                );
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
          break;
        }

        case "method-trigger":
          const currentActiveTrackId = activeTrackIdRef.current;
          const activeTrack = tracks.find((t) => t.id === currentActiveTrackId);

          if (activeTrack && activeTrack.channelMappings) {
            let channelsToFlash: number[] = [];
            const globalMappings = userDataRef.current?.config || { input: {} as InputConfig };
            const currentInputType: InputType = globalMappings.input?.type || "midi";
            const trackMappings = 'trackMappings' in globalMappings ? globalMappings.trackMappings : undefined;

            if (inputData.source === "midi") {
              const midiData = data as { note?: number };
              const trigger = midiData.note as number;
              Object.entries(activeTrack.channelMappings).forEach(
                ([channelNumber, slotNumber]) => {
                  const resolvedTrigger = resolveChannelTrigger(
                    slotNumber as number,
                    currentInputType,
                    trackMappings as any
                  );
                  const triggerNum = noteNameToNumber(resolvedTrigger);
                  if (triggerNum === (trigger as number | number | undefined)) {
                    channelsToFlash.push(Number(channelNumber));
                  }
                }
              );
            } else if (inputData.source === "osc") {
              const oscData = data as { channelName?: string };
              if (oscData.channelName) {
                Object.entries(activeTrack.channelMappings).forEach(
                  ([channelNumber, slotNumber]) => {
                    const resolvedTrigger = resolveChannelTrigger(
                      slotNumber as number,
                      currentInputType,
                      trackMappings as any
                    );
                    if (resolvedTrigger === oscData.channelName) {
                      channelsToFlash.push(Number(channelNumber));
                    }
                  }
                );
              }
            }

            channelsToFlash.forEach((channel) => {
              flashChannel(String(channel), 100);
            });

            if (currentActiveTrackId && channelsToFlash.length > 0) {
              const recordingStateForTrack =
                recordingStateRef.current[currentActiveTrackId];
              if (recordingStateForTrack?.isRecording) {
                const currentTime = Date.now();
                const relativeTime =
                  (currentTime - recordingStateForTrack.startTime) / 1000;

                channelsToFlash.forEach((channelNumber) => {
                  const channelName = `ch${channelNumber}`;
                  setRecordingData((prev) => {
                    const recording = getRecordingForTrack(
                      prev as Record<string, any>,
                      currentActiveTrackId as unknown as string
                    ) as { channels?: any[] };
                    const newRecording = { ...recording };

                    if (!newRecording.channels) {
                      newRecording.channels = [];
                    }

                    const channelIndex = newRecording.channels.findIndex(
                      (ch) => (ch as { name: string }).name === channelName
                    );

                    if (channelIndex === -1) {
                      newRecording.channels.push({
                        name: channelName,
                        sequences: [{ time: relativeTime, duration: 0.1 }],
                      });
                    } else {
                      const channel = newRecording.channels[channelIndex] as {
                        sequences: { time: number; duration: number }[];
                      };
                      channel.sequences.push({
                        time: relativeTime,
                        duration: 0.1,
                      });
                    }

                    return setRecordingForTrack(
                      prev as Record<string, any>,
                      currentActiveTrackId as unknown as string,
                      newRecording as any
                    );
                  });
                });
              }
            }
          }
          break;
      }

      const log = formatDebugLog({
        timestamp,
        type,
        source: inputData.source || "unknown",
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

  useIPCListener("from-projector", (event, data) => {
    const projectorData = data as { type?: string };
    if (projectorData.type === "projector-ready") {
      setIsProjectorReady(true);
    }
  });
};
