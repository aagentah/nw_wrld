import { useCallback, useEffect } from "react";
import type { UserData, DashboardToProjectorMessageMap } from "../../../types";
import type { WorkspaceModuleSummary } from "../../../types/workspace";
import type { NwWrldBridge } from "../../../types/bridge";
import { getProjectDir } from "../../../shared/utils/projectDir";
import { updateUserData } from "../utils";
import { useIPCListener } from "./useIPC";

// Type declaration for hot module replacement
declare const module: { hot?: { accept: (path: string, callback: () => void) => void } } | undefined;

export interface PredefinedModule {
  id: string;
  name: string;
  category: string;
  methods: unknown[];
  status: string;
}

export interface UseWorkspaceModulesParams {
  workspacePath: string | null;
  isWorkspaceModalOpen: boolean;
  sendToProjector: <K extends keyof DashboardToProjectorMessageMap>(
    type: K,
    props: DashboardToProjectorMessageMap[K]
  ) => void;
  userData: UserData;
  setUserData: React.Dispatch<React.SetStateAction<UserData>>;
  predefinedModules: PredefinedModule[];
  workspaceModuleFiles: string[];
  setPredefinedModules: React.Dispatch<React.SetStateAction<PredefinedModule[]>>;
  setWorkspaceModuleFiles: React.Dispatch<React.SetStateAction<string[]>>;
  setWorkspaceModuleLoadFailures: React.Dispatch<React.SetStateAction<string[]>>;
  setIsProjectorReady: React.Dispatch<React.SetStateAction<boolean>>;
  didMigrateWorkspaceModuleTypesRef: React.MutableRefObject<boolean>;
  loadModulesRunIdRef: React.MutableRefObject<number>;
}

