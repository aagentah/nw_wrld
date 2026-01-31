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

type UserData = Parameters<typeof SelectSetModal>[0]["userData"];
type ProjectorSettings = Parameters<typeof SettingsModal>[0]["settings"];
type PredefinedModules = Parameters<typeof AddModuleModal>[0]["predefinedModules"];

type DashboardModalLayerProps = {
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
  settings: ProjectorSettings;
  aspectRatio: string;
  setAspectRatio: (ratio: string) => void;
  bgColor: string;
  setBgColor: (color: string) => void;
  updateConfig: (updates: Record<string, unknown>) => void;
  workspacePath: string | null;
  onSelectWorkspace: () => void;

  predefinedModules: PredefinedModules;
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

  onDeleteChannel: (channelNumber: number) => void;
  workspaceModuleFiles: string[];
  workspaceModuleLoadFailures: string[];
  workspaceModuleSkipped: Array<{ file: string; reason: string }>;

  openAlertModal: (message: string) => void;
};

export const DashboardModalLayer = ({
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
  settings,
  aspectRatio,
  setAspectRatio,
  bgColor,
  setBgColor,
  updateConfig,
  workspacePath,
  onSelectWorkspace,
  predefinedModules,
  onCreateNewModule,
  onEditModule,
  editingModuleName,
  editingTemplateType,
  onCreateModule,
  debugLogs,
  perfStats,
  onDeleteChannel,
  workspaceModuleFiles,
  workspaceModuleLoadFailures,
  workspaceModuleSkipped,
  openAlertModal,
}: DashboardModalLayerProps) => {
  return (
    <>
      <CreateTrackModal
        inputConfig={inputConfig}
        onAlert={openAlertModal}
      />
      <CreateSetModal
        onAlert={openAlertModal}
      />
      <SelectTrackModal
        userData={userData}
        setUserData={setUserData}
        activeTrackId={activeTrackId}
        setActiveTrackId={setActiveTrackId}
        activeSetId={activeSetId}
        recordingData={recordingData}
        setRecordingData={setRecordingData}
      />
      <SelectSetModal
        userData={userData}
        setUserData={setUserData}
        activeTrackId={activeTrackId}
        setActiveTrackId={setActiveTrackId}
        activeSetId={activeSetId}
        setActiveSetId={setActiveSetId}
        recordingData={recordingData}
        setRecordingData={setRecordingData}
      />
      <SettingsModal
        aspectRatio={aspectRatio}
        setAspectRatio={setAspectRatio}
        bgColor={bgColor}
        setBgColor={setBgColor}
        settings={settings}
        inputConfig={inputConfig}
        setInputConfig={setInputConfig}
        availableMidiDevices={availableMidiDevices}
        config={userData?.config}
        updateConfig={updateConfig}
        workspacePath={workspacePath}
        onSelectWorkspace={onSelectWorkspace}
      />
      <InputMappingsModal />
      <ReleaseNotesModal />
      <AddModuleModal
        userData={userData}
        setUserData={setUserData}
        predefinedModules={predefinedModules}
        onCreateNewModule={onCreateNewModule}
        onEditModule={onEditModule}
        skippedWorkspaceModules={workspaceModuleSkipped}
      />
      <ModuleEditorModal
        moduleName={editingModuleName}
        templateType={editingTemplateType}
        onModuleSaved={null}
        predefinedModules={predefinedModules}
        workspacePath={workspacePath}
      />
      <NewModuleDialog
        onCreateModule={onCreateModule}
        workspacePath={workspacePath}
      />
      <DebugOverlayModal
        debugLogs={debugLogs}
        perfStats={perfStats}
      />
      <MethodConfiguratorModal
        predefinedModules={predefinedModules}
        onDeleteChannel={onDeleteChannel}
        workspacePath={workspacePath}
        workspaceModuleFiles={workspaceModuleFiles}
        workspaceModuleLoadFailures={workspaceModuleLoadFailures}
      />
      <EditChannelModal
        inputConfig={inputConfig}
        config={userData?.config}
      />
      <ConfirmationModal />
    </>
  );
};

