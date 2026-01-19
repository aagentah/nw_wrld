import React, { useState, useEffect } from "react";
import { Modal } from "../shared/Modal";
import { ModalHeader } from "../components/ModalHeader";
import { getMethodCode } from "../core/utils";

type MethodCodeModalProps = {
  isOpen: boolean;
  onClose: () => void;
  moduleName: string | null | undefined;
  methodName: string | null | undefined;
};

export const MethodCodeModal = ({ isOpen, onClose, moduleName, methodName }: MethodCodeModalProps) => {
  const [methodCode, setMethodCode] = useState<string | null>(null);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && moduleName && methodName) {
      setLoading(true);
      try {
        const result = getMethodCode(moduleName, methodName);
        setMethodCode(result.code);
        setFilePath(result.filePath);
      } catch (error) {
        console.error("Error loading method code:", error);
        setMethodCode(null);
        setFilePath(null);
      } finally {
        setLoading(false);
      }
    }
  }, [isOpen, moduleName, methodName]);

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="large">
      <ModalHeader title={`METHOD: ${methodName?.toUpperCase() || ""}`} onClose={onClose} />

      {loading ? (
        <div className="text-neutral-300/50 text-[11px]">Loading...</div>
      ) : (
        <div className="flex flex-col gap-4">
          {filePath && (
            <div>
              <div className="text-neutral-300/50 text-[10px] mb-1">File Path:</div>
              <div className="text-neutral-300 text-[11px] font-mono">{filePath}</div>
            </div>
          )}

          {methodCode ? (
            <div>
              <div className="text-neutral-300/50 text-[10px] mb-1">Method Code:</div>
              <pre className="p-4 border border-neutral-800 overflow-x-auto text-[10px] text-neutral-300 font-mono max-h-[400px] overflow-y-auto">
                <code>{methodCode}</code>
              </pre>
            </div>
          ) : (
            <div className="text-neutral-300/50 text-[11px]">
              Method code not found or method is inherited from base class.
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};

