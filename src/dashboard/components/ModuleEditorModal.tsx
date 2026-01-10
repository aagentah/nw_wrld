import React, { useState, useEffect, useMemo, useCallback } from "react";
import { FaTimes, FaRedo } from "react-icons/fa";
import { Button } from "./Button";
import {
  TextInput,
  NumberInput,
  ColorInput,
  Select,
  Checkbox,
  TERMINAL_STYLES,
} from "./FormInputs";
import { getBaseMethodNames } from "../utils/moduleUtils";
import { MethodBlock, MethodOptionWithValue } from "./MethodBlock";
import { HelpIcon } from "./HelpIcon";
import { HELP_TEXT } from "../../shared/helpText";
import type { PreviewModuleData } from "../../types";

const getBridge = () => (globalThis as any).nwWrldBridge;

interface ModuleData {
  id: string;
  name: string;
  methods: {
    name: string;
    executeOnLoad: boolean;
    options: {
      name: string;
      defaultVal: any;
      type: string;
    }[];
  }[];
}

export interface ModuleEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  moduleName: string | null;
  templateType?: "basic" | "threejs" | "p5js" | null;
  onModuleSaved?: () => void;
  predefinedModules?: ModuleData[];
  workspacePath?: string | null;
}

export const ModuleEditorModal = ({
  isOpen,
  onClose,
  moduleName,
  templateType = null,
  onModuleSaved,
  predefinedModules = [],
  workspacePath = null,
}: ModuleEditorModalProps) => {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [methodOptions, setMethodOptions] = useState<Record<string, Record<string, any>>>({});

  const moduleData = useMemo(() => {
    if (!moduleName) return null;
    return predefinedModules.find(
      (m) => m.id === moduleName || m.name === moduleName
    );
  }, [predefinedModules, moduleName]);

  const filePath = useMemo(() => {
    if (!moduleName) return null;
    if (workspacePath) {
      return `${workspacePath}/modules/${moduleName}.js`;
    }
    return null;
  }, [moduleName, workspacePath]);

  const handleOpenInFileExplorer = useCallback(() => {
    const bridge = getBridge();
    if (
      !bridge ||
      !bridge.workspace ||
      typeof bridge.workspace.showModuleInFolder !== "function"
    ) {
      return;
    }
    bridge.workspace.showModuleInFolder(moduleName);
  }, [moduleName]);

  const { moduleBase, threeBase } = useMemo(() => getBaseMethodNames(), []);

  const customMethods = useMemo(() => {
    if (!moduleData || !moduleData.methods) return [];

    const allBaseMethods = [...moduleBase, ...threeBase];
    return moduleData.methods.filter(
      (method) => !allBaseMethods.includes(method.name)
    );
  }, [moduleData, moduleBase, threeBase]);

  const methodsWithValues = useMemo(() => {
    return customMethods.map((method) => ({
      name: method.name,
      options: (method.options || []).map((opt) => {
        const currentValue =
          methodOptions[method.name]?.[opt.name] !== undefined
            ? methodOptions[method.name][opt.name]
            : opt.defaultVal;
        return {
          name: opt.name,
          value: currentValue,
        };
      }),
    }));
  }, [customMethods, methodOptions]);

  useEffect(() => {
    if (!isOpen) {
      setIsLoading(true);
      return;
    }

    setIsLoading(true);

    if (templateType && moduleName) {
      // Simplified template generation
      const template = `/* Template for ${moduleName} */`;
      setCode(template);
      setIsLoading(false);
    } else if (moduleName) {
      (async () => {
        try {
          const bridge = getBridge();
          if (
            !bridge ||
            !bridge.workspace ||
            typeof bridge.workspace.readModuleText !== "function"
          ) {
            throw new Error("Workspace bridge unavailable");
          }
          const fileContent = await bridge.workspace.readModuleText(moduleName);
          if (fileContent == null) {
            throw new Error("Module file not found");
          }
          setCode(String(fileContent));
          setIsLoading(false);
        } catch (err) {
          const error = err as Error;
          setError(`Failed to load module: ${error.message}`);
          setIsLoading(false);
        }
      })();
    }
  }, [isOpen, moduleName, templateType, workspacePath]);

  const triggerPreview = () => {
    if (!moduleName || !moduleData) return;

    try {
      const executeOnLoadMethods = moduleData.methods
        .filter((m) => m.executeOnLoad)
        .map((m) => ({
          name: m.name,
          options:
            m.options?.length > 0
              ? m.options.map((opt) => ({
                  name: opt.name,
                  value: opt.defaultVal,
                }))
              : null,
        }));

      const showMethod = moduleData.methods.find((m) => m.name === "show");
      const finalConstructorMethods = [...executeOnLoadMethods];

      if (
        showMethod &&
        !finalConstructorMethods.some((m) => m.name === "show")
      ) {
        finalConstructorMethods.push({
          name: "show",
          options:
            showMethod.options?.length > 0
              ? showMethod.options.map((opt) => ({
                  name: opt.name,
                  value: opt.defaultVal,
                }))
              : null,
        });
      }

      const previewData = {
        type: "preview-module" as const,
        props: {
          moduleName: moduleName,
          moduleData: {
            constructor: finalConstructorMethods,
            methods: {},
          },
          requestId: null,
        },
      };

      const bridge = getBridge();
      bridge?.messaging?.sendToProjector?.(previewData.type, previewData.props);
    } catch (error) {
      console.error("Error triggering preview:", error);
    }
  };

  const clearPreview = () => {
    const bridge = getBridge();
    bridge?.messaging?.sendToProjector?.("clear-preview", {});
  };

  const handleMethodTrigger = (method: { name: string; options: MethodOptionWithValue[] }) => {
    const params: Record<string, any> = {};
    method.options.forEach((opt) => {
      params[opt.name] = opt.value;
    });

    const bridge = getBridge();
    bridge?.messaging?.sendToProjector?.("trigger-preview-method", {
      moduleName: moduleName,
      methodName: method.name,
      options: params,
    });
  };

  const handleOptionChange = useCallback((methodName: string, optionName: string, value: any) => {
    setMethodOptions((prev) => ({
      ...prev,
      [methodName]: {
        ...prev[methodName],
        [optionName]: value,
      },
    }));
  }, []);

  const handleClose = () => {
    clearPreview();
    setCode("");
    setError(null);
    setMethodOptions({});
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-95 flex flex-col">
      {/* Header */}
      <div className="bg-[#101010] border-b border-neutral-700 px-6 py-3 flex items-start justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-4">
            <h2 className="text-neutral-300 font-mono text-md uppercase">
              {moduleName}
            </h2>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <Button onClick={handleClose} type="secondary" icon={<FaTimes />}>
            Close
          </Button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 bg-[#101010] overflow-hidden relative pt-6 min-h-0">
        {isLoading && (
          <div className="absolute inset-0 bg-[#101010] flex items-center justify-center z-10">
            <div className="text-neutral-400 font-mono text-[11px]">
              Loading editor...
            </div>
          </div>
        )}
        <div className="h-full overflow-auto px-6 pb-6">
          <pre className="code-viewer text-neutral-300 font-mono text-[11px] leading-5 whitespace-pre">
            <code>{code}</code>
          </pre>
        </div>
      </div>

      {/* Footer Panel */}
      <div className="bg-[#101010] border-t border-neutral-700 flex flex-col flex-shrink-0">
        <div className="overflow-x-auto overflow-y-hidden px-6 py-6">
          {filePath && (
            <div className="text-neutral-500 font-mono">
              <div className="text-[11px]">
                To edit this module, open file in your code editor:
              </div>
              <div>
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    handleOpenInFileExplorer();
                  }}
                  className="text-red-500/50 font-mono text-[10px] underline cursor-pointer"
                  title="Open in File Explorer"
                >
                  {filePath}
                </a>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Error/Status Bar */}
      {error && (
        <div
          className={`px-6 py-3 font-mono text-[10px] ${
            error.includes("successfully")
              ? "bg-green-900 text-green-200"
              : "bg-red-900 text-red-200"
          }`}
        >
          {error}
        </div>
      )}
    </div>
  );
};
