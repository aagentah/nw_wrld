import React, { useState, useEffect, useCallback, useRef } from "react";
import { useAtom } from "jotai";
import { remove } from "lodash";
import { FaPlus } from "react-icons/fa";
import { SortableList, arrayMove } from "../../shared/SortableList";
import { useIPCSend } from "../../core/hooks/useIPC";
import {
  userDataAtom,
  recordingDataAtom,
  activeSetIdAtom,
  flashingConstructorsAtom,
  helpTextAtom,
  useFlashingChannels,
} from "../../core/state";
import { updateActiveSet } from "../../core/utils";
import { getActiveSetTracks } from "../../../shared/utils/setUtils";
import {
  getRecordingForTrack,
  setRecordingForTrack,
} from "../../../shared/json/recordingUtils";
import MidiPlayback from "../../../shared/midi/midiPlayback";
import { Button } from "../Button";
import { TrackDataModal } from "../../modals/TrackDataModal";
import { ModuleSelector, SortableModuleItem } from "./ModuleComponents";
import type { Track, InputConfig, UserConfig } from "@/types";

export interface TrackItemProps {
  track: Track;
  trackIndex: number;
  predefinedModules: any[];
  openRightMenu: (trackIndex: number) => void;
  onConfirmDelete: (message: string, callback: () => void) => void;
  setActiveTrackId: (trackId: number) => void;
  inputConfig: InputConfig | null;
  config: UserConfig | null;
  isSequencerPlaying: boolean;
  sequencerCurrentStep: number;
  handleSequencerToggle: (channelName: string, stepIndex: number) => void;
  workspacePath?: string | null;
  workspaceModuleFiles?: string[];
  workspaceModuleLoadFailures?: string[];
}

