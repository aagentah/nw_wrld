import { memo, useState, useEffect, useCallback, useRef, useMemo } from "react";
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
  useFlashingChannels,
} from "../../core/state.ts";
import { updateActiveSet } from "../../core/utils";
import { getRecordingForTrack } from "../../../shared/json/recordingUtils.ts";
import MidiPlayback from "../../../shared/midi/midiPlayback.ts";
import { Button } from "../Button";
import { TrackDataModal } from "../../modals/TrackDataModal";
import { ModuleSelector, SortableModuleItem } from "./ModuleComponents";

type ModuleInstance = { id: string; type: string };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.prototype.toString.call(value) === "[object Object]"
  );
}

type Track = {
  id: string | number;
  name: string;
  bpm?: number;
  channelMappings?: Record<string, number>;
  modules: ModuleInstance[];
  modulesData: Record<string, unknown>;
};

type TrackItemProps = {
  track: Track;
  trackIndex: number;
  predefinedModules: unknown[];
  openRightMenu: (trackIndex: number) => void;
  onConfirmDelete: (message: string, onConfirm: () => void) => void;
  setActiveTrackId: (id: string | null) => void;
  inputConfig: unknown;
  config: Record<string, unknown> | null;
  isSequencerPlaying: boolean;
  sequencerCurrentStep: number;
  handleSequencerToggle: (channelName: string, stepIndex: number) => void;
  workspacePath?: string | null;
  workspaceModuleFiles?: string[];
  workspaceModuleLoadFailures?: string[];
};

