import { useCallback, useEffect } from "react";
import {
  getRecordingForTrack,
  setRecordingForTrack,
} from "../../../shared/json/recordingUtils.js";
import {
  noteNameToNumber,
  resolveChannelTrigger,
} from "../../../shared/midi/midiUtils.js";
import { getActiveSetTracks } from "../../../shared/utils/setUtils.js";
import { useIPCListener } from "./useIPC.js";

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
}) => {
  useEffect(() => {
    const tracks = getActiveSetTracks(userData, activeSetId);
    const globalMappings = userData?.config || {};
    const inputType = globalMappings.input?.type || "midi";
    const { buildMidiConfig } = require("../../../shared/midi/midiUtils.js");
    triggerMapsRef.current = buildMidiConfig(tracks, globalMappings, inputType);
  }, [userData?.sets, userData?.config?.input, activeSetId]);

  useIPCListener("input-status", (event, statusPayload) => {
    setInputStatus(statusPayload.data);
  });

  useIPCListener("from-projector", (event, data) => {
    if (data.type === "debug-log") {
      const rawLog =
        typeof data.log === "string"
          ? data.log
          : typeof data.props?.log === "string"
          ? data.props.log
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

  const addDebugLog = useCallback((log) => {
    setDebugLogs((prev) => {
      const newLogs = [...prev, log];
      return newLogs.slice(-200);
    });
  }, []);

  const formatDebugLog = useCallback((eventData) => {
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
      if (type === "track-selection") {
        log += `  Note: ${data.note}\n`;
        log += `  Channel: ${data.channel || 1}\n`;
      } else {
        log += `  Note: ${data.note}\n`;
        log += `  Channel: ${data.channel}\n`;
      }
    } else if (source === "osc") {
      if (data.address) {
        log += `  Address: ${data.address}\n`;
      }
      if (data.identifier) {
        log += `  Identifier: ${data.identifier}\n`;
      }
      if (data.channelName) {
        log += `  Channel: ${data.channelName}\n`;
      }
      if (data.value !== undefined) {
        log += `  Value: ${data.value}\n`;
      }
    }

    if (trackName) {
      log += `  Track: ${trackName}\n`;
    }
    if (moduleInfo) {
      log += `  Module: ${moduleInfo.instanceId} (${moduleInfo.type})\n`;
    }
    if (methodInfo) {
      log += `  Method: ${methodInfo.name}\n`;
    }
    if (props && Object.keys(props).length > 0) {
      log += `  Props: ${JSON.stringify(props, null, 2)}\n`;
    }
    return log;
  }, []);

  const handleInputEvent = useCallback(
    (event, payload) => {
      const { type, data } = payload;
      const timestamp = data.timestamp || performance.now() / 1000;

      const tracks = getActiveSetTracks(
        userDataRef.current || {},
        activeSetIdRef.current
      );
      let trackName = null;
      let moduleInfo = null;
      let methodInfo = null;
      let props = null;

      switch (type) {
        case "track-selection": {
          let resolvedTrackName = null;

          if (data.source === "midi") {
            resolvedTrackName =
              triggerMapsRef.current.trackTriggersMap[data.note];
          } else if (data.source === "osc") {
            resolvedTrackName =
              triggerMapsRef.current.trackTriggersMap[data.identifier];
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
                  setRecordingForTrack(prev, targetTrack.id, { channels: [] })
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
            let channelsToFlash = [];
            const globalMappings = userDataRef.current?.config || {};
            const currentInputType = globalMappings.input?.type || "midi";

            if (data.source === "midi") {
              const trigger = data.note;
              Object.entries(activeTrack.channelMappings).forEach(
                ([channelNumber, slotNumber]) => {
                  const resolvedTrigger = resolveChannelTrigger(
                    slotNumber,
                    currentInputType,
                    globalMappings
                  );
                  const triggerNum = noteNameToNumber(resolvedTrigger);
                  if (triggerNum === trigger) {
                    channelsToFlash.push(channelNumber);
                  }
                }
              );
            } else if (data.source === "osc" && data.channelName) {
              Object.entries(activeTrack.channelMappings).forEach(
                ([channelNumber, slotNumber]) => {
                  const resolvedTrigger = resolveChannelTrigger(
                    slotNumber,
                    currentInputType,
                    globalMappings
                  );
                  if (resolvedTrigger === data.channelName) {
                    channelsToFlash.push(channelNumber);
                  }
                }
              );
            }

            channelsToFlash.forEach((channel) => {
              flashChannel(channel, 100);
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
                      prev,
                      currentActiveTrackId
                    );
                    const newRecording = { ...recording };

                    if (!newRecording.channels) {
                      newRecording.channels = [];
                    }

                    const channelIndex = newRecording.channels.findIndex(
                      (ch) => ch.name === channelName
                    );

                    if (channelIndex === -1) {
                      newRecording.channels.push({
                        name: channelName,
                        sequences: [{ time: relativeTime, duration: 0.1 }],
                      });
                    } else {
                      newRecording.channels[channelIndex].sequences.push({
                        time: relativeTime,
                        duration: 0.1,
                      });
                    }

                    return setRecordingForTrack(
                      prev,
                      currentActiveTrackId,
                      newRecording
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
        source: data.source,
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
    if (data.type === "projector-ready") {
      setIsProjectorReady(true);
    }
  });
};
