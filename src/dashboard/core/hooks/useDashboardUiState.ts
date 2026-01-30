import { useCallback, useState, type Dispatch, type SetStateAction } from "react";
import { updateActiveSet } from "../utils";
import { useAtomValue, useSetAtom } from "jotai";
import { confirmationModalAtom } from "../modalAtoms";
import { selectedChannelAtom } from "../state";

type UseDashboardUiStateArgs = {
  setUserData: (
    updater:
      | ((prev: Record<string, unknown>) => Record<string, unknown>)
      | Record<string, unknown>
  ) => void;
  activeSetId: string | null;
};

export const useDashboardUiState = ({ setUserData, activeSetId }: UseDashboardUiStateArgs) => {
  const [workspacePath, setWorkspacePath] = useState<string | null>(null);
  const [workspaceModalMode, setWorkspaceModalMode] = useState<"initial" | "lostSync">("initial");
  const [workspaceModalPath, setWorkspaceModalPath] = useState<string | null>(null);
  
  const [isModuleEditorOpen, setIsModuleEditorOpen] = useState(false);
  const [editingModuleName, setEditingModuleName] = useState<string | null>(null);
  const [editingTemplateType, setEditingTemplateType] = useState<"basic" | "threejs" | "p5js" | null>(
    null
  );
  const [isNewModuleDialogOpen, setIsNewModuleDialogOpen] = useState(false);
  
  const selectedChannel = useAtomValue(selectedChannelAtom)
  const setConfirmationModal = useSetAtom(confirmationModalAtom)
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [isSequencerMuted, setIsSequencerMuted] = useState(false);
  const [isProjectorReady, setIsProjectorReady] = useState(false);
  const [perfStats, setPerfStats] = useState<{
    fps: number;
    frameMsAvg: number;
    longFramePct: number;
    at: number;
  } | null>(null);

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

  const openAlertModal = useCallback((message: string) => {
    setConfirmationModal({ message, type: "alert" });
  }, []);

  

  const handleDeleteChannel = useCallback(
    (channelNumber: number) => {
      if (!selectedChannel) return;
      const onConfirm = () => {
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
      }
      setConfirmationModal({ message: `Are you sure you want to delete Channel ${channelNumber}?`, onConfirm, type: "confirm" });
    },
    [selectedChannel, setUserData, setConfirmationModal, activeSetId]
  );

  return {
    workspacePath,
    setWorkspacePath,
    workspaceModalMode,
    setWorkspaceModalMode,
    workspaceModalPath,
    setWorkspaceModalPath,

    handleCreateNewModule,
    handleCreateModule,
    handleEditModule,
    handleCloseModuleEditor,
    isModuleEditorOpen,
    editingModuleName,
    editingTemplateType,
    isNewModuleDialogOpen,
    setIsNewModuleDialogOpen,

    openAlertModal,

    debugLogs,
    setDebugLogs,
    isSequencerMuted,
    setIsSequencerMuted,
    isProjectorReady,
    setIsProjectorReady,
    perfStats,
    setPerfStats,

    handleDeleteChannel,
  } as {
    workspacePath: string | null;
    setWorkspacePath: Dispatch<SetStateAction<string | null>>;
    workspaceModalMode: "initial" | "lostSync";
    setWorkspaceModalMode: Dispatch<SetStateAction<"initial" | "lostSync">>;
    workspaceModalPath: string | null;
    setWorkspaceModalPath: Dispatch<SetStateAction<string | null>>;

    handleCreateNewModule: () => void;
    handleCreateModule: (moduleName: string, templateType: string) => void;
    handleEditModule: (moduleName: string) => void;
    handleCloseModuleEditor: () => void;
    isModuleEditorOpen: boolean;
    editingModuleName: string | null;
    editingTemplateType: "basic" | "threejs" | "p5js" | null;
    isNewModuleDialogOpen: boolean;
    setIsNewModuleDialogOpen: Dispatch<SetStateAction<boolean>>;

    openAlertModal: (message: string) => void;

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

    handleDeleteChannel: (channelNumber: number) => void;
  };
};

