import React, { useState, useEffect, useMemo } from "react";
import { useAtom, type PrimitiveAtom } from "jotai";
import { Modal } from "../shared/Modal";
import { ModalHeader } from "../components/ModalHeader";
import { ModalFooter } from "../components/ModalFooter";
import { Button } from "../components/Button";
import { TextInput, Select, Label, ValidationError } from "../components/FormInputs";
import { HelpIcon } from "../components/HelpIcon";
import { userDataAtom, activeTrackIdAtom, activeSetIdAtom } from "../core/state";
import { updateActiveSet } from "../core/utils";
import { getActiveSetTracks } from "../../shared/utils/setUtils";
import { HELP_TEXT } from "../../shared/helpText";
import { useNameValidation } from "../core/hooks/useNameValidation";
import { useTrackSlots } from "../core/hooks/useTrackSlots";
import { parsePitchClass, pitchClassToName } from "../../shared/midi/midiUtils";

type InputConfigLike = {
  type?: unknown;
  noteMatchMode?: unknown;
};

type CreateTrackModalProps = {
  isOpen: boolean;
  onClose: () => void;
  inputConfig?: InputConfigLike | null;
  onAlert?: ((message: string) => void) | null;
};

export const CreateTrackModal = ({ isOpen, onClose, inputConfig, onAlert }: CreateTrackModalProps) => {
  const [userData, setUserData] = useAtom(userDataAtom);
  const [, setActiveTrackId] = useAtom(activeTrackIdAtom as unknown as PrimitiveAtom<string | null>);
  const [activeSetId] = useAtom(activeSetIdAtom);
  const [trackName, setTrackName] = useState("");
  const [trackSlot, setTrackSlot] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const inputType =
    inputConfig?.type === "osc"
      ? "osc"
      : inputConfig?.type === "audio"
        ? "audio"
        : inputConfig?.type === "file"
          ? "file"
          : "midi";
  const noteMatchMode = inputConfig?.noteMatchMode === "exactNote" ? "exactNote" : "pitchClass";
  const globalMappings = (userData as Record<string, unknown>).config || {};
  const maxTrackSlots = inputType === "midi" ? 12 : 10;

  const tracks = getActiveSetTracks(userData, activeSetId);

  const { validate } = useNameValidation(tracks);
  const validation = validate(trackName);

  const { availableSlots, getTrigger } = useTrackSlots(tracks, globalMappings, inputType);

  const resolvedTrigger = getTrigger(trackSlot);
  const resolvedNoteName =
    inputType === "midi"
      ? (() => {
          const pc =
            typeof resolvedTrigger === "number" ? resolvedTrigger : parsePitchClass(resolvedTrigger);
          if (pc === null) return null;
          return pitchClassToName(pc) || String(pc);
        })()
      : null;

  const takenSlotToTrackName = useMemo(() => {
    const map = new Map<number, string>();
    (tracks as unknown[]).forEach((t) => {
      const tr = t as Record<string, unknown> | null;
      const slot = typeof tr?.trackSlot === "number" ? tr.trackSlot : null;
      if (!slot) return;
      map.set(slot, String(tr?.name || "").trim() || `Track ${slot}`);
    });
    return map;
  }, [tracks]);

  useEffect(() => {
    if (!isOpen) {
      setTrackName("");
      setTrackSlot(availableSlots[0] || 1);
    } else if (availableSlots.length > 0) {
      setTrackSlot(availableSlots[0]);
    }
  }, [isOpen, availableSlots]);

  if (!isOpen) return null;

  const canSubmit =
    validation.isValid && trackSlot && !submitting && availableSlots.includes(trackSlot);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const newTrackId = `track_${Date.now()}`;
      updateActiveSet(setUserData, activeSetId, (activeSet: unknown) => {
        const s = activeSet as Record<string, unknown>;
        const tracksArr = Array.isArray(s.tracks) ? (s.tracks as unknown[]) : [];
        if (!Array.isArray(s.tracks)) {
          s.tracks = tracksArr;
        }
        tracksArr.push({
          id: newTrackId,
          name: trackName,
          trackSlot: trackSlot,
          bpm: 120,
          channelMappings: { "1": 1, "2": 2, "3": 3 },
          modules: [],
          modulesData: {},
        });
      });

      setActiveTrackId(newTrackId);
      onClose();
    } catch (e) {
      console.error("Error creating track:", e);
      if (onAlert) onAlert("Failed to create track.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalHeader title="CREATE TRACK" onClose={onClose} />

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
            onChange={(e) => setTrackSlot(parseInt(e.target.value, 10))}
            className="w-full py-1 font-mono"
          >
            {availableSlots.length === 0 && (
              <option value="">No tracks available (max {maxTrackSlots} tracks)</option>
            )}
            {Array.from({ length: maxTrackSlots }, (_, i) => i + 1).map((slot) => {
              const rawTrigger = getTrigger(slot);
              const trigger =
                inputType === "midi"
                  ? noteMatchMode === "pitchClass"
                    ? (() => {
                        const pc =
                          typeof rawTrigger === "number"
                            ? rawTrigger
                            : parsePitchClass(rawTrigger);
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
          {submitting ? "Creating..." : "Create Track"}
        </Button>
      </ModalFooter>
    </Modal>
  );
};

