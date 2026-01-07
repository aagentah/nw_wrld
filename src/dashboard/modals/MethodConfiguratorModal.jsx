import React, {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { useAtom } from "jotai";
import { remove } from "lodash";
import { useIPCSend } from "../core/hooks/useIPC.js";
import { Modal } from "../shared/Modal.jsx";
import { ModalHeader } from "../components/ModalHeader.js";
import { SortableWrapper } from "../shared/SortableWrapper.jsx";
import { SortableList, arrayMove } from "../shared/SortableList.jsx";
import { horizontalListSortingStrategy } from "@dnd-kit/sortable";
import { ModalFooter } from "../components/ModalFooter.js";
import { Button } from "../components/Button.js";
import { Select } from "../components/FormInputs.js";
import { HelpIcon } from "../components/HelpIcon.js";
import { MethodBlock } from "../components/MethodBlock.js";
import { Tooltip } from "../components/Tooltip.js";
import { FaExclamationTriangle } from "react-icons/fa";
import {
  userDataAtom,
  selectedChannelAtom,
  activeSetIdAtom,
} from "../core/state.js";
import { updateActiveSet, getMethodsByLayer } from "../core/utils.js";
import { getActiveSetTracks } from "../../shared/utils/setUtils.js";
import { getBaseMethodNames } from "../utils/moduleUtils.js";
import { HELP_TEXT } from "../../shared/helpText.js";
import { MethodCodeModal } from "./MethodCodeModal.jsx";

const SortableItem = React.memo(
  ({
    id,
    method,
    handleRemoveMethod,
    changeOption,
    addMissingOption,
    moduleMethods,
    moduleName,
    onShowMethodCode,
  }) => {
    const toggleRandomization = useCallback(
      (optionName, optionDef = null) => {
        const option = method.options.find((o) => o.name === optionName);
        if (!option) return;

        const type = optionDef?.type || null;
        if (type === "select") {
          if (
            Array.isArray(option.randomValues) &&
            option.randomValues.length
          ) {
            changeOption(method.name, optionName, undefined, "randomValues");
            return;
          }
          const values = Array.isArray(optionDef?.values)
            ? optionDef.values
            : [];
          if (!values.length) return;
          changeOption(method.name, optionName, [...values], "randomValues");
          return;
        }

        if (option.randomRange) {
          changeOption(method.name, optionName, undefined, "randomRange");
          return;
        }

        const defaultVal =
          typeof optionDef?.defaultVal === "boolean"
            ? optionDef.defaultVal
            : typeof optionDef?.defaultVal === "number"
            ? optionDef.defaultVal
            : typeof option.defaultVal === "boolean"
            ? option.defaultVal
            : parseFloat(option.defaultVal);

        let min, max;
        if (typeof defaultVal === "boolean") {
          min = false;
          max = true;
        } else {
          min = Math.max(defaultVal * 0.8, 0);
          max = defaultVal * 1;
        }
        changeOption(method.name, optionName, [min, max], "randomRange");
      },
      [method.name, method.options, changeOption]
    );

    const handleRandomChange = useCallback(
      (optionName, indexOrValues, newValue, optionDef = null) => {
        const option = method.options.find((o) => o.name === optionName);
        if (!option) return;

        const type = optionDef?.type || null;
        if (type === "select") {
          const values = Array.isArray(optionDef?.values)
            ? optionDef.values
            : [];
          if (!values.length) return;
          if (!Array.isArray(indexOrValues)) return;
          const selected = values.filter((v) => indexOrValues.includes(v));
          if (selected.length === 0) {
            changeOption(method.name, optionName, undefined, "randomValues");
          } else {
            changeOption(method.name, optionName, selected, "randomValues");
          }
          return;
        }

        if (!option.randomRange) return;

        let newRandomRange;
        if (type === "boolean") {
          newRandomRange = [...option.randomRange];
          newRandomRange[indexOrValues] = newValue === "true";
        } else {
          newRandomRange = [...option.randomRange];
          newRandomRange[indexOrValues] = parseFloat(newValue);
        }
        changeOption(method.name, optionName, newRandomRange, "randomRange");
      },
      [method.options, method.name, changeOption]
    );

    const handleOptionChange = useCallback(
      (methodName, optionName, value) => {
        changeOption(methodName, optionName, value);
      },
      [changeOption]
    );

    return (
      <SortableWrapper id={id} disabled={method.name === "matrix"}>
        {({ dragHandleProps, isDragging }) => (
          <>
            <div>
              <MethodBlock
                method={method}
                mode="dashboard"
                moduleMethods={moduleMethods}
                moduleName={moduleName}
                dragHandleProps={dragHandleProps}
                onRemove={handleRemoveMethod}
                onShowCode={onShowMethodCode}
                onOptionChange={handleOptionChange}
                onToggleRandom={(optionName, optionDef) =>
                  toggleRandomization(optionName, optionDef)
                }
                onRandomRangeChange={(optionName, index, newValue, optionDef) =>
                  handleRandomChange(optionName, index, newValue, optionDef)
                }
                onAddMissingOption={addMissingOption}
              />
            </div>

            {method.name === "matrix" && (
              <div className="h-auto flex items-center mx-2 text-neutral-800 text-lg font-mono">
                +
              </div>
            )}
          </>
        )}
      </SortableWrapper>
    );
  }
);

SortableItem.displayName = "SortableItem";

export const MethodConfiguratorModal = ({
  isOpen,
  onClose,
  predefinedModules,
  onEditChannel,
  onDeleteChannel,
  workspacePath = null,
  workspaceModuleFiles = [],
  workspaceModuleLoadFailures = [],
}) => {
  const [userData, setUserData] = useAtom(userDataAtom);
  const [selectedChannel] = useAtom(selectedChannelAtom);
  const [selectedMethodForCode, setSelectedMethodForCode] = useState(null);
  const sendToProjector = useIPCSend("dashboard-to-projector");
  const { moduleBase, threeBase } = useMemo(() => getBaseMethodNames(), []);
  const lastNormalizedKeyRef = useRef(null);

  const module = useMemo(() => {
    if (!selectedChannel) return null;
    return predefinedModules.find(
      (m) =>
        m.id === selectedChannel.moduleType ||
        m.name === selectedChannel.moduleType
    );
  }, [predefinedModules, selectedChannel]);

  const needsIntrospection =
    Boolean(selectedChannel?.moduleType) &&
    Boolean(module) &&
    (!Array.isArray(module.methods) || module.methods.length === 0);

  const selectedModuleType = selectedChannel?.moduleType || null;
  const isWorkspaceMode = Boolean(workspacePath);
  const workspaceFileSet = useMemo(() => {
    return new Set((workspaceModuleFiles || []).filter(Boolean));
  }, [workspaceModuleFiles]);
  const workspaceFailureSet = useMemo(() => {
    return new Set((workspaceModuleLoadFailures || []).filter(Boolean));
  }, [workspaceModuleLoadFailures]);
  const isFileMissing =
    isWorkspaceMode &&
    selectedModuleType &&
    !workspaceFileSet.has(selectedModuleType);
  const isLoadFailed =
    isWorkspaceMode &&
    selectedModuleType &&
    workspaceFileSet.has(selectedModuleType) &&
    workspaceFailureSet.has(selectedModuleType);
  const missingReasonText = isFileMissing
    ? `Module "${selectedModuleType}" was referenced by this track but "${selectedModuleType}.js" was not found in your workspace modules folder.`
    : isLoadFailed
    ? `Module "${selectedModuleType}.js" exists in your workspace but failed to load. Fix the module file (syntax/runtime error) and save to retry.`
    : `Module "${selectedModuleType}" is not available in the current workspace scan.`;

  const [activeSetId] = useAtom(activeSetIdAtom);

  useEffect(() => {
    if (!isOpen) return;
    if (!needsIntrospection) return;
    if (!selectedChannel?.moduleType) return;
    sendToProjector("module-introspect", {
      moduleId: selectedChannel.moduleType,
    });
  }, [
    isOpen,
    needsIntrospection,
    selectedChannel?.moduleType,
    sendToProjector,
  ]);

  useEffect(() => {
    if (!isOpen) return;
    if (!selectedChannel) return;
    if (
      !module ||
      !Array.isArray(module.methods) ||
      module.methods.length === 0
    )
      return;

    const channelKey = selectedChannel.isConstructor
      ? "constructor"
      : String(selectedChannel.channelNumber);
    const key = `${activeSetId || "no_set"}:${selectedChannel.trackIndex}:${
      selectedChannel.instanceId
    }:${channelKey}:${selectedChannel.moduleType || ""}`;
    if (lastNormalizedKeyRef.current === key) return;

    updateActiveSet(setUserData, activeSetId, (activeSet) => {
      const track = activeSet.tracks[selectedChannel.trackIndex];
      if (!track?.modulesData?.[selectedChannel.instanceId]) return;
      const methodList = selectedChannel.isConstructor
        ? track.modulesData[selectedChannel.instanceId].constructor
        : track.modulesData[selectedChannel.instanceId].methods[channelKey] ||
          [];
      if (!Array.isArray(methodList) || methodList.length === 0) return;

      let changed = false;

      const clampNumber = (n, min, max) => {
        let out = n;
        if (typeof min === "number") out = Math.max(min, out);
        if (typeof max === "number") out = Math.min(max, out);
        return out;
      };

      for (const m of methodList) {
        if (!m?.name || !Array.isArray(m.options)) continue;
        const methodDef = module.methods.find((mm) => mm?.name === m.name);
        if (!methodDef || !Array.isArray(methodDef.options)) continue;

        for (const opt of m.options) {
          if (!opt?.name) continue;
          const optDef = methodDef.options.find((oo) => oo?.name === opt.name);
          if (!optDef) continue;

          if (optDef.type === "number") {
            if (typeof opt.value === "string") {
              const n = Number(opt.value);
              const next = Number.isFinite(n)
                ? clampNumber(n, optDef.min, optDef.max)
                : optDef.defaultVal;
              if (opt.value !== next) {
                opt.value = next;
                changed = true;
              }
            }
            if (
              Array.isArray(opt.randomRange) &&
              opt.randomRange.length === 2
            ) {
              const [a, b] = opt.randomRange;
              const na = typeof a === "number" ? a : Number(a);
              const nb = typeof b === "number" ? b : Number(b);
              if (Number.isFinite(na) && Number.isFinite(nb)) {
                const next = [
                  clampNumber(na, optDef.min, optDef.max),
                  clampNumber(nb, optDef.min, optDef.max),
                ];
                if (
                  opt.randomRange[0] !== next[0] ||
                  opt.randomRange[1] !== next[1]
                ) {
                  opt.randomRange = next;
                  changed = true;
                }
              } else {
                delete opt.randomRange;
                changed = true;
              }
            }
          }

          if (optDef.type === "boolean") {
            if (typeof opt.value !== "boolean") {
              const next =
                opt.value === "true"
                  ? true
                  : opt.value === "false"
                  ? false
                  : optDef.defaultVal;
              if (opt.value !== next) {
                opt.value = next;
                changed = true;
              }
            }
          }

          if (optDef.type === "select") {
            const values = Array.isArray(optDef.values) ? optDef.values : [];
            if (opt.value === "random") {
              if (values.length > 0) {
                opt.randomValues = [...values];
              }
              opt.value = optDef.defaultVal;
              changed = true;
            }

            if (opt.randomValues !== undefined) {
              if (!Array.isArray(opt.randomValues)) {
                delete opt.randomValues;
                changed = true;
              } else if (values.length > 0) {
                const set = new Set(opt.randomValues);
                const filtered = values.filter((v) => set.has(v));
                if (filtered.length === 0) {
                  delete opt.randomValues;
                  changed = true;
                } else {
                  const sameLength =
                    filtered.length === opt.randomValues.length;
                  const sameOrder =
                    sameLength &&
                    filtered.every((v, i) => opt.randomValues[i] === v);
                  if (!sameOrder) {
                    opt.randomValues = filtered;
                    changed = true;
                  }
                }
              }
            }

            if (
              opt.randomValues === undefined &&
              values.length > 0 &&
              typeof opt.value === "string" &&
              !values.includes(opt.value)
            ) {
              opt.value = optDef.defaultVal;
              changed = true;
            }
          }

          if (optDef.type === "matrix") {
            const v = opt.value;
            let rows = 1;
            let cols = 1;
            let excludedCells = [];
            if (Array.isArray(v)) {
              rows = v[0] || 1;
              cols = v[1] || 1;
            } else if (v && typeof v === "object") {
              rows = v.rows || 1;
              cols = v.cols || 1;
              excludedCells = Array.isArray(v.excludedCells)
                ? v.excludedCells
                : [];
            }

            const nextRows = Math.max(1, Math.min(5, Number(rows) || 1));
            const nextCols = Math.max(1, Math.min(5, Number(cols) || 1));
            const nextExcluded = excludedCells.filter((key) => {
              const [r, c] = String(key).split("-").map(Number);
              return (
                Number.isFinite(r) &&
                Number.isFinite(c) &&
                r >= 1 &&
                c >= 1 &&
                r <= nextRows &&
                c <= nextCols
              );
            });
            const next = {
              rows: nextRows,
              cols: nextCols,
              excludedCells: nextExcluded,
            };
            const same =
              v &&
              typeof v === "object" &&
              v.rows === nextRows &&
              v.cols === nextCols &&
              Array.isArray(v.excludedCells) &&
              v.excludedCells.length === nextExcluded.length &&
              v.excludedCells.every((x, i) => x === nextExcluded[i]);
            if (!same) {
              opt.value = next;
              changed = true;
            }
          }
        }
      }

      if (!changed) return;
    });

    lastNormalizedKeyRef.current = key;
  }, [isOpen, selectedChannel, module, activeSetId, setUserData]);

  const methodConfigs = useMemo(() => {
    if (!selectedChannel) return [];
    const tracks = getActiveSetTracks(userData, activeSetId);
    const track = tracks[selectedChannel.trackIndex];
    const moduleData = track?.modulesData[selectedChannel.instanceId] || {
      constructor: [],
      methods: {},
    };
    const channelKey = selectedChannel.isConstructor
      ? "constructor"
      : String(selectedChannel.channelNumber);
    const configs = selectedChannel.isConstructor
      ? moduleData.constructor
      : moduleData.methods[channelKey] || [];

    return configs;
  }, [userData, selectedChannel, activeSetId]);

  const changeOption = useCallback(
    (methodName, optionName, value, field = "value") => {
      if (!selectedChannel) return;
      updateActiveSet(setUserData, activeSetId, (activeSet) => {
        const channelKey = selectedChannel.isConstructor
          ? "constructor"
          : String(selectedChannel.channelNumber);
        const track = activeSet.tracks[selectedChannel.trackIndex];
        const methods = selectedChannel.isConstructor
          ? track.modulesData[selectedChannel.instanceId].constructor
          : track.modulesData[selectedChannel.instanceId].methods[channelKey];
        const method = methods.find((m) => m.name === methodName);
        if (method) {
          const option = method.options.find((o) => o.name === optionName);
          if (option) {
            option[field] = value;
          }
        }
      });
    },
    [selectedChannel, setUserData, activeSetId]
  );

  const addMethod = useCallback(
    (methodName) => {
      if (!selectedChannel || !module) return;
      const method = module.methods.find((m) => m.name === methodName);
      if (!method) return;

      const initializedMethod = {
        name: method.name,
        options: method?.options?.length
          ? method.options.map((opt) => ({
              name: opt.name,
              value: opt.defaultVal,
              defaultVal: opt.defaultVal,
            }))
          : null,
      };

      const channelKey = selectedChannel.isConstructor
        ? "constructor"
        : String(selectedChannel.channelNumber);

      updateActiveSet(setUserData, activeSetId, (activeSet) => {
        const track = activeSet.tracks[selectedChannel.trackIndex];
        const insertMethod = methodName === "matrix" ? "unshift" : "push";

        if (selectedChannel.isConstructor) {
          track.modulesData[selectedChannel.instanceId].constructor[
            insertMethod
          ](initializedMethod);
        } else {
          if (
            !track.modulesData[selectedChannel.instanceId].methods[channelKey]
          ) {
            track.modulesData[selectedChannel.instanceId].methods[channelKey] =
              [];
          }
          track.modulesData[selectedChannel.instanceId].methods[channelKey][
            insertMethod
          ](initializedMethod);
        }
      });
    },
    [module, selectedChannel, setUserData, activeSetId]
  );

  const removeMethod = useCallback(
    (methodName) => {
      if (!selectedChannel) return;
      updateActiveSet(setUserData, activeSetId, (activeSet) => {
        const channelKey = selectedChannel.isConstructor
          ? "constructor"
          : String(selectedChannel.channelNumber);
        const track = activeSet.tracks[selectedChannel.trackIndex];
        const methods = selectedChannel.isConstructor
          ? track.modulesData[selectedChannel.instanceId].constructor
          : track.modulesData[selectedChannel.instanceId].methods[channelKey];
        remove(methods, (m) => m.name === methodName);
      });
    },
    [selectedChannel, setUserData, activeSetId]
  );

  const addMissingOption = useCallback(
    (methodName, optionName) => {
      if (!selectedChannel || !module) return;
      const methodDef = module.methods.find((m) => m.name === methodName);
      if (!methodDef) return;
      const optionDef = methodDef.options?.find((o) => o.name === optionName);
      if (!optionDef) return;

      updateActiveSet(setUserData, activeSetId, (activeSet) => {
        const track = activeSet.tracks[selectedChannel.trackIndex];
        const channelKey = selectedChannel.isConstructor
          ? "constructor"
          : String(selectedChannel.channelNumber);
        const methods = selectedChannel.isConstructor
          ? track.modulesData[selectedChannel.instanceId].constructor
          : track.modulesData[selectedChannel.instanceId].methods[channelKey];
        const method = methods.find((m) => m.name === methodName);
        if (method && !method.options.find((o) => o.name === optionName)) {
          if (!method.options) {
            method.options = [];
          }
          method.options.push({
            name: optionName,
            value: optionDef.defaultVal,
          });
        }
      });
    },
    [module, selectedChannel, setUserData, activeSetId]
  );

  const methodLayers = useMemo(() => {
    if (!module) return [];
    return getMethodsByLayer(module, moduleBase, threeBase);
  }, [module, moduleBase, threeBase]);

  const availableMethods = useMemo(() => {
    if (!module || !module.methods) return [];
    return module.methods.filter(
      (m) => !methodConfigs.some((mc) => mc.name === m.name)
    );
  }, [methodConfigs, module]);

  const methodsByLayer = useMemo(() => {
    if (!methodLayers.length) {
      return [
        {
          name: "Configured",
          methods: methodConfigs.map((m) => m.name),
          configuredMethods: methodConfigs,
          availableMethods: [],
        },
      ];
    }
    const layersWithMethods = methodLayers.map((layer) => {
      const layerMethods = methodConfigs.filter((method) =>
        layer.methods.includes(method.name)
      );
      return {
        ...layer,
        configuredMethods: layerMethods,
        availableMethods: availableMethods.filter((m) =>
          layer.methods.includes(m.name)
        ),
      };
    });
    return layersWithMethods;
  }, [methodLayers, methodConfigs, availableMethods]);

  if (!isOpen || !selectedChannel) return null;
  if (!module && !isWorkspaceMode) return null;

  const modalTitle = (
    <>
      {module ? module.name : selectedChannel.moduleType}{" "}
      {selectedChannel.isConstructor
        ? "(Constructor)"
        : `(Channel ${selectedChannel.channelNumber})`}
      {!module && isWorkspaceMode ? (
        <span className="ml-2 inline-flex items-center">
          <Tooltip content={missingReasonText} position="top">
            <span className="text-red-500/70 text-[11px] cursor-help">
              <FaExclamationTriangle />
            </span>
          </Tooltip>
        </span>
      ) : null}
      {selectedChannel.isConstructor ? (
        <HelpIcon helpText={HELP_TEXT.constructor} />
      ) : (
        <HelpIcon helpText={HELP_TEXT.midiChannel} />
      )}
    </>
  );

  if (!module && isWorkspaceMode) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} position="bottom" size="full">
        <ModalHeader title={modalTitle} onClose={onClose} />
        <div className="px-6 py-6">
          <div className="text-neutral-300/70 text-[11px] font-mono">
            {missingReasonText}
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} position="bottom" size="full">
        <ModalHeader title={modalTitle} onClose={onClose} />

        <div className="flex flex-col gap-6">
          {methodsByLayer.map((layer, layerIndex) => {
            const hasMethodsOrAvailable =
              layer.configuredMethods.length > 0 ||
              layer.availableMethods.length > 0;

            if (!hasMethodsOrAvailable) return null;

            return (
              <div key={layer.name} className="px-6 mb-6 border-neutral-800">
                <div className="flex justify-between items-baseline mb-4">
                  <div className="uppercase text-neutral-300 text-[11px] relative inline-block">
                    {layer.name} Methods
                  </div>
                  <div className="relative">
                    <Select
                      onChange={(e) => {
                        addMethod(e.target.value);
                        e.target.value = "";
                      }}
                      className="py-1 px-2 min-w-[150px]"
                      defaultValue=""
                      disabled={layer.availableMethods.length === 0}
                      style={{
                        opacity: layer.availableMethods.length === 0 ? 0.5 : 1,
                        cursor:
                          layer.availableMethods.length === 0
                            ? "not-allowed"
                            : "pointer",
                      }}
                    >
                      <option value="" disabled className="text-neutral-300/30">
                        add method
                      </option>
                      {layer.availableMethods.map((method) => (
                        <option
                          key={method.name}
                          value={method.name}
                          className="bg-[#101010]"
                        >
                          {method.name}
                        </option>
                      ))}
                    </Select>
                    <HelpIcon helpText={HELP_TEXT.methods} />
                  </div>
                </div>

                {layer.configuredMethods.length > 0 ? (
                  <SortableList
                    items={layer.configuredMethods.map((method) => ({
                      id: method.name,
                    }))}
                    strategy={horizontalListSortingStrategy}
                    onReorder={(oldIndex, newIndex) => {
                      if (!selectedChannel) return;

                      const currentLayer = layer;
                      if (!currentLayer) return;

                      updateActiveSet(setUserData, activeSetId, (activeSet) => {
                        const channelKey = selectedChannel.isConstructor
                          ? "constructor"
                          : String(selectedChannel.channelNumber);
                        const track =
                          activeSet.tracks[selectedChannel.trackIndex];
                        const methods = selectedChannel.isConstructor
                          ? track.modulesData[selectedChannel.instanceId]
                              .constructor
                          : track.modulesData[selectedChannel.instanceId]
                              .methods[channelKey];

                        const reorderedLayer = arrayMove(
                          currentLayer.configuredMethods,
                          oldIndex,
                          newIndex
                        );

                        const allReorderedMethods = methodsByLayer.reduce(
                          (acc, l) => {
                            if (l.name === currentLayer.name) {
                              return [...acc, ...reorderedLayer];
                            } else {
                              return [...acc, ...l.configuredMethods];
                            }
                          },
                          []
                        );

                        if (selectedChannel.isConstructor) {
                          track.modulesData[
                            selectedChannel.instanceId
                          ].constructor = allReorderedMethods;
                        } else {
                          track.modulesData[selectedChannel.instanceId].methods[
                            channelKey
                          ] = allReorderedMethods;
                        }
                      });
                    }}
                  >
                    <div className="flex items-start overflow-x-auto pt-4">
                      {layer.configuredMethods.map((method, methodIndex) => (
                        <React.Fragment key={method.name}>
                          <SortableItem
                            id={method.name}
                            method={method}
                            handleRemoveMethod={removeMethod}
                            changeOption={changeOption}
                            addMissingOption={addMissingOption}
                            moduleMethods={module ? module.methods : []}
                            moduleName={module ? module.name : null}
                            onShowMethodCode={(methodName) => {
                              setSelectedMethodForCode({
                                moduleName: module?.id || module?.name || null,
                                methodName,
                              });
                            }}
                          />
                          {methodIndex < layer.configuredMethods.length - 1 && (
                            <div className="flex-shrink-0 flex items-center w-4 min-h-[40px]">
                              <div className="w-full h-px bg-neutral-800" />
                            </div>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </SortableList>
                ) : (
                  <div className="text-neutral-500 text-[10px]">
                    No methods added to {layer.name} layer.
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {!selectedChannel?.isConstructor &&
          (onEditChannel || onDeleteChannel) && (
            <ModalFooter>
              {onEditChannel && (
                <Button
                  onClick={() => {
                    onEditChannel(selectedChannel.channelNumber);
                    onClose();
                  }}
                  type="secondary"
                  className="text-[11px]"
                >
                  EDIT CHANNEL
                </Button>
              )}
              {onDeleteChannel && (
                <Button
                  onClick={() => {
                    onDeleteChannel(selectedChannel.channelNumber);
                    onClose();
                  }}
                  type="secondary"
                  className="text-[11px]"
                >
                  DELETE CHANNEL
                </Button>
              )}
            </ModalFooter>
          )}
      </Modal>

      <MethodCodeModal
        isOpen={!!selectedMethodForCode}
        onClose={() => setSelectedMethodForCode(null)}
        moduleName={selectedMethodForCode?.moduleName}
        methodName={selectedMethodForCode?.methodName}
      />
    </>
  );
};
