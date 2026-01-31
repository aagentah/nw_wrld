import { useState, useEffect, useMemo, useCallback } from "react";
import { FaTimes } from "react-icons/fa";
import { Button } from "./Button";
import { getBaseMethodNames } from "../utils/moduleUtils";

const getBridge = () => globalThis.nwWrldBridge;

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

type TemplateType = "basic" | "threejs" | "p5js";

type MethodWithValues = {
  name: string;
  options: { name: string; value: unknown }[];
};

type ModuleEditorModalProps = {
  isOpen: boolean;
  onClose: () => void;
  moduleName: string | null;
  templateType?: TemplateType | null;
  onModuleSaved?: ((moduleName: string) => void) | null;
  predefinedModules?: PredefinedModule[];
  workspacePath?: string | null;
};

const TEMPLATES = {
  basic: (moduleName) => `/*
@nwWrld name: ${moduleName}
@nwWrld category: Custom
@nwWrld imports: ModuleBase
*/

class ${moduleName} extends ModuleBase {
  static methods = [
    {
      name: "exampleMethod",
      executeOnLoad: false,
      options: [
        {
          name: "param1",
          defaultVal: 100,
          type: "number",
        },
      ],
    },
  ];

  constructor(container) {
    super(container);
    this.init();
  }

  init() {
    if (!this.elem) return;
    const html = \`
      <div style="
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: 3rem;
        color: white;
      ">
        ${moduleName}
      </div>
    \`;
    this.elem.insertAdjacentHTML("beforeend", html);
  }

  exampleMethod({ param1 = 100 }) {
    void param1;
  }

  destroy() {
    super.destroy();
  }
}

export default ${moduleName};
`,

  threejs: (moduleName) => `/*
@nwWrld name: ${moduleName}
@nwWrld category: 3D
@nwWrld imports: BaseThreeJsModule, THREE
*/

class ${moduleName} extends BaseThreeJsModule {
  static methods = [
    {
      name: "exampleMethod",
      executeOnLoad: false,
      options: [
        {
          name: "param1",
          defaultVal: 1.0,
          type: "number",
        },
      ],
    },
  ];

  constructor(container) {
    super(container);
    this.customGroup = new THREE.Group();
    this.init();
  }

  init() {
    if (this.destroyed) return;
    if (!this.scene || !this.camera) return;

    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    this.cube = new THREE.Mesh(geometry, material);
    this.customGroup.add(this.cube);
    this.scene.add(this.customGroup);

    this.camera.position.z = 5;

    this.setCustomAnimate(this.animateLoop.bind(this));
  }

  animateLoop() {
    if (this.cube) {
      this.cube.rotation.x += 0.01;
      this.cube.rotation.y += 0.01;
    }
  }

  exampleMethod({ param1 = 1.0 }) {
    if (this.cube) {
      this.cube.scale.set(param1, param1, param1);
    }
  }

  destroy() {
    if (this.destroyed) return;
    if (this.cube) {
      this.customGroup.remove(this.cube);
      this.cube.geometry.dispose();
      this.cube.material.dispose();
    }
    super.destroy();
  }
}

export default ${moduleName};
`,

  p5js: (moduleName) => `/*
@nwWrld name: ${moduleName}
@nwWrld category: 2D
@nwWrld imports: ModuleBase, p5
*/

class ${moduleName} extends ModuleBase {
  static methods = [
    {
      name: "exampleMethod",
      executeOnLoad: false,
      options: [
        {
          name: "param1",
          defaultVal: 255,
          type: "number",
        },
      ],
    },
  ];

  constructor(container) {
    super(container);
    this.p5Instance = null;
    this.param1Value = 255;
    this.init();
  }

  init() {
    if (!this.elem) return;
    const sketch = (p) => {
      p.setup = () => {
        p.createCanvas(this.elem.offsetWidth, this.elem.offsetHeight);
        p.background(0);
      };

      p.draw = () => {
        p.background(0, 10);
        p.fill(this.param1Value);
        p.noStroke();
        p.ellipse(p.mouseX, p.mouseY, 50, 50);
      };
    };

    this.p5Instance = new p5(sketch, this.elem);
  }

  exampleMethod({ param1 = 255 }) {
    this.param1Value = param1;
  }

  destroy() {
    if (this.p5Instance) {
      this.p5Instance.remove();
      this.p5Instance = null;
    }
    super.destroy();
  }
}

export default ${moduleName};
`,
};

