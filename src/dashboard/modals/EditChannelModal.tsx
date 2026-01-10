import React, { useState, useEffect, useMemo } from "react";
import { useAtom } from "jotai";
import { Modal } from "../shared/Modal";
import { ModalHeader } from "../components/ModalHeader";
import { ModalFooter } from "../components/ModalFooter";
import { Button } from "../components/Button";
import { Select, Label } from "../components/FormInputs";
import { HelpIcon } from "../components/HelpIcon";
import { userDataAtom, activeSetIdAtom } from "../core/state";
import { updateActiveSet } from "../core/utils";
import { getActiveSetTracks } from "../../shared/utils/setUtils";
import { HELP_TEXT } from "../../shared/helpText";
import type { InputConfig, UserConfig } from "@/types";

export interface EditChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
  trackIndex: number;
  channelNumber: number;
  inputConfig?: InputConfig;
  config?: UserConfig;
}

export const EditChannelModal: React.FC<EditChannelModalProps> = ({
  isOpen,
  onClose,
  trackIndex,
  channelNumber,
  inputConfig,
  config,
}) => {
  const [userData, setUserData] = useAtom(userDataAtom);
  const [activeSetId] = useAtom(activeSetIdAtom);
  const [newChannelNumber, setNewChannelNumber] = useState(1);

  const tracks = getActiveSetTracks(userData, activeSetId);
  const track = tracks[trackIndex];
  const inputType = inputConfig?.type || "midi";
  const globalMappings = userData.config as any;

  const existingChannelNumbers = useMemo(() => {
    return new Set(
      Object.keys(track?.channelMappings || {})
        .map(Number)
        .filter((num) => num !== channelNumber)
    );
  }, [track, channelNumber]);

  const availableChannelNumbers = useMemo(() => {
    const numbers: number[] = [];
    for (let i = 1; i <= 16; i++) {
      if (!existingChannelNumbers.has(i) || i === channelNumber) {
        numbers.push(i);
      }
    }
    return numbers;
  }, [existingChannelNumbers, channelNumber]);

  const resolvedTrigger = useMemo(() => {
    return (
      globalMappings.channelMappings?.[inputType]?.[newChannelNumber] || ""
    );
  }, [newChannelNumber, inputType, globalMappings]);

  useEffect(() => {
    if (!isOpen) {
      setNewChannelNumber(1);
    } else if (channelNumber) {
      setNewChannelNumber(channelNumber);
    }
  }, [isOpen, channelNumber]);

  if (!isOpen) return null;

  const isDuplicateNumber =
    newChannelNumber !== channelNumber &&
    existingChannelNumbers.has(newChannelNumber);
  const canSubmit = newChannelNumber && !isDuplicateNumber;

  const handleSubmit = () => {
    if (!canSubmit) return;

    updateActiveSet(setUserData, activeSetId, (activeSet) => {
      const currentTrack = activeSet.tracks[trackIndex];
      const oldKey = String(channelNumber);
      const newKey = String(newChannelNumber);

      if (oldKey !== newKey) {
        delete currentTrack.channelMappings[oldKey];

        Object.keys(currentTrack.modulesData).forEach((moduleId) => {
          if (currentTrack.modulesData[moduleId].methods?.[oldKey]) {
            currentTrack.modulesData[moduleId].methods[newKey] =
              currentTrack.modulesData[moduleId].methods[oldKey];
            delete currentTrack.modulesData[moduleId].methods[oldKey];
          }
        });
      }

      currentTrack.channelMappings[newKey] = newChannelNumber;
    });

    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalHeader title="EDIT CHANNEL" onClose={onClose} />

      <div className="px-6 flex flex-col gap-4">
        <div>
          <Label>Current Channel</Label>
          <div className="text-neutral-300 text-[11px] py-2 px-3 bg-neutral-900/50 rounded font-mono">
            Channel {channelNumber}
          </div>
        </div>

        <div>
          <div className="relative inline-block">
            <Label>New Channel Number</Label>
            <HelpIcon helpText={HELP_TEXT.channelSlot} />
          </div>
          <Select
            value={newChannelNumber}
            onChange={(e) => setNewChannelNumber(parseInt(e.target.value))}
            className="w-full py-1 font-mono"
          >
            {availableChannelNumbers.map((num) => {
              const trigger =
                globalMappings.channelMappings?.[inputType]?.[num] || "";
              return (
                <option key={num} value={num} className="bg-[#101010]">
                  {config?.sequencerMode
                    ? `Channel ${num}`
                    : `Channel ${num} (${trigger || "not configured"})`}
                </option>
              );
            })}
          </Select>
          {isDuplicateNumber && (
            <div className="text-red-400 text-[11px] mt-1 font-mono">
              Channel {newChannelNumber} is already used
            </div>
          )}
          {!config?.sequencerMode && resolvedTrigger && (
            <div className="text-green-500 text-[11px] mt-1 font-mono">
              Will use trigger: {resolvedTrigger}
            </div>
          )}
        </div>
      </div>

      <ModalFooter>
        <Button onClick={onClose} type="secondary">
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={!canSubmit}>
          Save Changes
        </Button>
      </ModalFooter>
    </Modal>
  );
};
