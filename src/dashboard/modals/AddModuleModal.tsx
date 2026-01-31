import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAtom } from "jotai";
import { FaPlus, FaCode, FaEye, FaSpinner, FaCheck, FaExclamationTriangle } from "react-icons/fa";
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
  mode = "add-to-track",
}: AddModuleModalProps) => {
  const sendToProjector = useIPCSend("dashboard-to-projector");
  const [hoveredPreviewModuleId, setHoveredPreviewModuleId] = useState<string | null>(null);
  const [loadingPreviewModuleId, setLoadingPreviewModuleId] = useState<string | null>(null);
  const previewRequestRef = useRef<{ moduleId: string | null; requestId: string | null }>({
    moduleId: null,
    requestId: null,
  });
  const lastAutoPreviewSentRef = useRef<string | null>(null);

  const handleClose = () => {
    setHoveredPreviewModuleId(null);
    setLoadingPreviewModuleId(null);
    previewRequestRef.current = { moduleId: null, requestId: null };
    lastAutoPreviewSentRef.current = null;
    sendToProjector("clear-preview", {});
    onClose();
  };

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
    sendToProjector("clear-preview", {});
    updateActiveSet(setUserData, activeSetId, (activeSet) => {
      const tracksUnknown = (activeSet as Record<string, unknown>).tracks;
      if (!Array.isArray(tracksUnknown)) return;
      const trackUnknown = tracksUnknown[effectiveTrackIndex];
      if (typeof trackUnknown !== "object" || !trackUnknown) return;
      const t = trackUnknown as Record<string, unknown>;
      
      const instanceId = `inst_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
      
      const modulesData = typeof t.modulesData === "object" && t.modulesData
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

  const handlePreviewHandshake = useCallback((event: unknown, data: unknown) => {
    if (!data || typeof data !== "object") return;
    const d = data as Record<string, unknown>;
    if (d.type !== "preview-module-ready" && d.type !== "preview-module-error") return;

    const payload = (d.props || {}) as Record<string, unknown>;
    const requestId = payload.requestId || null;
    if (!requestId) return;
    if (previewRequestRef.current.requestId !== requestId) return;

    setLoadingPreviewModuleId(null);
    previewRequestRef.current = {
      moduleId: previewRequestRef.current.moduleId,
      requestId: null,
    };
  }, []);

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
      if (loadingPreviewModuleId !== moduleId) return;

      setLoadingPreviewModuleId(null);
      previewRequestRef.current = { moduleId: String(moduleId), requestId: null };
    },
    [loadingPreviewModuleId]
  );

  useEffect(() => {
    if (!isOpen) {
      setHoveredPreviewModuleId(null);
      setLoadingPreviewModuleId(null);
      previewRequestRef.current = { moduleId: null, requestId: null };
      lastAutoPreviewSentRef.current = null;
      return;
    }
    if (!hoveredPreviewModuleId) return;
    if (lastAutoPreviewSentRef.current === hoveredPreviewModuleId) return;

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
    lastAutoPreviewSentRef.current = hoveredPreviewModuleId;
  }, [isOpen, hoveredPreviewModuleId, predefinedModules, sendToProjector]);

  if (mode === "add-to-track") {
    if (trackIndex === null || trackIndex === undefined) return null;
    if (!track || !track.modules) return null;
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} onCloseHandler={handleClose} size="medium">
      <ModalHeader title={modalTitle} onClose={handleClose} />

      <div className="px-6">
        {Object.entries(modulesByCategory).map(([category, modules]) => (
          <div key={category} className="mb-6 font-mono">
            <div className="mb-2">
              <div className="opacity-50 text-[11px] text-neutral-300">{category}:</div>

              <div className="pl-6 uppercase flex flex-col flex-wrap gap-2">
                {modules.map((module) => {
                  const handlePreview = () => {
                    const hoveredId = module.id || module.name;
                    if (!hoveredId) return;
                    if (hoveredPreviewModuleId === hoveredId) return;
                    const requestId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                    setHoveredPreviewModuleId(hoveredId);
                    setLoadingPreviewModuleId(hoveredId);
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
                    lastAutoPreviewSentRef.current = hoveredId;
                  };

                  const handleClearPreview = () => {
                    setHoveredPreviewModuleId(null);
                    setLoadingPreviewModuleId(null);
                    previewRequestRef.current = {
                      moduleId: null,
                      requestId: null,
                    };
                    lastAutoPreviewSentRef.current = null;
                    sendToProjector("clear-preview", {});
                  };

                  const isHovered = hoveredPreviewModuleId === (module.id || module.name);
                  const isLoading = loadingPreviewModuleId === (module.id || module.name);
                  const isFailed = module?.status === "failed";
                  const moduleId = module.id || module.name;
                  const loadFailedText = moduleId
                    ? `Module "${moduleId}.js" exists in your workspace but failed to load. Fix the module file (syntax/runtime error) and save to retry.`
                    : null;

                  return (
                    <div key={module.id || module.name} className="flex items-center gap-1 group">
                      <div className="font-mono text-[11px] text-neutral-300 uppercase flex-1 flex items-center gap-2">
                        <div className="truncate">{module.name}</div>
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
                                        nwWrldBridge?: { app?: { openProjectorDevTools?: () => void } };
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
          </div>
        ))}

        {skippedList.length > 0 ? (
          <div className="mt-6 font-mono border-t border-neutral-800 pt-4">
            <div className="mb-2 opacity-50 text-[11px] text-neutral-300">Skipped modules:</div>
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
      </div>
    </Modal>
  );
};
