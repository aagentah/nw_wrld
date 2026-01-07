import { useCallback, useEffect } from "react";
import { getProjectDir } from "../../../shared/utils/projectDir.js";
import { updateUserData } from "../utils.js";
import { useIPCListener } from "./useIPC.js";

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
}) => {
  const loadModules = useCallback(async () => {
    const runId = ++loadModulesRunIdRef.current;
    const isStale = () => runId !== loadModulesRunIdRef.current;
    try {
      if (isWorkspaceModalOpen) return;
      const projectDirArg = getProjectDir();
      if (!projectDirArg) return;
      if (!workspacePath) return;
      let summaries = [];
      try {
        const bridge = globalThis.nwWrldBridge;
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
          };
        })
        .filter(Boolean);
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
  }, [isWorkspaceModalOpen, sendToProjector, workspacePath]);

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

      const displayNameToId = new Map();
      const dupes = new Set();
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
      const sets = userData?.sets;
      if (Array.isArray(sets)) {
        for (const set of sets) {
          const tracks = set?.tracks;
          if (!Array.isArray(tracks)) continue;
          for (const track of tracks) {
            const mods = track?.modules;
            if (!Array.isArray(mods)) continue;
            for (const inst of mods) {
              const t = inst?.type;
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
        if (!Array.isArray(draft?.sets)) return;
        draft.sets.forEach((set) => {
          if (!Array.isArray(set?.tracks)) return;
          set.tracks.forEach((track) => {
            if (!Array.isArray(track?.modules)) return;
            track.modules.forEach((inst) => {
              const t = inst?.type;
              if (!t || typeof t !== "string") return;
              if (workspaceFileSet.has(t)) return;
              const mapped = displayNameToId.get(t);
              if (mapped && workspaceFileSet.has(mapped)) {
                inst.type = mapped;
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
          module.hot.accept("../../../projector/helpers/moduleBase.js", () => {
            loadModules();
          });
        } catch {}
        try {
          module.hot.accept("../../../projector/helpers/threeBase.js", () => {
            loadModules();
          });
        } catch {}
      }
    } catch (e) {}
  }, [loadModules]);

  return { loadModules };
};
