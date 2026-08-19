import { memo, useState, useCallback, useMemo } from "react";
import { useAtom, useSetAtom } from "jotai";
import { remove } from "lodash";
import { FaPlus } from "react-icons/fa";
import { SortableList, arrayMove } from "../../shared/SortableList";
import { userDataAtom, activeSetIdAtom } from "../../core/state";
import { updateActiveSet } from "../../core/utils";
import { Button } from "../Button";
import { TrackDataModal } from "../../modals/TrackDataModal";
import { EditTrackModal } from "../../modals/EditTrackModal";
import { ModuleSelector, SortableModuleItem } from "./ModuleComponents";
import type { AudioCaptureState } from "../../core/hooks/useDashboardAudioCapture";
import type { FileAudioState } from "../../core/hooks/useDashboardFileAudio";

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
  inputConfig: unknown;
  config: Record<string, unknown> | null;
  isSequencerPlaying: boolean;
  handleSequencerToggle: (channelName: string, stepIndex: number) => void;
  workspacePath?: string | null;
  workspaceModuleFiles?: string[];
  workspaceModuleLoadFailures?: string[];
  audioCaptureState?: AudioCaptureState | null;
  fileAudioState?: FileAudioState | null;
};

export const TrackItem = memo(
  ({
    track,
    trackIndex,
    predefinedModules,
    openRightMenu,
    onConfirmDelete,
    inputConfig,
    config: _config,
    isSequencerPlaying,
    handleSequencerToggle,
    workspacePath = null,
    workspaceModuleFiles = [],
    workspaceModuleLoadFailures = [],
    audioCaptureState = null,
    fileAudioState = null,
  }: TrackItemProps) => {
    const setUserData = useSetAtom(userDataAtom);
    const [activeSetId] = useAtom(activeSetIdAtom);
    const [selectedTrackForData, setSelectedTrackForData] = useState<unknown | null>(null);
    const [isEditTrackModalOpen, setIsEditTrackModalOpen] = useState(false);

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

    return (
      <div className="mb-4 pb-4 font-mono">
        <div className="flex flex-col h-full w-full mb-4 relative">
          <div className="relative">
            <ModuleSelector
              trackIndex={trackIndex}
              predefinedModules={predefinedModules}
              openRightMenu={openRightMenu}
              onShowTrackData={(t: unknown) => {
                setSelectedTrackForData(t);
              }}
              inputConfig={inputConfig}
              onEditTrack={() => setIsEditTrackModalOpen(true)}
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

        <EditTrackModal
          isOpen={isEditTrackModalOpen}
          onClose={() => setIsEditTrackModalOpen(false)}
          trackIndex={trackIndex}
          inputConfig={inputConfig as { type?: unknown; noteMatchMode?: unknown } | null}
          audioCaptureState={audioCaptureState}
          fileAudioState={fileAudioState}
        />
      </div>
    );
  }
);

