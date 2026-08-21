import { useState, useEffect, useMemo, useCallback } from "react";
import { FaTimes } from "react-icons/fa";
import { Button } from "../components/Button";
import { getBridge } from "../core/utils";


type ModuleMethodOption = {
  name: string;
  defaultVal?: unknown;
};

type ModuleMethod = {
  name: string;
  executeOnLoad?: boolean;
  options?: ModuleMethodOption[] | null;
};

type PredefinedModule = {
  id?: string;
  name?: string;
  methods?: ModuleMethod[];
};

type ModuleEditorModalProps = {
  isOpen: boolean;
  onClose: () => void;
  moduleName: string | null;
  predefinedModules?: PredefinedModule[];
  workspacePath?: string | null;
};

export const ModuleEditorModal = ({
  isOpen,
  onClose,
  moduleName,
  predefinedModules = [],
  workspacePath = null,
}: ModuleEditorModalProps) => {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const moduleData = useMemo<PredefinedModule | null>(() => {
    if (!moduleName) return null;
    return predefinedModules.find(
      (m) => m.id === moduleName || m.name === moduleName
    );
  }, [predefinedModules, moduleName]);

  const filePath = useMemo<string | null>(() => {
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

  useEffect(() => {
    if (!isOpen) {
      setIsLoading(true);
      return;
    }

    setIsLoading(true);

    if (moduleName) {
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
          const msg = err instanceof Error ? err.message : String(err);
          setError(`Failed to load module: ${msg}`);
          setIsLoading(false);
        }
      })();
    }
  }, [isOpen, moduleName, workspacePath]);

  const triggerPreview = useCallback(() => {
    if (!moduleName || !moduleData) return;

    try {
      const methods = moduleData.methods || [];
      const executeOnLoadMethods = methods
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

      const showMethod = methods.find((m) => m.name === "show");
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
        type: "preview-module",
        props: {
          moduleName: moduleName,
          moduleData: {
            constructor: finalConstructorMethods,
            methods: {},
          },
        },
      };

      const bridge = getBridge();
      bridge?.messaging?.sendToProjector?.(previewData.type, previewData.props);
    } catch (error) {
      console.error("Error triggering preview:", error);
    }
  }, [moduleName, moduleData]);

  useEffect(() => {
    if (isOpen && moduleData && !isLoading) {
      triggerPreview();
    }
  }, [isOpen, isLoading, moduleData, triggerPreview]);

  const clearPreview = () => {
    const bridge = getBridge();
    bridge?.messaging?.sendToProjector?.("clear-preview", {});
  };

  const handleClose = () => {
    clearPreview();
    setCode("");
    setError(null);
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
                  className="selectable-text text-red-500/50 font-mono text-[10px] underline cursor-pointer"
                  title="Open in File Explorer"
                >
                  {filePath}
                </a>
              </div>
            </div>
          )}
          {/* {methodsWithValues.length === 0 ? (
            <div className="text-neutral-500 font-mono text-[10px] py-2">
              No custom methods found
            </div>
          ) : (
            <div className="flex flex-col gap-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <h3 className="text-neutral-300 font-mono text-[11px] uppercase">
                    Methods
                  </h3>
                  <span className="relative inline-block">
                    <HelpIcon helpText={HELP_TEXT.editorMethods} />
                  </span>
                </div>
                <Button
                  onClick={triggerPreview}
                  type="secondary"
                  icon={<FaRedo />}
                >
                  Re-render
                </Button>
              </div>
              <div className="flex items-start gap-4">
                {methodsWithValues.map((method) => (
                  <MethodBlock
                    key={method.name}
                    method={method}
                    mode="editor"
                    moduleMethods={moduleData?.methods || []}
                    onTrigger={handleMethodTrigger}
                    onOptionChange={handleOptionChange}
                  />
                ))}
              </div>
            </div>
          )} */}
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
