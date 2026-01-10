// Dashboard.tsx
import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { createRoot } from "react-dom/client";
import { useAtom } from "jotai";
import { produce } from "immer";
import * as Tone from "tone";
import { loadSettings } from "../shared/json/configUtils";
import {
  loadRecordingData,
  saveRecordingData,
  saveRecordingDataSync,
  getRecordingForTrack,
  setRecordingForTrack,
  getSequencerForTrack,
  setSequencerForTrack,
} from "../shared/json/recordingUtils";
import {
  loadAppState,
  loadAppStateSync,
  saveAppState,
  saveAppStateSync,
} from "../shared/json/appStateUtils";
import MidiPlayback from "../shared/midi/midiPlayback";
import SequencerPlayback from "../shared/sequencer/SequencerPlayback";
import SequencerAudio from "../shared/audio/sequencerAudio";
import { getActiveSetTracks } from "../shared/utils/setUtils";
import { Button } from "./components/Button";
import { ModalHeader } from "./components/ModalHeader";
import { ModalFooter } from "./components/ModalFooter";
import { ModuleEditorModal } from "./components/ModuleEditorModal";
import { NewModuleDialog } from "./components/NewModuleDialog";
import {
  loadUserData,
  saveUserData,
  saveUserDataSync,
  updateUserData,
  updateActiveSet,
} from "./core/utils";
import {
  useIPCSend,
  useIPCListener,
  useIPCInvoke,
} from "./core/hooks/useIPC";
import {
  userDataAtom,
  recordingDataAtom,
  activeTrackIdAtom,
  activeSetIdAtom,
  selectedChannelAtom,
  flashingChannelsAtom,
  flashingConstructorsAtom,
  recordingStateAtom,
  useFlashingChannels,
  type UserData,
} from "./core/state";
import type { Recordings } from "../shared/json/recordingUtils";
import { Modal } from "./shared/Modal";
import { ConfirmationModal } from "./modals/ConfirmationModal";
import { DebugOverlayModal } from "./modals/DebugOverlayModal";
import { EditSetModal } from "./modals/EditSetModal";
import { CreateSetModal } from "./modals/CreateSetModal";
import { CreateTrackModal } from "./modals/CreateTrackModal";
import { EditTrackModal } from "./modals/EditTrackModal";
import { EditChannelModal } from "./modals/EditChannelModal";
import { AddModuleModal } from "./modals/AddModuleModal";
import { SettingsModal } from "./modals/SettingsModal";
import { InputMappingsModal } from "./modals/InputMappingsModal";
import { SelectSetModal } from "./modals/SelectSetModal";
import { SelectTrackModal } from "./modals/SelectTrackModal";
import { MethodConfiguratorModal } from "./modals/MethodConfiguratorModal";
import { TrackItem } from "./components/track/TrackItem";
import { DashboardHeader } from "./components/DashboardHeader";
import { DashboardFooter } from "./components/DashboardFooter";
import { useWorkspaceModules } from "./core/hooks/useWorkspaceModules";
import { useInputEvents } from "./core/hooks/useInputEvents";
import ErrorBoundary from "./components/ErrorBoundary";
import { getProjectDir } from "../shared/utils/projectDir";
import type {
  InputConfig,
  UserConfig,
  Track,
} from "../types";

// =========================
// Type Definitions
// =========================

export interface InputStatus {
  status: string;
  message: string;
  config?: InputConfig;
}

export interface Settings {
  aspectRatios: unknown[];
  backgroundColors: unknown[];
  input?: InputConfig;
  autoRefresh?: boolean;
}

export interface PredefinedModule {
  id: string;
  name?: string;
  methods?: unknown[];
  status?: string;
}

export interface EditChannelModalState {
  isOpen: boolean;
  trackIndex: number | null;
  channelNumber: number | null;
}

export interface ConfirmationModalState {
  message: string;
  onConfirm?: () => void;
  type: "confirm" | "alert";
}

export interface WorkspaceModalProps {
  isOpen: boolean;
  mode: "initial" | "lostSync";
  path: string | null;
}

export interface FooterPlaybackEngineRef {
  [trackId: string]: MidiPlayback | null;
}

// =========================
// Components
// =========================

