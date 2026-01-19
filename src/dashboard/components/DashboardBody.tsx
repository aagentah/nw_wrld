import { getActiveSetTracks } from "../../shared/utils/setUtils";
import { TrackItem } from "./track/TrackItem";

type DashboardBodyProps = {
  userData: unknown;
  activeSetId: unknown;
  activeTrackId: string | number | null;
  predefinedModules: unknown[];
  openAddModuleModal: (trackIndex: number) => void;
  openConfirmationModal: (message: string, onConfirm: () => void) => void;
  setActiveTrackId: (id: string | number | null) => void;
  inputConfig: unknown;
  config: Record<string, unknown> | null;
  isSequencerPlaying: boolean;
  sequencerCurrentStep: number;
  handleSequencerToggle: (channelName: string, stepIndex: number) => void;
  workspacePath: string | null;
  workspaceModuleFiles: string[];
  workspaceModuleLoadFailures: string[];
};

export const DashboardBody = ({
  userData,
  activeSetId,
  activeTrackId,
  predefinedModules,
  openAddModuleModal,
  openConfirmationModal,
  setActiveTrackId,
  inputConfig,
  config,
  isSequencerPlaying,
  sequencerCurrentStep,
  handleSequencerToggle,
  workspacePath,
  workspaceModuleFiles,
  workspaceModuleLoadFailures,
}: DashboardBodyProps) => {
  const tracks = getActiveSetTracks(userData, activeSetId);
  const hasActiveTrack = activeTrackId && tracks.find((t) => t.id === activeTrackId);

  if (!activeTrackId || !hasActiveTrack) {
    return <div className="text-neutral-300/30 text-[11px]">No tracks to display.</div>;
  }

  return (
    <div className="flex flex-col gap-8 px-8">
      {tracks
        .filter((track) => track.id === activeTrackId)
        .map((track) => {
          const trackIndex = tracks.findIndex((t) => t.id === track.id);
          return (
            <TrackItem
              key={track.id}
              track={track}
              trackIndex={trackIndex}
              predefinedModules={predefinedModules}
              openRightMenu={openAddModuleModal}
              onConfirmDelete={openConfirmationModal}
              setActiveTrackId={setActiveTrackId}
              inputConfig={inputConfig}
              config={config}
              isSequencerPlaying={isSequencerPlaying}
              sequencerCurrentStep={sequencerCurrentStep}
              handleSequencerToggle={handleSequencerToggle}
              workspacePath={workspacePath}
              workspaceModuleFiles={workspaceModuleFiles}
              workspaceModuleLoadFailures={workspaceModuleLoadFailures}
            />
          );
        })}
    </div>
  );
};

