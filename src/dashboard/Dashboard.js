import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createRoot } from "react-dom/client";
import { useAtom } from "jotai";
import { getActiveSetTracks } from "../shared/utils/setUtils";
import { useIPCSend, useIPCInvoke } from "./core/hooks/useIPC";
import { useLatestRef } from "./core/hooks/useLatestRef";
import {
  userDataAtom,
  recordingDataAtom,
  activeTrackIdAtom,
  activeSetIdAtom,
  selectedChannelAtom,
  flashingConstructorsAtom,
  recordingStateAtom,
  useFlashingChannels,
} from "./core/state";
import { DashboardHeader } from "./components/DashboardHeader";
import { DashboardFooter } from "./components/DashboardFooter";
import { DashboardBody } from "./components/DashboardBody";
import { DashboardModalLayer } from "./components/DashboardModalLayer";
import { WorkspaceGateModal } from "./components/WorkspaceGateModal";
import { useWorkspaceModules } from "./core/hooks/useWorkspaceModules";
import { useInputEvents } from "./core/hooks/useInputEvents";
import { useModuleIntrospection } from "./core/hooks/useModuleIntrospection";
import { useProjectorPerfStats } from "./core/hooks/useProjectorPerfStats";
import { useDashboardPlayback } from "./core/hooks/useDashboardPlayback";
import { useDashboardBootstrap } from "./core/hooks/useDashboardBootstrap";
import { useDashboardPersistence } from "./core/hooks/useDashboardPersistence";
import { useDashboardUiState } from "./core/hooks/useDashboardUiState";
import { useDashboardProjectorSettings } from "./core/hooks/useDashboardProjectorSettings";
import { useDashboardInputConfiguration } from "./core/hooks/useDashboardInputConfiguration";
import { useWorkspaceModuleIntrospectionDrain } from "./core/hooks/useWorkspaceModuleIntrospectionDrain";
import { useDashboardUpdateConfig } from "./core/hooks/useDashboardUpdateConfig";
import { useDashboardAudioDevices } from "./core/hooks/useDashboardAudioDevices";
import { useDashboardAudioCapture } from "./core/hooks/useDashboardAudioCapture";
import { useDashboardFileAudio } from "./core/hooks/useDashboardFileAudio";
import ErrorBoundary from "./components/ErrorBoundary";