const Dashboard = () => {
  const [userData, setUserData] = useAtom(userDataAtom);
  const [recordingData, setRecordingData] = useAtom(recordingDataAtom);
  const [activeTrackId, setActiveTrackId] = useAtom(activeTrackIdAtom);
  const [activeSetId, setActiveSetId] = useAtom(activeSetIdAtom);
  const [predefinedModules, setPredefinedModules] = useState<PredefinedModule[]>([]);
  const [selectedChannel, setSelectedChannel] = useAtom(selectedChannelAtom);
  const [selectedTrackForModuleMenu, setSelectedTrackForModuleMenu] =
    useState<number | null>(null);
  const [flashingChannels, flashChannel] = useFlashingChannels();
  const [flashingConstructors, setFlashingConstructors] = useAtom(
    flashingConstructorsAtom
  );

  const sendToProjector = useIPCSend("dashboard-to-projector");
  const invokeIPC = useIPCInvoke();

  // Module editor states
  const [isModuleEditorOpen, setIsModuleEditorOpen] = useState(false);
  const [editingModuleName, setEditingModuleName] = useState<string | null>(null);
  const [editingTemplateType, setEditingTemplateType] = useState<string | null>(null);
  const [isNewModuleDialogOpen, setIsNewModuleDialogOpen] = useState(false);

  const userDataRef = useRef(userData);
  useEffect(() => {
    userDataRef.current = userData;
  }, [userData]);

  const recordingDataRef = useRef(recordingData);
  useEffect(() => {
    recordingDataRef.current = recordingData;
  }, [recordingData]);

  const activeTrackIdRef = useRef(activeTrackId);
  const activeSetIdRef = useRef(activeSetId);
  useEffect(() => {
    activeTrackIdRef.current = activeTrackId;
    activeSetIdRef.current = activeSetId;
  }, [activeTrackId, activeSetId]);

  // Recording state management
  const [recordingState, setRecordingState] = useAtom(recordingStateAtom);
  const recordingStateRef = useRef(recordingState);
  useEffect(() => {
    recordingStateRef.current = recordingState;
  }, [recordingState]);
  const triggerMapsRef = useRef<{
    trackTriggersMap: Record<string | number, string>;
    channelTriggersMap: Record<string, unknown>;
  }>({ trackTriggersMap: {}, channelTriggersMap: {} });

  // Track pending save timeouts for cancellation
  const userDataSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const recordingDataSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isInitialMount.current) {
      return;
    }

    if (!userDataLoadedSuccessfully.current) {
      return;
    }

    const debouncedSave = setTimeout(async () => {
      await saveUserData(userData);
      userDataSaveTimeoutRef.current = null;

      const tracks = getActiveSetTracks(userData, activeSetId);
      const track = tracks.find((t) => t.id === activeTrackId);

      sendToProjector("reload-data", {
        setId: activeSetId,
        trackName: track?.name || null,
      });
    }, 500);
    userDataSaveTimeoutRef.current = debouncedSave;
    return () => clearTimeout(debouncedSave);
  }, [userData, activeSetId, activeTrackId, sendToProjector]);

  useEffect(() => {
    if (isInitialMount.current) {
      return;
    }

    const debouncedSave = setTimeout(async () => {
      await saveRecordingData(recordingData);
      recordingDataSaveTimeoutRef.current = null;
    }, 500);
    recordingDataSaveTimeoutRef.current = debouncedSave;
    return () => clearTimeout(debouncedSave);
  }, [recordingData]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      try {
        if (isInitialMount.current) {
          return;
        }

        // Cancel any pending async saves
        if (userDataSaveTimeoutRef.current) {
          clearTimeout(userDataSaveTimeoutRef.current);
          userDataSaveTimeoutRef.current = null;
        }
        if (recordingDataSaveTimeoutRef.current) {
          clearTimeout(recordingDataSaveTimeoutRef.current);
          recordingDataSaveTimeoutRef.current = null;
        }

        // Now do sync saves with latest state
        saveUserDataSync(userDataRef.current);
        saveRecordingDataSync(recordingDataRef.current);
        const currentAppState = loadAppStateSync();
        const appStateToSave = {
          ...currentAppState,
          activeTrackId: activeTrackIdRef.current,
          activeSetId: activeSetIdRef.current,
          sequencerMuted: sequencerMutedRef.current,
          workspacePath: workspacePathRef.current,
        };
        saveAppStateSync(appStateToSave);
      } catch (e) {
        console.error("Failed to persist data on unload:", e);
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  const [aspectRatio, setAspectRatio] = useState("default");
  const [bgColor, setBgColor] = useState("grey");
  const [inputConfig, setInputConfig] = useState<InputConfig>({
    type: "midi",
    deviceName: "",
    trackSelectionChannel: 1,
    methodTriggerChannel: 2,
    velocitySensitive: false,
    port: 8000,
  });
  const [availableMidiDevices, setAvailableMidiDevices] = useState<string[]>([]);
  const [inputStatus, setInputStatus] = useState<InputStatus>({
    status: "disconnected",
    message: "",
  });
  const [settings, setSettings] = useState<Settings>({
    aspectRatios: [],
    backgroundColors: [],
  });
  const [isCreateTrackOpen, setIsCreateTrackOpen] = useState(false);
  const [isCreateSetOpen, setIsCreateSetOpen] = useState(false);
  const [isSelectTrackModalOpen, setIsSelectTrackModalOpen] = useState(false);
  const [isSelectSetModalOpen, setIsSelectSetModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isAddModuleModalOpen, setIsAddModuleModalOpen] = useState(false);
  const [isManageModulesModalOpen, setIsManageModulesModalOpen] =
    useState(false);
  const [isDebugOverlayOpen, setIsDebugOverlayOpen] = useState(false);
  const [isInputMappingsModalOpen, setIsInputMappingsModalOpen] =
    useState(false);
  const [confirmationModal, setConfirmationModal] =
    useState<ConfirmationModalState | null>(null);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [footerPlaybackState, setFooterPlaybackState] = useState<
    Record<string, boolean>
  >({});
  const [isSequencerPlaying, setIsSequencerPlaying] = useState(false);
  const [sequencerCurrentStep, setSequencerCurrentStep] = useState(0);
  const [isSequencerMuted, setIsSequencerMuted] = useState(false);
  const [isProjectorReady, setIsProjectorReady] = useState(false);
  const [workspacePath, setWorkspacePath] = useState<string | null>(null);
  const workspacePathRef = useRef<string | null>(null);
  useEffect(() => {
    workspacePathRef.current = workspacePath;
  }, [workspacePath]);
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false);
  const [workspaceModalMode, setWorkspaceModalMode] = useState<
    "initial" | "lostSync"
  >("initial");
  const [workspaceModalPath, setWorkspaceModalPath] = useState<string | null>(null);
  const [workspaceModuleFiles, setWorkspaceModuleFiles] = useState<string[]>([]);
  const [workspaceModuleLoadFailures, setWorkspaceModuleLoadFailures] =
    useState<string[]>([]);
  const didMigrateWorkspaceModuleTypesRef = useRef(false);
  const loadModulesRunIdRef = useRef(0);
  const sequencerEngineRef = useRef<SequencerPlayback | null>(null);
  const sequencerAudioRef = useRef<SequencerAudio | null>(null);
  const sequencerMutedRef = useRef(false);
  const sequencerRunIdRef = useRef(0);
  const [editChannelModalState, setEditChannelModalState] =
    useState<EditChannelModalState>({
      isOpen: false,
      trackIndex: null,
      channelNumber: null,
    });

  useEffect(() => {
    sequencerMutedRef.current = isSequencerMuted;
  }, [isSequencerMuted]);

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

  // Wrapper for setRecordingData to handle RecordingData vs Recordings conversion
  const setRecordingDataWithWrapper = useCallback((
    updater: React.SetStateAction<{ recordings: Recordings }>
  ) => {
    setRecordingData((prev) => {
      const nextValue = typeof updater === 'function' ? updater({ recordings: prev }) : updater;
      return nextValue.recordings;
    });
  }, [setRecordingData]);

  // Module editor handlers
  const handleCreateNewModule = () => {
    setIsNewModuleDialogOpen(true);
  };

  const handleCreateModule = (moduleName: string, templateType: string) => {
    setEditingModuleName(moduleName);
    setEditingTemplateType(templateType);
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
  const footerPlaybackEngineRef = useRef<FooterPlaybackEngineRef>({});

  useEffect(() => {
    if (isInitialMount.current) {
      return;
    }

    if (sequencerEngineRef.current) {
      sequencerEngineRef.current.stop();
      if (typeof sequencerEngineRef.current.getRunId === "function") {
        sequencerRunIdRef.current = sequencerEngineRef.current.getRunId();
      }
      setIsSequencerPlaying(false);
      setSequencerCurrentStep(0);
    }

    Object.entries(footerPlaybackEngineRef.current).forEach(
      ([trackId, engine]) => {
        if (engine) {
          engine.stop();
        }
      }
    );
    setFooterPlaybackState({});

    const tracks = getActiveSetTracks(userDataRef.current || null, activeSetId);
    const track = tracks.find((t) => t.id === activeTrackId);

    if (track) {
      setIsProjectorReady(false);
      sendToProjector("set-activate", {
        setId: activeSetId,
      });
      sendToProjector("track-activate", {
        trackName: track.name,
      });
    } else {
      setIsProjectorReady(true);
    }
  }, [activeTrackId, activeSetId, sendToProjector]);

  const openConfirmationModal = useCallback(
    (message: string, onConfirm?: () => void) => {
      setConfirmationModal({ message, onConfirm, type: "confirm" });
    },
    []
  );

  const openAlertModal = useCallback((message: string) => {
    setConfirmationModal({ message, type: "alert" });
  }, []);

  const handleEditChannel = useCallback(
    (channelNumber: number) => {
      if (!selectedChannel) return;
      setEditChannelModalState({
        isOpen: true,
        trackIndex: selectedChannel.trackIndex,
        channelNumber: channelNumber,
      });
    },
    [selectedChannel]
  );

  const handleDeleteChannel = useCallback(
    (channelNumber: number) => {
      if (!selectedChannel) return;
      openConfirmationModal(
        `Are you sure you want to delete Channel ${channelNumber}?`,
        () => {
          updateActiveSet(setUserData, activeSetId, (activeSet) => {
            const currentTrack = activeSet.tracks[selectedChannel.trackIndex];
            const channelKey = String(channelNumber);

            delete currentTrack.channelMappings[channelKey];

            Object.keys(currentTrack.modulesData).forEach((moduleId) => {
              if (currentTrack.modulesData[moduleId].methods) {
                delete currentTrack.modulesData[moduleId].methods[channelKey];
              }
            });
          });
        }
      );
    },
    [selectedChannel, setUserData, activeSetId, openConfirmationModal]
  );

  // Load settings on mount
  useEffect(() => {
    loadSettings().then((loadedSettings) => {
      setSettings(loadedSettings);
    });

    invokeIPC("input:get-midi-devices").then((devices: string[]) => {
      setAvailableMidiDevices(devices);
    });
  }, [invokeIPC]);

  // Initialize settings when userData loads (but don't overwrite user changes from settings modal)
  useEffect(() => {
    if (userData.config) {
      const storedAspect = userData.config.aspectRatio;
      setAspectRatio(
        !storedAspect || storedAspect === "landscape" ? "default" : storedAspect
      );
      setBgColor(userData.config.bgColor || "grey");
    }
  }, [userData]);

  useEffect(() => {
    updateUserData(setUserData, (draft) => {
      draft.config.aspectRatio = aspectRatio;
    });
  }, [aspectRatio, setUserData]);

  useEffect(() => {
    sendToProjector("toggleAspectRatioStyle", { name: aspectRatio });
  }, [aspectRatio, sendToProjector]);

  const didInitAspectRefreshRef = useRef(false);
  useEffect(() => {
    if (!didInitAspectRefreshRef.current) {
      didInitAspectRefreshRef.current = true;
      return;
    }
    const t = setTimeout(() => {
      sendToProjector("refresh-projector", {});
    }, 200);
    return () => clearTimeout(t);
  }, [aspectRatio, sendToProjector]);

  useEffect(() => {
    updateUserData(setUserData, (draft) => {
      draft.config.bgColor = bgColor;
    });
  }, [bgColor, setUserData]);

  useEffect(() => {
    sendToProjector("setBg", { value: bgColor });
  }, [bgColor, sendToProjector]);

  useEffect(() => {
    if (isInitialMount.current) {
      return;
    }

    const updateAppState = async () => {
      const currentState = await loadAppState();
      const preservedWorkspacePath =
        workspacePathRef.current ?? currentState.workspacePath ?? null;
      const stateToSave = {
        ...currentState,
        activeTrackId,
        activeSetId,
        sequencerMuted: isSequencerMuted,
        workspacePath: preservedWorkspacePath,
      };
      await saveAppState(stateToSave);
    };
    updateAppState();
  }, [isSequencerMuted, activeTrackId, activeSetId]);

  const isInitialMountInput = useRef(true);

  useEffect(() => {
    if (inputConfig && !isInitialMountInput.current) {
      updateUserData(setUserData, (draft) => {
        draft.config.input = inputConfig;
      });

      // Only attempt to configure input if we have a valid MIDI device or are using OSC
      if (inputConfig.type === "osc" || (inputConfig.type === "midi" && inputConfig.deviceName)) {
        invokeIPC("input:configure", inputConfig).catch((err: unknown) => {
          console.error("[Dashboard] Failed to configure input:", err);
        });
      }
    }
    isInitialMountInput.current = false;
  }, [inputConfig, setUserData, invokeIPC]);

  const prevSequencerModeRef = useRef<boolean | undefined>(undefined);
  useEffect(() => {
    const next = userData?.config?.sequencerMode;
    const prev = prevSequencerModeRef.current;
    prevSequencerModeRef.current = next;

    if (prev === true && next === false) {
      // Only attempt to configure input if we have a valid MIDI device or are using OSC
      if (inputConfig.type === "osc" || (inputConfig.type === "midi" && inputConfig.deviceName)) {
        invokeIPC("input:configure", inputConfig).catch((err: unknown) => {
          console.error("[Dashboard] Failed to configure input:", err);
        });
      }
    }
  }, [userData?.config?.sequencerMode, inputConfig, invokeIPC]);

  useIPCListener("from-projector", (event, data) => {
    const projectorData = data as { type?: string; props?: { moduleId?: string; ok?: boolean; methods?: unknown[] } };
    if (projectorData.type !== "module-introspect-result") return;
    const payload = projectorData.props || {};
    const moduleId = payload.moduleId;
    if (!moduleId) return;

    if (payload.ok) {
      const incomingMethods = Array.isArray(payload.methods)
        ? payload.methods
        : [];
      setPredefinedModules((prev) =>
        (prev || []).map((m) =>
          m && m.id === moduleId
            ? {
                ...m,
                methods: incomingMethods,
                status: "ready",
              }
            : m
        )
      );
      setWorkspaceModuleLoadFailures((prev) =>
        (prev || []).filter((id) => id !== moduleId)
      );

      const executeOnLoad = incomingMethods
        .filter((m): m is { name: string; executeOnLoad?: boolean; options?: unknown[] } =>
          m && typeof m === 'object' && 'executeOnLoad' in m && (m as any).executeOnLoad)
        .filter((m) => m.name !== "matrix" && m.name !== "show");

      if (executeOnLoad.length) {
        updateActiveSet(setUserData, activeSetId, (activeSet) => {
          const tracks = Array.isArray(activeSet?.tracks)
            ? activeSet.tracks
            : [];
          for (const track of tracks) {
            const modules = Array.isArray(track?.modules) ? track.modules : [];
            const modulesData = track?.modulesData || null;
            if (!modulesData) continue;

            for (const inst of modules) {
              const instId = inst?.id ? String(inst.id) : "";
              const type = inst?.type ? String(inst.type) : "";
              if (!instId || !type) continue;
              if (type !== moduleId) continue;

              const data = modulesData[instId];
              const ctor = Array.isArray(data?.constructor)
                ? data.constructor
                : null;
              if (!ctor) continue;

              const names = ctor
                .map((m) => (m?.name ? String(m.name) : ""))
                .filter(Boolean);
              if (names.length > 2) continue;
              if (names.some((n) => n !== "matrix" && n !== "show")) continue;

              const existingSet = new Set(names);
              const missing = executeOnLoad.filter(
                (m) => !existingSet.has(m.name)
              );
              if (!missing.length) continue;

              const matrix = ctor.find((m) => (m as any)?.name === "matrix") as { name: string } | null;
              const show = ctor.find((m) => (m as any)?.name === "show") as { name: string } | null;

              const filled = missing.map((method) => ({
                name: method.name,
                options: Array.isArray(method?.options)
                  ? method.options.map((opt) => ({
                      name: (opt as any)?.name,
                      value: (opt as any)?.defaultVal,
                    }))
                  : [],
              }));

              const nextCtor: unknown[] = [];
              if (matrix) nextCtor.push(matrix);
              nextCtor.push(...filled);
              if (show) nextCtor.push(show);
              data.constructor = nextCtor as any;
            }
          }
        });
      }
    } else {
      setWorkspaceModuleLoadFailures((prev) => {
        const list = Array.isArray(prev) ? prev : [];
        if (list.includes(moduleId)) return list;
        return [...list, moduleId];
      });
      setPredefinedModules((prev) =>
        (prev || []).map((m) =>
          m && m.id === moduleId ? { ...m, status: "failed" } : m
        )
      );
    }
  });

  const ipcInvoke = useIPCInvoke();

  const pauseAllPlayback = useCallback(() => {
    if (sequencerEngineRef.current) {
      sequencerEngineRef.current.stop();
      if (typeof sequencerEngineRef.current.getRunId === "function") {
        sequencerRunIdRef.current = sequencerEngineRef.current.getRunId();
      }
      setIsSequencerPlaying(false);
      setSequencerCurrentStep(0);
    }

    Object.entries(footerPlaybackEngineRef.current).forEach(
      ([trackId, engine]) => {
        if (engine) {
          engine.stop();
        }
      }
    );
    setFooterPlaybackState({});
  }, []);
  useWorkspaceModules({
    workspacePath,
    isWorkspaceModalOpen,
    sendToProjector,
    userData,
    setUserData,
    predefinedModules: predefinedModules as any,
    workspaceModuleFiles,
    setPredefinedModules,
    setWorkspaceModuleFiles,
    setWorkspaceModuleLoadFailures,
    setIsProjectorReady,
    didMigrateWorkspaceModuleTypesRef,
    loadModulesRunIdRef,
  });

  const isInitialMount = useRef(true);
  const userDataLoadedSuccessfully = useRef(false);

  // Load userData and appState from JSON files on mount
  useEffect(() => {
    const initializeUserData = async () => {
      const data = await loadUserData();

      if (data?._loadedSuccessfully) {
        userDataLoadedSuccessfully.current = true;
      }

      const recordings = await loadRecordingData();

      const appState = await loadAppState();
      let activeTrackIdToUse = appState.activeTrackId;
      let activeSetIdToUse = appState.activeSetId;
      let sequencerMutedToUse = appState.sequencerMuted;
      const projectDir = getProjectDir();
      const workspacePathToUse = projectDir || null;
      workspacePathRef.current = workspacePathToUse;
      setIsSequencerMuted(Boolean(sequencerMutedToUse));
      setWorkspacePath(workspacePathToUse);
      if (!workspacePathToUse) {
        setWorkspaceModalMode("initial");
        setWorkspaceModalPath(null);
        setIsWorkspaceModalOpen(true);
      } else {
        const bridge = globalThis.nwWrldAppBridge as any;
        const isAvailable =
          bridge &&
          bridge.project &&
          typeof bridge.project.isDirAvailable === "function"
            ? bridge.project.isDirAvailable()
            : false;
        if (!isAvailable) {
          setWorkspaceModalMode("lostSync");
          setWorkspaceModalPath(workspacePathToUse);
          setIsWorkspaceModalOpen(true);
        }
      }

      if (activeSetIdToUse) {
        (setActiveSetId as any)(activeSetIdToUse);
      }

      const tracksFromData = getActiveSetTracks(data, activeSetIdToUse);

      setUserData(data);
      setRecordingData(recordings);

      if (data.config && data.config.input) {
        setInputConfig(data.config.input as InputConfig);
      }

      const tracks = getActiveSetTracks(data, activeSetIdToUse);
      if (tracks.length > 0) {
        const storedTrack = activeTrackIdToUse
          ? tracks.find((t) => t.id === activeTrackIdToUse)
          : null;

        if (storedTrack) {
          (setActiveTrackId as any)(storedTrack.id);
        } else {
          const visibleTrack = tracks.find((t) => t.isVisible);
          const firstTrack = visibleTrack || tracks[0];
          (setActiveTrackId as any)(firstTrack.id);
        }
      }

      isInitialMount.current = false;
    };

    initializeUserData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useIPCListener("workspace:lostSync", (event, payload) => {
    const lostPath = (payload as any)?.workspacePath || workspacePathRef.current || null;
    setWorkspaceModalMode("lostSync");
    setWorkspaceModalPath(lostPath);
    setIsWorkspaceModalOpen(true);
  });

  const handleSelectWorkspace = useCallback(async () => {
    await ipcInvoke("workspace:select");
  }, [ipcInvoke]);

  const openAddModuleModal = useCallback((trackIndex: number) => {
    setSelectedTrackForModuleMenu(trackIndex);
    setIsAddModuleModalOpen(true);
  }, []);

  const firstVisibleTrack = useMemo(() => {
    if (!activeTrackId) return null;
    const tracks = getActiveSetTracks(userData, activeSetId);
    const track = tracks.find((t) => t.id === activeTrackId);
    if (!track) return null;
    const trackIndex = tracks.findIndex((t) => t.id === activeTrackId);
    return { track, trackIndex };
  }, [activeTrackId, userData, activeSetId]);

  const updateConfig = useCallback(
    (updates: Partial<UserData["config"]>) => {
      const wasSequencerMode = userData.config?.sequencerMode;
      const willBeSequencerMode = Object.prototype.hasOwnProperty.call(
        updates,
        "sequencerMode"
      )
        ? updates.sequencerMode
        : wasSequencerMode;

      if (wasSequencerMode && !willBeSequencerMode && isSequencerPlaying) {
        if (sequencerEngineRef.current) {
          sequencerEngineRef.current.stop();
          if (typeof sequencerEngineRef.current.getRunId === "function") {
            sequencerRunIdRef.current = sequencerEngineRef.current.getRunId();
          }
          setIsSequencerPlaying(false);
          setSequencerCurrentStep(0);
        }
      }

      const normalizeUserColors = (list: unknown[]): string[] => {
        const raw = Array.isArray(list) ? list : [];
        const out: string[] = [];
        const seen = new Set<string>();
        for (const v of raw) {
          const s = String(v || "").trim();
          if (!s) continue;
          const withHash = s.startsWith("#") ? s : `#${s}`;
          if (!/^#([0-9A-F]{3}){1,2}$/i.test(withHash)) continue;
          let hex = withHash.toLowerCase();
          if (hex.length === 4) {
            const r = hex[1];
            const g = hex[2];
            const b = hex[3];
            hex = `#${r}${r}${g}${g}${b}${b}`;
          }
          if (seen.has(hex)) continue;
          seen.add(hex);
          out.push(hex);
        }
        return out;
      };

      setUserData(
        produce((draft: any) => {
          if (!draft.config) {
            draft.config = {} as any;
          }

          const hasUserColors = Object.prototype.hasOwnProperty.call(
            updates || {},
            "userColors"
          );

          if (hasUserColors) {
            const palette = normalizeUserColors(updates.userColors as string[]);
            draft.config.userColors = palette;

            const syncOptions = (options: unknown[]) => {
              const list = Array.isArray(options) ? options : [];
              for (const opt of list) {
                if (!opt || typeof opt !== "object") continue;
                if ((opt as { randomizeFromUserColors?: boolean }).randomizeFromUserColors !== true) continue;
                if (palette.length > 0) {
                  (opt as { randomValues?: string[] }).randomValues = [...palette];
                } else {
                  delete (opt as { randomValues?: string[] }).randomValues;
                  delete (opt as { randomizeFromUserColors?: boolean }).randomizeFromUserColors;
                }
              }
            };

            const syncMethodList = (methods: unknown[]) => {
              const list = Array.isArray(methods) ? methods : [];
              for (const m of list) {
                if (!m || typeof m !== "object") continue;
                syncOptions((m as { options?: unknown[] }).options);
              }
            };

            const sets = Array.isArray(draft.sets) ? draft.sets : [];
            for (const set of sets) {
              const tracks = Array.isArray(set?.tracks) ? set.tracks : [];
              for (const track of tracks) {
                const modulesData =
                  track && typeof track === "object" ? track.modulesData : null;
                if (!modulesData || typeof modulesData !== "object") continue;
                for (const instanceId of Object.keys(modulesData)) {
                  const md = modulesData[instanceId];
                  if (!md || typeof md !== "object") continue;
                  syncMethodList((md as { constructor?: unknown[] }).constructor);
                  const methodsByChannel =
                    md && typeof md === "object" && (md as { methods?: Record<string, unknown> }).methods && typeof (md as { methods: Record<string, unknown> }).methods === "object"
                      ? (md as { methods: Record<string, unknown> }).methods
                      : null;
                  if (!methodsByChannel) continue;
                  for (const channelKey of Object.keys(methodsByChannel)) {
                    syncMethodList(methodsByChannel[channelKey] as unknown[]);
                  }
                }
              }
            }
          }

          const { userColors, ...rest } = updates || {};
          Object.assign(draft.config, hasUserColors ? rest : updates);
        })
      );
    },
    [setUserData, userData.config, isSequencerPlaying]
  );

  const handleSequencerToggle = useCallback(
    (channelName: string, stepIndex: number) => {
      if (!firstVisibleTrack) return;
      const { track } = firstVisibleTrack;

      setRecordingData(
        produce((draft: any) => {
          if (!draft[track.id]) {
            draft[track.id] = { channels: [], sequencer: { bpm: 120, pattern: {} } };
          }
          if (!draft[track.id].sequencer) {
            draft[track.id].sequencer = { bpm: 120, pattern: {} };
          }
          if (!draft[track.id].sequencer.pattern) {
            draft[track.id].sequencer.pattern = {};
          }
          if (
            !draft[track.id].sequencer.pattern[channelName] ||
            !Array.isArray(draft[track.id].sequencer.pattern[channelName])
          ) {
            draft[track.id].sequencer.pattern[channelName] = [];
          }

          const steps = draft[track.id].sequencer.pattern[channelName];
          const idx = steps.indexOf(stepIndex);

          if (idx > -1) {
            steps.splice(idx, 1);
          } else {
            steps.push(stepIndex);
            steps.sort((a, b) => a - b);
          }
        })
      );

      if (sequencerEngineRef.current && isSequencerPlaying) {
        const sequencerData = getSequencerForTrack(recordingData, String(track.id));
        const updatedPattern = { ...sequencerData.pattern };

        if (!updatedPattern[channelName]) {
          updatedPattern[channelName] = [];
        }

        const steps = [...updatedPattern[channelName]];
        const idx = steps.indexOf(stepIndex);

        if (idx > -1) {
          steps.splice(idx, 1);
        } else {
          steps.push(stepIndex);
          steps.sort((a, b) => a - b);
        }

        updatedPattern[channelName] = steps;

        const bpm = userData.config.sequencerBpm || 120;
        sequencerEngineRef.current.load(updatedPattern as any, bpm);
      }
    },
    [
      setRecordingData,
      firstVisibleTrack,
      recordingData,
      userData.config.sequencerBpm,
      isSequencerPlaying,
    ]
  );

  const handleFooterPlayPause = useCallback(async () => {
    if (!firstVisibleTrack) return;
    const { track, trackIndex } = firstVisibleTrack;
    const trackId = track.id;
    const config = userData.config;

    if (config.sequencerMode) {
      if (!sequencerEngineRef.current) {
        sequencerEngineRef.current = new SequencerPlayback();

        sequencerEngineRef.current.setOnStepCallback(
          (stepIndex, channels, time, runId) => {
            const hasScheduledTime =
              typeof time === "number" && Number.isFinite(time);

            if (
              typeof runId === "number" &&
              runId !== sequencerRunIdRef.current
            ) {
              return;
            }

            channels.forEach((channelName) => {
              if (sequencerAudioRef.current && !sequencerMutedRef.current) {
                const channelNumber = channelName.replace(/^ch/, "");
                sequencerAudioRef.current.playChannelBeep(
                  channelNumber,
                  hasScheduledTime ? time : undefined
                );
              }
            });

            if (hasScheduledTime) {
              const scheduledRunId = runId;
              Tone.Draw.schedule(() => {
                if (
                  typeof scheduledRunId === "number" &&
                  scheduledRunId !== sequencerRunIdRef.current
                ) {
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
          }
        );
      }

      if (!sequencerAudioRef.current) {
        sequencerAudioRef.current = new SequencerAudio();
      }

      if (!isSequencerPlaying) {
        const sequencerData = getSequencerForTrack(recordingData, String(track.id));
        const pattern = sequencerData.pattern || {};
        const bpm = config.sequencerBpm || 120;
        sequencerEngineRef.current.load(pattern as any, bpm);

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
        sequencerEngineRef.current.play();
        if (typeof sequencerEngineRef.current.getRunId === "function") {
          sequencerRunIdRef.current = sequencerEngineRef.current.getRunId();
        }
        setIsSequencerPlaying(true);
      }
    } else {
      const isPlaying = footerPlaybackState[trackId] || false;

      if (!footerPlaybackEngineRef.current[trackId]) {
        footerPlaybackEngineRef.current[trackId] = new MidiPlayback();

        footerPlaybackEngineRef.current[trackId].setOnNoteCallback(
          (channelName, midiNote) => {
            const channelNumber = channelName.replace(/^ch/, "");
            flashChannel(channelNumber, 100);

            sendToProjector("channel-trigger", {
              channelName: channelName,
            });
          }
        );

        footerPlaybackEngineRef.current[trackId].setOnStopCallback(() => {
          setFooterPlaybackState((prev) => ({ ...prev, [trackId]: false }));
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

          const channels = recording.channels.map((ch) => ({
            name: (ch as any).name,
            midi: 0,
            sequences: (ch as any).sequences || [],
          }));

          const bpm = track.bpm || 120;
          footerPlaybackEngineRef.current[trackId].load(channels, bpm);
        } catch (error) {
          console.error("Error loading recording for playback:", error);
          alert(`Failed to load recording for playback: ${(error as Error).message}`);
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

        footerPlaybackEngineRef.current[trackId].play();
        setFooterPlaybackState((prev) => ({ ...prev, [trackId]: true }));
      }
    }
  }, [
    firstVisibleTrack,
    footerPlaybackState,
    flashChannel,
    setFlashingConstructors,
    userData.config,
    isSequencerPlaying,
    recordingData,
    sendToProjector,
  ]);

  const handleFooterStop = useCallback(() => {
    if (!firstVisibleTrack) return;
    const config = userData.config;

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
      const trackId = firstVisibleTrack.track.id;
      if (footerPlaybackEngineRef.current[trackId]) {
        footerPlaybackEngineRef.current[trackId].stop();
        setFooterPlaybackState((prev) => ({ ...prev, [trackId]: false }));
      }
    }
  }, [firstVisibleTrack, userData.config]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;

      const target = e.target as HTMLElement;
      const isTyping =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      if (isTyping) return;

      const config = userData.config;
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
  }, [
    userData.config,
    isSequencerPlaying,
    handleFooterStop,
    handleFooterPlayPause,
  ]);

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

  return (
    <div className="relative bg-[#101010] font-mono h-screen flex flex-col">
      <DashboardHeader
        onSets={() => setIsSelectSetModalOpen(true)}
        onTracks={() => setIsSelectTrackModalOpen(true)}
        onModules={() => setIsManageModulesModalOpen(true)}
        onSettings={() => setIsSettingsModalOpen(true)}
        onDebugOverlay={() => setIsDebugOverlayOpen(true)}
      />

      <div className="flex-1 overflow-y-auto pt-12 pb-32">
        <div className="bg-[#101010] p-6 font-mono">
          {(() => {
            const tracks = getActiveSetTracks(userData, activeSetId);
            const hasActiveTrack =
              activeTrackId && tracks.find((t) => t.id === activeTrackId);

            if (!activeTrackId || !hasActiveTrack) {
              return (
                <div className="text-neutral-300/30 text-[11px]">
                  No tracks to display.
                </div>
              );
            }

            return (
              <div className="flex flex-col gap-8 px-8">
                {tracks
                  .filter((track) => track.id === activeTrackId)
                  .map((track) => {
                    const trackIndex = tracks.findIndex(
                      (t) => t.id === track.id
                    );
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
                        config={userData.config}
                        isSequencerPlaying={isSequencerPlaying}
                        sequencerCurrentStep={sequencerCurrentStep}
                        handleSequencerToggle={handleSequencerToggle}
                        workspacePath={workspacePath}
                        workspaceModuleFiles={workspaceModuleFiles}
                        workspaceModuleLoadFailures={
                          workspaceModuleLoadFailures
                        }
                      />
                    );
                  })}
              </div>
            );
          })()}
        </div>
      </div>

      <DashboardFooter
        track={firstVisibleTrack?.track || null}
        isPlaying={
          userData.config.sequencerMode
            ? isSequencerPlaying
            : firstVisibleTrack
            ? footerPlaybackState[firstVisibleTrack.track.id] || false
            : false
        }
        onPlayPause={handleFooterPlayPause}
        onStop={handleFooterStop}
        inputStatus={inputStatus as any}
        inputConfig={inputConfig}
        config={userData.config as any}
        onSettingsClick={() => setIsSettingsModalOpen(true)}
        isMuted={isSequencerMuted}
        onMuteChange={setIsSequencerMuted}
        isProjectorReady={isProjectorReady}
      />

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
        recordingData={{ recordings: recordingData }}
        setRecordingData={setRecordingDataWithWrapper as any}
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
        recordingData={{ recordings: recordingData }}
        setRecordingData={setRecordingDataWithWrapper as any}
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
        settings={settings as any}
        inputConfig={inputConfig}
        setInputConfig={setInputConfig}
        availableMidiDevices={availableMidiDevices as any}
        onOpenMappings={() => {
          setIsSettingsModalOpen(false);
          setIsInputMappingsModalOpen(true);
        }}
        config={userData.config}
        updateConfig={updateConfig}
        workspacePath={workspacePath}
        onSelectWorkspace={handleSelectWorkspace}
      />
      <InputMappingsModal
        isOpen={isInputMappingsModalOpen}
        onClose={() => setIsInputMappingsModalOpen(false)}
      />
      {React.createElement(AddModuleModal as any, {
        isOpen: isAddModuleModalOpen,
        onClose: () => {
          setIsAddModuleModalOpen(false);
          setSelectedTrackForModuleMenu(null);
        },
        trackIndex: selectedTrackForModuleMenu,
        userData: userData,
        setUserData: setUserData,
        predefinedModules: predefinedModules as any,
        onCreateNewModule: handleCreateNewModule,
        onEditModule: handleEditModule,
        mode: "add-to-track" as any,
      } as any)}
      {React.createElement(AddModuleModal as any, {
        isOpen: isManageModulesModalOpen,
        onClose: () => setIsManageModulesModalOpen(false),
        trackIndex: null as any,
        userData: userData,
        setUserData: setUserData as any,
        predefinedModules: predefinedModules as any,
        onCreateNewModule: handleCreateNewModule,
        onEditModule: handleEditModule,
        mode: "manage-modules" as any,
      } as any)}
      <ModuleEditorModal
        isOpen={isModuleEditorOpen}
        onClose={handleCloseModuleEditor}
        moduleName={editingModuleName}
        templateType={editingTemplateType as any}
        onModuleSaved={null}
        predefinedModules={predefinedModules as any}
        workspacePath={workspacePath}
      />
      <NewModuleDialog
        isOpen={isNewModuleDialogOpen}
        onClose={() => setIsNewModuleDialogOpen(false)}
        onCreateModule={handleCreateModule}
        workspacePath={workspacePath}
      />
      <DebugOverlayModal
        isOpen={isDebugOverlayOpen}
        onClose={() => setIsDebugOverlayOpen(false)}
        debugLogs={debugLogs}
      />
      <MethodConfiguratorModal
        isOpen={!!selectedChannel}
        onClose={() => (setSelectedChannel as any)(null)}
        predefinedModules={predefinedModules as any}
        onEditChannel={handleEditChannel}
        onDeleteChannel={handleDeleteChannel}
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
        config={userData.config}
      />
      <ConfirmationModal
        isOpen={!!confirmationModal}
        onClose={() => setConfirmationModal(null)}
        message={confirmationModal?.message || ""}
        onConfirm={confirmationModal?.onConfirm}
        type={confirmationModal?.type || "confirm"}
      />

      <Modal isOpen={isWorkspaceModalOpen} onClose={() => {}}>
        <ModalHeader
          title={
            workspaceModalMode === "lostSync"
              ? "PROJECT FOLDER NOT FOUND"
              : "OPEN PROJECT"
          }
          onClose={() => {}}
          showClose={false}
        />
        <div className="flex flex-col gap-4">
          <div className="text-neutral-300/70">
            {workspaceModalMode === "lostSync"
              ? "We lost sync with your project folder. It may have been moved or renamed. Reopen the project folder to continue."
              : "Open (or create) a project folder to begin. Your project folder contains your modules and performance data."}
          </div>
          {workspaceModalPath || workspacePath ? (
            <div className="text-neutral-300/50 break-all">
              {workspaceModalPath || workspacePath}
            </div>
          ) : null}
        </div>
        <ModalFooter>
          <div className="flex justify-end gap-3">
            <Button onClick={handleSelectWorkspace}>
              {workspaceModalMode === "lostSync"
                ? "REOPEN PROJECT"
                : "OPEN PROJECT"}
            </Button>
          </div>
        </ModalFooter>
      </Modal>
    </div>
  );
};

// =========================
// Render the Dashboard
// =========================

const rootElement =
  document.getElementById("dashboard") || document.getElementById("root");
if (rootElement) {
  createRoot(rootElement).render(
    <ErrorBoundary>
      <Dashboard />
    </ErrorBoundary>
  );
}

export default Dashboard;
