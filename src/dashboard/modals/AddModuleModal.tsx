import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAtom } from "jotai";
import {
  FaPlus,
  FaCode,
  FaEye,
  FaSpinner,
  FaCheck,
  FaExclamationTriangle,
  FaSyncAlt,
} from "react-icons/fa";
import { Modal } from "../shared/Modal";
import { useIPCListener, useIPCSend } from "../core/hooks/useIPC";
import { ModalHeader } from "../components/ModalHeader";
import { Button } from "../components/Button";
import { HelpIcon } from "../components/HelpIcon";
import { Tooltip } from "../components/Tooltip";
import { activeSetIdAtom, activeTrackIdAtom } from "../core/state";
import { updateActiveSet } from "../core/utils";
import { getActiveSetTracks } from "../../shared/utils/setUtils";
import { HELP_TEXT } from "../../shared/helpText";

type ModuleMethod = {
  name: string;
  executeOnLoad?: boolean;
  options?: Array<{
    name: string;
    defaultVal?: unknown;
  }>;
};

type PredefinedModule = {
  id?: string;
  name: string;
  category: string;
  status?: string;
  starterSync?: "inSync" | "outOfSync";
  methods?: ModuleMethod[];
  instancesOnCurrentTrack?: number;
};

type Track = {
  id: string | number;
  modules: Array<{ id: string; type: string }>;
  modulesData?: Record<string, unknown>;
};

type UserData = {
  [key: string]: unknown;
};

type AddModuleModalProps = {
  isOpen: boolean;
  onClose: () => void;
  trackIndex: number | null;
  userData: UserData;
  setUserData: (updater: unknown) => void;
  predefinedModules: PredefinedModule[];
  skippedWorkspaceModules?: Array<{ file: string; reason: string }>;
  onCreateNewModule?: () => void;
  onEditModule: (moduleId: string) => void;
  onConfirmRewrite?: (message: string, onConfirm: () => void, options?: { title?: string }) => void;
  mode?: "add-to-track" | "manage-modules";
};

