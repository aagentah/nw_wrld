import React from "react";
import { Modal } from "../shared/Modal";
import { ModalHeader } from "../components/ModalHeader";

type TrackDataModalProps = {
  isOpen: boolean;
  onClose: () => void;
  trackData: unknown;
};

export const TrackDataModal = ({ isOpen, onClose, trackData }: TrackDataModalProps) => {
  if (!isOpen) return null;

  const jsonString = trackData ? JSON.stringify(trackData, null, 2) : null;
  const td = trackData as Record<string, unknown> | null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="large">
      <ModalHeader title={`Track: ${String(td?.name || "")}`} onClose={onClose} />

      {jsonString ? (
        <div>
          <div className="text-neutral-300/50 text-[10px] mb-1">Track Data:</div>
          <pre className="p-4 border border-neutral-800 overflow-x-auto text-[10px] text-neutral-300 font-mono max-h-[400px] overflow-y-auto">
            <code>{jsonString}</code>
          </pre>
        </div>
      ) : (
        <div className="text-neutral-300/50 text-[11px]">No track data available.</div>
      )}
    </Modal>
  );
};

