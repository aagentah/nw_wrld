import React, { useState } from "react";
import { Button } from "./Button.js";
import { ModalHeader } from "./ModalHeader.js";
import { ModalFooter } from "./ModalFooter.js";
import { TextInput, Select, Label } from "./FormInputs.js";

const Modal = ({ isOpen, onClose, children, size = "small" }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85">
      <div
        className={`bg-[#101010] border border-neutral-700 ${
          size === "small" ? "w-[500px]" : "w-[800px]"
        } max-h-[90vh] overflow-y-auto`}
      >
        {children}
      </div>
    </div>
  );
};

export const NewModuleDialog = ({
  isOpen,
  onClose,
  onCreateModule,
  workspacePath = null,
}) => {
  const [moduleName, setModuleName] = useState("");
  const [templateType, setTemplateType] = useState("basic");
  const [error, setError] = useState("");

  const validateModuleName = (name) => {
    if (!name || name.trim() === "") {
      return "Module name is required";
    }

    // Check if name is a valid JavaScript identifier
    if (!/^[A-Z][a-zA-Z0-9]*$/.test(name)) {
      return "Module name must start with uppercase letter and contain only letters and numbers";
    }

    // Check if file already exists (workspace modules)
    try {
      const bridge = globalThis.nwWrldBridge;
      if (
        bridge &&
        bridge.workspace &&
        typeof bridge.workspace.moduleExists === "function" &&
        bridge.workspace.moduleExists(name)
      ) {
        return "A module with this name already exists";
      }
    } catch (err) {
      return `Error checking file: ${err.message}`;
    }

    return null;
  };

  const canSubmit = moduleName.trim().length > 0 && !error;

  const handleCreate = () => {
    const validationError = validateModuleName(moduleName);
    if (validationError) {
      setError(validationError);
      return;
    }

    onCreateModule(moduleName, templateType);
    setModuleName("");
    setTemplateType("basic");
    setError("");
    onClose();
  };

  const handleClose = () => {
    setModuleName("");
    setTemplateType("basic");
    setError("");
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="small">
      <ModalHeader title="CREATE MODULE FROM TEMPLATE" onClose={handleClose} />

      <div className="px-6 flex flex-col gap-4">
        <p className="text-neutral-500 text-[11px] font-mono">
          Once you create a module, you can edit it in your code editor. The
          module will be saved in{" "}
          <code>{workspacePath ? `${workspacePath}/modules` : "modules"}</code>.
        </p>
        <div>
          <Label>Module Name</Label>
          <TextInput
            value={moduleName}
            onChange={(e) => {
              setModuleName(e.target.value);
              setError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && canSubmit) {
                handleCreate();
              }
            }}
            placeholder="MyCustomModule"
            className="w-full"
            autoFocus
          />
          <p className="text-neutral-500 text-[11px] mt-1 font-mono">
            Must start with uppercase letter (e.g., MyModule, CustomVisual)
          </p>
          {error && (
            <div className="text-red-400 text-[11px] mt-1 font-mono">
              {error}
            </div>
          )}
        </div>

        <div>
          <Label>Template Type</Label>
          <Select
            value={templateType}
            onChange={(e) => setTemplateType(e.target.value)}
            className="w-full"
          >
            <option value="basic">Basic (DOM/Canvas)</option>
            <option value="threejs">Three.js (3D)</option>
            <option value="p5js">p5.js (2D Canvas)</option>
          </Select>
          <p className="text-neutral-500 text-[11px] mt-1 font-mono">
            {templateType === "basic" &&
              "Simple module for DOM elements or canvas drawing"}
            {templateType === "threejs" && "3D graphics using Three.js library"}
            {templateType === "p5js" && "Creative coding with p5.js library"}
          </p>
        </div>
      </div>

      <ModalFooter>
        <Button onClick={handleClose} type="secondary">
          Cancel
        </Button>
        <Button onClick={handleCreate} disabled={!canSubmit}>
          Create Module
        </Button>
      </ModalFooter>
    </Modal>
  );
};
