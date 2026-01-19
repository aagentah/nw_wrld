import { useIPCListener } from "./useIPC";
import { updateActiveSet, updateUserData } from "../utils";

type UseModuleIntrospectionArgs = {
  activeSetId: string | null;
  setUserData: Parameters<typeof updateUserData>[0];
  setPredefinedModules: (updater: (prev: Array<Record<string, unknown>>) => Array<Record<string, unknown>>) => void;
  setWorkspaceModuleLoadFailures: (updater: (prev: string[]) => string[]) => void;
};

export const useModuleIntrospection = ({
  activeSetId,
  setUserData,
  setPredefinedModules,
  setWorkspaceModuleLoadFailures,
}: UseModuleIntrospectionArgs) => {
  useIPCListener("from-projector", (_event, data: unknown) => {
    const d = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
    if (d.type !== "workspace-modules-failed" && d.type !== "workspace-modules-loaded") return;
    const payload =
      d.props && typeof d.props === "object" ? (d.props as Record<string, unknown>) : {};
    const moduleIdsRaw = Array.isArray(payload.moduleIds) ? payload.moduleIds : [];
    const moduleIds = moduleIdsRaw.map((x) => String(x || "").trim()).filter(Boolean);
    if (!moduleIds.length) return;

    if (d.type === "workspace-modules-loaded") {
      setWorkspaceModuleLoadFailures((prev) =>
        (Array.isArray(prev) ? prev : []).filter((id) => !moduleIds.includes(String(id)))
      );
      setPredefinedModules((prev) =>
        (prev || []).map((m) => {
          const mObj = m && typeof m === "object" ? (m as Record<string, unknown>) : {};
          const id = mObj.id ? String(mObj.id) : "";
          if (!id || !moduleIds.includes(id)) return m;
          return mObj.status === "failed" ? ({ ...mObj, status: "uninspected" } as typeof m) : m;
        })
      );
      return;
    }

    setWorkspaceModuleLoadFailures((prev) => {
      const list = Array.isArray(prev) ? prev : [];
      const out = new Set(list.map((x) => String(x)));
      moduleIds.forEach((id) => out.add(id));
      return Array.from(out);
    });
    setPredefinedModules((prev) =>
      (prev || []).map((m) => {
        const mObj = m && typeof m === "object" ? (m as Record<string, unknown>) : {};
        const id = mObj.id ? String(mObj.id) : "";
        if (!id || !moduleIds.includes(id)) return m;
        return { ...mObj, status: "failed" } as typeof m;
      })
    );
  });

  useIPCListener("from-projector", (_event, data: unknown) => {
    const d = data && typeof data === 'object' ? data as Record<string, unknown> : {};
    if (d.type !== "module-introspect-result") return;
    const payload = d.props && typeof d.props === 'object' ? d.props as Record<string, unknown> : {};
    const moduleId = payload.moduleId;
    if (!moduleId) return;

    if (payload.ok) {
      const incomingMethods = Array.isArray(payload.methods) ? payload.methods : [];
      setPredefinedModules((prev) =>
        (prev || []).map((m) => {
          const mObj = m && typeof m === 'object' ? m as Record<string, unknown> : {};
          return mObj.id === moduleId
            ? {
                ...mObj,
                methods: incomingMethods,
                status: "ready",
              }
            : m;
        })
      );
      setWorkspaceModuleLoadFailures((prev) => (prev || []).filter((id) => id !== moduleId));

      const executeOnLoad = incomingMethods
        .filter((m: unknown) => {
          const mObj = m && typeof m === 'object' ? m as Record<string, unknown> : {};
          return mObj.executeOnLoad;
        })
        .filter((m: unknown) => {
          const mObj = m && typeof m === 'object' ? m as Record<string, unknown> : {};
          return mObj.name !== "matrix" && mObj.name !== "show";
        });

      if (executeOnLoad.length) {
        updateActiveSet(setUserData, activeSetId, (activeSet: unknown) => {
          const activeSetObj = activeSet && typeof activeSet === 'object' ? activeSet as Record<string, unknown> : {};
          const tracks = Array.isArray(activeSetObj.tracks) ? activeSetObj.tracks : [];
          for (const track of tracks) {
            const trackObj = track && typeof track === 'object' ? track as Record<string, unknown> : {};
            const modules = Array.isArray(trackObj.modules) ? trackObj.modules : [];
            const modulesData = trackObj.modulesData || null;
            if (!modulesData || typeof modulesData !== 'object') continue;
            const modulesDataObj = modulesData as Record<string, unknown>;

            for (const inst of modules) {
              const instObj = inst && typeof inst === 'object' ? inst as Record<string, unknown> : {};
              const instId = instObj.id ? String(instObj.id) : "";
              const type = instObj.type ? String(instObj.type) : "";
              if (!instId || !type) continue;
              if (type !== moduleId) continue;

              const data = modulesDataObj[instId];
              const dataObj = data && typeof data === 'object' ? data as Record<string, unknown> : {};
              const ctor = Array.isArray(dataObj.constructor) ? dataObj.constructor : null;
              if (!ctor) continue;

              const names = ctor.map((m: unknown) => {
                const mObj = m && typeof m === 'object' ? m as Record<string, unknown> : {};
                return mObj.name ? String(mObj.name) : "";
              }).filter(Boolean);
              if (names.length > 2) continue;
              if (names.some((n: string) => n !== "matrix" && n !== "show")) continue;

              const existingSet = new Set(names);
              const missing = executeOnLoad.filter((m: unknown) => {
                const mObj = m && typeof m === 'object' ? m as Record<string, unknown> : {};
                return !existingSet.has(String(mObj.name || ''));
              });
              if (!missing.length) continue;

              const matrix = ctor.find((m: unknown) => {
                const mObj = m && typeof m === 'object' ? m as Record<string, unknown> : {};
                return mObj.name === "matrix";
              }) || null;
              const show = ctor.find((m: unknown) => {
                const mObj = m && typeof m === 'object' ? m as Record<string, unknown> : {};
                return mObj.name === "show";
              }) || null;

              const filled = missing.map((method: unknown) => {
                const methodObj = method && typeof method === 'object' ? method as Record<string, unknown> : {};
                const options = Array.isArray(methodObj.options) ? methodObj.options : [];
                return {
                  name: methodObj.name,
                  options: options.map((opt: unknown) => {
                    const optObj = opt && typeof opt === 'object' ? opt as Record<string, unknown> : {};
                    return {
                      name: optObj.name,
                      value: optObj.defaultVal,
                    };
                  }),
                };
              });

              const nextCtor: unknown[] = [];
              if (matrix) nextCtor.push(matrix);
              nextCtor.push(...filled);
              if (show) nextCtor.push(show);
              (dataObj as { constructor?: unknown }).constructor = nextCtor;
            }
          }
        });
      }
    } else {
      setWorkspaceModuleLoadFailures((prev) => {
        const list = Array.isArray(prev) ? prev : [];
        if (list.includes(String(moduleId))) return list;
        return [...list, String(moduleId)];
      });
      setPredefinedModules((prev) =>
        (prev || []).map((m) => {
          const mObj = m && typeof m === 'object' ? m as Record<string, unknown> : {};
          return mObj.id === moduleId ? { ...mObj, status: "failed" } as typeof m : m;
        })
      );
    }
  });
};

