import { memo, useMemo, useCallback, useEffect, useRef, useState } from "react";
import { FaDice, FaLock, FaPlay } from "react-icons/fa";
import { TextInput, NumberInput, ColorInput, Select, Checkbox } from "./FormInputs";
import { MatrixGrid } from "../shared/MatrixGrid";
import { AssetOptionInput } from "./AssetOptionInput";

const CUSTOM_VALUE = "__nw_wrld_custom__";

type MethodOptionDef = {
  name: string;
  type: string;
  defaultVal?: unknown;
  values?: string[];
  min?: number;
  max?: number;
  assetBaseDir?: string;
  assetExtensions?: string[];
  allowCustom?: boolean;
  allowRandomization?: boolean;
};

type ModuleMethodDef = {
  name: string;
  options?: MethodOptionDef[];
};

type MethodOptionValue = {
  name: string;
  value: unknown;
  randomRange?: unknown;
  randomValues?: unknown;
  randomizeFromUserColors?: unknown;
};

type MethodValue = {
  name: string;
  options: MethodOptionValue[];
};

type MethodBlockProps = {
  method: MethodValue;
  mode?: "dashboard" | "editor";
  moduleMethods?: ModuleMethodDef[];
  moduleName?: string | null;
  userColors?: string[];
  dragHandleProps?: Record<string, unknown> | null;
  onRemove?: ((methodName: string) => void) | null;
  onShowCode?: ((methodName: string) => void) | null;
  onTrigger?: ((method: MethodValue) => void) | null;
  onOptionChange?: ((methodName: string, optionName: string, value: unknown) => void) | null;
  onToggleRandom?: ((optionName: string, optionDef?: MethodOptionDef | null) => void) | null;
  onRandomRangeChange?:
    | ((
        optionName: string,
        indexOrValues: unknown,
        newValue: unknown,
        optionDef?: MethodOptionDef | null
      ) => void)
    | null;
  onAddMissingOption?: ((methodName: string, optionName: string) => void) | null;
};

const DraftNumberInput = memo(
  ({
    value,
    min,
    max,
    fallback,
    onCommit,
    methodName,
    optionName,
  }: {
    value: unknown;
    min?: number;
    max?: number;
    fallback: number;
    onCommit: (next: number) => void;
    methodName?: string;
    optionName?: string;
  }) => {
    const [draft, setDraft] = useState<string | null>(null);
    const [isFocused, setIsFocused] = useState(false);
    const skipCommitRef = useRef(false);

    useEffect(() => {
      if (!isFocused) setDraft(null);
    }, [isFocused, value]);

    const displayed = draft !== null ? draft : String(value ?? "");

    const commitIfValid = useCallback(
      (raw) => {
        const s = String(raw);
        const isIntermediate =
          s === "" || s === "-" || s === "." || s === "-." || s.endsWith(".") || /e[+-]?$/i.test(s);
        if (isIntermediate) return;
        const n = Number(s);
        if (!Number.isFinite(n)) return;
        onCommit(n);
      },
      [onCommit]
    );

    const commitOnBlur = useCallback(() => {
      if (draft === null) return;
      const s = String(draft);
      const isIntermediate =
        s === "" || s === "-" || s === "." || s === "-." || s.endsWith(".") || /e[+-]?$/i.test(s);
      if (isIntermediate) {
        onCommit(fallback);
        return;
      }
      const n = Number(s);
      if (!Number.isFinite(n)) {
        onCommit(fallback);
        return;
      }
      onCommit(n);
    }, [draft, fallback, onCommit]);

    return (
      <NumberInput
        value={displayed}
        min={min}
        max={max}
        data-testid="method-option-input"
        data-method-name={methodName}
        data-option-name={optionName}
        onFocus={() => {
          skipCommitRef.current = false;
          setIsFocused(true);
          setDraft(String(value ?? ""));
        }}
        onChange={(e) => {
          const next = e.target.value;
          setDraft(next);
          commitIfValid(next);
        }}
        onBlur={() => {
          setIsFocused(false);
          if (skipCommitRef.current) {
            skipCommitRef.current = false;
            return;
          }
          commitOnBlur();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            skipCommitRef.current = true;
            setDraft(null);
            e.currentTarget.blur();
          }
        }}
      />
    );
  }
);

