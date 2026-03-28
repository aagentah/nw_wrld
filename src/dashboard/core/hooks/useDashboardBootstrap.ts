import { useEffect } from "react";
import { getProjectDir } from "../../../shared/utils/projectDir";
import { getActiveSetTracks } from "../../../shared/utils/setUtils";
import { loadRecordingData } from "../../../shared/json/recordingUtils";
import { loadAppState } from "../../../shared/json/appStateUtils";
import { loadUserData } from "../utils";
import { useIPCListener } from "./useIPC";

type UseDashboardBootstrapArgs = {
  isInitialMountRef: { current: boolean };
  userDataLoadedSuccessfullyRef: { current: boolean };
  workspacePathRef: { current: string | null };
  setUserData: (next: Record<string, unknown>) => void;
  setRecordingData: (next: Record<string, unknown>) => void;
  setActiveTrackId: (id: string | number | null) => void;
  setActiveSetId: (id: string | null) => void;
  setInputConfig: (cfg: Record<string, unknown>) => void;
  setIsSequencerMuted: (next: boolean) => void;
  setWorkspacePath: (next: string | null) => void;
  setWorkspaceModalMode: (mode: "initial" | "lostSync") => void;
  setWorkspaceModalPath: (path: string | null) => void;
  setIsWorkspaceModalOpen: (open: boolean) => void;
};

export const useDashboardBootstrap = ({
  isInitialMountRef,
  userDataLoadedSuccessfullyRef,
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
}: UseDashboardBootstrapArgs) => {
  useEffect(() => {
    const initializeUserData = async () => {
      const data = await loadUserData();

      const loadedOk =
        data && typeof data === "object" && "_loadedSuccessfully" in data
          ? Boolean((data as Record<string, unknown>)._loadedSuccessfully)
          : false;
      userDataLoadedSuccessfullyRef.current = loadedOk;

      const recordings = await loadRecordingData();

      const appState = await loadAppState();
      const appStateObj =
        appState && typeof appState === "object" ? (appState as Record<string, unknown>) : {};
      const activeTrackIdToUse = appStateObj.activeTrackId;
      const activeSetIdToUse = appStateObj.activeSetId;
      const sequencerMutedToUse = appStateObj.sequencerMuted;
      const projectDirRaw = getProjectDir();
      const workspacePathToUse =
        typeof projectDirRaw === "string" && projectDirRaw ? projectDirRaw : null;
      workspacePathRef.current = workspacePathToUse;
      setIsSequencerMuted(Boolean(sequencerMutedToUse));
      setWorkspacePath(workspacePathToUse);
      if (!workspacePathToUse) {
        setWorkspaceModalMode("initial");
        setWorkspaceModalPath(null);
        setIsWorkspaceModalOpen(true);
      } else {
        const bridge = (globalThis as { nwWrldBridge?: unknown }).nwWrldBridge;
        const bridgeObj =
          bridge && typeof bridge === "object" ? (bridge as Record<string, unknown>) : {};
        const project = bridgeObj.project;
        const projectObj =
          project && typeof project === "object" ? (project as Record<string, unknown>) : {};
        const isAvailable =
          typeof projectObj.isDirAvailable === "function"
            ? (projectObj.isDirAvailable as () => boolean)()
            : false;
        if (!isAvailable) {
          setWorkspaceModalMode("lostSync");
          setWorkspaceModalPath(workspacePathToUse);
          setIsWorkspaceModalOpen(true);
        }
      }

      if (activeSetIdToUse) {
        setActiveSetId(typeof activeSetIdToUse === "string" ? activeSetIdToUse : null);
      }

      const dataObj = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
      setUserData(dataObj);
      setRecordingData(recordings);

      const cfg = dataObj.config || null;
      if (cfg && typeof cfg === "object" && "input" in cfg) {
        const cfgObj = cfg as Record<string, unknown>;
        const rawInput =
          cfgObj.input && typeof cfgObj.input === "object"
            ? (cfgObj.input as Record<string, unknown>)
            : {};
        setInputConfig(rawInput);
      }

      const tracks = getActiveSetTracks(data, activeSetIdToUse);
      if (tracks.length > 0) {
        const storedTrack = activeTrackIdToUse
          ? tracks.find((t: { id: unknown }) => t.id === activeTrackIdToUse)
          : null;
        if (storedTrack) {
          const trackId = (storedTrack as { id: unknown }).id;
          setActiveTrackId(
            typeof trackId === "string" || typeof trackId === "number" ? trackId : null
          );
        } else {
          const visibleTrack = tracks.find((t: { isVisible?: unknown }) => t.isVisible);
          const firstTrack = visibleTrack || tracks[0];
          const trackId = (firstTrack as { id: unknown }).id;
          setActiveTrackId(
            typeof trackId === "string" || typeof trackId === "number" ? trackId : null
          );
        }
      }

      isInitialMountRef.current = false;
    };

    initializeUserData();
  }, []);

  useIPCListener("workspace:lostSync", (_event, payload: unknown) => {
    const payloadObj =
      payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
    const lostPath =
      typeof payloadObj.workspacePath === "string"
        ? payloadObj.workspacePath
        : workspacePathRef.current || null;
    setWorkspaceModalMode("lostSync");
    setWorkspaceModalPath(lostPath);
    setIsWorkspaceModalOpen(true);
  });
};
