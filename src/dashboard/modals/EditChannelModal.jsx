import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useAtom } from "jotai";
import { Modal } from "../shared/Modal.jsx";
import { ModalHeader } from "../components/ModalHeader";
import { ModalFooter } from "../components/ModalFooter";
import { Button } from "../components/Button";
import { Select, Label } from "../components/FormInputs";
import { HelpIcon } from "../components/HelpIcon";
import { userDataAtom, activeSetIdAtom } from "../core/state.ts";
import { updateActiveSet, updateUserData } from "../core/utils";
import { getActiveSetTracks } from "../../shared/utils/setUtils.ts";
import { HELP_TEXT } from "../../shared/helpText.ts";
import {
  parsePitchClass,
  pitchClassToName,
  resolveChannelTrigger,
} from "../../shared/midi/midiUtils.ts";

export const EditChannelModal = ({
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
  const noteMatchMode = inputConfig?.noteMatchMode === "exactNote" ? "exactNote" : "pitchClass";
  const globalMappings = userData.config || {};

  const exactNoteOptions = useMemo(
    () => Array.from({ length: 128 }, (_, n) => ({ value: n, label: String(n) })),
    []
  );

  const updateExactNoteMappingForSlot = useCallback(
    (slot, noteNumber) => {
      const n = parseInt(String(noteNumber ?? ""), 10);
      if (!Number.isFinite(n) || n < 0 || n > 127) return;
      updateUserData(setUserData, (draft) => {
        if (!draft.config) draft.config = {};
        if (!draft.config.input) draft.config.input = {};
        draft.config.input.noteMatchMode = "exactNote";
        if (!draft.config.channelMappings) draft.config.channelMappings = {};
        if (!draft.config.channelMappings.midi) {
          draft.config.channelMappings.midi = { pitchClass: {}, exactNote: {} };
        }
        if (!draft.config.channelMappings.midi.exactNote) {
          draft.config.channelMappings.midi.exactNote = {};
        }
        draft.config.channelMappings.midi.exactNote[slot] = n;
      });
    },
    [setUserData]
  );

  const existingChannelNumbers = useMemo(() => {
    return new Set(
      Object.keys(track?.channelMappings || {})
        .map(Number)
        .filter((num) => num !== channelNumber)
    );
  }, [track, channelNumber]);

  const availableChannelNumbers = useMemo(() => {
    const numbers = [];
    for (let i = 1; i <= 12; i++) {
      if (!existingChannelNumbers.has(i) || i === channelNumber) {
        numbers.push(i);
      }
    }
    return numbers;
  }, [existingChannelNumbers, channelNumber]);

  const resolvedTrigger = useMemo(() => {
    return resolveChannelTrigger(newChannelNumber, inputType, globalMappings);
  }, [newChannelNumber, inputType, globalMappings]);
  const resolvedNoteName =
    inputType === "midi"
      ? (() => {
          if (noteMatchMode === "exactNote") {
            const s = String(resolvedTrigger ?? "").trim();
            return s ? s : null;
          }
          const pc =
            typeof resolvedTrigger === "number"
              ? resolvedTrigger
              : parsePitchClass(resolvedTrigger);
          if (pc === null) return null;
          return pitchClassToName(pc) || String(pc);
        })()
      : null;

  useEffect(() => {
    if (!isOpen) return;
    if (config?.sequencerMode) return;
    if (inputType !== "midi") return;
    if (noteMatchMode !== "exactNote") return;
    const slot = newChannelNumber;
    if (!slot) return;
    const current = globalMappings?.channelMappings?.midi?.exactNote?.[slot] ?? null;
    const n = typeof current === "number" ? current : null;
    const usedByOtherSlots = new Set(
      Object.entries(globalMappings?.channelMappings?.midi?.exactNote || {})
        .filter(([s]) => parseInt(s, 10) !== slot)
        .map(([, v]) => v)
        .filter((v) => typeof v === "number" && v >= 0 && v <= 127)
    );
    const isValid = typeof n === "number" && n >= 0 && n <= 127;
    const isUnique = isValid && !usedByOtherSlots.has(n);
    if (isUnique) return;
    const pick = Array.from({ length: 128 }, (_, x) => x).find((x) => !usedByOtherSlots.has(x));
    if (pick === undefined) return;
    updateExactNoteMappingForSlot(slot, pick);
  }, [
    isOpen,
    config?.sequencerMode,
    inputType,
    noteMatchMode,
    newChannelNumber,
    globalMappings,
    updateExactNoteMappingForSlot,
  ]);

  useEffect(() => {
    if (!isOpen) {
      setNewChannelNumber(1);
    } else if (channelNumber) {
      setNewChannelNumber(channelNumber);
    }
  }, [isOpen, channelNumber]);

  if (!isOpen) return null;

  const isDuplicateNumber =
    newChannelNumber !== channelNumber && existingChannelNumbers.has(newChannelNumber);
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
              const rawTrigger = resolveChannelTrigger(num, inputType, globalMappings);
              const trigger =
                inputType === "midi"
                  ? (() => {
                      const noteMatchMode =
                        inputConfig?.noteMatchMode === "exactNote" ? "exactNote" : "pitchClass";
                      if (noteMatchMode === "exactNote") {
                        return String(rawTrigger || "").trim();
                      }
                      const pc =
                        typeof rawTrigger === "number" ? rawTrigger : parsePitchClass(rawTrigger);
                      if (pc === null) return String(rawTrigger || "").trim();
                      return pitchClassToName(pc) || String(pc);
                    })()
                  : rawTrigger;
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
          {!config?.sequencerMode && inputType === "midi" && resolvedNoteName ? (
            <div className="text-blue-500 text-[11px] mt-1 font-mono">
              ✓ Will use trigger: <span className="text-blue-500">{resolvedNoteName}</span>
            </div>
          ) : !config?.sequencerMode && resolvedTrigger ? (
            <div className="text-blue-500 text-[11px] mt-1 font-mono">
              ✓ Will use trigger: {resolvedTrigger}
            </div>
          ) : null}
        </div>

        {!config?.sequencerMode && inputType === "midi" && noteMatchMode === "exactNote" ? (
          <div>
            <Label>Trigger Note (0–127)</Label>
            <Select
              value={String(
                globalMappings?.channelMappings?.midi?.exactNote?.[newChannelNumber] ?? 0
              )}
              onChange={(e) =>
                updateExactNoteMappingForSlot(newChannelNumber, parseInt(e.target.value, 10))
              }
              className="w-full py-1 font-mono"
            >
              {exactNoteOptions.map((opt) => {
                const selected =
                  globalMappings?.channelMappings?.midi?.exactNote?.[newChannelNumber];
                const usedByOtherSlot = Object.entries(
                  globalMappings?.channelMappings?.midi?.exactNote || {}
                ).some(([s, v]) => {
                  if (parseInt(s, 10) === newChannelNumber) return false;
                  return v === opt.value;
                });
                const disabled = usedByOtherSlot && opt.value !== selected;
                return (
                  <option
                    key={opt.value}
                    value={String(opt.value)}
                    disabled={disabled}
                    className="bg-[#101010]"
                  >
                    {opt.label}
                  </option>
                );
              })}
            </Select>
          </div>
        ) : null}
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
