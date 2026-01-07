import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAtom } from "jotai";
import { FaPlus, FaCode, FaEye, FaSpinner, FaCheck } from "react-icons/fa";
import { Modal } from "../shared/Modal.jsx";
import { useIPCListener, useIPCSend } from "../core/hooks/useIPC.js";
import { ModalHeader } from "../components/ModalHeader.js";
import { Button } from "../components/Button.js";
import { HelpIcon } from "../components/HelpIcon.js";
import { activeSetIdAtom, activeTrackIdAtom } from "../core/state.js";
import { updateActiveSet } from "../core/utils.js";
import { getActiveSetTracks } from "../../shared/utils/setUtils.js";
import { HELP_TEXT } from "../../shared/helpText.js";

export const AddModuleModal = ({
  isOpen,
  onClose,
  trackIndex,
  userData,
  setUserData,
  predefinedModules,
  onCreateNewModule,
  onEditModule,
  mode = "add-to-track",
}) => {
  const sendToProjector = useIPCSend("dashboard-to-projector");
  const [hoveredPreviewModuleId, setHoveredPreviewModuleId] = useState(null);
  const [loadingPreviewModuleId, setLoadingPreviewModuleId] = useState(null);
  const previewRequestRef = useRef({ moduleId: null, requestId: null });
  const lastAutoPreviewSentRef = useRef(null);

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
      ? tracks.findIndex((t) => t.id === activeTrackId)
      : null;

  const track =
    effectiveTrackIndex !== null && effectiveTrackIndex !== -1
      ? tracks?.[effectiveTrackIndex]
      : null;

  const modulesWithTrackIndicator = useMemo(() => {
    const list = Array.isArray(predefinedModules) ? predefinedModules : [];
    const modules = Array.isArray(track?.modules) ? track.modules : [];

    if (modules.length === 0) {
      return list.map((m) => ({ ...m, instancesOnCurrentTrack: 0 }));
    }

    const typeCounts = new Map();
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

  const handleAddToTrack = (module) => {
    if (!track || effectiveTrackIndex === null || effectiveTrackIndex === -1)
      return;
    sendToProjector("clear-preview", {});
    updateActiveSet(setUserData, activeSetId, (activeSet) => {
      const track = activeSet.tracks[effectiveTrackIndex];
      const instanceId = `inst_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;
      track.modules.push({
        id: instanceId,
        type: module.id || module.name,
      });
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
      track.modulesData[instanceId] = {
        constructor: constructorMethods,
        methods: {},
      };
    });
    onClose();
  };

  const modulesByCategory = modulesWithTrackIndicator.reduce((acc, module) => {
    if (!acc[module.category]) {
      acc[module.category] = [];
    }
    acc[module.category].push(module);
    return acc;
  }, {});

  const handlePreviewHandshake = useCallback((event, data) => {
    if (!data || typeof data !== "object") return;
    if (
      data.type !== "preview-module-ready" &&
      data.type !== "preview-module-error"
    )
      return;

    const payload = data.props || {};
    const requestId = payload.requestId || null;
    if (!requestId) return;
    if (previewRequestRef.current.requestId !== requestId) return;

    setLoadingPreviewModuleId(null);
    previewRequestRef.current = {
      moduleId: previewRequestRef.current.moduleId,
      requestId: null,
    };
  }, []);

  useIPCListener("from-projector", handlePreviewHandshake, [
    handlePreviewHandshake,
  ]);

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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      onCloseHandler={handleClose}
      size="medium"
    >
      <ModalHeader title={modalTitle} onClose={handleClose} />

      <div className="px-6">
        {Object.entries(modulesByCategory).map(([category, modules]) => (
          <div key={category} className="mb-6 font-mono">
            <div className="mb-2">
              <div className="opacity-50 text-[11px] text-neutral-300">
                {category}:
              </div>

              <div className="pl-6 uppercase flex flex-col flex-wrap gap-2">
                {modules.map((module) => {
                  const handlePreview = () => {
                    const hoveredId = module.id || module.name;
                    if (!hoveredId) return;
                    if (hoveredPreviewModuleId === hoveredId) return;
                    const requestId = `${Date.now()}_${Math.random()
                      .toString(36)
                      .slice(2, 8)}`;
                    setHoveredPreviewModuleId(hoveredId);
                    setLoadingPreviewModuleId(hoveredId);
                    previewRequestRef.current = {
                      moduleId: hoveredId,
                      requestId,
                    };
                    lastAutoPreviewSentRef.current = null;
                    const moduleMethods = Array.isArray(module.methods)
                      ? module.methods
                      : [];
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
                    if (
                      !finalConstructorMethods.some((m) => m.name === "matrix")
                    ) {
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
                    if (
                      !finalConstructorMethods.some((m) => m.name === "show")
                    ) {
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

                  const isHovered =
                    hoveredPreviewModuleId === (module.id || module.name);
                  const isLoading =
                    loadingPreviewModuleId === (module.id || module.name);

                  return (
                    <div
                      key={module.id || module.name}
                      className="flex items-center gap-1 group"
                    >
                      <div className="font-mono text-[11px] text-neutral-300 uppercase flex-1 flex items-center gap-2">
                        <div className="truncate">{module.name}</div>
                        {module.instancesOnCurrentTrack > 0 ? (
                          <div
                            className="flex items-center gap-1 text-green-500/50"
                            title={`${module.instancesOnCurrentTrack} instance${
                              module.instancesOnCurrentTrack > 1 ? "s" : ""
                            } on this track`}
                          >
                            <FaCheck />
                            {module.instancesOnCurrentTrack > 1 ? (
                              <span className="text-[10px]">
                                {module.instancesOnCurrentTrack}
                              </span>
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
                            title={
                              isHovered && isLoading
                                ? "Loading preview..."
                                : "Preview module"
                            }
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
                          className="text-blue-500/75"
                        />
                        <Button
                          onClick={() => handleAddToTrack(module)}
                          type="secondary"
                          icon={<FaPlus />}
                          title={
                            track ? "Add to track" : "Select a track first"
                          }
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
      </div>
    </Modal>
  );
};
