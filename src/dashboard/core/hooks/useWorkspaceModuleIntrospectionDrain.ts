import { useCallback, useEffect, useRef } from "react";
import { useIPCListener } from "./useIPC";

type UseWorkspaceModuleIntrospectionDrainArgs = {
  workspacePath: string | null;
  isProjectorReady: boolean;
  workspaceModuleLoadFailures: string[];
  workspaceModuleFiles: string[];
  sendToProjector: (type: string, props: Record<string, unknown>) => void;
};

export const useWorkspaceModuleIntrospectionDrain = ({
  workspacePath,
  isProjectorReady,
  workspaceModuleLoadFailures,
  workspaceModuleFiles,
  sendToProjector,
}: UseWorkspaceModuleIntrospectionDrainArgs) => {
  const pendingModuleIntrospectionsRef = useRef(new Set<string>());
  const pendingFullWorkspaceIntrospectionRef = useRef(false);
  const moduleIntrospectionDrainRunIdRef = useRef(0);
  const drainScheduledRef = useRef(false);
  const isProjectorReadyRef = useRef(isProjectorReady);

  useEffect(() => {
    isProjectorReadyRef.current = isProjectorReady;
  }, [isProjectorReady]);

  const drainNow = useCallback(() => {
    if (!workspacePath) return;
    if (!isProjectorReadyRef.current) return;

    const failures = Array.isArray(workspaceModuleLoadFailures)
      ? workspaceModuleLoadFailures.filter(Boolean)
      : [];
    const pending = Array.from(pendingModuleIntrospectionsRef.current || []);
    const pendingAll = pendingFullWorkspaceIntrospectionRef.current === true;
    const workspaceIds =
      pendingAll && Array.isArray(workspaceModuleFiles)
        ? workspaceModuleFiles.map((x) => String(x || "").trim()).filter(Boolean)
        : [];
    const ids = Array.from(new Set([...failures, ...pending, ...workspaceIds])).filter((id) =>
      /^[A-Za-z][A-Za-z0-9]*$/.test(String(id))
    );
    if (!ids.length) return;

    try {
      pendingModuleIntrospectionsRef.current.clear();
    } catch {}
    try {
      pendingFullWorkspaceIntrospectionRef.current = false;
    } catch {}

    const runId = ++moduleIntrospectionDrainRunIdRef.current;
    const batchSize = 25;
    const drainBatch = (startIndex: number) => {
      if (moduleIntrospectionDrainRunIdRef.current !== runId) return;
      const batch = ids.slice(startIndex, startIndex + batchSize);
      batch.forEach((moduleId) => {
        sendToProjector("module-introspect", { moduleId: String(moduleId) });
      });
      const next = startIndex + batchSize;
      if (next >= ids.length) return;
      setTimeout(() => drainBatch(next), 60);
    };
    drainBatch(0);
  }, [workspacePath, workspaceModuleLoadFailures, workspaceModuleFiles, sendToProjector]);

  const requestDrain = useCallback(() => {
    if (drainScheduledRef.current) return;
    drainScheduledRef.current = true;
    setTimeout(() => {
      drainScheduledRef.current = false;
      drainNow();
    }, 0);
  }, [drainNow]);

  useIPCListener(
    "workspace:modulesChanged",
    (_event, payload) => {
      if (!workspacePath) return;
      const p = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null;
      const filenameRaw = p && "filename" in p ? (p as { filename?: unknown }).filename : null;
      const filename = typeof filenameRaw === "string" ? filenameRaw : "";
      if (!filename || !/\.js$/i.test(filename)) {
        pendingFullWorkspaceIntrospectionRef.current = true;
      } else {
        const moduleId = filename.replace(/\.js$/i, "").trim();
        if (/^[A-Za-z][A-Za-z0-9]*$/.test(moduleId)) {
          try {
            pendingModuleIntrospectionsRef.current.add(moduleId);
          } catch {}
        }
      }

      if (isProjectorReadyRef.current) {
        requestDrain();
      }
    },
    [workspacePath, requestDrain]
  );

  useEffect(() => {
    if (!workspacePath) return;
    if (!isProjectorReady) return;
    requestDrain();
  }, [isProjectorReady, workspacePath, workspaceModuleFiles, workspaceModuleLoadFailures, requestDrain]);
};