export const TrackItem = React.memo<TrackItemProps>(
  ({
    track,
    trackIndex,
    predefinedModules,
    openRightMenu,
    onConfirmDelete,
    setActiveTrackId,
    inputConfig,
    config,
    isSequencerPlaying,
    sequencerCurrentStep,
    handleSequencerToggle,
    workspacePath = null,
    workspaceModuleFiles = [],
    workspaceModuleLoadFailures = [],
  }) => {
    const [userData, setUserData] = useAtom(userDataAtom);
    const [recordingData] = useAtom(recordingDataAtom);
    const [activeSetId] = useAtom(activeSetIdAtom);
    const [flashingChannels, flashChannel] = useFlashingChannels() as [any, (channelName: string, duration?: number) => void];
    const [flashingConstructors, setFlashingConstructors] = useAtom(
      flashingConstructorsAtom
    );
    const [selectedTrackForData, setSelectedTrackForData] = useState<Track | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const playbackEngineRef = useRef<MidiPlayback | null>(null);

    const sendToProjector = useIPCSend("dashboard-to-projector");

    const stopPlayback = useCallback(() => {
      if (playbackEngineRef.current) {
        playbackEngineRef.current.stop();
        setIsPlaying(false);
      }
    }, []);

    const handleAddChannel = useCallback(() => {
      const existingChannelNumbers = new Set(
        Object.keys(track?.channelMappings || {}).map(Number)
      );

      let nextChannel: number | null = null;
      for (let i = 1; i <= 16; i++) {
        if (!existingChannelNumbers.has(i)) {
          nextChannel = i;
          break;
        }
      }

      if (!nextChannel) {
        alert("All 16 channels are already in use.");
        return;
      }

      updateActiveSet(setUserData, activeSetId, (activeSet) => {
        const currentTrack = activeSet.tracks[trackIndex];
        if (!currentTrack.channelMappings) {
          currentTrack.channelMappings = {};
        }
        currentTrack.channelMappings[String(nextChannel)] = nextChannel;
      });
    }, [track, trackIndex, setUserData, activeSetId]);

    const handleRemoveModule = useCallback(
      (instanceId: string) => {
        const module = track.modules.find((m) => m.id === instanceId);
        if (!module) return;

        onConfirmDelete(
          `Are you sure you want to delete the ${module.type} module?`,
          () => {
            updateActiveSet(setUserData, activeSetId, (activeSet) => {
              const track = activeSet.tracks[trackIndex];
              remove(track.modules, (m) => m.id === instanceId);
              delete track.modulesData[instanceId];
            });
          }
        );
      },
      [setUserData, trackIndex, track.modules, onConfirmDelete, activeSetId]
    );

    const handleRemoveChannel = useCallback(
      (channelName: string) => {
        onConfirmDelete(
          `Are you sure you want to delete channel ${channelName}?`,
          () => {
            updateActiveSet(setUserData, activeSetId, (activeSet) => {
              const currentTrack = activeSet.tracks[trackIndex];

              delete currentTrack.channelMappings[channelName];

              Object.keys(currentTrack.modulesData).forEach((moduleId) => {
                if (currentTrack.modulesData[moduleId].methods) {
                  delete currentTrack.modulesData[moduleId].methods[channelName];
                }
              });
            });
          }
        );
      },
      [setUserData, trackIndex, onConfirmDelete, activeSetId]
    );

    const handlePlayPause = useCallback(async () => {
      if (!playbackEngineRef.current) {
        playbackEngineRef.current = new MidiPlayback();

        playbackEngineRef.current.setOnNoteCallback((channelName: string) => {
          flashChannel(channelName, 100);

          sendToProjector("channel-trigger", {
            channelName: channelName,
          });
        });

        playbackEngineRef.current.setOnStopCallback(() => {
          setIsPlaying(false);
        });

        try {
          const recording = getRecordingForTrack(recordingData, String(track.id));
          if (
            !recording ||
            !recording.channels ||
            recording.channels.length === 0
          ) {
            alert("No recording available. Trigger some channels first.");
            return;
          }

          const channels = (recording.channels || []).map((ch: any) => ({
            name: ch?.name || '',
            midi: 0,
            sequences: (ch as any)?.sequences || [],
          }));

          const bpm = track.bpm || 120;
          playbackEngineRef.current.load(channels, bpm);
        } catch (error) {
          console.error("Error loading recording for playback:", error);
          const err = error as Error;
          alert(`Failed to load recording for playback: ${err.message}`);
          return;
        }
      }

      if (!isPlaying) {
        const keys = track.modules.map(
          (moduleInstance) => `${track.id}:${moduleInstance.id}`
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

        sendToProjector("track-activate", {
          trackName: track.name,
        });

        playbackEngineRef.current.play();
        setIsPlaying(true);
      }
    }, [
      isPlaying,
      recordingData,
      track.id,
      track.bpm,
      track.name,
      track.modules,
      flashChannel,
      setFlashingConstructors,
      sendToProjector,
    ]);

    const handleStop = useCallback(() => {
      if (playbackEngineRef.current) {
        playbackEngineRef.current.stop();
        setIsPlaying(false);
      }
    }, []);

    useEffect(() => {
      return () => {
        if (playbackEngineRef.current) {
          playbackEngineRef.current.stop();
        }
      };
    }, []);

    return (
      <div className="mb-4 pb-4 font-mono">
        <div className="flex flex-col h-full w-full mb-4 relative">
          <div className="relative">
            <ModuleSelector
              trackIndex={trackIndex}
              predefinedModules={predefinedModules}
              openRightMenu={openRightMenu}
              stopPlayback={stopPlayback}
              onShowTrackData={(track) => {
                setSelectedTrackForData(track);
              }}
              inputConfig={inputConfig}
            />
            {track.modules.length > 0 && (
              <div className="absolute left-[11px] bottom-0 w-[2px] bg-neutral-800 h-4" />
            )}
          </div>

          <div className="mb-6 relative">
            {track.modules.length === 0 ? (
              <div className="pl-12 text-neutral-300/30 text-[11px]">
                [NO MODULES ADDED]
              </div>
            ) : (
              <>
                <div
                  className="absolute left-[11px] top-0 w-[2px] bg-neutral-800"
                  style={{ height: `calc(100% - 8px)` }}
                />
                <SortableList
                  items={track.modules}
                  onReorder={(oldIndex, newIndex) => {
                    updateActiveSet(setUserData, activeSetId, (activeSet) => {
                      const modules = activeSet.tracks[trackIndex].modules;
                      activeSet.tracks[trackIndex].modules = arrayMove(
                        modules,
                        oldIndex,
                        newIndex
                      );
                    });
                  }}
                >
                  {track.modules.map((moduleInstance, index) => (
                    <div
                      key={moduleInstance.id}
                      className="relative mb-4 last:mb-0"
                    >
                      <div className="relative flex items-start">
                        <div className="absolute left-[11px] top-[8px] w-[25px] h-[2px] bg-neutral-800" />
                        <div
                          className="absolute left-[11px] top-[9px] w-[6px] h-[6px] bg-neutral-800 rounded-full"
                          style={{ transform: "translate(-50%, -50%)" }}
                        />
                        <div className="flex-1">
                          <SortableModuleItem
                            id={moduleInstance.id}
                            moduleInstance={moduleInstance}
                            trackIndex={trackIndex}
                            predefinedModules={predefinedModules}
                            onRemoveModule={handleRemoveModule}
                            inputConfig={inputConfig}
                            config={config}
                            isSequencerPlaying={isSequencerPlaying}
                            sequencerCurrentStep={sequencerCurrentStep}
                            handleSequencerToggle={handleSequencerToggle}
                            workspacePath={workspacePath}
                            workspaceModuleFiles={workspaceModuleFiles}
                            workspaceModuleLoadFailures={workspaceModuleLoadFailures}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </SortableList>
              </>
            )}
          </div>

          <div className="flex items-center gap-6 mb-4">
            <Button onClick={() => openRightMenu(trackIndex)} icon={<FaPlus />}>
              MODULE
            </Button>
            <Button
              onClick={handleAddChannel}
              icon={<FaPlus />}
              disabled={track.modules.length === 0}
              className={
                track.modules.length === 0
                  ? "opacity-50 cursor-not-allowed"
                  : ""
              }
              title={
                track.modules.length === 0
                  ? "Add a module first"
                  : "Add Channel"
              }
            >
              CHANNEL
            </Button>
          </div>
        </div>

        <TrackDataModal
          isOpen={!!selectedTrackForData}
          onClose={() => setSelectedTrackForData(null)}
          trackData={selectedTrackForData}
        />
      </div>
    );
  }
);

TrackItem.displayName = "TrackItem";
