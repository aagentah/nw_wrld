import React, { useState, useEffect } from "react";
import { useAtom } from "jotai";
import { Modal } from "../shared/Modal.jsx";
import { ModalHeader } from "../components/ModalHeader.js";
import { ModalFooter } from "../components/ModalFooter.js";
import { Button } from "../components/Button.js";
import { TextInput, Select, Label, ValidationError } from "../components/FormInputs.js";
import { HelpIcon } from "../components/HelpIcon.js";
import { userDataAtom, activeSetIdAtom } from "../core/state.js";
import { updateActiveSet } from "../core/utils.js";
import { getActiveSetTracks } from "../../shared/utils/setUtils.js";
import { HELP_TEXT } from "../../shared/helpText.js";
import { useNameValidation } from "../core/hooks/useNameValidation.js";
import { useTrackSlots } from "../core/hooks/useTrackSlots.js";

export const EditTrackModal = ({
  isOpen,
  onClose,
  trackIndex,
  inputConfig,
}) => {
  const [userData, setUserData] = useAtom(userDataAtom);
  const [activeSetId] = useAtom(activeSetIdAtom);
  const [trackName, setTrackName] = useState("");
  const [trackSlot, setTrackSlot] = useState(1);

  const tracks = getActiveSetTracks(userData, activeSetId);
  const track = tracks[trackIndex];
  const inputType = inputConfig?.type || "midi";
  const globalMappings = userData.config || {};

  const { validate } = useNameValidation(tracks, track?.id);
  const validation = validate(trackName);

  const { availableSlots, getTrigger } = useTrackSlots(
    tracks,
    globalMappings,
    inputType,
    track?.id
  );

  const resolvedTrigger = getTrigger(trackSlot);

  useEffect(() => {
    if (!isOpen) {
      setTrackName("");
      setTrackSlot(1);
    } else if (track) {
      setTrackName(track.name || "");
      setTrackSlot(track.trackSlot || 1);
    }
  }, [isOpen, track]);

  if (!isOpen) return null;

  const canSubmit =
    validation.isValid && trackSlot && availableSlots.includes(trackSlot);

  const handleSubmit = () => {
    if (!canSubmit) return;

    updateActiveSet(setUserData, activeSetId, (activeSet) => {
      activeSet.tracks[trackIndex].name = trackName.trim();
      activeSet.tracks[trackIndex].trackSlot = trackSlot;
    });

    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalHeader title="EDIT TRACK" onClose={onClose} />

      <div className="px-6 flex flex-col gap-4">
        <div>
          <Label>Track Name</Label>
          <TextInput
            value={trackName}
            onChange={(e) => setTrackName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && canSubmit) {
                handleSubmit();
              }
            }}
            className="w-full"
            placeholder="My Performance Track"
            autoFocus
          />
          <ValidationError value={trackName} validation={validation} />
        </div>

        <div>
          <div className="relative inline-block">
            <Label>Track Number</Label>
            <HelpIcon helpText={HELP_TEXT.trackSlot} />
          </div>
          <Select
            value={trackSlot}
            onChange={(e) => setTrackSlot(parseInt(e.target.value))}
            className="w-full py-1 font-mono"
          >
            {availableSlots.map((slot) => {
              const trigger =
                globalMappings.trackMappings?.[inputType]?.[slot] || "";
              return (
                <option key={slot} value={slot} className="bg-[#101010]">
                  Track {slot} ({trigger || "not configured"})
                </option>
              );
            })}
          </Select>
          {resolvedTrigger && (
            <div className="text-green-500 text-[11px] mt-1 font-mono">
              ✓ Will use trigger: {resolvedTrigger}
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