const Dashboard = () => {
  const [userData, setUserData] = useAtom(userDataAtom);
  const [recordingData, setRecordingData] = useAtom(recordingDataAtom);
  const [activeTrackId, setActiveTrackId] = useAtom(activeTrackIdAtom);
  const [activeSetId, setActiveSetId] = useAtom(activeSetIdAtom);
  const [predefinedModules, setPredefinedModules] = useState([]);
  const [selectedChannel, setSelectedChannel] = useAtom(selectedChannelAtom);
  const [, flashChannel] = useFlashingChannels();
  const [, setFlashingConstructors] = useAtom(flashingConstructorsAtom);

  const sendToProjector = useIPCSend("dashboard-to-projector");
  const invokeIPC = useIPCInvoke();

  const {
    workspacePath,
    setWorkspacePath,
    isWorkspaceModalOpen,
    setIsWorkspaceModalOpen,
    workspaceModalMode,
    setWorkspaceModalMode,
    workspaceModalPath,
    setWorkspaceModalPath,
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
    selectedTrackForModuleMenu,
    setSelectedTrackForModuleMenu,
    openAddModuleModal,
    handleCreateNewModule,
    handleCreateModule,
    handleEditModule,
    handleCloseModuleEditor,
    isModuleEditorOpen,
    editingModuleName,
    editingTemplateType,
    isNewModuleDialogOpen,
    setIsNewModuleDialogOpen,
    confirmationModal,
    setConfirmationModal,
    openAlertModal,
    openConfirmationModal,
    debugLogs,
    setDebugLogs,
    isSequencerMuted,
    setIsSequencerMuted,
    isProjectorReady,
    setIsProjectorReady,
    perfStats,
    setPerfStats,
    editChannelModalState,
    setEditChannelModalState,
    handleEditChannel,
    handleDeleteChannel,
  } = useDashboardUiState({ selectedChannel, setUserData, activeSetId });

  const userDataRef = useLatestRef(userData);
  const recordingDataRef = useLatestRef(recordingData);

  const activeTrackIdRef = useRef(activeTrackId);
  const activeSetIdRef = useRef(activeSetId);
  const workspacePathRef = useRef(null);
  useEffect(() => {
    activeTrackIdRef.current = activeTrackId;
    activeSetIdRef.current = activeSetId;
    workspacePathRef.current = workspacePath;
  }, [activeTrackId, activeSetId, workspacePath]);

  // Recording state management
  const [recordingState, setRecordingState] = useAtom(recordingStateAtom);
  const recordingStateRef = useLatestRef(recordingState);
  const triggerMapsRef = useRef({ trackTriggersMap: {}, channelMappings: {} });

  const isInitialMount = useRef(true);
  const userDataLoadedSuccessfully = useRef(false);

  const [inputConfig, setInputConfig] = useState({
    type: "midi",
    deviceName: "IAC Driver Bus 1",
    trackSelectionChannel: 1,
    methodTriggerChannel: 2,
    velocitySensitive: false,
    port: 8000,
  });
  const [inputStatus, setInputStatus] = useState({
    status: "disconnected",
    message: "",
  });
  const [workspaceModuleFiles, setWorkspaceModuleFiles] = useState([]);
  const [workspaceModuleLoadFailures, setWorkspaceModuleLoadFailures] = useState([]);
  const [workspaceModuleSkipped, setWorkspaceModuleSkipped] = useState([]);
  const didMigrateWorkspaceModuleTypesRef = useRef(false);
  const loadModulesRunIdRef = useRef(0);
  const sequencerMutedRef = useLatestRef(isSequencerMuted);
  const { aspectRatio, setAspectRatio, bgColor, setBgColor, settings, availableMidiDevices } =
    useDashboardProjectorSettings({
      userData,
      setUserData,
      invokeIPC,
      sendToProjector,
    });

  const isAudioMode = inputConfig?.type === "audio" && userData?.config?.sequencerMode !== true;
  const isFileMode = inputConfig?.type === "file" && userData?.config?.sequencerMode !== true;
  const { devices: availableAudioDevices, refresh: refreshAudioDevices } = useDashboardAudioDevices(
    Boolean(isAudioMode)
  );
  const emitAudioBand = useCallback(
    async (payload) => invokeIPC("input:audio:emitBand", payload),
    [invokeIPC]
  );
  const emitFileBand = useCallback(
    async (payload) => invokeIPC("input:file:emitBand", payload),
    [invokeIPC]
  );
  const audioCaptureState = useDashboardAudioCapture({
    enabled: Boolean(isAudioMode),
    deviceId:
      typeof inputConfig?.deviceId === "string" && inputConfig.deviceId ? inputConfig.deviceId : null,
    emitBand: emitAudioBand,
    thresholds:
      inputConfig && typeof inputConfig === "object" ? inputConfig.audioThresholds || null : null,
    minIntervalMs:
      inputConfig && typeof inputConfig === "object" ? inputConfig.audioMinIntervalMs ?? null : null,
  });

  const fileAudio = useDashboardFileAudio({
    enabled: Boolean(isFileMode),
    assetRelPath:
      inputConfig && typeof inputConfig === "object" && typeof inputConfig.fileAssetRelPath === "string" && inputConfig.fileAssetRelPath
        ? inputConfig.fileAssetRelPath
        : null,
    emitBand: emitFileBand,
    thresholds:
      inputConfig && typeof inputConfig === "object" ? inputConfig.fileThresholds || null : null,
    minIntervalMs:
      inputConfig && typeof inputConfig === "object" ? inputConfig.fileMinIntervalMs ?? null : null,
  });

  const fileAudioIsPlayingRef = useRef(false);
  const fileAudioPlayRef = useRef(() => Promise.resolve());
  const fileAudioStopRef = useRef(() => Promise.resolve());

  useEffect(() => {
    fileAudioIsPlayingRef.current = Boolean(fileAudio.isPlaying);
    fileAudioPlayRef.current = () => fileAudio.play();
    fileAudioStopRef.current = () => fileAudio.stop();
  }, [fileAudio]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code !== "Space") return;
      if (!isFileMode) return;

      const target = e.target;
      const isTyping =
        (target && target.tagName === "INPUT") ||
        (target && target.tagName === "TEXTAREA") ||
        (target && target.isContentEditable);
      if (isTyping) return;

      e.preventDefault();
      if (fileAudioIsPlayingRef.current) {
        fileAudioStopRef.current().catch(() => {});
      } else {
        fileAudioPlayRef.current().catch(() => {});
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFileMode]);

  useInputEvents({
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
  });

  useDashboardInputConfiguration({ userData, setUserData, invokeIPC, inputConfig });

  useDashboardPersistence({
    isInitialMountRef: isInitialMount,
    userDataLoadedSuccessfullyRef: userDataLoadedSuccessfully,
    userData,
    recordingData,
    activeTrackId,
    activeSetId,
    userDataRef,
    recordingDataRef,
    activeTrackIdRef,
    activeSetIdRef,
    workspacePathRef,
    sequencerMutedRef,
    sendToProjector,
    isSequencerMuted,
  });

  useModuleIntrospection({
    activeSetId,
    setUserData,
    setPredefinedModules,
    setWorkspaceModuleLoadFailures,
  });
  useProjectorPerfStats(setPerfStats);

  useWorkspaceModules({
    workspacePath,
    isWorkspaceModalOpen,
    sendToProjector,
    userData,
    setUserData,
    predefinedModules,
    workspaceModuleFiles,
    setPredefinedModules,
    setWorkspaceModuleFiles,
    setWorkspaceModuleLoadFailures,
    setWorkspaceModuleSkipped,
    setIsProjectorReady,
    didMigrateWorkspaceModuleTypesRef,
    loadModulesRunIdRef,
  });

  useWorkspaceModuleIntrospectionDrain({
    workspacePath,
    isProjectorReady,
    workspaceModuleLoadFailures,
    workspaceModuleFiles,
    sendToProjector,
  });

  useDashboardBootstrap({
    isInitialMountRef: isInitialMount,
    userDataLoadedSuccessfullyRef: userDataLoadedSuccessfully,
    workspacePathRef,
    setUserData,
    setRecordingData,
    setActiveTrackId,
    setActiveSetId,
    setInputConfig,
    setIsSequencerMuted,
    setWorkspacePath,
    setWorkspaceModalMode,
    setWorkspaceModalPath,
    setIsWorkspaceModalOpen,
  });

  const handleSelectWorkspace = useCallback(async () => {
    await invokeIPC("workspace:select");
  }, [invokeIPC]);

  const firstVisibleTrack = useMemo(() => {
    if (!activeTrackId) return null;
    const tracks = getActiveSetTracks(userData, activeSetId);
    const track = tracks.find((t) => t.id === activeTrackId);
    if (!track) return null;
    const trackIndex = tracks.findIndex((t) => t.id === activeTrackId);
    return { track, trackIndex };
  }, [activeTrackId, userData, activeSetId]);

  const {
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
  } = useDashboardPlayback({
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
    isInitialMountRef: isInitialMount,
  });

  const updateConfig = useDashboardUpdateConfig({
    setUserData,
    userDataConfig: userData.config,
    isSequencerPlaying,
    sequencerEngineRef,
    sequencerRunIdRef,
    setIsSequencerPlaying,
    setSequencerCurrentStep,
  });

  return (
    <div className="relative bg-[#101010] font-mono h-screen flex flex-col">
      <DashboardHeader
        onSets={() => setIsSelectSetModalOpen(true)}
        onTracks={() => setIsSelectTrackModalOpen(true)}
        onModules={() => setIsManageModulesModalOpen(true)}
        onSettings={() => setIsSettingsModalOpen(true)}
        onDebugOverlay={() => setIsDebugOverlayOpen(true)}
        onReleases={() => setIsReleaseNotesOpen(true)}
      />

      <div className="flex-1 overflow-y-auto pt-12 pb-32">
        <div className="bg-[#101010] p-6 font-mono">
          <DashboardBody
            userData={userData}
            activeSetId={activeSetId}
            activeTrackId={activeTrackId}
            predefinedModules={predefinedModules}
            openAddModuleModal={openAddModuleModal}
            openConfirmationModal={openConfirmationModal}
            setActiveTrackId={setActiveTrackId}
            inputConfig={inputConfig}
            config={userData.config}
            isSequencerPlaying={isSequencerPlaying}
            sequencerCurrentStep={sequencerCurrentStep}
            handleSequencerToggle={handleSequencerToggle}
            workspacePath={workspacePath}
            workspaceModuleFiles={workspaceModuleFiles}
            workspaceModuleLoadFailures={workspaceModuleLoadFailures}
          />
        </div>
      </div>

      <DashboardFooter
        track={firstVisibleTrack?.track || null}
        isPlaying={
          userData.config.sequencerMode
            ? isSequencerPlaying
            : inputConfig?.type === "file"
              ? fileAudio.isPlaying
              : firstVisibleTrack
                ? footerPlaybackState[firstVisibleTrack.track.id] || false
                : false
        }
        onPlayPause={
          userData.config.sequencerMode
            ? handleFooterPlayPause
            : inputConfig?.type === "file"
              ? fileAudio.play
              : handleFooterPlayPause
        }
        onStop={
          userData.config.sequencerMode
            ? handleFooterStop
            : inputConfig?.type === "file"
              ? fileAudio.stop
              : handleFooterStop
        }
        inputStatus={inputStatus}
        inputConfig={inputConfig}
        config={userData.config}
        onSettingsClick={() => setIsSettingsModalOpen(true)}
        isMuted={isSequencerMuted}
        onMuteChange={setIsSequencerMuted}
        isProjectorReady={isProjectorReady}
      />

      <DashboardModalLayer
        isCreateTrackOpen={isCreateTrackOpen}
        setIsCreateTrackOpen={setIsCreateTrackOpen}
        isCreateSetOpen={isCreateSetOpen}
        setIsCreateSetOpen={setIsCreateSetOpen}
        isSelectTrackModalOpen={isSelectTrackModalOpen}
        setIsSelectTrackModalOpen={setIsSelectTrackModalOpen}
        isSelectSetModalOpen={isSelectSetModalOpen}
        setIsSelectSetModalOpen={setIsSelectSetModalOpen}
        isSettingsModalOpen={isSettingsModalOpen}
        setIsSettingsModalOpen={setIsSettingsModalOpen}
        isInputMappingsModalOpen={isInputMappingsModalOpen}
        setIsInputMappingsModalOpen={setIsInputMappingsModalOpen}
        isReleaseNotesOpen={isReleaseNotesOpen}
        setIsReleaseNotesOpen={setIsReleaseNotesOpen}
        isAddModuleModalOpen={isAddModuleModalOpen}
        setIsAddModuleModalOpen={setIsAddModuleModalOpen}
        isManageModulesModalOpen={isManageModulesModalOpen}
        setIsManageModulesModalOpen={setIsManageModulesModalOpen}
        isDebugOverlayOpen={isDebugOverlayOpen}
        setIsDebugOverlayOpen={setIsDebugOverlayOpen}
        userData={userData}
        setUserData={setUserData}
        recordingData={recordingData}
        setRecordingData={setRecordingData}
        activeTrackId={activeTrackId}
        setActiveTrackId={setActiveTrackId}
        activeSetId={activeSetId}
        setActiveSetId={setActiveSetId}
        inputConfig={inputConfig}
        setInputConfig={setInputConfig}
        availableMidiDevices={availableMidiDevices}
        availableAudioDevices={availableAudioDevices}
        refreshAudioDevices={refreshAudioDevices}
        audioCaptureState={audioCaptureState}
        fileAudioState={fileAudio.state}
        settings={settings}
        aspectRatio={aspectRatio}
        setAspectRatio={setAspectRatio}
        bgColor={bgColor}
        setBgColor={setBgColor}
        updateConfig={updateConfig}
        workspacePath={workspacePath}
        onSelectWorkspace={handleSelectWorkspace}
        predefinedModules={predefinedModules}
        selectedTrackForModuleMenu={selectedTrackForModuleMenu}
        setSelectedTrackForModuleMenu={setSelectedTrackForModuleMenu}
        onCreateNewModule={handleCreateNewModule}
        onEditModule={handleEditModule}
        isModuleEditorOpen={isModuleEditorOpen}
        onCloseModuleEditor={handleCloseModuleEditor}
        editingModuleName={editingModuleName}
        editingTemplateType={editingTemplateType}
        isNewModuleDialogOpen={isNewModuleDialogOpen}
        onCloseNewModuleDialog={() => setIsNewModuleDialogOpen(false)}
        onCreateModule={handleCreateModule}
        debugLogs={debugLogs}
        perfStats={perfStats}
        selectedChannel={selectedChannel}
        setSelectedChannel={setSelectedChannel}
        onEditChannel={handleEditChannel}
        onDeleteChannel={handleDeleteChannel}
        workspaceModuleFiles={workspaceModuleFiles}
        workspaceModuleLoadFailures={workspaceModuleLoadFailures}
        workspaceModuleSkipped={workspaceModuleSkipped}
        editChannelModalState={editChannelModalState}
        setEditChannelModalState={setEditChannelModalState}
        confirmationModal={confirmationModal}
        setConfirmationModal={setConfirmationModal}
        openAlertModal={openAlertModal}
        openConfirmationModal={openConfirmationModal}
      />

      <WorkspaceGateModal
        isOpen={isWorkspaceModalOpen}
        mode={workspaceModalMode}
        workspacePath={workspacePath}
        workspaceModalPath={workspaceModalPath}
        onSelectWorkspace={handleSelectWorkspace}
      />
    </div>
  );
};

const rootElement = document.getElementById("dashboard") || document.getElementById("root");
if (rootElement) {
  createRoot(rootElement).render(
    <ErrorBoundary>
      <Dashboard />
    </ErrorBoundary>
  );
}

export default Dashboard;
