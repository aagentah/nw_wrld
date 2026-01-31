import { CreateTrackModal } from "../modals/CreateTrackModal";
import { CreateSetModal } from "../modals/CreateSetModal";
import { SelectTrackModal } from "../modals/SelectTrackModal";
import { SelectSetModal } from "../modals/SelectSetModal";
import { SettingsModal } from "../modals/SettingsModal";
import { InputMappingsModal } from "../modals/InputMappingsModal";
import { ReleaseNotesModal } from "../modals/ReleaseNotesModal";
import { AddModuleModal } from "../modals/AddModuleModal";
import { DebugOverlayModal } from "../modals/DebugOverlayModal";
import { MethodConfiguratorModal } from "../modals/MethodConfiguratorModal";
import { EditChannelModal } from "../modals/EditChannelModal";
import { ConfirmationModal } from "../modals/ConfirmationModal";
import { ModuleEditorModal } from "./ModuleEditorModal";
import { NewModuleDialog } from "./NewModuleDialog";
import type { FileAudioState } from "../core/hooks/useDashboardFileAudio";

type Confirmation = { message: string; onConfirm?: () => void; type?: "confirm" | "alert" } | null;

type UserData = Parameters<typeof SelectSetModal>[0]["userData"];
type ProjectorSettings = Parameters<typeof SettingsModal>[0]["settings"];
type PredefinedModules = Parameters<typeof AddModuleModal>[0]["predefinedModules"];
type AudioCaptureState = Parameters<typeof SettingsModal>[0]["audioCaptureState"];

type DashboardModalLayerProps = {
  isCreateTrackOpen: boolean;
  setIsCreateTrackOpen: (next: boolean) => void;
  isCreateSetOpen: boolean;
  setIsCreateSetOpen: (next: boolean) => void;
  isSelectTrackModalOpen: boolean;
  setIsSelectTrackModalOpen: (next: boolean) => void;
  isSelectSetModalOpen: boolean;
  setIsSelectSetModalOpen: (next: boolean) => void;
  isSettingsModalOpen: boolean;
  setIsSettingsModalOpen: (next: boolean) => void;
  isInputMappingsModalOpen: boolean;
  setIsInputMappingsModalOpen: (next: boolean) => void;
  isReleaseNotesOpen: boolean;
  setIsReleaseNotesOpen: (next: boolean) => void;
  isAddModuleModalOpen: boolean;
  setIsAddModuleModalOpen: (next: boolean) => void;
  isManageModulesModalOpen: boolean;
  setIsManageModulesModalOpen: (next: boolean) => void;
  isDebugOverlayOpen: boolean;
  setIsDebugOverlayOpen: (next: boolean) => void;

  userData: UserData;
  setUserData: (
    updater: ((prev: Record<string, unknown>) => Record<string, unknown>) | Record<string, unknown>
  ) => void;
  recordingData: Record<string, unknown>;
  setRecordingData: (updater: ((prev: Record<string, unknown>) => Record<string, unknown>) | Record<string, unknown>) => void;
  activeTrackId: string | number | null;
  setActiveTrackId: (id: string | number | null) => void;
  activeSetId: string | null;
  setActiveSetId: (id: string | null) => void;

  inputConfig: Record<string, unknown>;
  setInputConfig: (config: Record<string, unknown>) => void;
  availableMidiDevices: Array<{ id: string; name: string }>;
  availableAudioDevices: Array<{ id: string; label: string }>;
  refreshAudioDevices: () => Promise<void>;
  audioCaptureState: AudioCaptureState;
  fileAudioState: FileAudioState;
  settings: ProjectorSettings;
  aspectRatio: string;
  setAspectRatio: (ratio: string) => void;
  bgColor: string;
  setBgColor: (color: string) => void;
  updateConfig: (updates: Record<string, unknown>) => void;
  workspacePath: string | null;
  onSelectWorkspace: () => void;

  predefinedModules: PredefinedModules;
  selectedTrackForModuleMenu: number | null;
  setSelectedTrackForModuleMenu: (next: number | null) => void;
  onCreateNewModule: () => void;
  onEditModule: (moduleName: string) => void;
  isModuleEditorOpen: boolean;
  onCloseModuleEditor: () => void;
  editingModuleName: string | null;
  editingTemplateType: "basic" | "threejs" | "p5js" | null;
  isNewModuleDialogOpen: boolean;
  onCloseNewModuleDialog: () => void;
  onCreateModule: (moduleName: string, templateType: string) => void;

  debugLogs: string[];
  perfStats: { fps: number; frameMsAvg: number; longFramePct: number; at: number } | null;

  selectedChannel: unknown;
  setSelectedChannel: (next: unknown) => void;
  onEditChannel: (channelNumber: number) => void;
  onDeleteChannel: (channelNumber: number) => void;
  workspaceModuleFiles: string[];
  workspaceModuleLoadFailures: string[];
  workspaceModuleSkipped: Array<{ file: string; reason: string }>;

  editChannelModalState: { isOpen: boolean; trackIndex: number | null; channelNumber: number | null };
  setEditChannelModalState: (next: {
    isOpen: boolean;
    trackIndex: number | null;
    channelNumber: number | null;
  }) => void;

  confirmationModal: Confirmation;
  setConfirmationModal: (next: Confirmation) => void;
  openAlertModal: (message: string) => void;
  openConfirmationModal: (message: string, onConfirm: () => void) => void;
};

