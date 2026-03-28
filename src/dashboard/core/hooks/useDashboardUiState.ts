import { useCallback, useState, type Dispatch, type SetStateAction } from "react";
import { updateActiveSet } from "../utils";

type Confirmation = { message: string; onConfirm?: () => void; type?: "confirm" | "alert" } | null;

type EditChannelModalState = { isOpen: boolean; trackIndex: number | null; channelNumber: number | null };

type UseDashboardUiStateArgs = {
  selectedChannel: unknown;
  setUserData: (
    updater:
      | ((prev: Record<string, unknown>) => Record<string, unknown>)
      | Record<string, unknown>
  ) => void;
  activeSetId: string | null;
};

export const useDashboardUiState = ({ selectedChannel, setUserData, activeSetId }: UseDashboardUiStateArgs) => {
  const [workspacePath, setWorkspacePath] = useState<string | null>(null);
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false);
  const [workspaceModalMode, setWorkspaceModalMode] = useState<"initial" | "lostSync">("initial");
  const [workspaceModalPath, setWorkspaceModalPath] = useState<string | null>(null);

  const [isModuleEditorOpen, setIsModuleEditorOpen] = useState(false);
  const [editingModuleName, setEditingModuleName] = useState<string | null>(null);
  const [editingTemplateType, setEditingTemplateType] = useState<"basic" | "threejs" | "p5js" | null>(
    null
  );
  const [isNewModuleDialogOpen, setIsNewModuleDialogOpen] = useState(false);

  const [isCreateTrackOpen, setIsCreateTrackOpen] = useState(false);
  const [isCreateSetOpen, setIsCreateSetOpen] = useState(false);
  const [isSelectTrackModalOpen, setIsSelectTrackModalOpen] = useState(false);
  const [isSelectSetModalOpen, setIsSelectSetModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isAddModuleModalOpen, setIsAddModuleModalOpen] = useState(false);
  const [isManageModulesModalOpen, setIsManageModulesModalOpen] = useState(false);
  const [isDebugOverlayOpen, setIsDebugOverlayOpen] = useState(false);
  const [isReleaseNotesOpen, setIsReleaseNotesOpen] = useState(false);
  const [isInputMappingsModalOpen, setIsInputMappingsModalOpen] = useState(false);

  const [selectedTrackForModuleMenu, setSelectedTrackForModuleMenu] = useState<number | null>(null);
  const [confirmationModal, setConfirmationModal] = useState<Confirmation>(null);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [isSequencerMuted, setIsSequencerMuted] = useState(false);
  const [isProjectorReady, setIsProjectorReady] = useState(false);
  const [perfStats, setPerfStats] = useState<{
    fps: number;
    frameMsAvg: number;
    longFramePct: number;
    at: number;
  } | null>(null);

  const [editChannelModalState, setEditChannelModalState] = useState<EditChannelModalState>({
    isOpen: false,
    trackIndex: null,
    channelNumber: null,
  });

  const handleCreateNewModule = () => {
    setIsNewModuleDialogOpen(true);
  };

  const handleCreateModule = (moduleName: string, templateType: string) => {
    setEditingModuleName(moduleName);
    setEditingTemplateType(templateType as unknown as "basic" | "threejs" | "p5js");
    setIsModuleEditorOpen(true);
  };

  const handleEditModule = (moduleName: string) => {
    setEditingModuleName(moduleName);
    setEditingTemplateType(null);
    setIsModuleEditorOpen(true);
  };

  const handleCloseModuleEditor = () => {
    setIsModuleEditorOpen(false);
    setEditingModuleName(null);
    setEditingTemplateType(null);
  };

  const openConfirmationModal = useCallback((message: string, onConfirm: () => void) => {
    setConfirmationModal({ message, onConfirm, type: "confirm" });
  }, []);

  const openAlertModal = useCallback((message: string) => {
    setConfirmationModal({ message, type: "alert" });
  }, []);

  const openAddModuleModal = useCallback((trackIndex: number) => {
    setSelectedTrackForModuleMenu(trackIndex);
    setIsAddModuleModalOpen(true);
  }, []);

  const handleEditChannel = useCallback(
    (channelNumber: number) => {
      if (!selectedChannel) return;
      setEditChannelModalState({
        isOpen: true,
        trackIndex: (selectedChannel as unknown as { trackIndex: number }).trackIndex,
        channelNumber,
      });
    },
    [selectedChannel]
  );

  const handleDeleteChannel = useCallback(
    (channelNumber: number) => {
      if (!selectedChannel) return;
      openConfirmationModal(`Are you sure you want to delete Channel ${channelNumber}?`, () => {
        updateActiveSet(setUserData, activeSetId, (activeSet) => {
          const tracks = (activeSet as unknown as { tracks: unknown[] }).tracks;
          const currentTrack = tracks[
            (selectedChannel as unknown as { trackIndex: number }).trackIndex
          ] as unknown as {
            channelMappings: Record<string, unknown>;
            modulesData: Record<string, { methods?: Record<string, unknown> }>;
          };
          const channelCount = Object.keys(currentTrack.channelMappings || {}).filter((k) => {
            const n = parseInt(k, 10);
            if (!Number.isFinite(n)) return false;
            if (n < 1 || n > 12) return false;
            return String(n) === k;
          }).length;
          if (channelCount <= 3) return;

          const channelKey = String(channelNumber);

          delete currentTrack.channelMappings[channelKey];

          Object.keys(currentTrack.modulesData).forEach((moduleId) => {
            if (currentTrack.modulesData[moduleId].methods) {
              delete currentTrack.modulesData[moduleId].methods[channelKey];
            }
          });
        });
      });
    },
    [selectedChannel, setUserData, openConfirmationModal, activeSetId]
  );

  return {
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
    isAddModuleModalOpen,
    setIsAddModuleModalOpen,
    isManageModulesModalOpen,
    setIsManageModulesModalOpen,
    isDebugOverlayOpen,
    setIsDebugOverlayOpen,
    isReleaseNotesOpen,
    setIsReleaseNotesOpen,
    isInputMappingsModalOpen,
    setIsInputMappingsModalOpen,

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
  } as {
    workspacePath: string | null;
    setWorkspacePath: Dispatch<SetStateAction<string | null>>;
    isWorkspaceModalOpen: boolean;
    setIsWorkspaceModalOpen: Dispatch<SetStateAction<boolean>>;
    workspaceModalMode: "initial" | "lostSync";
    setWorkspaceModalMode: Dispatch<SetStateAction<"initial" | "lostSync">>;
    workspaceModalPath: string | null;
    setWorkspaceModalPath: Dispatch<SetStateAction<string | null>>;

    isCreateTrackOpen: boolean;
    setIsCreateTrackOpen: Dispatch<SetStateAction<boolean>>;
    isCreateSetOpen: boolean;
    setIsCreateSetOpen: Dispatch<SetStateAction<boolean>>;
    isSelectTrackModalOpen: boolean;
    setIsSelectTrackModalOpen: Dispatch<SetStateAction<boolean>>;
    isSelectSetModalOpen: boolean;
    setIsSelectSetModalOpen: Dispatch<SetStateAction<boolean>>;
    isSettingsModalOpen: boolean;
    setIsSettingsModalOpen: Dispatch<SetStateAction<boolean>>;
    isAddModuleModalOpen: boolean;
    setIsAddModuleModalOpen: Dispatch<SetStateAction<boolean>>;
    isManageModulesModalOpen: boolean;
    setIsManageModulesModalOpen: Dispatch<SetStateAction<boolean>>;
    isDebugOverlayOpen: boolean;
    setIsDebugOverlayOpen: Dispatch<SetStateAction<boolean>>;
    isReleaseNotesOpen: boolean;
    setIsReleaseNotesOpen: Dispatch<SetStateAction<boolean>>;
    isInputMappingsModalOpen: boolean;
    setIsInputMappingsModalOpen: Dispatch<SetStateAction<boolean>>;

    selectedTrackForModuleMenu: number | null;
    setSelectedTrackForModuleMenu: Dispatch<SetStateAction<number | null>>;
    openAddModuleModal: (trackIndex: number) => void;

    handleCreateNewModule: () => void;
    handleCreateModule: (moduleName: string, templateType: string) => void;
    handleEditModule: (moduleName: string) => void;
    handleCloseModuleEditor: () => void;
    isModuleEditorOpen: boolean;
    editingModuleName: string | null;
    editingTemplateType: "basic" | "threejs" | "p5js" | null;
    isNewModuleDialogOpen: boolean;
    setIsNewModuleDialogOpen: Dispatch<SetStateAction<boolean>>;

    confirmationModal: Confirmation;
    setConfirmationModal: Dispatch<SetStateAction<Confirmation>>;
    openAlertModal: (message: string) => void;
    openConfirmationModal: (message: string, onConfirm: () => void) => void;

    debugLogs: string[];
    setDebugLogs: Dispatch<SetStateAction<string[]>>;
    isSequencerMuted: boolean;
    setIsSequencerMuted: Dispatch<SetStateAction<boolean>>;
    isProjectorReady: boolean;
    setIsProjectorReady: Dispatch<SetStateAction<boolean>>;
    perfStats: { fps: number; frameMsAvg: number; longFramePct: number; at: number } | null;
    setPerfStats: Dispatch<
      SetStateAction<{ fps: number; frameMsAvg: number; longFramePct: number; at: number } | null>
    >;

    editChannelModalState: EditChannelModalState;
    setEditChannelModalState: Dispatch<SetStateAction<EditChannelModalState>>;
    handleEditChannel: (channelNumber: number) => void;
    handleDeleteChannel: (channelNumber: number) => void;
  };
};