export const MethodBlock = memo(
  ({
    method,
    mode = "dashboard",
    moduleMethods = [],
    moduleName: _moduleName = null,
    userColors = [],
    dragHandleProps = null,
    onRemove = null,
    onShowCode: _onShowCode = null,
    onTrigger = null,
    onOptionChange = null,
    onToggleRandom = null,
    onRandomRangeChange = null,
    onAddMissingOption = null,
  }: MethodBlockProps) => {
    const [isFlashing, setIsFlashing] = useState(false);
    const [customColorOpenByOption, setCustomColorOpenByOption] = useState({});

    const methodOptions = useMemo(
      () => moduleMethods.find((m) => m.name === method.name)?.options || [],
      [moduleMethods, method.name]
    );

    const handleOptionChange = useCallback(
      (optionName, value) => {
        if (onOptionChange) {
          onOptionChange(method.name, optionName, value);
        }
      },
      [method.name, onOptionChange]
    );

    const renderInput = (option, currentOption) => {
      const isRandomized =
        Array.isArray(currentOption.randomRange) ||
        (option.type === "select" &&
          Array.isArray(currentOption.randomValues) &&
          currentOption.randomValues.length > 0) ||
        (option.type === "color" &&
          Array.isArray(currentOption.randomValues) &&
          currentOption.randomValues.length > 0 &&
          currentOption.randomizeFromUserColors);
      const optionDef = moduleMethods
        .find((m) => m.name === method.name)
        ?.options.find((o) => o.name === option.name);
      const _allowRandomization = optionDef?.allowRandomization || false;

      if (mode === "editor") {
        if (option.type === "number") {
          const fallback =
            typeof option.defaultVal === "number"
              ? option.defaultVal
              : typeof currentOption.value === "number"
                ? currentOption.value
                : 0;
          return (
            <DraftNumberInput
              value={currentOption.value}
              min={option.min}
              max={option.max}
              fallback={fallback}
              onCommit={(next) => handleOptionChange(option.name, next)}
              methodName={method.name}
              optionName={option.name}
            />
          );
        } else if (option.type === "select") {
          return (
            <Select
              value={currentOption.value}
              onChange={(e) => handleOptionChange(option.name, e.target.value)}
              data-testid="method-option-select"
              data-method-name={method.name}
              data-option-name={option.name}
            >
              {option.values.map((val) => (
                <option key={val} value={val} className="bg-[#101010]">
                  {val}
                </option>
              ))}
            </Select>
          );
        } else if (option.type === "assetFile" || option.type === "assetDir") {
          const kind = option.type === "assetDir" ? "dir" : "file";
          return (
            <AssetOptionInput
              kind={kind}
              baseDir={option.assetBaseDir}
              extensions={option.assetExtensions}
              allowCustom={option.allowCustom !== false}
              value={currentOption.value}
              onChange={(next) => handleOptionChange(option.name, next)}
            />
          );
        } else if (option.type === "text") {
          return (
            <TextInput
              value={currentOption.value}
              onChange={(e) => handleOptionChange(option.name, e.target.value)}
              className="w-20 py-0.5"
              data-testid="method-option-input"
              data-method-name={method.name}
              data-option-name={option.name}
            />
          );
        } else if (option.type === "color") {
          const values = Array.isArray(userColors) ? userColors : [];
          const isCustomOpen =
            customColorOpenByOption[option.name] ?? !values.includes(currentOption.value);
          const selectValue =
            !isCustomOpen && values.includes(currentOption.value)
              ? currentOption.value
              : CUSTOM_VALUE;
          return (
            <div className="flex items-center gap-2">
              {values.length > 0 ? (
                <Select
                  value={selectValue}
                  onChange={(e) => {
                    const next = e.target.value;
                    if (next === CUSTOM_VALUE) {
                      setCustomColorOpenByOption((prev) => ({
                        ...prev,
                        [option.name]: true,
                      }));
                      return;
                    }
                    setCustomColorOpenByOption((prev) => ({
                      ...prev,
                      [option.name]: false,
                    }));
                    handleOptionChange(option.name, next);
                  }}
                  style={{ width: "120px" }}
                  data-testid="method-option-select"
                  data-method-name={method.name}
                  data-option-name={option.name}
                >
                  {values.map((hex) => (
                    <option key={hex} value={hex} className="bg-[#101010]">
                      {hex}
                    </option>
                  ))}
                  <option value={CUSTOM_VALUE} className="bg-[#101010]">
                    custom…
                  </option>
                </Select>
              ) : null}
              {values.length === 0 || isCustomOpen ? (
                <ColorInput
                  value={currentOption.value}
                  onChange={(e) => {
                    setCustomColorOpenByOption((prev) => ({
                      ...prev,
                      [option.name]: true,
                    }));
                    handleOptionChange(option.name, e.target.value);
                  }}
                  data-testid="method-option-input"
                  data-method-name={method.name}
                  data-option-name={option.name}
                />
              ) : null}
            </div>
          );
        } else if (option.type === "boolean") {
          return (
            <Checkbox
              checked={currentOption.value}
              onChange={(e) => handleOptionChange(option.name, e.target.checked)}
            />
          );
        } else if (option.type === "matrix") {
          return (
            <MatrixGrid
              value={currentOption.value}
              onChange={(value) => handleOptionChange(option.name, value)}
            />
          );
        }
      } else {
        if (option.type === "color") {
          const values = Array.isArray(userColors) ? userColors : [];
          const isCustomOpen =
            customColorOpenByOption[option.name] ??
            (!values.includes(currentOption.value) &&
              !(isRandomized && currentOption.randomizeFromUserColors));
          const selectValue =
            !isCustomOpen && values.includes(currentOption.value)
              ? currentOption.value
              : CUSTOM_VALUE;
          return (
            <div className="flex items-center gap-2">
              {values.length > 0 ? (
                <Select
                  value={selectValue}
                  onChange={(e) => {
                    const next = e.target.value;
                    if (next === CUSTOM_VALUE) {
                      setCustomColorOpenByOption((prev) => ({
                        ...prev,
                        [option.name]: true,
                      }));
                      return;
                    }
                    setCustomColorOpenByOption((prev) => ({
                      ...prev,
                      [option.name]: false,
                    }));
                    handleOptionChange(option.name, next);
                  }}
                  style={{ width: "120px" }}
                  data-testid="method-option-select"
                  data-method-name={method.name}
                  data-option-name={option.name}
                >
                  {values.map((hex) => (
                    <option key={hex} value={hex} className="bg-[#101010]">
                      {hex}
                    </option>
                  ))}
                  <option value={CUSTOM_VALUE} className="bg-[#101010]">
                    custom…
                  </option>
                </Select>
              ) : null}
              {values.length === 0 || isCustomOpen ? (
                <ColorInput
                  value={currentOption.value}
                  onChange={(e) => {
                    setCustomColorOpenByOption((prev) => ({
                      ...prev,
                      [option.name]: true,
                    }));
                    handleOptionChange(option.name, e.target.value);
                  }}
                  data-testid="method-option-input"
                  data-method-name={method.name}
                  data-option-name={option.name}
                />
              ) : null}
            </div>
          );
        }

        if (isRandomized) {
          if (option.type === "select") {
            const values = Array.isArray(option.values) ? option.values : [];
            const currentRandomValues = Array.isArray(currentOption.randomValues)
              ? currentOption.randomValues
              : [];
            const randomAll =
              values.length > 0 &&
              currentRandomValues.length === values.length &&
              values.every((v) => currentRandomValues.includes(v));
            const selectedSet = new Set(currentRandomValues);

            return (
              <div className="flex flex-col gap-2">
                <label className="inline-flex items-center gap-2 text-[10px] text-neutral-300/60 font-mono select-none">
                  <Checkbox
                    checked={randomAll}
                    onChange={(e) => {
                      if (!onRandomRangeChange) return;
                      if (e.target.checked) {
                        onRandomRangeChange(option.name, [...values], null, option);
                        return;
                      }
                      const fallback = values.includes(currentOption.value)
                        ? currentOption.value
                        : values.includes(option.defaultVal)
                          ? option.defaultVal
                          : values[0];
                      onRandomRangeChange(option.name, [fallback], null, option);
                    }}
                  />
                  use all values
                </label>

                <div
                  className="flex flex-col gap-1 border border-neutral-700"
                  style={{
                    width: "160px",
                    maxHeight: "132px",
                    overflowY: "auto",
                    padding: "6px",
                    opacity: randomAll ? 0.5 : 1,
                  }}
                >
                  {values.map((val) => {
                    const checked = randomAll ? true : selectedSet.has(val);
                    return (
                      <label
                        key={val}
                        className="inline-flex items-center gap-2 text-[10px] text-neutral-300/80 font-mono select-none"
                        style={{
                          cursor: randomAll ? "not-allowed" : "pointer",
                        }}
                      >
                        <Checkbox
                          checked={checked}
                          disabled={randomAll}
                          onChange={() => {
                            if (!onRandomRangeChange) return;
                            if (randomAll) return;
                            const nextSet = new Set(selectedSet);
                            if (nextSet.has(val)) nextSet.delete(val);
                            else nextSet.add(val);
                            const next = values.filter((v) => nextSet.has(v));
                            onRandomRangeChange(option.name, next, null, option);
                          }}
                        />
                        <span>{val}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          }

          return (
            <div className="flex gap-2">
              {option.type === "boolean" ? (
                <>
                  <div className="flex flex-col gap-0.5">
                    <div className="text-[9px] text-neutral-300/30">min:</div>
                    <Select
                      value={currentOption.randomRange[0] ? "true" : "false"}
                      onChange={(e) =>
                        onRandomRangeChange &&
                        onRandomRangeChange(option.name, 0, e.target.value, option)
                      }
                    >
                      <option value="true">True</option>
                      <option value="false">False</option>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <div className="text-[9px] text-neutral-300/30">max:</div>
                    <Select
                      value={currentOption.randomRange[1] ? "true" : "false"}
                      onChange={(e) =>
                        onRandomRangeChange &&
                        onRandomRangeChange(option.name, 1, e.target.value, option)
                      }
                    >
                      <option value="true">True</option>
                      <option value="false">False</option>
                    </Select>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex flex-col gap-0.5">
                    <div className="text-[9px] text-neutral-300/30">min:</div>
                    <NumberInput
                      value={currentOption.randomRange[0]}
                      onChange={(e) =>
                        onRandomRangeChange &&
                        onRandomRangeChange(option.name, 0, e.target.value, option)
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <div className="text-[9px] text-neutral-300/30">max:</div>
                    <NumberInput
                      value={currentOption.randomRange[1]}
                      onChange={(e) =>
                        onRandomRangeChange &&
                        onRandomRangeChange(option.name, 1, e.target.value, option)
                      }
                    />
                  </div>
                </>
              )}
            </div>
          );
        } else if (option.type === "number") {
          const fallback =
            typeof option.defaultVal === "number"
              ? option.defaultVal
              : typeof currentOption.value === "number"
                ? currentOption.value
                : 0;
          return (
            <DraftNumberInput
              value={currentOption.value}
              min={option.min}
              max={option.max}
              fallback={fallback}
              onCommit={(next) => handleOptionChange(option.name, next)}
              methodName={method.name}
              optionName={option.name}
            />
          );
        } else if (option.type === "select") {
          return (
            <Select
              value={currentOption.value}
              onChange={(e) => handleOptionChange(option.name, e.target.value)}
              data-testid="method-option-select"
              data-method-name={method.name}
              data-option-name={option.name}
            >
              {option.values.map((val) => (
                <option key={val} value={val} className="bg-[#101010]">
                  {val}
                </option>
              ))}
            </Select>
          );
        } else if (option.type === "assetFile" || option.type === "assetDir") {
          const kind = option.type === "assetDir" ? "dir" : "file";
          return (
            <AssetOptionInput
              kind={kind}
              baseDir={option.assetBaseDir}
              extensions={option.assetExtensions}
              allowCustom={option.allowCustom !== false}
              value={currentOption.value}
              onChange={(next) => handleOptionChange(option.name, next)}
            />
          );
        } else if (option.type === "text") {
          return (
            <TextInput
              value={currentOption.value}
              onChange={(e) => handleOptionChange(option.name, e.target.value)}
              className="w-20 py-0.5"
              data-testid="method-option-input"
              data-method-name={method.name}
              data-option-name={option.name}
            />
          );
        } else if (option.type === "color") {
          return (
            <ColorInput
              value={currentOption.value}
              onChange={(e) => handleOptionChange(option.name, e.target.value)}
              data-testid="method-option-input"
              data-method-name={method.name}
              data-option-name={option.name}
            />
          );
        } else if (option.type === "boolean") {
          return (
            <Checkbox
              checked={currentOption.value}
              onChange={(e) => handleOptionChange(option.name, e.target.checked)}
            />
          );
        } else if (option.type === "matrix") {
          return (
            <MatrixGrid
              value={currentOption.value}
              onChange={(value) => handleOptionChange(option.name, value)}
            />
          );
        }
      }

      return null;
    };

    return (
      <div
        className={`flex flex-col border w-fit flex-shrink-0 ${
          isFlashing ? "border-red-500" : "border-neutral-600"
        }`}
      >
        <div className="relative py-2 px-3 font-mono">
          <div className="h-0 -translate-y-[17px] w-full px-2 min-w-max flex justify-between items-baseline mb-2">
            <span
              className={`px-1 mr-4 text-[11px] font-mono text-neutral-300 bg-[#101010] ${
                mode === "dashboard" && dragHandleProps && method.name !== "matrix"
                  ? "cursor-move"
                  : method.name === "matrix"
                    ? "cursor-not-allowed"
                    : "cursor-default"
              }`}
              {...(mode === "dashboard" && dragHandleProps ? dragHandleProps : {})}
            >
              {mode === "dashboard" && method.name !== "matrix" && (
                <span className="text-md text-neutral-300">{"\u2261 "}</span>
              )}
              {mode === "dashboard" && method.name === "matrix" && (
                <span
                  className="inline-flex items-center text-[11px] text-neutral-300/60"
                  title="Not movable"
                >
                  <FaLock className="text-[10px] mr-1" />
                </span>
              )}
              <span className="opacity-80">{method.name}</span>
            </span>

            <div className="flex items-center gap-2">
              {mode === "dashboard" && onRemove && (
                <div
                  className="px-1 text-red-500/50 cursor-pointer text-[11px] bg-[#101010]"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(method.name);
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  title="Delete Method"
                >
                  [{"\u00D7"}]
                </div>
              )}
              {mode === "editor" && onTrigger && (
                <div
                  className="px-1 text-red-500/50 cursor-pointer text-[11px] bg-[#101010]"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsFlashing(true);
                    onTrigger(method);
                    setTimeout(() => {
                      setIsFlashing(false);
                    }, 50);
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  title="Trigger Method"
                >
                  <FaPlay className="text-[10px]" />
                </div>
              )}
            </div>
          </div>

          <div
            className={`pt-2 grid gap-4 font-mono min-w-max ${
              methodOptions?.length === 1
                ? "grid-cols-1"
                : methodOptions?.length >= 2
                  ? method.name === "matrix"
                    ? "grid-cols-[max-content_max-content]"
                    : "grid-cols-2"
                  : "grid-cols-1"
            }`}
          >
            {methodOptions?.map((option) => {
              const methodOptionValues = Array.isArray(method?.options) ? method.options : [];
              const currentOption = methodOptionValues.find((o) => o.name === option.name);

              if (!currentOption) {
                if (mode === "dashboard" && onAddMissingOption) {
                  return (
                    <div
                      className="w-[192px] text-[11px] text-neutral-300 font-mono flex items-center gap-2"
                      key={option.name}
                    >
                      <span>ERROR: Missing key &quot;{option.name}&quot;</span>
                      <button
                        onClick={() => onAddMissingOption(method.name, option.name)}
                        className="py-0.5 px-2 text-[11px] font-mono bg-white/5 text-neutral-300 border border-neutral-300 cursor-pointer whitespace-nowrap hover:bg-neutral-300 hover:text-[#101010]"
                        title="Add missing option with default value"
                      >
                        Fix
                      </button>
                    </div>
                  );
                }
                return null;
              }

              const optionDef = moduleMethods
                .find((m) => m.name === method.name)
                ?.options.find((o) => o.name === option.name);
              const allowRandomization = optionDef?.allowRandomization || false;
              const isRandomized =
                Array.isArray(currentOption.randomRange) ||
                (option.type === "select" &&
                  Array.isArray(currentOption.randomValues) &&
                  currentOption.randomValues.length > 0) ||
                (option.type === "color" &&
                  Array.isArray(currentOption.randomValues) &&
                  currentOption.randomValues.length > 0 &&
                  currentOption.randomizeFromUserColors);
              const showDice =
                mode === "dashboard" &&
                onToggleRandom &&
                (allowRandomization ||
                  option.type === "select" ||
                  (option.type === "color" && Array.isArray(userColors) && userColors.length > 0));

              return (
                <div
                  key={option.name}
                  className="flex flex-col gap-1 text-[11px] text-neutral-300 font-mono"
                >
                  <div className="inline-flex items-center font-mono">
                    {option.name}:
                    {mode === "dashboard" && showDice && (
                      <FaDice
                        className={`ml-1.5 cursor-pointer text-[10px] ${
                          isRandomized ? "text-neutral-300" : "text-neutral-300/30"
                        }`}
                        onClick={() => onToggleRandom(option.name, option)}
                        title="Toggle Randomization"
                      />
                    )}
                  </div>
                  {renderInput(option, currentOption)}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }
);
