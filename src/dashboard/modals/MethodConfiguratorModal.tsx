import { memo, Fragment, useState, useMemo, useCallback, useEffect, useRef, type ChangeEvent } from "react";
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
import { userDataAtom, selectedChannelAtom, activeSetIdAtom } from "../core/state";
import { updateActiveSet, getMethodsByLayer } from "../core/utils";
import { getActiveSetTracks } from "../../shared/utils/setUtils";
import { getBaseMethodNames } from "../utils/moduleUtils";
import { HELP_TEXT } from "../../shared/helpText";
import { MethodCodeModal } from "./MethodCodeModal";

type MethodOption = {
  name: string;
  value: unknown;
  defaultVal?: unknown;
  randomRange?: [number, number] | [boolean, boolean];
  randomValues?: string[];
  randomizeFromUserColors?: boolean;
};

type MethodConfig = {
  name: string;
  options: MethodOption[];
};

type OptionDef = {
  name: string;
  type: string;
  defaultVal?: unknown;
  min?: number;
  max?: number;
  values?: string[];
  allowRandomization?: boolean;
};

type _MethodDef = {
  name: string;
  options?: OptionDef[];
};

type ModuleMethod = {
  name: string;
  options?: OptionDef[];
  executeOnLoad?: boolean;
};

type PredefinedModule = {
  id?: string;
  name: string;
  category: string;
  status?: string;
  methods?: unknown[];
};

type SortableItemProps = {
  id: string;
  method: MethodConfig;
  handleRemoveMethod: (methodName: string) => void;
  changeOption: (methodName: string, optionName: string, value: unknown, field?: string) => void;
  addMissingOption: (methodName: string, optionName: string) => void;
  moduleMethods: ModuleMethod[];
  moduleName: string | null;
  userColors: string[];
  onShowMethodCode: (methodName: string) => void;
};