export const AddModuleModal = ({
  isOpen,
  onClose,
  trackIndex,
  userData,
  setUserData,
  predefinedModules,
  skippedWorkspaceModules,
  onCreateNewModule: _onCreateNewModule,
  onEditModule,
  onConfirmRewrite,
  mode = "add-to-track",
}: AddModuleModalProps) => {
  const sendToProjector = useIPCSend("dashboard-to-projector");
  const [hoveredPreviewModuleId, setHoveredPreviewModuleId] = useState<string | null>(null);
  const [loadingPreviewModuleId, setLoadingPreviewModuleId] = useState<string | null>(null);
  const [rewritingModuleId, setRewritingModuleId] = useState<string | null>(null);
  const [rewriteError, setRewriteError] = useState<string | null>(null);
  const hoveredPreviewModuleIdRef = useRef<string | null>(null);
  const loadingPreviewModuleIdRef = useRef<string | null>(null);
  const previewRequestRef = useRef<{ moduleId: string | null; requestId: string | null }>({
    moduleId: null,
    requestId: null,
  });
  const previewDispatchedRequestIdRef = useRef<string | null>(null);
  const lastAutoPreviewSentRef = useRef<string | null>(null);
  const previewClearTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingClearAfterLoadRef = useRef(false);
  const wasOpenRef = useRef(false);

  const clearPreviewNow = useCallback(() => {
    setHoveredPreviewModuleId(null);
    setLoadingPreviewModuleId(null);
    hoveredPreviewModuleIdRef.current = null;
    loadingPreviewModuleIdRef.current = null;
    previewRequestRef.current = {
      moduleId: null,
      requestId: null,
    };
    previewDispatchedRequestIdRef.current = null;
    lastAutoPreviewSentRef.current = null;
    pendingClearAfterLoadRef.current = false;
    sendToProjector("clear-preview", {});
  }, [sendToProjector]);

  const schedulePreviewClear = useCallback(() => {
    if (previewClearTimeoutRef.current) {
      clearTimeout(previewClearTimeoutRef.current);
      previewClearTimeoutRef.current = null;
    }
    previewClearTimeoutRef.current = setTimeout(() => {
      previewClearTimeoutRef.current = null;
      if (
        hoveredPreviewModuleIdRef.current &&
        hoveredPreviewModuleIdRef.current === loadingPreviewModuleIdRef.current
      ) {
        pendingClearAfterLoadRef.current = true;
        return;
      }
      clearPreviewNow();
    }, 120);
  }, [clearPreviewNow]);

  const cancelScheduledPreviewClear = useCallback(() => {
    if (previewClearTimeoutRef.current) {
      clearTimeout(previewClearTimeoutRef.current);
      previewClearTimeoutRef.current = null;
    }
  }, []);

  const handleClose = () => {
    wasOpenRef.current = false;
    cancelScheduledPreviewClear();
    pendingClearAfterLoadRef.current = false;
    setRewritingModuleId(null);
    setRewriteError(null);
    clearPreviewNow();
    onClose();
  };

  useEffect(() => {
    hoveredPreviewModuleIdRef.current = hoveredPreviewModuleId;
  }, [hoveredPreviewModuleId]);

  useEffect(() => {
    loadingPreviewModuleIdRef.current = loadingPreviewModuleId;
  }, [loadingPreviewModuleId]);

  const modalTitle = (
    <>
      {mode === "add-to-track" ? "MODULE" : "MODULES"}
      <HelpIcon helpText={HELP_TEXT.modules} />
    </>
  );

  const [activeSetId] = useAtom(activeSetIdAtom);
  const [activeTrackId] = useAtom(activeTrackIdAtom);
  const tracks = getActiveSetTracks(userData, activeSetId);

  const effectiveTrackIndex =
    trackIndex !== null && trackIndex !== undefined
      ? trackIndex
      : mode === "manage-modules" && activeTrackId
        ? tracks.findIndex((t: { id: string | number }) => t.id === activeTrackId)
        : null;

  const track: Track | null =
    effectiveTrackIndex !== null && effectiveTrackIndex !== -1
      ? (tracks?.[effectiveTrackIndex] as Track | undefined) || null
      : null;

  const modulesWithTrackIndicator = useMemo(() => {
    const list = Array.isArray(predefinedModules) ? predefinedModules : [];
    const modules = Array.isArray(track?.modules) ? track.modules : [];

    if (modules.length === 0) {
      return list.map((m) => ({ ...m, instancesOnCurrentTrack: 0 }));
    }

    const typeCounts = new Map<string, number>();
    modules.forEach((inst) => {
      const type = inst?.type ? String(inst.type) : "";
      if (!type) return;
      typeCounts.set(type, (typeCounts.get(type) || 0) + 1);
    });

    return list.map((m) => {
      const id = m?.id ? String(m.id) : "";
      const name = m?.name ? String(m.name) : "";
      const countFromId = id ? typeCounts.get(id) || 0 : 0;
      const countFromName = name && name !== id ? typeCounts.get(name) || 0 : 0;
      return { ...m, instancesOnCurrentTrack: countFromId + countFromName };
    });
  }, [predefinedModules, track]);

  const handleAddToTrack = (module: PredefinedModule) => {
    if (!track || effectiveTrackIndex === null || effectiveTrackIndex === -1) return;
    wasOpenRef.current = false;
    cancelScheduledPreviewClear();
    clearPreviewNow();
    updateActiveSet(setUserData, activeSetId, (activeSet) => {
      const tracksUnknown = (activeSet as Record<string, unknown>).tracks;
      if (!Array.isArray(tracksUnknown)) return;
      const trackUnknown = tracksUnknown[effectiveTrackIndex];
      if (typeof trackUnknown !== "object" || !trackUnknown) return;
      const t = trackUnknown as Record<string, unknown>;

      const instanceId = `inst_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
      const modulesArray = Array.isArray(t.modules) ? t.modules : [];
      modulesArray.push({
        id: instanceId,
        type: module.id || module.name,
      });
      t.modules = modulesArray;

      const moduleMethods = Array.isArray(module.methods) ? module.methods : [];
      const hasMethodData = moduleMethods.length > 0;
      const constructorMethods = hasMethodData
        ? moduleMethods
            .filter((m) => m.executeOnLoad)
            .map((m) => ({
              name: m.name,
              options: m?.options?.length
                ? m.options.map((opt) => ({
                    name: opt.name,
                    value: opt.defaultVal,
                  }))
                : [],
            }))
        : [];

      if (!constructorMethods.some((m) => m.name === "matrix")) {
        constructorMethods.unshift({
          name: "matrix",
          options: [
            { name: "matrix", value: { rows: 1, cols: 1, excludedCells: [] } },
            { name: "border", value: false },
          ],
        });
      }
      if (!constructorMethods.some((m) => m.name === "show")) {
        constructorMethods.push({
          name: "show",
          options: [{ name: "duration", value: 0 }],
        });
      }

      const modulesData =
        typeof t.modulesData === "object" && t.modulesData
          ? (t.modulesData as Record<string, unknown>)
          : {};
      modulesData[instanceId] = {
        constructor: constructorMethods,
        methods: {},
      };
      t.modulesData = modulesData;
    });
    onClose();
  };

  const modulesByCategory = modulesWithTrackIndicator.reduce(
    (acc, module) => {
      if (!acc[module.category]) {
        acc[module.category] = [];
      }
      acc[module.category].push(module);
      return acc;
    },
    {} as Record<string, PredefinedModule[]>
  );

  const skippedList = useMemo(() => {
    const list = Array.isArray(skippedWorkspaceModules) ? skippedWorkspaceModules : [];
    return list
      .map((s) => ({
        file: s?.file ? String(s.file) : "",
        reason: s?.reason ? String(s.reason) : "",
      }))
      .filter((s) => Boolean(s.file && s.reason));
  }, [skippedWorkspaceModules]);

  const handleRewriteStarterModule = useCallback(async (moduleId: string) => {
    if (!moduleId) return;
    setRewriteError(null);
    setRewritingModuleId(moduleId);
    try {
      const bridge = globalThis.nwWrldBridge as
        | {
            workspace?: {
              rewriteStarterModule?: (
                moduleName: string
              ) => Promise<{ ok?: unknown; reason?: unknown } | null>;
            };
          }
        | undefined;
      if (typeof bridge?.workspace?.rewriteStarterModule !== "function") {
        throw new Error("Rewrite action unavailable");
      }
      const result = await bridge.workspace.rewriteStarterModule(moduleId);
      if (!result || result.ok !== true) {
        const reason =
          result && typeof result.reason === "string" ? result.reason : "rewrite failed";
        throw new Error(reason);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setRewriteError(`Failed to rewrite ${moduleId}: ${message}`);
    } finally {
      setRewritingModuleId((current) => (current === moduleId ? null : current));
    }
  }, []);

  const handleRequestRewriteStarterModule = useCallback(
    (moduleId: string) => {
      if (!moduleId || rewritingModuleId === moduleId) return;
      const confirmMessage = `This will replace your workspace copy of "${moduleId}.js" with the bundled starter module from nw_wrld. Any edits in your project folder for this module will be lost.`;
      const confirmAction = () => {
        void handleRewriteStarterModule(moduleId);
      };
      if (typeof onConfirmRewrite === "function") {
        onConfirmRewrite(confirmMessage, confirmAction, { title: "ARE YOU SURE?" });
        return;
      }
      confirmAction();
    },
    [handleRewriteStarterModule, onConfirmRewrite, rewritingModuleId]
  );

  const handlePreviewHandshake = useCallback(
    (event: unknown, data: unknown) => {
      if (!data || typeof data !== "object") return;
      const d = data as Record<string, unknown>;
      if (d.type !== "preview-module-ready" && d.type !== "preview-module-error") return;

      const payload = (d.props || {}) as Record<string, unknown>;
      const requestId = payload.requestId || null;
      if (!requestId) return;
      if (previewRequestRef.current.requestId !== requestId) return;

      setLoadingPreviewModuleId(null);
      loadingPreviewModuleIdRef.current = null;
      previewRequestRef.current = {
        moduleId: previewRequestRef.current.moduleId,
        requestId: null,
      };
      previewDispatchedRequestIdRef.current = null;
      if (pendingClearAfterLoadRef.current) {
        pendingClearAfterLoadRef.current = false;
        clearPreviewNow();
      }
    },
    [clearPreviewNow]
  );

  useIPCListener("from-projector", handlePreviewHandshake, [handlePreviewHandshake]);

  useIPCListener(
    "from-projector",
    (_event: unknown, data: unknown) => {
      if (!data || typeof data !== "object") return;
      const d = data as Record<string, unknown>;
      if (d.type !== "module-introspect-result") return;
      const payload = (d.props || {}) as Record<string, unknown>;
      const moduleId = payload.moduleId || null;
      if (!moduleId) return;
      if (payload.ok) return;
      if (loadingPreviewModuleIdRef.current !== moduleId) return;

      setLoadingPreviewModuleId(null);
      loadingPreviewModuleIdRef.current = null;
      previewRequestRef.current = { moduleId: String(moduleId), requestId: null };
      previewDispatchedRequestIdRef.current = null;
      if (pendingClearAfterLoadRef.current) {
        pendingClearAfterLoadRef.current = false;
        clearPreviewNow();
      }
    },
    [clearPreviewNow]
  );

  useEffect(() => {
    if (!isOpen) {
      if (wasOpenRef.current) {
        cancelScheduledPreviewClear();
        clearPreviewNow();
      }
      wasOpenRef.current = false;
      return;
    }
    wasOpenRef.current = true;
    if (!hoveredPreviewModuleId) return;
    if (lastAutoPreviewSentRef.current === hoveredPreviewModuleId) return;
    if (
      previewRequestRef.current.requestId &&
      previewDispatchedRequestIdRef.current === previewRequestRef.current.requestId
    ) {
      return;
    }

    const mod =
      (predefinedModules || []).find(
        (m) => (m?.id || m?.name) && (m.id || m.name) === hoveredPreviewModuleId
      ) || null;
    if (!mod) return;
    const moduleMethods = Array.isArray(mod.methods) ? mod.methods : [];
    if (moduleMethods.length === 0) return;

    const constructorMethods = moduleMethods
      .filter((m) => m.executeOnLoad)
      .map((m) => ({
        name: m.name,
        options: m?.options?.length
          ? m.options.map((opt) => ({
              name: opt.name,
              value: opt.defaultVal,
            }))
          : null,
      }));

    const finalConstructorMethods = [...constructorMethods];
    if (!finalConstructorMethods.some((m) => m.name === "matrix")) {
      finalConstructorMethods.unshift({
        name: "matrix",
        options: [
          { name: "matrix", value: { rows: 1, cols: 1, excludedCells: [] } },
          { name: "border", value: false },
        ],
      });
    }
    if (!finalConstructorMethods.some((m) => m.name === "show")) {
      finalConstructorMethods.push({
        name: "show",
        options: [{ name: "duration", value: 0 }],
      });
    }

    sendToProjector("preview-module", {
      moduleName: mod.id || mod.name,
      requestId: previewRequestRef.current.requestId,
      moduleData: {
        constructor: finalConstructorMethods,
        methods: {},
      },
    });
    previewDispatchedRequestIdRef.current = previewRequestRef.current.requestId;
    lastAutoPreviewSentRef.current = hoveredPreviewModuleId;
  }, [
    isOpen,
    hoveredPreviewModuleId,
    predefinedModules,
    sendToProjector,
    cancelScheduledPreviewClear,
    clearPreviewNow,
  ]);

  useEffect(() => {
    return () => {
      cancelScheduledPreviewClear();
    };
  }, [cancelScheduledPreviewClear]);

  if (mode === "add-to-track") {
    if (trackIndex === null || trackIndex === undefined) return null;
    if (!track || !track.modules) return null;
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} onOverlayClick={handleClose} size="medium">
      <ModalHeader title={modalTitle} onClose={handleClose} />

      <div className="px-6">
        <div className="flex flex-col gap-8 font-mono">
          {Object.entries(modulesByCategory).map(([category, modules]) => (
            <div key={category}>
              <div className="opacity-50 text-[11px] mb-1">{category}:</div>
              <div className="pl-6 uppercase flex flex-col gap-2">
                {modules.map((module) => {
                  const handlePreview = () => {
                    cancelScheduledPreviewClear();
                    pendingClearAfterLoadRef.current = false;
                    const hoveredId = module.id || module.name;
                    if (!hoveredId) return;
                    if (
                      previewRequestRef.current.moduleId === hoveredId &&
                      Boolean(previewRequestRef.current.requestId)
                    ) {
                      return;
                    }
                    if (hoveredPreviewModuleId === hoveredId) return;
                    const requestId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                    setHoveredPreviewModuleId(hoveredId);
                    setLoadingPreviewModuleId(hoveredId);
                    hoveredPreviewModuleIdRef.current = hoveredId;
                    loadingPreviewModuleIdRef.current = hoveredId;
                    previewRequestRef.current = {
                      moduleId: hoveredId,
                      requestId,
                    };
                    lastAutoPreviewSentRef.current = null;
                    const moduleMethods = Array.isArray(module.methods) ? module.methods : [];
                    const hasMethodData = moduleMethods.length > 0;

                    if (!hasMethodData) {
                      sendToProjector("module-introspect", {
                        moduleId: module.id || module.name,
                      });
                      return;
                    }

                    const constructorMethods = hasMethodData
                      ? moduleMethods
                          .filter((m) => m.executeOnLoad)
                          .map((m) => ({
                            name: m.name,
                            options: m?.options?.length
                              ? m.options.map((opt) => ({
                                  name: opt.name,
                                  value: opt.defaultVal,
                                }))
                              : null,
                          }))
                      : [];

                    const finalConstructorMethods = [...constructorMethods];
                    if (!finalConstructorMethods.some((m) => m.name === "matrix")) {
                      finalConstructorMethods.unshift({
                        name: "matrix",
                        options: [
                          {
                            name: "matrix",
                            value: { rows: 1, cols: 1, excludedCells: [] },
                          },
                          { name: "border", value: false },
                        ],
                      });
                    }
                    if (!finalConstructorMethods.some((m) => m.name === "show")) {
                      finalConstructorMethods.push({
                        name: "show",
                        options: [{ name: "duration", value: 0 }],
                      });
                    }

                    const previewData = {
                      type: "preview-module",
                      props: {
                        moduleName: module.id || module.name,
                        requestId,
                        moduleData: {
                          constructor: finalConstructorMethods,
                          methods: {},
                        },
                      },
                    };

                    sendToProjector(previewData.type, previewData.props);
                    previewDispatchedRequestIdRef.current = requestId;
                    lastAutoPreviewSentRef.current = hoveredId;
                  };

                  const handleClearPreview = () => {
                    const moduleId = module.id || module.name;
                    if (
                      hoveredPreviewModuleIdRef.current === moduleId &&
                      loadingPreviewModuleIdRef.current === moduleId
                    ) {
                      pendingClearAfterLoadRef.current = true;
                      return;
                    }
                    schedulePreviewClear();
                  };

                  const isHovered = hoveredPreviewModuleId === (module.id || module.name);
                  const isLoading = loadingPreviewModuleId === (module.id || module.name);
                  const isFailed = module?.status === "failed";
                  const moduleId = module.id || module.name;
                  const isOutOfSync = module?.starterSync === "outOfSync";
                  const isRewriting = rewritingModuleId === moduleId;
                  const loadFailedText = moduleId
                    ? `Module "${moduleId}.js" exists in your workspace but failed to load. Fix the module file (syntax/runtime error) and save to retry.`
                    : null;
                  const outOfSyncText = moduleId
                    ? `Module "${moduleId}.js" differs from the bundled starter module.`
                    : null;
                  const rewriteTooltipText = moduleId
                    ? `Rewrite "${moduleId}.js" with the bundled starter module.`
                    : null;

                  return (
                    <div key={module.id || module.name} className="flex items-center gap-1 group">
                      <div className="font-mono text-[11px] text-neutral-300 uppercase flex-1 flex items-center gap-2">
                        <div className="truncate">{module.name}</div>
                        {isOutOfSync ? (
                          <Tooltip content={outOfSyncText} position="top">
                            <span className="px-1 py-[1px] border border-yellow-500/20 text-yellow-500/70 text-[8px] leading-none cursor-help">
                              DIFFERS
                            </span>
                          </Tooltip>
                        ) : null}
                        {isFailed ? (
                          <span className="inline-flex items-center">
                            <Tooltip content={loadFailedText} position="top">
                              <span
                                className="text-red-500/70 text-[11px] cursor-help"
                                data-testid="module-load-failed"
                                data-module-name={moduleId}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  try {
                                    (
                                      globalThis as unknown as {
                                        nwWrldBridge?: {
                                          app?: { openProjectorDevTools?: () => void };
                                        };
                                      }
                                    )?.nwWrldBridge?.app?.openProjectorDevTools?.();
                                  } catch {}
                                }}
                              >
                                <FaExclamationTriangle />
                              </span>
                            </Tooltip>
                          </span>
                        ) : null}
                        {module.instancesOnCurrentTrack && module.instancesOnCurrentTrack > 0 ? (
                          <div
                            className="flex items-center gap-1 text-blue-500/50"
                            title={`${module.instancesOnCurrentTrack} instance${
                              module.instancesOnCurrentTrack > 1 ? "s" : ""
                            } on this track`}
                          >
                            <FaCheck />
                            {module.instancesOnCurrentTrack > 1 ? (
                              <span className="text-[10px]">{module.instancesOnCurrentTrack}</span>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-3">
                        {isOutOfSync ? (
                          <Tooltip content={rewriteTooltipText} position="top">
                            <span className="inline-flex">
                              <Button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRequestRewriteStarterModule(moduleId);
                                }}
                                type="secondary"
                                icon={
                                  isRewriting ? (
                                    <FaSpinner className="animate-spin" />
                                  ) : (
                                    <FaSyncAlt />
                                  )
                                }
                                title="Rewrite bundled starter module into workspace"
                                className="text-yellow-500/70"
                                disabled={isRewriting}
                              />
                            </span>
                          </Tooltip>
                        ) : null}
                        <div
                          onMouseEnter={handlePreview}
                          onMouseLeave={handleClearPreview}
                          className="cursor-default"
                        >
                          <div
                            title={isHovered && isLoading ? "Loading preview..." : "Preview module"}
                            className="cursor-help flex items-center text-neutral-400"
                          >
                            {isHovered && isLoading ? (
                              <FaSpinner className="animate-spin" />
                            ) : (
                              <FaEye />
                            )}
                          </div>
                        </div>

                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditModule(module.id || module.name);
                          }}
                          type="secondary"
                          icon={<FaCode />}
                          title="Edit code"
                          className="text-blue-500"
                        />
                        <Button
                          onClick={() => handleAddToTrack(module)}
                          type="secondary"
                          icon={<FaPlus />}
                          data-testid="add-module-to-track"
                          data-module-name={module.id || module.name}
                          title={track ? "Add to track" : "Select a track first"}
                          disabled={!track}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {skippedList.length > 0 ? (
            <div>
              <div className="opacity-50 text-[11px] mb-1">Skipped modules:</div>
              <div className="pl-6 flex flex-col gap-2">
                {skippedList.map((s) => (
                  <div key={s.file} className="flex items-start gap-2 text-[11px] text-neutral-300">
                    <span className="text-red-500/70 mt-[1px]">
                      <FaExclamationTriangle />
                    </span>
                    <div className="min-w-0">
                      <div className="truncate">{s.file}</div>
                      <div className="opacity-60">{s.reason}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {rewriteError ? (
            <div className="text-[11px] text-red-400/80 break-words">{rewriteError}</div>
          ) : null}
        </div>
      </div>
    </Modal>
  );
};
