import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import * as Tone from "tone";
import { produce } from "immer";
import MidiPlayback from "../../../shared/midi/midiPlayback";
import SequencerPlayback from "../../../shared/sequencer/SequencerPlayback";
import SequencerAudio from "../../../shared/audio/sequencerAudio";
import { getActiveSetTracks } from "../../../shared/utils/setUtils";
import { getRecordingForTrack, getSequencerForTrack } from "../../../shared/json/recordingUtils";
import { useLatestRef } from "./useLatestRef";

type UseDashboardPlaybackArgs = {
  userData: Record<string, unknown>;
  userDataRef: MutableRefObject<Record<string, unknown>>;
  activeTrackId: string | number | null;
  activeSetId: string | null;
  activeSetIdRef: MutableRefObject<string | null>;
  firstVisibleTrack: { track: Record<string, unknown>; trackIndex: number } | null;
  recordingData: Record<string, unknown>;
  recordingDataRef: MutableRefObject<Record<string, unknown>>;
  setRecordingData: (updater: (draft: Record<string, unknown>) => void) => void;
  sendToProjector: (type: string, props: Record<string, unknown>) => void;
  flashChannel: (channelName: string, durationMs?: number) => void;
  setFlashingConstructors: (updater: (prev: Set<string>) => Set<string>) => void;
  isSequencerMuted: boolean;
  setIsProjectorReady: (ready: boolean) => void;
  isInitialMountRef: MutableRefObject<boolean>;
};