export const ModuleEditorModal = ({
  isOpen,
  onClose,
  moduleName,
  templateType = null,
  onModuleSaved: _onModuleSaved,
  predefinedModules = [],
  workspacePath = null,
}: ModuleEditorModalProps) => {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [methodOptions, setMethodOptions] = useState<
    Record<string, Record<string, unknown>>
  >({});

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

  const { moduleBase, threeBase } = useMemo(() => getBaseMethodNames(), []);

  const customMethods = useMemo(() => {
    if (!moduleData || !moduleData.methods) return [];

    const allBaseMethods = [...moduleBase, ...threeBase];
    return moduleData.methods.filter(
      (method) => !allBaseMethods.includes(method.name)
    );
  }, [moduleData, moduleBase, threeBase]);

  const _methodsWithValues = useMemo(() => {
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
      const WORKSPACE_TEMPLATES = {
        basic: (n) =>
          [
            "/*",
            `@nwWrld name: ${n}`,
            "@nwWrld category: Custom",
            "@nwWrld imports: ModuleBase",
            "*/",
            "",
            `class ${n} extends ModuleBase {`,
            "",
            "  static methods = [",
            "    ...((ModuleBase && ModuleBase.methods) || []),",
            "    {",
            '      name: "exampleMethod",',
            "      executeOnLoad: false,",
            "      options: [",
            '        { name: "param1", defaultVal: 100, type: "number" },',
            "      ],",
            "    },",
            "  ];",
            "",
            "  constructor(container) {",
            "    super(container);",
            "    this.init();",
            "  }",
            "",
            "  init() {",
            "    const html = `",
            '      <div style="',
            "        position: absolute;",
            "        top: 50%;",
            "        left: 50%;",
            "        transform: translate(-50%, -50%);",
            "        font-size: 3rem;",
            "        color: white;",
            '      ">',
            `        ${n}`,
            "      </div>",
            "    `;",
            "    if (this.elem) {",
            '      this.elem.insertAdjacentHTML("beforeend", html);',
            "    }",
            "  }",
            "",
            "  exampleMethod({ param1 = 100 } = {}) {",
            "  }",
            "",
            "  destroy() {",
            "    super.destroy();",
            "  }",
            "}",
            "",
            `export default ${n};`,
            "",
          ].join("\n"),
        threejs: (n) =>
          [
            "/*",
            `@nwWrld name: ${n}`,
            "@nwWrld category: 3D",
            "@nwWrld imports: BaseThreeJsModule, THREE",
            "*/",
            "",
            `class ${n} extends BaseThreeJsModule {`,
            "",
            "  static methods = [",
            "    ...((BaseThreeJsModule && BaseThreeJsModule.methods) || []),",
            "  ];",
            "",
            "  constructor(container) {",
            "    super(container);",
            "    if (!THREE) return;",
            "    const geometry = new THREE.BoxGeometry(1, 1, 1);",
            "    const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });",
            "    this.cube = new THREE.Mesh(geometry, material);",
            "    const light = new THREE.DirectionalLight(0xffffff, 2);",
            "    light.position.set(2, 2, 4);",
            "    this.scene.add(light);",
            "    this.setModel(this.cube);",
            "    this.setCustomAnimate(() => {",
            "      if (!this.cube) return;",
            "      this.cube.rotation.x += 0.01;",
            "      this.cube.rotation.y += 0.01;",
            "    });",
            "  }",
            "",
            "  destroy() {",
            "    this.cube = null;",
            "    super.destroy();",
            "  }",
            "}",
            "",
            `export default ${n};`,
            "",
          ].join("\n"),
        p5js: (n) =>
          [
            "/*",
            `@nwWrld name: ${n}`,
            "@nwWrld category: 2D",
            "@nwWrld imports: ModuleBase, p5",
            "*/",
            "",
            `class ${n} extends ModuleBase {`,
            "",
            "  static methods = [",
            "    ...((ModuleBase && ModuleBase.methods) || []),",
            "  ];",
            "",
            "  constructor(container) {",
            "    super(container);",
            "    this.p5Instance = null;",
            "    this.param1Value = 255;",
            "    this.init();",
            "  }",
            "",
            "  init() {",
            "    if (!p5) return;",
            "    const sketch = (p) => {",
            "      p.setup = () => {",
            "        p.createCanvas(this.elem.offsetWidth, this.elem.offsetHeight);",
            "        p.background(0);",
            "      };",
            "      p.draw = () => {",
            "        p.background(0, 10);",
            "        p.fill(this.param1Value);",
            "        p.noStroke();",
            "        p.ellipse(p.mouseX, p.mouseY, 50, 50);",
            "      };",
            "    };",
            "    this.p5Instance = new p5(sketch, this.elem);",
            "  }",
            "",
            "  destroy() {",
            "    if (this.p5Instance) {",
            "      this.p5Instance.remove();",
            "      this.p5Instance = null;",
            "    }",
            "    super.destroy();",
            "  }",
            "}",
            "",
            `export default ${n};`,
            "",
          ].join("\n"),
      };

      const template = (workspacePath ? WORKSPACE_TEMPLATES : TEMPLATES)[
        templateType
      ](moduleName);
      setCode(template);
      setIsLoading(false);
      try {
        const bridge = getBridge();
        if (
          bridge &&
          bridge.workspace &&
          typeof bridge.workspace.moduleExists === "function" &&
          typeof bridge.workspace.writeModuleTextSync === "function"
        ) {
          if (!bridge.workspace.moduleExists(moduleName)) {
            const res = bridge.workspace.writeModuleTextSync(
              moduleName,
              template
            );
            if (res && res.ok === false) {
              setError(
                `Failed to create module: ${res.reason || "write failed"}`
              );
            }
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(`Failed to create module: ${msg}`);
      }
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
          const msg = err instanceof Error ? err.message : String(err);
          setError(`Failed to load module: ${msg}`);
          setIsLoading(false);
        }
      })();
    }
  }, [isOpen, moduleName, templateType, workspacePath]);

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

  const _handleMethodTrigger = (method: MethodWithValues) => {
    const params: Record<string, unknown> = {};
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

  const _handleOptionChange = useCallback(
    (methodName: string, optionName: string, value: unknown) => {
    setMethodOptions((prev) => ({
      ...prev,
      [methodName]: {
        ...prev[methodName],
        [optionName]: value,
      },
    }));
    },
    []
  );

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
                    moduleName={moduleName}
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