const SortableItem = memo(
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
  }: SortableItemProps) => {
    const toggleRandomization = useCallback(
      (optionName: string, optionDef: OptionDef | null = null) => {
        const option = method.options.find((o) => o.name === optionName);
        if (!option) return;

        const type = optionDef?.type || null;
        if (type === "select") {
          if (Array.isArray(option.randomValues) && option.randomValues.length) {
            changeOption(method.name, optionName, undefined, "randomValues");
            return;
          }
          const values = Array.isArray(optionDef?.values) ? optionDef.values : [];
          if (!values.length) return;
          changeOption(method.name, optionName, [...values], "randomValues");
          return;
        }

        if (type === "color") {
          if (option.randomValues !== undefined && option.randomizeFromUserColors) {
            changeOption(method.name, optionName, undefined, "randomValues");
            changeOption(method.name, optionName, undefined, "randomizeFromUserColors");
            return;
          }
          const values = Array.isArray(userColors) ? userColors : [];
          if (!values.length) return;
          changeOption(method.name, optionName, [...values], "randomValues");
          changeOption(method.name, optionName, true, "randomizeFromUserColors");
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
                : parseFloat(String(option.defaultVal));

        let min: number | boolean, max: number | boolean;
        if (typeof defaultVal === "boolean") {
          min = false;
          max = true;
        } else {
          min = defaultVal * 0.8;
          max = defaultVal * 1.2;
          if (typeof optionDef?.min === "number") min = Math.max(optionDef.min, min);
          if (typeof optionDef?.max === "number") max = Math.min(optionDef.max, max);
          if (typeof min === "number" && typeof max === "number" && min > max) {
            const tmp = min;
            min = max;
            max = tmp;
          }
        }
        changeOption(method.name, optionName, [min, max], "randomRange");
      },
      [method.name, method.options, changeOption, userColors]
    );

    const handleRandomChange = useCallback(
      (
        optionName: string,
        indexOrValues: number | string[],
        newValue: string,
        optionDef: OptionDef | null = null
      ) => {
        const option = method.options.find((o) => o.name === optionName);
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
            changeOption(method.name, optionName, undefined, "randomizeFromUserColors");
          } else {
            changeOption(method.name, optionName, selected, "randomValues");
            changeOption(method.name, optionName, true, "randomizeFromUserColors");
          }
          return;
        }

        if (!option.randomRange) return;

        let newRandomRange: [number, number] | [boolean, boolean];
        if (type === "boolean") {
          const current = option.randomRange as [boolean, boolean];
          newRandomRange = [...current] as [boolean, boolean];
          newRandomRange[indexOrValues as number] = newValue === "true";
        } else {
          const current = option.randomRange as [number, number];
          newRandomRange = [...current] as [number, number];
          const parsed = parseFloat(newValue);
          if (!Number.isFinite(parsed)) return;
          let next = parsed;
          if (typeof optionDef?.min === "number") next = Math.max(optionDef.min, next);
          if (typeof optionDef?.max === "number") next = Math.min(optionDef.max, next);
          newRandomRange[indexOrValues as number] = next;
        }
        changeOption(method.name, optionName, newRandomRange, "randomRange");
      },
      [method.options, method.name, changeOption, userColors]
    );

    const handleOptionChange = useCallback(
      (methodName: string, optionName: string, value: unknown) => {
        changeOption(methodName, optionName, value);
      },
      [changeOption]
    );

    return (
      <SortableWrapper id={id} disabled={method.name === "matrix"}>
        {({ dragHandleProps, isDragging: _isDragging }) => (
          <>
            <div>
              <MethodBlock
                method={method}
                mode="dashboard"
                moduleMethods={moduleMethods}
                moduleName={moduleName}
                userColors={userColors}
                dragHandleProps={dragHandleProps}
                onRemove={handleRemoveMethod}
                onShowCode={onShowMethodCode}
                onOptionChange={handleOptionChange}
                onToggleRandom={(optionName: string, optionDef?: OptionDef | null) =>
                  toggleRandomization(optionName, optionDef || null)
                }
                onRandomRangeChange={(
                  optionName: string,
                  index: unknown,
                  newValue: unknown,
                  optionDef?: OptionDef | null
                ) => handleRandomChange(optionName, index as number | string[], String(newValue), optionDef || null)}
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

type SelectedChannel = {
  trackIndex: number;
  instanceId: string;
  moduleType: string;
  channelNumber?: number;
  isConstructor: boolean;
};

type MethodConfiguratorModalProps = {
  isOpen: boolean;
  onClose: () => void;
  predefinedModules: PredefinedModule[];
  onEditChannel?: (channelNumber: number) => void;
  onDeleteChannel?: (channelNumber: number) => void;
  workspacePath?: string | null;
  workspaceModuleFiles?: string[];
  workspaceModuleLoadFailures?: string[];
};

export const MethodConfiguratorModal = ({
  isOpen,
  onClose,
  predefinedModules,
  onEditChannel,
  onDeleteChannel,
  workspacePath = null,
  workspaceModuleFiles = [],
  workspaceModuleLoadFailures = [],
}: MethodConfiguratorModalProps) => {
  const [userData, setUserData] = useAtom(userDataAtom);
  const [selectedChannel] = useAtom(selectedChannelAtom);
  const [selectedMethodForCode, setSelectedMethodForCode] = useState<{
    moduleName: string | null;
    methodName: string;
  } | null>(null);
  const sendToProjector = useIPCSend("dashboard-to-projector");
  const { moduleBase, threeBase } = useMemo(() => getBaseMethodNames(), []);
  const lastNormalizedKeyRef = useRef<string | null>(null);
  const userColors = useMemo(() => {
    const config = userData?.config as Record<string, unknown> | undefined;
    const list = config?.userColors;
    return Array.isArray(list) ? list.filter(Boolean) : [];
  }, [userData?.config]);

  const module = useMemo(() => {
    if (!selectedChannel) return null;
    const ch = selectedChannel as SelectedChannel;
    return predefinedModules.find((m) => m.id === ch.moduleType || m.name === ch.moduleType);
  }, [predefinedModules, selectedChannel]);

  const normalizedModuleMethods = useMemo(() => {
    const methodsUnknown = module && typeof module === "object" ? (module as { methods?: unknown }).methods : null;
    const list = Array.isArray(methodsUnknown) ? methodsUnknown : [];
    return list
      .map((m: unknown) => {
        const mObj = m && typeof m === "object" ? (m as Record<string, unknown>) : {};
        const name = String(mObj.name || "");
        const executeOnLoad = mObj.executeOnLoad === true;
        const optionsUnknown = mObj.options;
        const optionsList = Array.isArray(optionsUnknown) ? optionsUnknown : [];
        const options: OptionDef[] = optionsList
          .map((o: unknown) => {
            const oObj = o && typeof o === "object" ? (o as Record<string, unknown>) : {};
            const optName = String(oObj.name || "");
            if (!optName) return null;
            const values = Array.isArray(oObj.values) ? oObj.values.map((v: unknown) => String(v)) : undefined;
            return {
              name: optName,
              type: String(oObj.type || ""),
              defaultVal: oObj.defaultVal,
              values,
              min: typeof oObj.min === "number" ? oObj.min : undefined,
              max: typeof oObj.max === "number" ? oObj.max : undefined,
              allowRandomization: oObj.allowRandomization === true,
            };
          })
          .filter((o: OptionDef | null): o is OptionDef => Boolean(o));
        return name ? ({ name, executeOnLoad, options } as ModuleMethod) : null;
      })
      .filter((m: ModuleMethod | null): m is ModuleMethod => Boolean(m));
  }, [module]);

  const needsIntrospection =
    Boolean((selectedChannel as SelectedChannel | null)?.moduleType) &&
    Boolean(module) &&
    (!Array.isArray(module?.methods) || module.methods.length === 0);

  const selectedModuleType = (selectedChannel as SelectedChannel | null)?.moduleType || null;
  const isWorkspaceMode = Boolean(workspacePath);
  const workspaceFileSet = useMemo(() => {
    return new Set((workspaceModuleFiles || []).filter(Boolean));
  }, [workspaceModuleFiles]);
  const workspaceFailureSet = useMemo(() => {
    return new Set((workspaceModuleLoadFailures || []).filter(Boolean));
  }, [workspaceModuleLoadFailures]);
  const isFileMissing =
    isWorkspaceMode && selectedModuleType && !workspaceFileSet.has(selectedModuleType);
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

  const selectedTrackChannelCount = useMemo(() => {
    const ch = selectedChannel as SelectedChannel | null;
    if (!ch) return 0;
    const tracks = getActiveSetTracks(userData, activeSetId);
    const trackUnknown = tracks[ch.trackIndex];
    if (!trackUnknown || typeof trackUnknown !== "object") return 0;
    const track = trackUnknown as Record<string, unknown>;
    const cmUnknown = track.channelMappings;
    const cm =
      cmUnknown && typeof cmUnknown === "object" && !Array.isArray(cmUnknown)
        ? (cmUnknown as Record<string, unknown>)
        : {};
    const valid = Object.keys(cm).filter((k) => {
      const n = parseInt(k, 10);
      if (!Number.isFinite(n)) return false;
      if (n < 1 || n > 12) return false;
      return String(n) === k;
    });
    return valid.length;
  }, [userData, activeSetId, selectedChannel]);

  useEffect(() => {
    if (!isOpen) return;
    if (!needsIntrospection) return;
    const ch = selectedChannel as SelectedChannel | null;
    if (!ch?.moduleType) return;
    sendToProjector("module-introspect", {
      moduleId: ch.moduleType,
    });
  }, [isOpen, needsIntrospection, selectedChannel, sendToProjector]);

  useEffect(() => {
    if (!isOpen) return;
    const ch = selectedChannel as SelectedChannel | null;
    if (!ch) return;
    if (!module || !Array.isArray(module.methods) || module.methods.length === 0) return;

    const channelKey = ch.isConstructor ? "constructor" : String(ch.channelNumber);
    const key = `${activeSetId || "no_set"}:${ch.trackIndex}:${ch.instanceId}:${channelKey}:${
      ch.moduleType || ""
    }`;
    if (lastNormalizedKeyRef.current === key) return;

    updateActiveSet(setUserData, activeSetId, (activeSet) => {
      const tracksUnknown = (activeSet as Record<string, unknown>).tracks;
      if (!Array.isArray(tracksUnknown)) return;
      const trackUnknown = tracksUnknown[ch.trackIndex];
      if (!trackUnknown || typeof trackUnknown !== "object") return;
      const track = trackUnknown as Record<string, unknown>;
      const modulesData = track.modulesData as Record<string, unknown> | undefined;
      if (!modulesData || typeof modulesData !== "object") return;
      const instanceData = modulesData[ch.instanceId] as Record<string, unknown> | undefined;
      if (!instanceData) return;
      
      const methodList = ch.isConstructor
        ? ((instanceData as Record<string, unknown>)["constructor"] as MethodConfig[] | undefined)
        : ((instanceData.methods as Record<string, unknown> | undefined)?.[channelKey] as MethodConfig[] | undefined);
      if (!Array.isArray(methodList) || methodList.length === 0) return;

      let changed = false;

      const clampNumber = (n: number, min: number | undefined, max: number | undefined) => {
        let out = n;
        if (typeof min === "number") out = Math.max(min, out);
        if (typeof max === "number") out = Math.min(max, out);
        return out;
      };

      for (const m of methodList) {
        if (!m?.name || !Array.isArray(m.options)) continue;
        const methodDef = normalizedModuleMethods.find((mm) => mm?.name === m.name);
        if (!methodDef || !Array.isArray(methodDef.options)) continue;

        for (const opt of m.options) {
          if (!opt?.name) continue;
          const optDef = methodDef.options?.find((oo) => oo?.name === opt.name);
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
            if (Array.isArray(opt.randomRange) && opt.randomRange.length === 2) {
              const [a, b] = opt.randomRange;
              const na = typeof a === "number" ? a : Number(a);
              const nb = typeof b === "number" ? b : Number(b);
              if (Number.isFinite(na) && Number.isFinite(nb)) {
                const next = [
                  clampNumber(na, optDef.min, optDef.max),
                  clampNumber(nb, optDef.min, optDef.max),
                ];
                if (opt.randomRange[0] !== next[0] || opt.randomRange[1] !== next[1]) {
                  opt.randomRange = next as [number, number];
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
                opt.value === "true" ? true : opt.value === "false" ? false : optDef.defaultVal;
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
                  const sameLength = filtered.length === opt.randomValues.length;
                  const sameOrder =
                    sameLength && filtered.every((v, i) => opt.randomValues![i] === v);
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
            let excludedCells: string[] = [];
            if (Array.isArray(v)) {
              rows = (v as number[])[0] || 1;
              cols = (v as number[])[1] || 1;
            } else if (v && typeof v === "object") {
              const vo = v as Record<string, unknown>;
              rows = (vo.rows as number) || 1;
              cols = (vo.cols as number) || 1;
              excludedCells = Array.isArray(vo.excludedCells) ? (vo.excludedCells as string[]) : [];
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
              (v as Record<string, unknown>).rows === nextRows &&
              (v as Record<string, unknown>).cols === nextCols &&
              Array.isArray((v as Record<string, unknown>).excludedCells) &&
              ((v as Record<string, unknown>).excludedCells as string[]).length === nextExcluded.length &&
              ((v as Record<string, unknown>).excludedCells as string[]).every((x, i) => x === nextExcluded[i]);
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
  }, [isOpen, selectedChannel, module, activeSetId, setUserData, normalizedModuleMethods]);

  const methodConfigs = useMemo(() => {
    const ch = selectedChannel as SelectedChannel | null;
    if (!ch) return [];
    const tracks = getActiveSetTracks(userData, activeSetId);
    const trackUnknown = tracks[ch.trackIndex];
    if (!trackUnknown || typeof trackUnknown !== "object") return [];
    const track = trackUnknown as Record<string, unknown>;
    const modulesData = track.modulesData as Record<string, unknown> | undefined;
    const instanceData = modulesData?.[ch.instanceId] as Record<string, unknown> | undefined;
    if (!instanceData) return [];
    
    const moduleData = {
      constructor: Array.isArray(instanceData.constructor) ? instanceData.constructor : [],
      methods: typeof instanceData.methods === "object" ? (instanceData.methods as Record<string, unknown>) : {},
    };
    const channelKey = ch.isConstructor ? "constructor" : String(ch.channelNumber);
    const configs = ch.isConstructor
      ? moduleData.constructor
      : Array.isArray((moduleData.methods as Record<string, unknown>)[channelKey])
        ? ((moduleData.methods as Record<string, unknown>)[channelKey] as MethodConfig[])
        : [];

    return configs as MethodConfig[];
  }, [userData, selectedChannel, activeSetId]);

  const changeOption = useCallback(
    (methodName: string, optionName: string, value: unknown, field = "value") => {
      const ch = selectedChannel as SelectedChannel | null;
      if (!ch) return;
      updateActiveSet(setUserData, activeSetId, (activeSet) => {
        const channelKey = ch.isConstructor ? "constructor" : String(ch.channelNumber);
        const tracksUnknown = (activeSet as Record<string, unknown>).tracks;
        if (!Array.isArray(tracksUnknown)) return;
        const trackUnknown = tracksUnknown[ch.trackIndex];
        if (!trackUnknown || typeof trackUnknown !== "object") return;
        const track = trackUnknown as Record<string, unknown>;
        const modulesData = track.modulesData as Record<string, unknown> | undefined;
        if (!modulesData) return;
        const instanceData = modulesData[ch.instanceId] as Record<string, unknown> | undefined;
        if (!instanceData) return;
        
        let methods: MethodConfig[];
        if (ch.isConstructor) {
          methods = (instanceData as Record<string, unknown>)["constructor"] as MethodConfig[];
        } else {
          const methodsObj = instanceData.methods as Record<string, unknown>;
          methods = methodsObj[channelKey] as MethodConfig[];
        }
        const method = methods.find((m) => m.name === methodName);
        if (method) {
          const option = method.options.find((o) => o.name === optionName);
          if (option) {
            (option as Record<string, unknown>)[field] = value;
          }
        }
      });
    },
    [selectedChannel, setUserData, activeSetId]
  );

  const addMethod = useCallback(
    (methodName: string) => {
      const ch = selectedChannel as SelectedChannel | null;
      if (!ch || !module) return;
      const method = normalizedModuleMethods.find((m) => m.name === methodName);
      if (!method) return;

      const initializedMethod = {
        name: method.name,
        options: method?.options?.length
          ? method.options.map((opt) => ({
              name: opt.name,
              value: opt.defaultVal,
              defaultVal: opt.defaultVal,
            }))
          : [],
      };

      const channelKey = ch.isConstructor ? "constructor" : String(ch.channelNumber);

      updateActiveSet(setUserData, activeSetId, (activeSet) => {
        const tracksUnknown = (activeSet as Record<string, unknown>).tracks;
        if (!Array.isArray(tracksUnknown)) return;
        const trackUnknown = tracksUnknown[ch.trackIndex];
        if (!trackUnknown || typeof trackUnknown !== "object") return;
        const track = trackUnknown as Record<string, unknown>;
        const modulesData = track.modulesData as Record<string, unknown> | undefined;
        if (!modulesData) return;
        const instanceData = modulesData[ch.instanceId] as Record<string, unknown> | undefined;
        if (!instanceData) return;
        
        const insertMethod = methodName === "matrix" ? "unshift" : "push";

        if (ch.isConstructor) {
          const constructor = (instanceData as Record<string, unknown>)["constructor"] as MethodConfig[];
          if (insertMethod === "unshift") {
            constructor.unshift(initializedMethod);
          } else {
            constructor.push(initializedMethod);
          }
        } else {
          const methods = instanceData.methods as Record<string, unknown>;
          if (!methods[channelKey]) {
            methods[channelKey] = [];
          }
          const channelMethods = methods[channelKey] as MethodConfig[];
          if (insertMethod === "unshift") {
            channelMethods.unshift(initializedMethod);
          } else {
            channelMethods.push(initializedMethod);
          }
        }
      });
    },
    [module, selectedChannel, setUserData, activeSetId, normalizedModuleMethods]
  );

  const removeMethod = useCallback(
    (methodName: string) => {
      const ch = selectedChannel as SelectedChannel | null;
      if (!ch) return;
      updateActiveSet(setUserData, activeSetId, (activeSet) => {
        const channelKey = ch.isConstructor ? "constructor" : String(ch.channelNumber);
        const tracksUnknown = (activeSet as Record<string, unknown>).tracks;
        if (!Array.isArray(tracksUnknown)) return;
        const trackUnknown = tracksUnknown[ch.trackIndex];
        if (!trackUnknown || typeof trackUnknown !== "object") return;
        const track = trackUnknown as Record<string, unknown>;
        const modulesData = track.modulesData as Record<string, unknown> | undefined;
        if (!modulesData) return;
        const instanceData = modulesData[ch.instanceId] as Record<string, unknown> | undefined;
        if (!instanceData) return;
        
        let methods: MethodConfig[];
        if (ch.isConstructor) {
          methods = (instanceData as Record<string, unknown>)["constructor"] as MethodConfig[];
        } else {
          const methodsObj = instanceData.methods as Record<string, unknown>;
          methods = methodsObj[channelKey] as MethodConfig[];
        }
        remove(methods, (m) => m.name === methodName);
      });
    },
    [selectedChannel, setUserData, activeSetId]
  );

  const addMissingOption = useCallback(
    (methodName: string, optionName: string) => {
      const ch = selectedChannel as SelectedChannel | null;
      if (!ch || !module) return;
      const methodDef = normalizedModuleMethods.find((m) => m.name === methodName);
      if (!methodDef) return;
      const optionDef = methodDef.options?.find((o) => o.name === optionName);
      if (!optionDef) return;

      updateActiveSet(setUserData, activeSetId, (activeSet) => {
        const tracksUnknown = (activeSet as Record<string, unknown>).tracks;
        if (!Array.isArray(tracksUnknown)) return;
        const trackUnknown = tracksUnknown[ch.trackIndex];
        if (!trackUnknown || typeof trackUnknown !== "object") return;
        const track = trackUnknown as Record<string, unknown>;
        const modulesData = track.modulesData as Record<string, unknown> | undefined;
        if (!modulesData) return;
        const instanceData = modulesData[ch.instanceId] as Record<string, unknown> | undefined;
        if (!instanceData) return;
        
        const channelKey = ch.isConstructor ? "constructor" : String(ch.channelNumber);
        let methods: MethodConfig[];
        if (ch.isConstructor) {
          methods = (instanceData as Record<string, unknown>)["constructor"] as MethodConfig[];
        } else {
          const methodsObj = instanceData.methods as Record<string, unknown>;
          methods = methodsObj[channelKey] as MethodConfig[];
        }
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
    [module, selectedChannel, setUserData, activeSetId, normalizedModuleMethods]
  );

  const methodLayers = useMemo(() => {
    if (!module) return [];
    return getMethodsByLayer(module, moduleBase, threeBase);
  }, [module, moduleBase, threeBase]);

  const availableMethods = useMemo(() => {
    return normalizedModuleMethods.filter((m) => !methodConfigs.some((mc) => mc.name === m.name));
  }, [methodConfigs, normalizedModuleMethods]);

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
      const layerMethods = methodConfigs.filter((method) => layer.methods.includes(method.name));
      return {
        ...layer,
        configuredMethods: layerMethods,
        availableMethods: availableMethods.filter((m) => layer.methods.includes(m.name)),
      };
    });
    return layersWithMethods;
  }, [methodLayers, methodConfigs, availableMethods]);

  const ch = selectedChannel as SelectedChannel | null;
  if (!isOpen || !ch) return null;
  if (!module && !isWorkspaceMode) return null;

  const modalTitle = (
    <>
      {module ? module.name : ch.moduleType}{" "}
      {ch.isConstructor ? "(Constructor)" : `(Channel ${ch.channelNumber})`}
      {!module && isWorkspaceMode ? (
        <span className="ml-2 inline-flex items-center">
          <Tooltip content={missingReasonText} position="top">
            <span className="text-red-500/70 text-[11px] cursor-help">
              <FaExclamationTriangle />
            </span>
          </Tooltip>
        </span>
      ) : null}
      {ch.isConstructor ? (
        <HelpIcon helpText={String((HELP_TEXT as Record<string, unknown>)["constructor"])} />
      ) : (
        <HelpIcon helpText={String((HELP_TEXT as Record<string, unknown>).midiChannel)} />
      )}
    </>
  );

  if (!module && isWorkspaceMode) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} position="bottom" size="full">
        <ModalHeader title={modalTitle} onClose={onClose} />
        <div className="px-6 py-6">
          <div className="text-neutral-300/70 text-[11px] font-mono">{missingReasonText}</div>
        </div>
      </Modal>
    );
  }

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} position="bottom" size="full">
        <ModalHeader title={modalTitle} onClose={onClose} />

        <div className="flex flex-col gap-6">
          {methodsByLayer.map((layer, _layerIndex) => {
            const hasMethodsOrAvailable =
              layer.configuredMethods.length > 0 || layer.availableMethods.length > 0;

            if (!hasMethodsOrAvailable) return null;

            return (
              <div key={layer.name} className="px-6 mb-6 border-neutral-800">
                <div className="flex justify-between items-baseline mb-4">
                  <div className="uppercase text-neutral-300 text-[11px] relative inline-block">
                    {layer.name} Methods
                  </div>
                  <div className="relative">
                    <Select
                      onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                        addMethod(e.target.value);
                        e.target.value = "";
                      }}
                      data-testid="method-add-select"
                      data-layer-name={layer.name}
                      className="py-1 px-2 min-w-[150px]"
                      defaultValue=""
                      disabled={layer.availableMethods.length === 0}
                      style={{
                        opacity: layer.availableMethods.length === 0 ? 0.5 : 1,
                        cursor: layer.availableMethods.length === 0 ? "not-allowed" : "pointer",
                      }}
                    >
                      <option value="" disabled className="text-neutral-300/30">
                        add method
                      </option>
                      {layer.availableMethods.map((method) => (
                        <option key={method.name} value={method.name} className="bg-[#101010]">
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
                    onReorder={(oldIndex: number, newIndex: number) => {
                      if (!ch) return;

                      const currentLayer = layer;
                      if (!currentLayer) return;

                      updateActiveSet(setUserData, activeSetId, (activeSet) => {
                        const channelKey = ch.isConstructor ? "constructor" : String(ch.channelNumber);
                        const tracksUnknown = (activeSet as Record<string, unknown>).tracks;
                        if (!Array.isArray(tracksUnknown)) return;
                        const trackUnknown = tracksUnknown[ch.trackIndex];
                        if (!trackUnknown || typeof trackUnknown !== "object") return;
                        const track = trackUnknown as Record<string, unknown>;
                        const modulesData = track.modulesData as Record<string, unknown> | undefined;
                        if (!modulesData) return;
                        const instanceData = modulesData[ch.instanceId] as Record<string, unknown> | undefined;
                        if (!instanceData) return;
                        
                        if (ch.isConstructor) {
                          const _methods = (instanceData as Record<string, unknown>)["constructor"] as MethodConfig[];
                          void _methods;
                        } else {
                          const methodsObj = instanceData.methods as Record<string, unknown>;
                          const _methods = methodsObj[channelKey] as MethodConfig[];
                          void _methods;
                        }

                        const reorderedLayer = arrayMove(
                          currentLayer.configuredMethods,
                          oldIndex,
                          newIndex
                        );

                        const allReorderedMethods = methodsByLayer.reduce(
                          (acc: MethodConfig[], l) => {
                            if (l.name === currentLayer.name) {
                              return [...acc, ...reorderedLayer];
                            } else {
                              return [...acc, ...l.configuredMethods];
                            }
                          },
                          []
                        );

                        if (ch.isConstructor) {
                          (instanceData as Record<string, unknown>)["constructor"] = allReorderedMethods;
                        } else {
                          (instanceData.methods as Record<string, unknown>)[channelKey] =
                            allReorderedMethods;
                        }
                      });
                    }}
                  >
                    <div className="flex items-start overflow-x-auto pt-4">
                      {layer.configuredMethods.map((method, methodIndex) => {
                        const handleShowMethodCode = (methodName: string) => {
                          setSelectedMethodForCode({
                            moduleName: module?.id || module?.name || null,
                            methodName,
                          });
                        };
                        return (
                        <Fragment key={method.name}>
                          <SortableItem
                            id={method.name}
                            method={method}
                            handleRemoveMethod={removeMethod}
                            changeOption={changeOption}
                            addMissingOption={addMissingOption}
                            moduleMethods={normalizedModuleMethods}
                            moduleName={module ? module.name : null}
                            userColors={userColors}
                            onShowMethodCode={handleShowMethodCode}
                          />
                          {methodIndex < layer.configuredMethods.length - 1 && (
                            <div className="flex-shrink-0 flex items-center w-4 min-h-[40px]">
                              <div className="w-full h-px bg-neutral-800" />
                            </div>
                          )}
                        </Fragment>
                      );
                      })}
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

        {!ch?.isConstructor && (onEditChannel || onDeleteChannel) && (
          <ModalFooter>
            {onEditChannel && (
              <Button
                onClick={() => {
                  if (ch.channelNumber !== undefined) {
                    onEditChannel(ch.channelNumber);
                  }
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
                  if (ch.channelNumber !== undefined) {
                    onDeleteChannel(ch.channelNumber);
                  }
                  onClose();
                }}
                type="secondary"
                className="text-[11px]"
                disabled={selectedTrackChannelCount <= 3}
                title={selectedTrackChannelCount <= 3 ? "Minimum 3 channels required" : "Delete Channel"}
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
