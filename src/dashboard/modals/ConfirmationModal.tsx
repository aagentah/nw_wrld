import React from "react";
import { Modal } from "../shared/Modal";
import { ModalHeader } from "../components/ModalHeader";
import { ModalFooter } from "../components/ModalFooter";
import { Button } from "../components/Button";

export interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  message: string;
  onConfirm?: () => void;
  type?: "confirm" | "alert";
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  message,
  onConfirm,
  type = "confirm",
}) => {
  if (!isOpen) return null;

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    }
    onClose();
  };

  const isAlert = type === "alert";

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="small">
      <ModalHeader title={isAlert ? "ALERT" : "CONFIRM"} onClose={onClose} />

      <div className="px-6 flex flex-col gap-4">
        <div className="text-neutral-300 text-[11px] font-mono">{message}</div>
      </div>

      <ModalFooter>
        {!isAlert && (
          <Button onClick={onClose} type="secondary">
            Cancel
          </Button>
        )}
        <Button onClick={handleConfirm}>{isAlert ? "OK" : "Confirm"}</Button>
      </ModalFooter>
    </Modal>
  );
};