export const useWorkspaceModules = ({
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
}: UseWorkspaceModulesParams): { loadModules: () => Promise<void> } => {
  const loadModules = useCallback(async () => {
    const runId = ++loadModulesRunIdRef.current;
    const isStale = () => runId !== loadModulesRunIdRef.current;
    try {
      if (isWorkspaceModalOpen) return;
      const projectDirArg = getProjectDir();
      if (!projectDirArg) return;
      if (!workspacePath) return;

      let summaries: WorkspaceModuleSummary[] = [];
      try {
        const bridge = globalThis.nwWrldBridge as NwWrldBridge | undefined;
        if (
          bridge &&
          bridge.workspace &&
          typeof bridge.workspace.listModuleSummaries === "function"
        ) {
          summaries = await bridge.workspace.listModuleSummaries();
        } else {
          summaries = [];
        }
      } catch {
        summaries = [];
      }

      const safeSummaries = Array.isArray(summaries) ? summaries : [];
      const allModuleIds = safeSummaries
        .map((s) => (s?.id ? String(s.id) : ""))
        .filter(Boolean);
      const listable = safeSummaries.filter((s) => Boolean(s?.hasMetadata));

      if (isStale()) return;

      setWorkspaceModuleFiles(allModuleIds);

      const validModules = listable
        .map((s) => {
          const moduleId = s?.id ? String(s.id) : "";
          const name = s?.name ? String(s.name) : "";
          const category = s?.category ? String(s.category) : "";
          if (!moduleId || !name || !category) return null;
          if (!/^[A-Za-z][A-Za-z0-9]*$/.test(moduleId)) return null;
          return {
            id: moduleId,
            name,
            category,
            methods: [],
            status: "uninspected",
          } as PredefinedModule;
        })
        .filter((m): m is PredefinedModule => m !== null);

      if (isStale()) return;

      setPredefinedModules(validModules);
      setWorkspaceModuleLoadFailures([]);
      setIsProjectorReady(false);

      if (isStale()) return;

      sendToProjector("refresh-projector", {});
      return;
    } catch (error) {
      console.error("❌ [Dashboard] Error loading modules:", error);
      alert("Failed to load modules from project folder.");
    }
  }, [
    isWorkspaceModalOpen,
    sendToProjector,
    workspacePath,
    setWorkspaceModuleFiles,
    setPredefinedModules,
    setWorkspaceModuleLoadFailures,
    setIsProjectorReady,
  ]);

  useEffect(() => {
    loadModules();
  }, [loadModules]);

  useEffect(() => {
    try {
      if (!workspacePath) {
        didMigrateWorkspaceModuleTypesRef.current = false;
        return;
      }
      if (didMigrateWorkspaceModuleTypesRef.current) return;
      if (!Array.isArray(predefinedModules) || predefinedModules.length === 0)
        return;

      const workspaceFileSet = new Set(
        (workspaceModuleFiles || []).filter(Boolean)
      );
      if (workspaceFileSet.size === 0) return;

      const displayNameToId = new Map<string, string>();
      const dupes = new Set<string>();
      predefinedModules.forEach((m) => {
        const displayName = m?.name ? String(m.name) : "";
        const id = m?.id ? String(m.id) : "";
        if (!displayName || !id) return;
        if (displayNameToId.has(displayName)) {
          dupes.add(displayName);
          return;
        }
        displayNameToId.set(displayName, id);
      });
      dupes.forEach((d) => displayNameToId.delete(d));

      if (displayNameToId.size === 0) {
        didMigrateWorkspaceModuleTypesRef.current = true;
        return;
      }

      let needsChange = false;
      const sets = (userData as { sets?: unknown[] })?.sets;
      if (Array.isArray(sets)) {
        for (const setData of sets) {
          const tracks = (setData as { tracks?: unknown[] })?.tracks;
          if (!Array.isArray(tracks)) continue;
          for (const track of tracks) {
            const mods = (track as { modules?: unknown[] })?.modules;
            if (!Array.isArray(mods)) continue;
            for (const inst of mods) {
              const t = (inst as { type?: unknown })?.type;
              if (!t || typeof t !== "string") continue;
              if (workspaceFileSet.has(t)) continue;
              const mapped = displayNameToId.get(t);
              if (mapped && workspaceFileSet.has(mapped)) {
                needsChange = true;
                break;
              }
            }
            if (needsChange) break;
          }
          if (needsChange) break;
        }
      }

      if (!needsChange) {
        didMigrateWorkspaceModuleTypesRef.current = true;
        return;
      }

      updateUserData(setUserData, (draft) => {
        if (!Array.isArray((draft as { sets?: unknown[] })?.sets)) return;
        (draft as { sets: unknown[] }).sets.forEach((set) => {
          const tracks = (set as { tracks?: unknown[] })?.tracks;
          if (!Array.isArray(tracks)) return;
          tracks.forEach((track) => {
            const mods = (track as { modules?: unknown[] })?.modules;
            if (!Array.isArray(mods)) return;
            mods.forEach((inst) => {
              const t = (inst as { type?: unknown })?.type;
              if (!t || typeof t !== "string") return;
              if (workspaceFileSet.has(t)) return;
              const mapped = displayNameToId.get(t);
              if (mapped && workspaceFileSet.has(mapped)) {
                (inst as { type: string }).type = mapped;
              }
            });
          });
        });
      });

      didMigrateWorkspaceModuleTypesRef.current = true;
    } catch (e) {
      didMigrateWorkspaceModuleTypesRef.current = true;
      console.warn("[Dashboard] Workspace module type migration skipped:", e);
    }
  }, [
    workspacePath,
    predefinedModules,
    workspaceModuleFiles,
    userData,
    setUserData,
  ]);

  useIPCListener(
    "workspace:modulesChanged",
    () => {
      if (workspacePath) {
        loadModules();
        return;
      }
      loadModules();
    },
    [loadModules]
  );

  useEffect(() => {
    try {
      if (module && module.hot) {
        try {
          module.hot.accept("../../../projector/helpers/moduleBase", () => {
            loadModules();
          });
        } catch {}
        try {
          module.hot.accept("../../../projector/helpers/threeBase", () => {
            loadModules();
          });
        } catch {}
      }
    } catch (e) {}
  }, [loadModules]);

  return { loadModules };
};
