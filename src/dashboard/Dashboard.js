// Dashboard.js
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
import { loadSettings } from "../shared/json/configUtils.js";
import {
  loadRecordingData,
  saveRecordingData,
  saveRecordingDataSync,
  getRecordingForTrack,
  setRecordingForTrack,
  getSequencerForTrack,
  setSequencerForTrack,
} from "../shared/json/recordingUtils.js";
import {
  loadAppState,
  loadAppStateSync,
  saveAppState,
  saveAppStateSync,
} from "../shared/json/appStateUtils.js";
import MidiPlayback from "../shared/midi/midiPlayback.js";
import SequencerPlayback from "../shared/sequencer/SequencerPlayback.js";
import SequencerAudio from "../shared/audio/sequencerAudio.js";
import { getActiveSetTracks } from "../shared/utils/setUtils.js";
import { Button } from "./components/Button.js";
import { ModalHeader } from "./components/ModalHeader.js";
import { ModalFooter } from "./components/ModalFooter.js";
import { ModuleEditorModal } from "./components/ModuleEditorModal.js";
import { NewModuleDialog } from "./components/NewModuleDialog.js";
import {
  loadUserData,
  saveUserData,
  saveUserDataSync,
  updateUserData,
  updateActiveSet,
} from "./core/utils.js";
import {
  useIPCSend,
  useIPCListener,
  useIPCInvoke,
} from "./core/hooks/useIPC.js";
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
} from "./core/state.js";
import { Modal } from "./shared/Modal.jsx";
import { ConfirmationModal } from "./modals/ConfirmationModal.jsx";
import { DebugOverlayModal } from "./modals/DebugOverlayModal.jsx";
import { EditSetModal } from "./modals/EditSetModal.jsx";
import { CreateSetModal } from "./modals/CreateSetModal.jsx";
import { CreateTrackModal } from "./modals/CreateTrackModal.jsx";
import { EditTrackModal } from "./modals/EditTrackModal.jsx";
import { EditChannelModal } from "./modals/EditChannelModal.jsx";
import { AddModuleModal } from "./modals/AddModuleModal.jsx";
import { SettingsModal } from "./modals/SettingsModal.jsx";
import { InputMappingsModal } from "./modals/InputMappingsModal.jsx";
import { SelectSetModal } from "./modals/SelectSetModal.jsx";
import { SelectTrackModal } from "./modals/SelectTrackModal.jsx";
import { MethodConfiguratorModal } from "./modals/MethodConfiguratorModal.jsx";
import { TrackItem } from "./components/track/TrackItem.jsx";
import { DashboardHeader } from "./components/DashboardHeader.jsx";
import { DashboardFooter } from "./components/DashboardFooter.jsx";
import { useWorkspaceModules } from "./core/hooks/useWorkspaceModules.js";
import { useInputEvents } from "./core/hooks/useInputEvents.js";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { getProjectDir } from "../shared/utils/projectDir.js";

// =========================
// Components
// =========================