export const DashboardModalLayer = ({
  isCreateTrackOpen,
  setIsCreateTrackOpen,
  isCreateSetOpen,
  setIsCreateSetOpen,
  isSelectTrackModalOpen,
  setIsSelectTrackModalOpen,
  isSelectSetModalOpen,
  setIsSelectSetModalOpen,
  isSettingsModalOpen,
  setIsSettingsModalOpen,
  isInputMappingsModalOpen,
  setIsInputMappingsModalOpen,
  isReleaseNotesOpen,
  setIsReleaseNotesOpen,
  isAddModuleModalOpen,
  setIsAddModuleModalOpen,
  isManageModulesModalOpen,
  setIsManageModulesModalOpen,
  isDebugOverlayOpen,
  setIsDebugOverlayOpen,
  userData,
  setUserData,
  recordingData,
  setRecordingData,
  activeTrackId,
  setActiveTrackId,
  activeSetId,
  setActiveSetId,
  inputConfig,
  setInputConfig,
  availableMidiDevices,
  availableAudioDevices,
  refreshAudioDevices,
  audioCaptureState,
  fileAudioState,
  settings,
  aspectRatio,
  setAspectRatio,
  bgColor,
  setBgColor,
  updateConfig,
  workspacePath,
  onSelectWorkspace,
  predefinedModules,
  selectedTrackForModuleMenu,
  setSelectedTrackForModuleMenu,
  onCreateNewModule,
  onEditModule,
  isModuleEditorOpen,
  onCloseModuleEditor,
  editingModuleName,
  editingTemplateType,
  isNewModuleDialogOpen,
  onCloseNewModuleDialog,
  onCreateModule,
  debugLogs,
  perfStats,
  selectedChannel,
  setSelectedChannel,
  onEditChannel,
  onDeleteChannel,
  workspaceModuleFiles,
  workspaceModuleLoadFailures,
  workspaceModuleSkipped,
  editChannelModalState,
  setEditChannelModalState,
  confirmationModal,
  setConfirmationModal,
  openAlertModal,
  openConfirmationModal,
}: DashboardModalLayerProps) => {
  return (
    <>
      <CreateTrackModal
        isOpen={isCreateTrackOpen}
        onClose={() => setIsCreateTrackOpen(false)}
        inputConfig={inputConfig}
        onAlert={openAlertModal}
      />
      <CreateSetModal
        isOpen={isCreateSetOpen}
        onClose={() => setIsCreateSetOpen(false)}
        onAlert={openAlertModal}
      />
      <SelectTrackModal
        isOpen={isSelectTrackModalOpen}
        onClose={() => setIsSelectTrackModalOpen(false)}
        userData={userData}
        setUserData={setUserData}
        activeTrackId={activeTrackId}
        setActiveTrackId={setActiveTrackId}
        activeSetId={activeSetId}
        recordingData={recordingData}
        setRecordingData={setRecordingData}
        onCreateTrack={() => {
          setIsSelectTrackModalOpen(false);
          setIsCreateTrackOpen(true);
        }}
        onConfirmDelete={openConfirmationModal}
      />
      <SelectSetModal
        isOpen={isSelectSetModalOpen}
        onClose={() => setIsSelectSetModalOpen(false)}
        userData={userData}
        setUserData={setUserData}
        activeTrackId={activeTrackId}
        setActiveTrackId={setActiveTrackId}
        activeSetId={activeSetId}
        setActiveSetId={setActiveSetId}
        recordingData={recordingData}
        setRecordingData={setRecordingData}
        onCreateSet={() => {
          setIsSelectSetModalOpen(false);
          setIsCreateSetOpen(true);
        }}
        onConfirmDelete={openConfirmationModal}
      />
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        aspectRatio={aspectRatio}
        setAspectRatio={setAspectRatio}
        bgColor={bgColor}
        setBgColor={setBgColor}
        settings={settings}
        inputConfig={inputConfig}
        setInputConfig={setInputConfig}
        availableMidiDevices={availableMidiDevices}
        availableAudioDevices={availableAudioDevices}
        refreshAudioDevices={refreshAudioDevices}
        audioCaptureState={audioCaptureState}
        fileAudioState={fileAudioState}
        onOpenMappings={() => {
          setIsSettingsModalOpen(false);
          setIsInputMappingsModalOpen(true);
        }}
        config={userData?.config}
        updateConfig={updateConfig}
        workspacePath={workspacePath}
        onSelectWorkspace={onSelectWorkspace}
      />
      <InputMappingsModal
        isOpen={isInputMappingsModalOpen}
        onClose={() => setIsInputMappingsModalOpen(false)}
      />
      <ReleaseNotesModal isOpen={isReleaseNotesOpen} onClose={() => setIsReleaseNotesOpen(false)} />
      <AddModuleModal
        isOpen={isAddModuleModalOpen}
        onClose={() => {
          setIsAddModuleModalOpen(false);
          setSelectedTrackForModuleMenu(null);
        }}
        trackIndex={selectedTrackForModuleMenu}
        userData={userData}
        setUserData={setUserData}
        predefinedModules={predefinedModules}
        onCreateNewModule={onCreateNewModule}
        onEditModule={onEditModule}
        skippedWorkspaceModules={workspaceModuleSkipped}
        mode="add-to-track"
      />
      <AddModuleModal
        isOpen={isManageModulesModalOpen}
        onClose={() => setIsManageModulesModalOpen(false)}
        trackIndex={null}
        userData={userData}
        setUserData={setUserData}
        predefinedModules={predefinedModules}
        onCreateNewModule={onCreateNewModule}
        onEditModule={onEditModule}
        skippedWorkspaceModules={workspaceModuleSkipped}
        mode="manage-modules"
      />
      <ModuleEditorModal
        isOpen={isModuleEditorOpen}
        onClose={onCloseModuleEditor}
        moduleName={editingModuleName}
        templateType={editingTemplateType}
        onModuleSaved={null}
        predefinedModules={predefinedModules}
        workspacePath={workspacePath}
      />
      <NewModuleDialog
        isOpen={isNewModuleDialogOpen}
        onClose={onCloseNewModuleDialog}
        onCreateModule={onCreateModule}
        workspacePath={workspacePath}
      />
      <DebugOverlayModal
        isOpen={isDebugOverlayOpen}
        onClose={() => setIsDebugOverlayOpen(false)}
        debugLogs={debugLogs}
        perfStats={perfStats}
      />
      <MethodConfiguratorModal
        isOpen={!!selectedChannel}
        onClose={() => setSelectedChannel(null)}
        predefinedModules={predefinedModules}
        onEditChannel={onEditChannel}
        onDeleteChannel={onDeleteChannel}
        workspacePath={workspacePath}
        workspaceModuleFiles={workspaceModuleFiles}
        workspaceModuleLoadFailures={workspaceModuleLoadFailures}
      />
      <EditChannelModal
        isOpen={editChannelModalState.isOpen}
        onClose={() =>
          setEditChannelModalState({
            isOpen: false,
            trackIndex: null,
            channelNumber: null,
          })
        }
        trackIndex={editChannelModalState.trackIndex}
        channelNumber={editChannelModalState.channelNumber}
        inputConfig={inputConfig}
        config={userData?.config}
      />
      <ConfirmationModal
        isOpen={!!confirmationModal}
        onClose={() => setConfirmationModal(null)}
        message={confirmationModal?.message || ""}
        onConfirm={confirmationModal?.onConfirm}
        type={confirmationModal?.type || "confirm"}
      />
    </>
  );
};

