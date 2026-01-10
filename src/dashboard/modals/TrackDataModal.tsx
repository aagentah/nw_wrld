import React from "react";
import { Modal } from "../shared/Modal";
import { ModalHeader } from "../components/ModalHeader";
import type { Track } from "@/types";

export interface TrackDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  trackData?: Track | null;
}

export const TrackDataModal: React.FC<TrackDataModalProps> = ({
  isOpen,
  onClose,
  trackData,
}) => {
  if (!isOpen) return null;

  const jsonString = trackData ? JSON.stringify(trackData, null, 2) : null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="large">
      <ModalHeader
        title={`Track: ${trackData?.name || ""}`}
        onClose={onClose}
      />

      {jsonString ? (
        <div>
          <div className="text-neutral-300/50 text-[10px] mb-1">
            Track Data:
          </div>
          <pre className="p-4 border border-neutral-800 overflow-x-auto text-[10px] text-neutral-300 font-mono max-h-[400px] overflow-y-auto">
            <code>{jsonString}</code>
          </pre>
        </div>
      ) : (
        <div className="text-neutral-300/50 text-[11px]">
          No track data available.
        </div>
      )}
    </Modal>
  );
};