const Dashboard = () => {
  const [userData, setUserData] = useAtom(userDataAtom);
  const [recordingData, setRecordingData] = useAtom(recordingDataAtom);
  const [activeTrackId, setActiveTrackId] = useAtom(activeTrackIdAtom);
  const [activeSetId, setActiveSetId] = useAtom(activeSetIdAtom);
  const [predefinedModules, setPredefinedModules] = useState([]);
  const [selectedChannel, setSelectedChannel] = useAtom(selectedChannelAtom);
  const [selectedTrackForModuleMenu, setSelectedTrackForModuleMenu] =
    useState(null);
  const [flashingChannels, flashChannel] = useFlashingChannels();
  const [flashingConstructors, setFlashingConstructors] = useAtom(
    flashingConstructorsAtom
  );

  const sendToProjector = useIPCSend("dashboard-to-projector");
  const invokeIPC = useIPCInvoke();

  // Module editor states
  const [isModuleEditorOpen, setIsModuleEditorOpen] = useState(false);
  const [editingModuleName, setEditingModuleName] = useState(null);
  const [editingTemplateType, setEditingTemplateType] = useState(null);
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
  const workspacePathRef = useRef(null);
  useEffect(() => {
    activeTrackIdRef.current = activeTrackId;
    activeSetIdRef.current = activeSetId;
    workspacePathRef.current = workspacePath;
  }, [activeTrackId, activeSetId, workspacePath]);

  // Recording state management
  const [recordingState, setRecordingState] = useAtom(recordingStateAtom);
  const recordingStateRef = useRef(recordingState);
  useEffect(() => {
    recordingStateRef.current = recordingState;
  }, [recordingState]);
  const triggerMapsRef = useRef({ trackTriggersMap: {}, channelMappings: {} });

  // Track pending save timeouts for cancellation
  const userDataSaveTimeoutRef = useRef(null);
  const recordingDataSaveTimeoutRef = useRef(null);

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
  const [inputConfig, setInputConfig] = useState({
    type: "midi",
    deviceName: "IAC Driver Bus 1",
    trackSelectionChannel: 1,
    methodTriggerChannel: 2,
    velocitySensitive: false,
    port: 8000,
  });
  const [availableMidiDevices, setAvailableMidiDevices] = useState([]);
  const [inputStatus, setInputStatus] = useState({
    status: "disconnected",
    message: "",
  });
  const [settings, setSettings] = useState({
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
  const [confirmationModal, setConfirmationModal] = useState(null);
  const [debugLogs, setDebugLogs] = useState([]);
  const [footerPlaybackState, setFooterPlaybackState] = useState({});
  const [isSequencerPlaying, setIsSequencerPlaying] = useState(false);
  const [sequencerCurrentStep, setSequencerCurrentStep] = useState(0);
  const [isSequencerMuted, setIsSequencerMuted] = useState(false);
  const [isProjectorReady, setIsProjectorReady] = useState(false);
  const [workspacePath, setWorkspacePath] = useState(null);
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false);
  const [workspaceModalMode, setWorkspaceModalMode] = useState("initial");
  const [workspaceModalPath, setWorkspaceModalPath] = useState(null);
  const [workspaceModuleFiles, setWorkspaceModuleFiles] = useState([]);
  const [workspaceModuleLoadFailures, setWorkspaceModuleLoadFailures] =
    useState([]);
  const didMigrateWorkspaceModuleTypesRef = useRef(false);
  const loadModulesRunIdRef = useRef(0);
  const sequencerEngineRef = useRef(null);
  const sequencerAudioRef = useRef(null);
  const sequencerMutedRef = useRef(false);
  const sequencerRunIdRef = useRef(0);
  const [editChannelModalState, setEditChannelModalState] = useState({
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

  // Module editor handlers
  const handleCreateNewModule = () => {
    setIsNewModuleDialogOpen(true);
  };

  const handleCreateModule = (moduleName, templateType) => {
    setEditingModuleName(moduleName);
    setEditingTemplateType(templateType);
    setIsModuleEditorOpen(true);
  };

  const handleEditModule = (moduleName) => {
    setEditingModuleName(moduleName);
    setEditingTemplateType(null);
    setIsModuleEditorOpen(true);
  };

  const handleCloseModuleEditor = () => {
    setIsModuleEditorOpen(false);
    setEditingModuleName(null);
    setEditingTemplateType(null);
  };
  const footerPlaybackEngineRef = useRef({});

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

    const tracks = getActiveSetTracks(userDataRef.current || {}, activeSetId);
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

  const openConfirmationModal = useCallback((message, onConfirm) => {
    setConfirmationModal({ message, onConfirm, type: "confirm" });
  }, []);

  const openAlertModal = useCallback((message) => {
    setConfirmationModal({ message, type: "alert" });
  }, []);

  const handleEditChannel = useCallback(
    (channelNumber) => {
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
    (channelNumber) => {
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
    [selectedChannel, setUserData, openConfirmationModal]
  );

  // Load settings on mount
  useEffect(() => {
    loadSettings().then((loadedSettings) => {
      setSettings(loadedSettings);
    });

    invokeIPC("input:get-midi-devices").then((devices) => {
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
  }, [aspectRatio]);

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
  }, [bgColor]);

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

      invokeIPC("input:configure", inputConfig).catch((err) => {
        console.error("[Dashboard] Failed to configure input:", err);
      });
    }
    isInitialMountInput.current = false;
  }, [inputConfig]);

  const prevSequencerModeRef = useRef(undefined);
  useEffect(() => {
    const next = userData?.config?.sequencerMode;
    const prev = prevSequencerModeRef.current;
    prevSequencerModeRef.current = next;

    if (prev === true && next === false) {
      invokeIPC("input:configure", inputConfig).catch((err) => {
        console.error("[Dashboard] Failed to configure input:", err);
      });
    }
  }, [userData?.config?.sequencerMode, inputConfig, invokeIPC]);

  useIPCListener("from-projector", (event, data) => {
    if (data.type !== "module-introspect-result") return;
    const payload = data.props || {};
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
        .filter((m) => m && m.executeOnLoad)
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

              const matrix = ctor.find((m) => m?.name === "matrix") || null;
              const show = ctor.find((m) => m?.name === "show") || null;

              const filled = missing.map((method) => ({
                name: method.name,
                options: Array.isArray(method?.options)
                  ? method.options.map((opt) => ({
                      name: opt?.name,
                      value: opt?.defaultVal,
                    }))
                  : [],
              }));

              const nextCtor = [];
              if (matrix) nextCtor.push(matrix);
              nextCtor.push(...filled);
              if (show) nextCtor.push(show);
              data.constructor = nextCtor;
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
    predefinedModules,
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
        const bridge = globalThis.nwWrldBridge;
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
        setActiveSetId(activeSetIdToUse);
      }

      const tracksFromData = getActiveSetTracks(data, activeSetIdToUse);

      setUserData(data);
      setRecordingData(recordings);

      if (data.config && data.config.input) {
        setInputConfig(data.config.input);
      }

      const tracks = getActiveSetTracks(data, activeSetIdToUse);
      if (tracks.length > 0) {
        const storedTrack = activeTrackIdToUse
          ? tracks.find((t) => t.id === activeTrackIdToUse)
          : null;

        if (storedTrack) {
          setActiveTrackId(storedTrack.id);
        } else {
          const visibleTrack = tracks.find((t) => t.isVisible);
          const firstTrack = visibleTrack || tracks[0];
          setActiveTrackId(firstTrack.id);
        }
      }

      isInitialMount.current = false;
    };

    initializeUserData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useIPCListener("workspace:lostSync", (event, payload) => {
    const lostPath = payload?.workspacePath || workspacePathRef.current || null;
    setWorkspaceModalMode("lostSync");
    setWorkspaceModalPath(lostPath);
    setIsWorkspaceModalOpen(true);
  });

  const handleSelectWorkspace = useCallback(async () => {
    await ipcInvoke("workspace:select");
  }, [ipcInvoke]);

  const openAddModuleModal = useCallback((trackIndex) => {
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
  }, [activeTrackId, userData]);

  const updateConfig = useCallback(
    (updates) => {
      const wasSequencerMode = userData.config?.sequencerMode;
      const willBeSequencerMode = updates.hasOwnProperty("sequencerMode")
        ? updates.sequencerMode
        : wasSequencerMode;

      if (
        willBeSequencerMode &&
        Object.prototype.hasOwnProperty.call(updates || {}, "sequencerBpm") &&
        typeof updates.sequencerBpm === "number" &&
        Number.isFinite(updates.sequencerBpm) &&
        sequencerEngineRef.current
      ) {
        sequencerEngineRef.current.setBpm(updates.sequencerBpm);
      }

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

      const normalizeUserColors = (list) => {
        const raw = Array.isArray(list) ? list : [];
        const out = [];
        const seen = new Set();
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
        produce((draft) => {
          if (!draft.config) {
            draft.config = {};
          }

          const hasUserColors = Object.prototype.hasOwnProperty.call(
            updates || {},
            "userColors"
          );

          if (hasUserColors) {
            const palette = normalizeUserColors(updates.userColors);
            draft.config.userColors = palette;

            const syncOptions = (options) => {
              const list = Array.isArray(options) ? options : [];
              for (const opt of list) {
                if (!opt || typeof opt !== "object") continue;
                if (opt.randomizeFromUserColors !== true) continue;
                if (palette.length > 0) {
                  opt.randomValues = [...palette];
                } else {
                  delete opt.randomValues;
                  delete opt.randomizeFromUserColors;
                }
              }
            };

            const syncMethodList = (methods) => {
              const list = Array.isArray(methods) ? methods : [];
              for (const m of list) {
                if (!m || typeof m !== "object") continue;
                syncOptions(m.options);
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
                  syncMethodList(md.constructor);
                  const methodsByChannel =
                    md.methods && typeof md.methods === "object"
                      ? md.methods
                      : null;
                  if (!methodsByChannel) continue;
                  for (const channelKey of Object.keys(methodsByChannel)) {
                    syncMethodList(methodsByChannel[channelKey]);
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
    (channelName, stepIndex) => {
      if (!firstVisibleTrack) return;
      const { track } = firstVisibleTrack;

      setRecordingData(
        produce((draft) => {
          if (!draft[track.id]) {
            draft[track.id] = { channels: [], sequencer: { pattern: {} } };
          }
          if (!draft[track.id].sequencer) {
            draft[track.id].sequencer = { pattern: {} };
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
        const sequencerData = getSequencerForTrack(recordingData, track.id);
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
        sequencerEngineRef.current.load(updatedPattern, bpm);
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
        const sequencerData = getSequencerForTrack(recordingData, track.id);
        const pattern = sequencerData.pattern || {};
        const bpm = config.sequencerBpm || 120;
        sequencerEngineRef.current.load(pattern, bpm);

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
          const recording = getRecordingForTrack(recordingData, track.id);
          if (
            !recording ||
            !recording.channels ||
            recording.channels.length === 0
          ) {
            alert("No recording available. Trigger some channels first.");
            return;
          }

          const channels = recording.channels.map((ch) => ({
            name: ch.name,
            midi: 0,
            sequences: ch.sequences || [],
          }));

          const bpm = track.bpm || 120;
          footerPlaybackEngineRef.current[trackId].load(channels, bpm);
        } catch (error) {
          console.error("Error loading recording for playback:", error);
          alert(`Failed to load recording for playback: ${error.message}`);
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
    const handleKeyDown = (e) => {
      if (e.code !== "Space") return;

      const target = e.target;
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
        inputStatus={inputStatus}
        inputConfig={inputConfig}
        config={userData.config}
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
        onCreateNewModule={handleCreateNewModule}
        onEditModule={handleEditModule}
        mode="add-to-track"
      />
      <AddModuleModal
        isOpen={isManageModulesModalOpen}
        onClose={() => setIsManageModulesModalOpen(false)}
        trackIndex={null}
        userData={userData}
        setUserData={setUserData}
        predefinedModules={predefinedModules}
        onCreateNewModule={handleCreateNewModule}
        onEditModule={handleEditModule}
        mode="manage-modules"
      />
      <ModuleEditorModal
        isOpen={isModuleEditorOpen}
        onClose={handleCloseModuleEditor}
        moduleName={editingModuleName}
        templateType={editingTemplateType}
        onModuleSaved={null}
        predefinedModules={predefinedModules}
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
        onClose={() => setSelectedChannel(null)}
        predefinedModules={predefinedModules}
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