export const useDashboardPlayback = ({
  userData,
  userDataRef,
  activeTrackId,
  activeSetId,
  activeSetIdRef,
  firstVisibleTrack,
  recordingData,
  recordingDataRef,
  setRecordingData,
  sendToProjector,
  flashChannel,
  setFlashingConstructors,
  isSequencerMuted,
  setIsProjectorReady,
  isInitialMountRef,
}: UseDashboardPlaybackArgs) => {
  const [footerPlaybackState, setFooterPlaybackState] = useState<Record<string, boolean>>({});
  const [isSequencerPlaying, setIsSequencerPlaying] = useState(false);
  const [sequencerCurrentStep, setSequencerCurrentStep] = useState(0);

  const isSequencerPlayingRef = useLatestRef(isSequencerPlaying);
  const sequencerMutedRef = useLatestRef(isSequencerMuted);

  const prevActiveTrackIdRef = useRef<string | number | null>(activeTrackId);
  const prevActiveSetIdRef = useRef<string | null>(activeSetId);

  const footerPlaybackEngineRef = useRef<Record<string, MidiPlayback>>({});
  const sequencerEngineRef = useRef<SequencerPlayback | null>(null);
  const sequencerAudioRef = useRef<SequencerAudio | null>(null);
  const sequencerRunIdRef = useRef(0);

  useEffect(() => {
    if (isInitialMountRef.current) {
      prevActiveTrackIdRef.current = activeTrackId;
      prevActiveSetIdRef.current = activeSetId;
      return;
    }

    const userDataObj = userDataRef.current && typeof userDataRef.current === 'object' ? userDataRef.current as Record<string, unknown> : {};
    const config = userDataObj.config && typeof userDataObj.config === 'object' ? userDataObj.config as Record<string, unknown> : {};
    const didTrackChange = prevActiveTrackIdRef.current !== activeTrackId;
    const didSetChange = prevActiveSetIdRef.current !== activeSetId;
    const shouldKeepSequencerPlaying =
      config.sequencerMode && isSequencerPlayingRef.current && !didTrackChange && !didSetChange;
    if (sequencerEngineRef.current && !shouldKeepSequencerPlaying) {
      sequencerEngineRef.current.stop();
      if (typeof sequencerEngineRef.current.getRunId === "function") {
        sequencerRunIdRef.current = sequencerEngineRef.current.getRunId();
      }
      setIsSequencerPlaying(false);
      setSequencerCurrentStep(0);
    }

    Object.entries(footerPlaybackEngineRef.current).forEach(([_trackId, engine]) => {
      if (engine) {
        engine.stop();
      }
    });
    setFooterPlaybackState({});

    const tracks = getActiveSetTracks(userDataRef.current || {}, activeSetId);
    const track = tracks.find((t: { id: unknown }) => t.id === activeTrackId);
    const trackObj = track && typeof track === 'object' ? track as Record<string, unknown> : {};

    if (track) {
      setIsProjectorReady(false);
      sendToProjector("set-activate", {
        setId: activeSetId,
      });
      sendToProjector("track-activate", {
        trackName: trackObj.name,
      });
    } else {
      setIsProjectorReady(true);
    }

    prevActiveTrackIdRef.current = activeTrackId;
    prevActiveSetIdRef.current = activeSetId;
  }, [activeTrackId, activeSetId, sendToProjector, setIsProjectorReady, userDataRef, isInitialMountRef, isSequencerPlayingRef]);

  const handleSequencerToggle = useCallback(
    (channelName: string, stepIndex: number) => {
      if (!firstVisibleTrack) return;
      const { track } = firstVisibleTrack;
      const trackObj = track && typeof track === 'object' ? track as Record<string, unknown> : {};

      setRecordingData(
        produce((draft: Record<string, unknown>) => {
          const trackId = String(trackObj.id || '');
          if (!draft[trackId]) {
            draft[trackId] = { channels: [], sequencer: { pattern: {} } };
          }
          const draftTrack = draft[trackId] as Record<string, unknown>;
          if (!draftTrack.sequencer) {
            draftTrack.sequencer = { pattern: {} };
          }
          const sequencer = draftTrack.sequencer as Record<string, unknown>;
          if (!sequencer.pattern) {
            sequencer.pattern = {};
          }
          const pattern = sequencer.pattern as Record<string, unknown>;
          if (
            !pattern[channelName] ||
            !Array.isArray(pattern[channelName])
          ) {
            pattern[channelName] = [];
          }

          const steps = pattern[channelName] as number[];
          const idx = steps.indexOf(stepIndex);

          if (idx > -1) {
            steps.splice(idx, 1);
          } else {
            steps.push(stepIndex);
            steps.sort((a: number, b: number) => a - b);
          }
        })
      );

      if (sequencerEngineRef.current && isSequencerPlaying) {
        const sequencerData = getSequencerForTrack(recordingData as Record<string, unknown>, String(trackObj.id || ''));
        const sequencerDataObj = sequencerData && typeof sequencerData === 'object' ? sequencerData as Record<string, unknown> : {};
        const patternObj = sequencerDataObj.pattern && typeof sequencerDataObj.pattern === 'object' ? sequencerDataObj.pattern as Record<string, unknown> : {};
        const updatedPattern: Record<string, number[]> = { ...patternObj as Record<string, number[]> };

        if (!updatedPattern[channelName]) {
          updatedPattern[channelName] = [];
        }

        const steps = Array.isArray(updatedPattern[channelName]) ? [...updatedPattern[channelName]] : [];
        const idx = steps.indexOf(stepIndex);

        if (idx > -1) {
          steps.splice(idx, 1);
        } else {
          steps.push(stepIndex);
          steps.sort((a: number, b: number) => a - b);
        }

        updatedPattern[channelName] = steps;

        const userDataObj = userData && typeof userData === 'object' ? userData as Record<string, unknown> : {};
        const userConfig = userDataObj.config && typeof userDataObj.config === 'object' ? userDataObj.config as Record<string, unknown> : {};
        const bpm = typeof userConfig.sequencerBpm === 'number' ? userConfig.sequencerBpm : 120;
        sequencerEngineRef.current.load(updatedPattern, bpm);
      }
    },
    [firstVisibleTrack, isSequencerPlaying, recordingData, setRecordingData, userData]
  );

  const handleFooterPlayPause = useCallback(async () => {
    if (!firstVisibleTrack) return;
    const { track } = firstVisibleTrack;
    const trackObj = track && typeof track === 'object' ? track as Record<string, unknown> : {};
    const trackId = trackObj.id;
    const userDataObj = userData && typeof userData === 'object' ? userData as Record<string, unknown> : {};
    const config = userDataObj.config && typeof userDataObj.config === 'object' ? userDataObj.config as Record<string, unknown> : {};

    if (config.sequencerMode) {
      if (!sequencerEngineRef.current) {
        sequencerEngineRef.current = new SequencerPlayback();

        sequencerEngineRef.current.setOnStepCallback((stepIndex, channels, time, runId) => {
          const hasScheduledTime = typeof time === "number" && Number.isFinite(time);

          if (typeof runId === "number" && runId !== sequencerRunIdRef.current) {
            return;
          }

          channels.forEach((channelName) => {
            if (sequencerAudioRef.current && !sequencerMutedRef.current) {
              const channelNumber = channelName.replace(/^ch/, "");
              sequencerAudioRef.current.playChannelBeep(channelNumber, hasScheduledTime ? time : undefined);
            }
          });

          if (hasScheduledTime) {
            const scheduledRunId = runId;
            Tone.Draw.schedule(() => {
              if (typeof scheduledRunId === "number" && scheduledRunId !== sequencerRunIdRef.current) {
                return;
              }
              setSequencerCurrentStep(stepIndex);
              channels.forEach((channelName) => {
                flashChannel(channelName, 100);
                sendToProjector("channel-trigger", { channelName });
              });
            }, time);
          } else {
            setSequencerCurrentStep(stepIndex);
            channels.forEach((channelName) => {
              flashChannel(channelName, 100);
              sendToProjector("channel-trigger", { channelName });
            });
          }
        });
      }

      if (!sequencerAudioRef.current) {
        sequencerAudioRef.current = new SequencerAudio();
      }

      if (!isSequencerPlaying) {
        const sequencerData = getSequencerForTrack(recordingData as Record<string, unknown>, String(trackObj.id || ''));
        const sequencerDataObj = sequencerData && typeof sequencerData === 'object' ? sequencerData as Record<string, unknown> : {};
        const pattern = (sequencerDataObj.pattern && typeof sequencerDataObj.pattern === 'object' ? sequencerDataObj.pattern : {}) as Record<string, number[]>;
        const bpm = typeof config.sequencerBpm === 'number' ? config.sequencerBpm : 120;
        sequencerEngineRef.current.load(pattern, bpm);

        const modules = Array.isArray(trackObj.modules) ? trackObj.modules : [];
        const keys = modules.map((moduleInstance: unknown) => {
          const modObj = moduleInstance && typeof moduleInstance === 'object' ? moduleInstance as Record<string, unknown> : {};
          return `${trackObj.id}:${modObj.id}`;
        });
        setFlashingConstructors((prev) => {
          const next = new Set(prev);
          keys.forEach((k: string) => next.add(k));
          return next;
        });
        setTimeout(() => {
          setFlashingConstructors((prev) => {
            const next = new Set(prev);
            keys.forEach((k: string) => next.delete(k));
            return next;
          });
        }, 100);

        sendToProjector("track-activate", {
          trackName: trackObj.name,
        });
        sequencerEngineRef.current.play();
        if (typeof sequencerEngineRef.current.getRunId === "function") {
          sequencerRunIdRef.current = sequencerEngineRef.current.getRunId();
        }
        setIsSequencerPlaying(true);
      }
    } else {
      const trackIdStr = String(trackId);
      const isPlaying = footerPlaybackState[trackIdStr] || false;

      if (!footerPlaybackEngineRef.current[trackIdStr]) {
        footerPlaybackEngineRef.current[trackIdStr] = new MidiPlayback();

        footerPlaybackEngineRef.current[trackIdStr].setOnNoteCallback((channelName: unknown) => {
          const channelNumber = String(channelName).replace(/^ch/, "");
          flashChannel(channelNumber, 100);

          sendToProjector("channel-trigger", {
            channelName: String(channelName),
          });
        });

        footerPlaybackEngineRef.current[trackIdStr].setOnStopCallback(() => {
          setFooterPlaybackState((prev) => ({ ...prev, [trackIdStr]: false }));
        });

        try {
          const recording = getRecordingForTrack(recordingData as Record<string, unknown>, String(trackObj.id || ''));
          const recordingObj = recording && typeof recording === 'object' ? recording as Record<string, unknown> : {};
          const channels = Array.isArray(recordingObj.channels) ? recordingObj.channels : [];
          if (!recording || channels.length === 0) {
            alert("No recording available. Trigger some channels first.");
            return;
          }

          const mappedChannels = channels.map((ch: unknown) => {
            const chObj = ch && typeof ch === 'object' ? ch as Record<string, unknown> : {};
            return {
              name: chObj.name,
              midi: 0,
              sequences: Array.isArray(chObj.sequences) ? chObj.sequences : [],
            };
          });

          const bpm = trackObj.bpm || 120;
          footerPlaybackEngineRef.current[trackIdStr].load(mappedChannels, bpm);
        } catch (error: unknown) {
          const errorMsg = error && typeof error === 'object' && 'message' in error ? String((error as { message: unknown }).message) : String(error);
          console.error("Error loading recording for playback:", error);
          alert(`Failed to load recording for playback: ${errorMsg}`);
          return;
        }
      }

      if (!isPlaying) {
        const modules = Array.isArray(trackObj.modules) ? trackObj.modules : [];
        const keys = modules.map((moduleInstance: unknown) => {
          const modObj = moduleInstance && typeof moduleInstance === 'object' ? moduleInstance as Record<string, unknown> : {};
          return `${trackObj.id}:${modObj.id}`;
        });
        setFlashingConstructors((prev) => {
          const next = new Set(prev);
          keys.forEach((k: string) => next.add(k));
          return next;
        });
        setTimeout(() => {
          setFlashingConstructors((prev) => {
            const next = new Set(prev);
            keys.forEach((k: string) => next.delete(k));
            return next;
          });
        }, 100);

        sendToProjector("track-activate", {
          trackName: trackObj.name,
        });

        footerPlaybackEngineRef.current[trackIdStr].play();
        setFooterPlaybackState((prev) => ({ ...prev, [trackIdStr]: true }));
      }
    }
  }, [
    firstVisibleTrack,
    footerPlaybackState,
    flashChannel,
    isSequencerPlaying,
    recordingData,
    sendToProjector,
    setFlashingConstructors,
    userData,
    sequencerMutedRef,
  ]);

  const handleFooterStop = useCallback(() => {
    if (!firstVisibleTrack) return;
    const userDataObj = userData && typeof userData === 'object' ? userData as Record<string, unknown> : {};
    const config = userDataObj.config && typeof userDataObj.config === 'object' ? userDataObj.config as Record<string, unknown> : {};
    if (config.sequencerMode) {
      if (sequencerEngineRef.current) {
        sequencerEngineRef.current.stop();
        if (typeof sequencerEngineRef.current.getRunId === "function") {
          sequencerRunIdRef.current = sequencerEngineRef.current.getRunId();
        }
        setIsSequencerPlaying(false);
        setSequencerCurrentStep(0);
      }
    } else {
      const trackObj = firstVisibleTrack.track && typeof firstVisibleTrack.track === 'object' ? firstVisibleTrack.track as Record<string, unknown> : {};
      const trackId = String(trackObj.id || '');
      if (footerPlaybackEngineRef.current[trackId]) {
        footerPlaybackEngineRef.current[trackId].stop();
        setFooterPlaybackState((prev) => ({ ...prev, [trackId]: false }));
      }
    }
  }, [firstVisibleTrack, userData]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;

      const target = e.target as EventTarget & { tagName?: string; isContentEditable?: boolean };
      const isTyping =
        target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;

      if (isTyping) return;

      const userDataObj = userData && typeof userData === 'object' ? userData as Record<string, unknown> : {};
      const config = userDataObj.config && typeof userDataObj.config === 'object' ? userDataObj.config as Record<string, unknown> : {};
      if (!config.sequencerMode) return;

      e.preventDefault();

      if (isSequencerPlaying) {
        handleFooterStop();
      } else {
        handleFooterPlayPause();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [userData, isSequencerPlaying, handleFooterStop, handleFooterPlayPause]);

  useEffect(() => {
    return () => {
      Object.values(footerPlaybackEngineRef.current).forEach((engine) => {
        if (engine) {
          engine.stop();
        }
      });
    };
  }, []);

  useEffect(() => {
    Object.values(footerPlaybackEngineRef.current).forEach((engine) => {
      if (engine) {
        engine.stop();
      }
    });
    setFooterPlaybackState({});
  }, [activeTrackId]);

  useEffect(() => {
    const userDataObj = userDataRef.current && typeof userDataRef.current === 'object' ? userDataRef.current as Record<string, unknown> : {};
    const config = userDataObj.config && typeof userDataObj.config === 'object' ? userDataObj.config as Record<string, unknown> : {};
    if (!config.sequencerMode) return;
    if (!isSequencerPlaying) return;
    if (!sequencerEngineRef.current) return;
    if (!activeTrackId) return;

    const tracks = getActiveSetTracks(userDataRef.current || {}, activeSetIdRef.current);
    const track = tracks.find((t: { id: unknown }) => t.id === activeTrackId) || null;
    if (!track) return;
    const trackObj = track && typeof track === 'object' ? track as Record<string, unknown> : {};

    const sequencerData = getSequencerForTrack(recordingDataRef.current as Record<string, unknown> || {}, String(trackObj.id || ''));
    const sequencerDataObj = sequencerData && typeof sequencerData === 'object' ? sequencerData as Record<string, unknown> : {};
    const pattern = (sequencerDataObj.pattern && typeof sequencerDataObj.pattern === 'object' ? sequencerDataObj.pattern : {}) as Record<string, number[]>;
    const bpm = typeof config.sequencerBpm === 'number' ? config.sequencerBpm : 120;
    sequencerEngineRef.current.load(pattern, bpm);
  }, [activeTrackId, isSequencerPlaying, activeSetIdRef, recordingDataRef, userDataRef]);

  return {
    footerPlaybackState,
    isSequencerPlaying,
    sequencerCurrentStep,
    handleSequencerToggle,
    handleFooterPlayPause,
    handleFooterStop,
    sequencerEngineRef,
    sequencerRunIdRef,
    setIsSequencerPlaying,
    setSequencerCurrentStep,
  };
};

