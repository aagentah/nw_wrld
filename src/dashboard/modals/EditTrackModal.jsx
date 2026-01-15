import React, { useState, useEffect, useMemo } from "react";
import { useAtom } from "jotai";
import { Modal } from "../shared/Modal.jsx";
import { ModalHeader } from "../components/ModalHeader";
import { ModalFooter } from "../components/ModalFooter";
import { Button } from "../components/Button";
import { TextInput, Select, Label, ValidationError } from "../components/FormInputs";
import { HelpIcon } from "../components/HelpIcon";
import { userDataAtom, activeSetIdAtom } from "../core/state.ts";
import { updateActiveSet } from "../core/utils";
import { getActiveSetTracks } from "../../shared/utils/setUtils.ts";
import { HELP_TEXT } from "../../shared/helpText.ts";
import { useNameValidation } from "../core/hooks/useNameValidation";
import { useTrackSlots } from "../core/hooks/useTrackSlots.ts";
import { parsePitchClass, pitchClassToName } from "../../shared/midi/midiUtils.ts";

export const EditTrackModal = ({ isOpen, onClose, trackIndex, inputConfig }) => {
  const [userData, setUserData] = useAtom(userDataAtom);
  const [activeSetId] = useAtom(activeSetIdAtom);
  const [trackName, setTrackName] = useState("");
  const [trackSlot, setTrackSlot] = useState(1);

  const tracks = getActiveSetTracks(userData, activeSetId);
  const track = tracks[trackIndex];
  const inputType = inputConfig?.type || "midi";
  const noteMatchMode = inputConfig?.noteMatchMode === "exactNote" ? "exactNote" : "pitchClass";
  const globalMappings = userData.config || {};
  const maxTrackSlots = inputType === "midi" ? 12 : 10;

  const { validate } = useNameValidation(tracks, track?.id);
  const validation = validate(trackName);

  const { availableSlots, getTrigger } = useTrackSlots(
    tracks,
    globalMappings,
    inputType,
    track?.id
  );

  const resolvedTrigger = getTrigger(trackSlot);
  const resolvedNoteName =
    inputType === "midi"
      ? (() => {
          const pc =
            typeof resolvedTrigger === "number"
              ? resolvedTrigger
              : parsePitchClass(resolvedTrigger);
          if (pc === null) return null;
          return pitchClassToName(pc) || String(pc);
        })()
      : null;

  const takenSlotToTrackName = useMemo(() => {
    const map = new Map();
    tracks.forEach((t) => {
      const slot = t?.trackSlot;
      if (!slot) return;
      if (track?.id && t?.id === track.id) return;
      map.set(slot, String(t?.name || "").trim() || `Track ${slot}`);
    });
    return map;
  }, [tracks, track?.id]);

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

  const canSubmit = validation.isValid && trackSlot && availableSlots.includes(trackSlot);

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
            {Array.from({ length: maxTrackSlots }, (_, i) => i + 1).map((slot) => {
              const rawTrigger = getTrigger(slot);
              const trigger =
                inputType === "midi"
                  ? noteMatchMode === "pitchClass"
                    ? (() => {
                        const pc =
                          typeof rawTrigger === "number" ? rawTrigger : parsePitchClass(rawTrigger);
                        if (pc === null) return String(rawTrigger || "").trim();
                        return pitchClassToName(pc) || String(pc);
                      })()
                    : String(rawTrigger || "").trim()
                  : rawTrigger;
              const takenBy = takenSlotToTrackName.get(slot) || "";
              const isTaken = Boolean(takenBy);
              return (
                <option key={slot} value={slot} className="bg-[#101010]" disabled={isTaken}>
                  Track {slot} ({trigger || "not configured"})
                  {isTaken ? ` — used by ${takenBy}` : ""}
                </option>
              );
            })}
          </Select>
          {inputType === "midi" && resolvedNoteName ? (
            <div className="text-blue-500 text-[11px] mt-1 font-mono">
              ✓ Will use trigger: <span className="text-blue-500">{resolvedNoteName}</span>
            </div>
          ) : resolvedTrigger ? (
            <div className="text-blue-500 text-[11px] mt-1 font-mono">
              ✓ Will use trigger: {resolvedTrigger}
            </div>
          ) : null}
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