export const TrackItem = memo(
  ({
    track,
    trackIndex,
    predefinedModules,
    openRightMenu,
    onConfirmDelete,
    setActiveTrackId: _setActiveTrackId,
    inputConfig,
    config: _config,
    isSequencerPlaying,
    sequencerCurrentStep,
    handleSequencerToggle,
    workspacePath = null,
    workspaceModuleFiles = [],
    workspaceModuleLoadFailures = [],
  }: TrackItemProps) => {
    const [_userData, setUserData] = useAtom(userDataAtom);
    const [recordingData] = useAtom(recordingDataAtom);
    const [activeSetId] = useAtom(activeSetIdAtom);
    const [_flashingChannels, flashChannel] = useFlashingChannels();
    const [_flashingConstructors, setFlashingConstructors] = useAtom(flashingConstructorsAtom);
    const [selectedTrackForData, setSelectedTrackForData] = useState<unknown | null>(null);
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
      const existingChannelNumbers = new Set(Object.keys(track?.channelMappings || {}).map(Number));

      let nextChannel: number | null = null;
      for (let i = 1; i <= 12; i++) {
        if (!existingChannelNumbers.has(i)) {
          nextChannel = i;
          break;
        }
      }

      if (!nextChannel) {
        return;
      }

      updateActiveSet(setUserData, activeSetId, (activeSet) => {
        if (!isPlainObject(activeSet)) return;
        const tracksUnknown = (activeSet as Record<string, unknown>).tracks;
        if (!Array.isArray(tracksUnknown)) return;
        const currentTrack = tracksUnknown[trackIndex];
        if (!isPlainObject(currentTrack)) return;
        const cmUnknown = (currentTrack as Record<string, unknown>).channelMappings;
        const cm = isPlainObject(cmUnknown) ? (cmUnknown as Record<string, unknown>) : {};
        (currentTrack as Record<string, unknown>).channelMappings = cm;
        cm[String(nextChannel)] = nextChannel;
      });
    }, [track, trackIndex, setUserData, activeSetId]);

    const isAtMaxChannels = useMemo(() => {
      const existing = new Set(Object.keys(track?.channelMappings || {}).map(Number));
      for (let i = 1; i <= 12; i++) {
        if (!existing.has(i)) return false;
      }
      return true;
    }, [track?.channelMappings]);

    const handleRemoveModule = useCallback(
      (instanceId: string) => {
        const module = track.modules.find((m) => m.id === instanceId);
        if (!module) return;

        onConfirmDelete(`Are you sure you want to delete the ${module.type} module?`, () => {
          updateActiveSet(setUserData, activeSetId, (activeSet) => {
            if (!isPlainObject(activeSet)) return;
            const tracksUnknown = (activeSet as Record<string, unknown>).tracks;
            if (!Array.isArray(tracksUnknown)) return;
            const t = tracksUnknown[trackIndex];
            if (!isPlainObject(t)) return;
            const modulesUnknown = (t as Record<string, unknown>).modules;
            if (Array.isArray(modulesUnknown)) {
              remove(modulesUnknown, (m) => isPlainObject(m) && m.id === instanceId);
            }
            const modulesDataUnknown = (t as Record<string, unknown>).modulesData;
            if (isPlainObject(modulesDataUnknown)) {
              delete (modulesDataUnknown as Record<string, unknown>)[instanceId];
            }
          });
        });
      },
      [setUserData, trackIndex, track.modules, onConfirmDelete, activeSetId]
    );

    const _handlePlayPause = useCallback(async () => {
      if (!playbackEngineRef.current) {
        playbackEngineRef.current = new MidiPlayback();

        playbackEngineRef.current.setOnNoteCallback((channelName: string) => {
          flashChannel(channelName, 100);
          sendToProjector("channel-trigger", { channelName });
        });

        playbackEngineRef.current.setOnStopCallback(() => {
          setIsPlaying(false);
        });

        try {
          const recording = getRecordingForTrack(recordingData, String(track.id));
          const channelsRaw = isPlainObject(recording) ? recording.channels : null;
          if (!Array.isArray(channelsRaw) || channelsRaw.length === 0) {
            alert("No recording available. Trigger some channels first.");
            return;
          }

          const channels = channelsRaw.map((ch) => {
            const c = isPlainObject(ch) ? ch : {};
            return {
              name: String(c.name ?? ""),
              midi: 0,
              sequences: Array.isArray(c.sequences) ? c.sequences : [],
            };
          });

          const bpm = track.bpm || 120;
          playbackEngineRef.current.load(channels, bpm);
        } catch (error) {
          console.error("Error loading recording for playback:", error);
          alert(`Failed to load recording for playback: ${(error as { message?: string })?.message}`);
          return;
        }
      }

      if (!isPlaying) {
        const keys = track.modules.map((moduleInstance) => `${String(track.id)}:${moduleInstance.id}`);
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

        sendToProjector("track-activate", { trackName: track.name });

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
      sendToProjector,
      setFlashingConstructors,
    ]);

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
              onShowTrackData={(t: unknown) => {
                setSelectedTrackForData(t);
              }}
              inputConfig={inputConfig}
            />
            {track.modules.length > 0 && (
              <div className="absolute left-[11px] bottom-0 w-[2px] bg-neutral-800 h-4" />
            )}
          </div>

          <div className="mb-6 relative">
            {track.modules.length === 0 ? (
              <div className="pl-12 text-neutral-300/30 text-[11px]">[NO MODULES ADDED]</div>
            ) : (
              <>
                <div
                  className="absolute left-[11px] top-0 w-[2px] bg-neutral-800"
                  style={{ height: `calc(100% - 8px)` }}
                />
                <SortableList
                  items={track.modules}
                  onReorder={(oldIndex: number, newIndex: number) => {
                    updateActiveSet(setUserData, activeSetId, (activeSet) => {
                      if (!isPlainObject(activeSet)) return;
                      const tracksUnknown = (activeSet as Record<string, unknown>).tracks;
                      if (!Array.isArray(tracksUnknown)) return;
                      const t = tracksUnknown[trackIndex];
                      if (!isPlainObject(t)) return;
                      const modulesUnknown = (t as Record<string, unknown>).modules;
                      if (!Array.isArray(modulesUnknown)) return;
                      (t as Record<string, unknown>).modules = arrayMove(
                        modulesUnknown,
                        oldIndex,
                        newIndex
                      );
                    });
                  }}
                >
                  {track.modules.map((moduleInstance) => (
                    <div key={moduleInstance.id} className="relative mb-4 last:mb-0">
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
                            config={_config}
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
            <Button onClick={() => openRightMenu(trackIndex)} icon={<FaPlus />} data-testid="track-add-module">
              MODULE
            </Button>
            <Button
              onClick={handleAddChannel}
              icon={<FaPlus />}
              data-testid="track-add-channel"
              disabled={track.modules.length === 0 || isAtMaxChannels}
              className={
                track.modules.length === 0 || isAtMaxChannels ? "opacity-50 cursor-not-allowed" : ""
              }
              title={
                track.modules.length === 0
                  ? "Add a module first"
                  : isAtMaxChannels
                    ? "Max 12 channels"
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

