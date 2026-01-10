import React, {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { useAtom } from "jotai";
import { remove } from "lodash";
import { useIPCSend } from "../core/hooks/useIPC";
import { Modal } from "../shared/Modal";
import { ModalHeader } from "../components/ModalHeader";
import { SortableWrapper } from "../shared/SortableWrapper";
import { SortableList, arrayMove } from "../shared/SortableList";
import { horizontalListSortingStrategy } from "@dnd-kit/sortable";
import { ModalFooter } from "../components/ModalFooter";
import { Button } from "../components/Button";
import { Select } from "../components/FormInputs";
import { HelpIcon } from "../components/HelpIcon";
import { MethodBlock } from "../components/MethodBlock";
import { Tooltip } from "../components/Tooltip";
import { FaExclamationTriangle } from "react-icons/fa";
import {
  userDataAtom,
  selectedChannelAtom,
  activeSetIdAtom,
} from "../core/state";
import { updateActiveSet, getMethodsByLayer } from "../core/utils";
import { getActiveSetTracks } from "../../shared/utils/setUtils";
import { getBaseMethodNames } from "../utils/moduleUtils";
import { HELP_TEXT } from "../../shared/helpText";
import { MethodCodeModal } from "./MethodCodeModal";
import type {
  UserData,
  MethodOptionDefinition,
  ModuleMetadata,
  MethodDefinition,
} from "@/types";

// Type for method objects used in this component
interface MethodBlockData {
  name: string;
  options?: Array<{
    name: string;
    value: any;
    defaultVal?: any;
    randomValues?: any[];
    randomRange?: [number | string, number | string];
    randomizeFromUserColors?: boolean;
  }>;
}

interface SortableItemProps {
  id: string;
  method: MethodBlockData;
  handleRemoveMethod: (methodName: string) => void;
  changeOption: (
    methodName: string,
    optionName: string,
    value: any,
    field?: string
  ) => void;
  addMissingOption: (methodName: string, optionName: string) => void;
  moduleMethods: MethodDefinition[][];
  moduleName: string | null;
  userColors: string[];
  onShowMethodCode: (methodName: string) => void;
}

const SortableItem = React.memo<SortableItemProps>(
  ({
    id,
    method,
    handleRemoveMethod,
    changeOption,
    addMissingOption,
    moduleMethods,
    moduleName,
    userColors,
    onShowMethodCode,
  }) => {
    const toggleRandomization = useCallback(
      (optionName: string, optionDef: MethodOptionDefinition | null = null) => {
        const option = method.options?.find((o: any) => o.name === optionName);
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
          const values = Array.isArray(optionDef?.values) ? optionDef.values : [];
          if (!values.length) return;
          changeOption(method.name, optionName, [...values], "randomValues");
          return;
        }

        if (type === "color") {
          if (
            option.randomValues !== undefined &&
            option.randomizeFromUserColors
          ) {
            changeOption(method.name, optionName, undefined, "randomValues");
            changeOption(
              method.name,
              optionName,
              undefined,
              "randomizeFromUserColors"
            );
            return;
          }
          const values = Array.isArray(userColors) ? userColors : [];
          if (!values.length) return;
          changeOption(method.name, optionName, [...values], "randomValues");
          changeOption(
            method.name,
            optionName,
            true,
            "randomizeFromUserColors"
          );
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

        let min: number, max: number;
        if (typeof defaultVal === "boolean") {
          min = 0;
          max = 1;
        } else {
          min = Math.max(defaultVal * 0.8, 0);
          max = defaultVal * 1;
        }
        changeOption(method.name, optionName, [min, max], "randomRange");
      },
      [method.name, method.options, changeOption, userColors]
    );

    const handleRandomChange = useCallback(
      (
        optionName: string,
        indexOrValues: any,
        newValue: any,
        optionDef: MethodOptionDefinition | null = null
      ) => {
        const option = method.options?.find((o: any) => o.name === optionName);
        if (!option) return;

        const type = optionDef?.type || null;
        if (type === "select") {
          const values = Array.isArray(optionDef?.values) ? optionDef.values : [];
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

        if (type === "color") {
          const values = Array.isArray(userColors) ? userColors : [];
          if (!values.length) return;
          if (!Array.isArray(indexOrValues)) return;
          const selected = values.filter((v) => indexOrValues.includes(v));
          if (selected.length === 0) {
            changeOption(method.name, optionName, undefined, "randomValues");
            changeOption(
              method.name,
              optionName,
              undefined,
              "randomizeFromUserColors"
            );
          } else {
            changeOption(method.name, optionName, selected, "randomValues");
            changeOption(
              method.name,
              optionName,
              true,
              "randomizeFromUserColors"
            );
          }
          return;
        }

        if (!option.randomRange) return;

        let newRandomRange: any[];
        if (type === "boolean") {
          newRandomRange = [...option.randomRange];
          newRandomRange[indexOrValues] = newValue === "true";
        } else {
          newRandomRange = [...option.randomRange];
          newRandomRange[indexOrValues] = parseFloat(newValue);
        }
        changeOption(method.name, optionName, newRandomRange, "randomRange");
      },
      [method.options, method.name, changeOption, userColors]
    );

    const handleOptionChange = useCallback(
      (methodName: string, optionName: string, value: any) => {
        changeOption(methodName, optionName, value);
      },
      [changeOption]
    );

    return (
      <SortableWrapper id={id} disabled={method.name === "matrix"}>
        {({ dragHandleProps }) => (
          <>
            <div>
              <MethodBlock
                method={{
                  name: method.name,
                  options: method.options || []
                }}
                mode="dashboard"
                moduleMethods={moduleMethods}
                moduleName={moduleName}
                userColors={userColors}
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

export interface MethodConfiguratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  predefinedModules: ModuleMetadata[];
  onEditChannel?: (channelNumber: number) => void;
  onDeleteChannel?: (channelNumber: number) => void;
  workspacePath?: string | null;
  workspaceModuleFiles?: string[];
  workspaceModuleLoadFailures?: string[];
}

export const MethodConfiguratorModal: React.FC<MethodConfiguratorModalProps> = ({
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
  const [selectedMethodForCode, setSelectedMethodForCode] = useState<{
    moduleName: string | null;
    methodName: string | null;
  } | null>(null);
  const sendToProjector = useIPCSend("dashboard-to-projector");
  const { moduleBase, threeBase } = useMemo(() => getBaseMethodNames(), []);
  const lastNormalizedKeyRef = useRef<string | null>(null);
  const userColors = useMemo(() => {
    const list = userData?.config?.userColors;
    return Array.isArray(list) ? list.filter(Boolean) : [];
  }, [userData?.config?.userColors]);

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

      const clampNumber = (n: number, min: number, max: number) => {
        let out = n;
        if (typeof min === "number") out = Math.max(min, out);
        if (typeof max === "number") out = Math.min(max, out);
        return out;
      };

      for (const m of methodList) {
        if (typeof m === 'string' || typeof m === 'number' || typeof m === 'boolean' || Array.isArray(m) || typeof m !== 'object') continue;
        if (!m?.name || !Array.isArray(m.options)) continue;
        const methodDef = module.methods.find((mm) => mm?.name === m.name);
        if (!methodDef || !Array.isArray(methodDef.options)) continue;

        for (const opt of m.options) {
          if (typeof opt !== 'object' || opt === null) continue;
          if (!('name' in opt)) continue;
          if (!opt?.name) continue;
          const optDef = methodDef.options.find((oo) => oo?.name === opt.name);
          if (!optDef) continue;

          if (optDef.type === "number") {
            if ('value' in opt && typeof opt.value === "string") {
              const n = Number(opt.value);
              const next = Number.isFinite(n)
                ? clampNumber(n, typeof (optDef as any).min === 'number' ? (optDef as any).min : 0, typeof (optDef as any).max === 'number' ? (optDef as any).max : 100)
                : (optDef as any).defaultVal;
              if (opt.value !== next) {
                (opt as any).value = next;
                changed = true;
              }
            }
          }

          if (optDef.type === "boolean") {
            if ('value' in opt && typeof opt.value !== "boolean") {
              const next =
                opt.value === "true"
                  ? true
                  : opt.value === "false"
                  ? false
                  : (optDef as any).defaultVal;
              if (opt.value !== next) {
                (opt as any).value = next;
                changed = true;
              }
            }
          }

          if (optDef.type === "select") {
            const values = Array.isArray((optDef as any).values) ? (optDef as any).values : [];
            if ('value' in opt && opt.value === "random") {
              if (values.length > 0) {
                (opt as any).randomValues = [...values];
              }
              (opt as any).value = (optDef as any).defaultVal;
              changed = true;
            }

            if ((opt as any).randomValues !== undefined) {
              if (!Array.isArray((opt as any).randomValues)) {
                delete (opt as any).randomValues;
                changed = true;
              } else if (values.length > 0) {
                const set = new Set((opt as any).randomValues);
                const filtered = values.filter((v) => set.has(v));
                if (filtered.length === 0) {
                  delete (opt as any).randomValues;
                  changed = true;
                } else {
                  const sameLength =
                    filtered.length === (opt as any).randomValues.length;
                  const sameOrder =
                    sameLength &&
                    filtered.every((v, i) => (opt as any).randomValues[i] === v);
                  if (!sameOrder) {
                    (opt as any).randomValues = filtered;
                    changed = true;
                  }
                }
              }
            }

            if (
              (opt as any).randomValues === undefined &&
              values.length > 0 &&
              'value' in opt && typeof opt.value === "string" &&
              !values.includes(opt.value)
            ) {
              (opt as any).value = (optDef as any).defaultVal;
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
    (
      methodName: string,
      optionName: string,
      value: any,
      field = "value"
    ) => {
      if (!selectedChannel) return;
      updateActiveSet(setUserData, activeSetId, (activeSet) => {
        const channelKey = selectedChannel.isConstructor
          ? "constructor"
          : String(selectedChannel.channelNumber);
        const track = activeSet.tracks[selectedChannel.trackIndex];
        const methods = selectedChannel.isConstructor
          ? track.modulesData[selectedChannel.instanceId].constructor
          : track.modulesData[selectedChannel.instanceId].methods[channelKey];
        const method = methods.find((m: any) => {
          if (typeof m === 'string' || typeof m === 'number' || typeof m === 'boolean' || Array.isArray(m) || typeof m !== 'object') return false;
          return m.name === methodName;
        }) as MethodBlockData | undefined;
        if (method && Array.isArray(method.options)) {
          const option = method.options.find((o: any) => o.name === optionName);
          if (option) {
            option[field] = value;
          }
        }
      });
    },
    [selectedChannel, setUserData, activeSetId]
  );

  const addMethod = useCallback(
    (methodName: string) => {
      if (!selectedChannel || !module) return;
      const method = module.methods.find((m: any) => m.name === methodName);
      if (!method) return;

      const initializedMethod = {
        name: method.name,
        options: method?.options?.length
          ? method.options.map((opt: MethodOptionDefinition) => ({
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
    (methodName: string) => {
      if (!selectedChannel) return;
      updateActiveSet(setUserData, activeSetId, (activeSet) => {
        const channelKey = selectedChannel.isConstructor
          ? "constructor"
          : String(selectedChannel.channelNumber);
        const track = activeSet.tracks[selectedChannel.trackIndex];
        const methods = selectedChannel.isConstructor
          ? track.modulesData[selectedChannel.instanceId].constructor
          : track.modulesData[selectedChannel.instanceId].methods[channelKey];
        remove(methods, (m: any) => m.name === methodName);
      });
    },
    [selectedChannel, setUserData, activeSetId]
  );

  const addMissingOption = useCallback(
    (methodName: string, optionName: string) => {
      if (!selectedChannel || !module) return;
      const methodDef = module.methods.find((m: any) => m.name === methodName);
      if (!methodDef) return;
      const optionDef = methodDef.options?.find((o: any) => o.name === optionName);
      if (!optionDef) return;

      updateActiveSet(setUserData, activeSetId, (activeSet) => {
        const track = activeSet.tracks[selectedChannel.trackIndex];
        const channelKey = selectedChannel.isConstructor
          ? "constructor"
          : String(selectedChannel.channelNumber);
        const methods = selectedChannel.isConstructor
          ? track.modulesData[selectedChannel.instanceId].constructor
          : track.modulesData[selectedChannel.instanceId].methods[channelKey];
        const method = methods.find((m: any) => {
          if (typeof m === 'string' || typeof m === 'number' || typeof m === 'boolean' || Array.isArray(m) || typeof m !== 'object') return false;
          return m.name === methodName;
        }) as MethodBlockData | undefined;
        if (method && !method.options?.find((o: any) => o.name === optionName)) {
          if (!method.options) {
            method.options = [];
          }
          method.options.push({
            name: optionName,
            value: (optionDef as any).defaultVal,
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
      (m: any) => !methodConfigs.some((mc: any) => {
        if (typeof mc === 'string' || typeof mc === 'number' || typeof mc === 'boolean' || Array.isArray(mc) || typeof mc !== 'object') return false;
        return mc.name === m.name;
      })
    );
  }, [methodConfigs, module]);

  const methodsByLayer = useMemo(() => {
    if (!methodLayers.length) {
      return [
        {
          name: "Configured",
          methods: methodConfigs.map((m: any) => {
            if (typeof m === 'string' || typeof m === 'number' || typeof m === 'boolean' || Array.isArray(m) || typeof m !== 'object') return '';
            return m.name;
          }),
          configuredMethods: methodConfigs,
          availableMethods: [],
        },
      ];
    }
    const layersWithMethods = methodLayers.map((layer) => {
      const layerMethods = methodConfigs.filter((method: any) => {
        if (typeof method === 'string' || typeof method === 'number' || typeof method === 'boolean' || Array.isArray(method) || typeof method !== 'object') return false;
        return layer.methods.includes(method.name);
      });
      return {
        ...layer,
        configuredMethods: layerMethods,
        availableMethods: availableMethods.filter((m: any) => {
          if (typeof m === 'string' || typeof m === 'number' || typeof m === 'boolean' || Array.isArray(m) || typeof m !== 'object') return false;
          return layer.methods.includes(m.name);
        }),
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
        <HelpIcon helpText={HELP_TEXT.constructor as any} />
      ) : (
        <HelpIcon helpText={(HELP_TEXT as any).midiChannel ? String((HELP_TEXT as any).midiChannel) : ''} />
      )}
    </>
  );

  if (!module && isWorkspaceMode) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} position="bottom" size="full">
        <ModalHeader title={String(modalTitle)} onClose={onClose} />
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
        <ModalHeader title={String(modalTitle)} onClose={onClose} />

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
                        e.currentTarget.value = "";
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
                      {layer.availableMethods.map((method: any) => (
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
                    items={layer.configuredMethods.map((method: any) => ({
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
                        const track = activeSet.tracks[selectedChannel.trackIndex];
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

                        const allReorderedMethods = (methodsByLayer as any).reduce(
                          (acc: any[], l: any) => {
                            if (l.name === currentLayer.name) {
                              return [...acc, ...(reorderedLayer as any[])];
                            } else {
                              return [...acc, ...(l.configuredMethods as any[])];
                            }
                          },
                          [] as any[]
                        );

                        if (selectedChannel.isConstructor) {
                          (track.modulesData[
                            selectedChannel.instanceId
                          ] as any).constructor = allReorderedMethods;
                        } else {
                          (track.modulesData[selectedChannel.instanceId] as any).methods[
                            channelKey
                          ] = allReorderedMethods;
                        }
                      });
                    }}
                  >
                    <div className="flex items-start overflow-x-auto pt-4">
                      {layer.configuredMethods.map((method: any, methodIndex: number) => (
                        <React.Fragment key={method.name}>
                          <SortableItem
                            id={method.name}
                            method={method}
                            handleRemoveMethod={removeMethod}
                            changeOption={changeOption}
                            addMissingOption={addMissingOption}
                            moduleMethods={module ? (((module.methods as any) as MethodDefinition[][]).flat().filter((m): m is MethodDefinition => Boolean(m) && typeof m === 'object') as any) : []}
                            moduleName={module ? module.name : null}
                            userColors={userColors}
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
                    onEditChannel(Number(selectedChannel.channelNumber));
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
                    onDeleteChannel(Number(selectedChannel.channelNumber));
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
