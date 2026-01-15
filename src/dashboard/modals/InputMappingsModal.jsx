import React, { useEffect, useRef, useState } from "react";
import { useAtom } from "jotai";
import { Modal } from "../shared/Modal.jsx";
import { ModalHeader } from "../components/ModalHeader";
import { TextInput, RadioButton, Select } from "../components/FormInputs";
import { userDataAtom } from "../core/state.ts";
import { updateUserData } from "../core/utils";
import { DEFAULT_GLOBAL_MAPPINGS } from "../../shared/config/defaultConfig.ts";
import { parsePitchClass, pitchClassToName } from "../../shared/midi/midiUtils.ts";

export const InputMappingsModal = ({ isOpen, onClose }) => {
  const [userData, setUserData] = useAtom(userDataAtom);
  const [activeTab, setActiveTab] = useState("midi-pitchClass");
  const wasOpenRef = useRef(false);

  const isValidMidiNoteNumber = (n) =>
    typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 127;

  useEffect(() => {
    if (!isOpen) {
      wasOpenRef.current = false;
      return;
    }
    if (wasOpenRef.current) return;
    wasOpenRef.current = true;

    const inputType = userData?.config?.input?.type;
    const noteMatchMode = userData?.config?.input?.noteMatchMode;
    const nextTab =
      inputType === "osc"
        ? "osc"
        : noteMatchMode === "exactNote"
          ? "midi-exactNote"
          : "midi-pitchClass";
    setActiveTab(nextTab);
  }, [isOpen, userData?.config?.input?.type, userData?.config?.input?.noteMatchMode]);

  const trackMappings = userData?.config?.trackMappings || {};
  const channelMappings = userData?.config?.channelMappings || {};
  const isMidi = activeTab.startsWith("midi-");
  const midiMode = activeTab === "midi-exactNote" ? "exactNote" : "pitchClass";
  const trackSlots = isMidi ? 12 : 10;
  const triggerSlots = 12;

  useEffect(() => {
    if (!isOpen) return;
    if (!isMidi || midiMode !== "exactNote") return;
    updateUserData(setUserData, (draft) => {
      if (!draft.config) draft.config = {};
      if (!draft.config.input) draft.config.input = {};
      draft.config.input.noteMatchMode = "exactNote";

      if (!draft.config.trackMappings) {
        draft.config.trackMappings = DEFAULT_GLOBAL_MAPPINGS.trackMappings;
      }
      if (!draft.config.trackMappings.midi) {
        draft.config.trackMappings.midi = {
          pitchClass: {
            ...DEFAULT_GLOBAL_MAPPINGS.trackMappings.midi.pitchClass,
          },
          exactNote: {
            ...DEFAULT_GLOBAL_MAPPINGS.trackMappings.midi.exactNote,
          },
        };
      }
      if (!draft.config.trackMappings.midi.exactNote) {
        draft.config.trackMappings.midi.exactNote = {
          ...DEFAULT_GLOBAL_MAPPINGS.trackMappings.midi.exactNote,
        };
      }

      if (!draft.config.channelMappings) {
        draft.config.channelMappings = DEFAULT_GLOBAL_MAPPINGS.channelMappings;
      }
      if (!draft.config.channelMappings.midi) {
        draft.config.channelMappings.midi = {
          pitchClass: {
            ...DEFAULT_GLOBAL_MAPPINGS.channelMappings.midi.pitchClass,
          },
          exactNote: {
            ...DEFAULT_GLOBAL_MAPPINGS.channelMappings.midi.exactNote,
          },
        };
      }
      if (!draft.config.channelMappings.midi.exactNote) {
        draft.config.channelMappings.midi.exactNote = {
          ...DEFAULT_GLOBAL_MAPPINGS.channelMappings.midi.exactNote,
        };
      }

      const makeCandidateList = (defaultsObj) => {
        const defaults = [];
        for (let i = 1; i <= 12; i++) {
          const v = defaultsObj?.[i];
          if (typeof v === "number") defaults.push(v);
        }
        const all = Array.from({ length: 128 }, (_, n) => n);
        return [...defaults, ...all];
      };

      const normalizeMapping = (mappingObj, defaultsObj) => {
        const candidates = makeCandidateList(defaultsObj);
        const used = new Set();
        const next = { ...mappingObj };

        for (let slot = 1; slot <= 12; slot++) {
          const raw = next?.[slot];
          const n = typeof raw === "number" ? raw : null;
          if (isValidMidiNoteNumber(n) && !used.has(n)) {
            used.add(n);
            continue;
          }
          next[slot] = null;
        }

        for (let slot = 1; slot <= 12; slot++) {
          if (isValidMidiNoteNumber(next[slot])) continue;
          const pick = candidates.find((n) => isValidMidiNoteNumber(n) && !used.has(n));
          if (pick === undefined) continue;
          next[slot] = pick;
          used.add(pick);
        }

        return next;
      };

      draft.config.trackMappings.midi.exactNote = normalizeMapping(
        draft.config.trackMappings.midi.exactNote,
        DEFAULT_GLOBAL_MAPPINGS.trackMappings.midi.exactNote
      );
      draft.config.channelMappings.midi.exactNote = normalizeMapping(
        draft.config.channelMappings.midi.exactNote,
        DEFAULT_GLOBAL_MAPPINGS.channelMappings.midi.exactNote
      );
    });
  }, [isOpen, isMidi, midiMode, setUserData]);

  const updateTrackMapping = (slot, value) => {
    updateUserData(setUserData, (draft) => {
      if (!draft.config) draft.config = {};
      if (!draft.config.trackMappings) {
        draft.config.trackMappings = DEFAULT_GLOBAL_MAPPINGS.trackMappings;
      }
      if (isMidi) {
        if (!draft.config.input) draft.config.input = {};
        draft.config.input.noteMatchMode = midiMode;
        const midi = draft.config.trackMappings.midi;
        if (
          !midi ||
          typeof midi !== "object" ||
          midi === null ||
          !("pitchClass" in midi) ||
          !("exactNote" in midi)
        ) {
          draft.config.trackMappings.midi = {
            pitchClass: {
              ...DEFAULT_GLOBAL_MAPPINGS.trackMappings.midi.pitchClass,
            },
            exactNote: {
              ...DEFAULT_GLOBAL_MAPPINGS.trackMappings.midi.exactNote,
            },
          };
        }
        if (!draft.config.trackMappings.midi[midiMode]) {
          draft.config.trackMappings.midi[midiMode] = {};
        }
        draft.config.trackMappings.midi[midiMode][slot] = value;
      } else {
        if (!draft.config.trackMappings.osc) draft.config.trackMappings.osc = {};
        draft.config.trackMappings.osc[slot] = value;
      }
    });
  };

  const updateChannelMapping = (slot, value) => {
    updateUserData(setUserData, (draft) => {
      if (!draft.config) draft.config = {};
      if (!draft.config.channelMappings) {
        draft.config.channelMappings = DEFAULT_GLOBAL_MAPPINGS.channelMappings;
      }
      if (isMidi) {
        if (!draft.config.input) draft.config.input = {};
        draft.config.input.noteMatchMode = midiMode;
        const midi = draft.config.channelMappings.midi;
        if (
          !midi ||
          typeof midi !== "object" ||
          midi === null ||
          !("pitchClass" in midi) ||
          !("exactNote" in midi)
        ) {
          draft.config.channelMappings.midi = {
            pitchClass: {
              ...DEFAULT_GLOBAL_MAPPINGS.channelMappings.midi.pitchClass,
            },
            exactNote: {
              ...DEFAULT_GLOBAL_MAPPINGS.channelMappings.midi.exactNote,
            },
          };
        }
        if (!draft.config.channelMappings.midi[midiMode]) {
          draft.config.channelMappings.midi[midiMode] = {};
        }
        draft.config.channelMappings.midi[midiMode][slot] = value;
      } else {
        if (!draft.config.channelMappings.osc) draft.config.channelMappings.osc = {};
        draft.config.channelMappings.osc[slot] = value;
      }
    });
  };

  if (!isOpen) return null;

  const pitchClassOptions = Array.from({ length: 12 }).map((_, pc) => {
    const name = pitchClassToName(pc) || String(pc);
    return { value: pc, label: name };
  });

  const exactNoteOptions = Array.from({ length: 128 }, (_, n) => ({
    value: n,
    label: String(n),
  }));

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="large">
      <ModalHeader title="INPUT MAPPINGS" onClose={onClose} />

      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2 border-b border-neutral-800 pb-4 font-mono">
          <div className="text-neutral-300 text-[11px]">Mapping Type:</div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3 py-1">
              <RadioButton
                id="input-mappings-midi"
                name="input-mappings-tab"
                value="midi-pitchClass"
                checked={activeTab === "midi-pitchClass"}
                onChange={() => setActiveTab("midi-pitchClass")}
              />
              <label
                htmlFor="input-mappings-midi"
                className="cursor-pointer text-[11px] font-mono text-neutral-300"
              >
                MIDI (Pitch Class)
              </label>
            </div>
            <div className="flex items-center gap-3 py-1">
              <RadioButton
                id="input-mappings-midi-exact"
                name="input-mappings-tab"
                value="midi-exactNote"
                checked={activeTab === "midi-exactNote"}
                onChange={() => setActiveTab("midi-exactNote")}
              />
              <label
                htmlFor="input-mappings-midi-exact"
                className="cursor-pointer text-[11px] font-mono text-neutral-300"
              >
                MIDI (Exact Note)
              </label>
            </div>
            <div className="flex items-center gap-3 py-1">
              <RadioButton
                id="input-mappings-osc"
                name="input-mappings-tab"
                value="osc"
                checked={activeTab === "osc"}
                onChange={() => setActiveTab("osc")}
              />
              <label
                htmlFor="input-mappings-osc"
                className="cursor-pointer text-[11px] font-mono text-neutral-300"
              >
                OSC
              </label>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div>
            <div className="text-neutral-300 text-[11px] mb-3 font-mono">
              Method Trigger Mappings (1-{triggerSlots}):
            </div>
            <div className="grid grid-cols-2 gap-2">
              {Array.from({ length: triggerSlots }, (_, i) => i + 1).map((slot) => (
                <div key={slot} className="flex items-center gap-2">
                  <span className="text-neutral-500 text-[11px] font-mono w-12">Ch {slot}:</span>
                  {isMidi ? (
                    midiMode === "pitchClass" ? (
                      <Select
                        value={(() => {
                          const current =
                            channelMappings.midi?.pitchClass?.[slot] ??
                            channelMappings.midi?.[slot];
                          if (typeof current === "number") return String(current);
                          const pc = parsePitchClass(current);
                          return pc === null ? "" : String(pc);
                        })()}
                        onChange={(e) => updateChannelMapping(slot, parseInt(e.target.value, 10))}
                        className="flex-1 text-[11px]"
                      >
                        <option value="" disabled>
                          select pitch class…
                        </option>
                        {pitchClassOptions.map((opt) => (
                          <option key={opt.value} value={String(opt.value)}>
                            {opt.label}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <Select
                        value={(() => {
                          const current = channelMappings.midi?.exactNote?.[slot];
                          return isValidMidiNoteNumber(current) ? String(current) : "0";
                        })()}
                        onChange={(e) => updateChannelMapping(slot, parseInt(e.target.value, 10))}
                        className="flex-1 text-[11px]"
                      >
                        {exactNoteOptions.map((opt) => {
                          const selected = channelMappings.midi?.exactNote?.[slot];
                          const usedByOtherSlot = Object.entries(
                            channelMappings.midi?.exactNote || {}
                          ).some(([s, v]) => {
                            if (parseInt(s, 10) === slot) return false;
                            return v === opt.value;
                          });
                          const disabled = usedByOtherSlot && opt.value !== selected;
                          return (
                            <option key={opt.value} value={String(opt.value)} disabled={disabled}>
                              {opt.label}
                            </option>
                          );
                        })}
                      </Select>
                    )
                  ) : (
                    <TextInput
                      value={channelMappings.osc?.[slot] ?? ""}
                      onChange={(e) => updateChannelMapping(slot, e.target.value)}
                      className="flex-1 text-[11px]"
                      placeholder={`/ch/${slot}`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="text-neutral-300 text-[11px] mb-3 font-mono">
              Track Select Mappings (1-{trackSlots}):
            </div>
            <div className="grid grid-cols-2 gap-2">
              {Array.from({ length: trackSlots }, (_, i) => i + 1).map((slot) => (
                <div key={slot} className="flex items-center gap-2">
                  <span className="text-neutral-500 text-[11px] font-mono w-12">Track {slot}:</span>
                  {isMidi ? (
                    midiMode === "pitchClass" ? (
                      <Select
                        value={(() => {
                          const current =
                            trackMappings.midi?.pitchClass?.[slot] ?? trackMappings.midi?.[slot];
                          if (typeof current === "number") return String(current);
                          const pc = parsePitchClass(current);
                          return pc === null ? "" : String(pc);
                        })()}
                        onChange={(e) => updateTrackMapping(slot, parseInt(e.target.value, 10))}
                        className="flex-1 text-[11px]"
                      >
                        <option value="" disabled>
                          select pitch class…
                        </option>
                        {pitchClassOptions.map((opt) => (
                          <option key={opt.value} value={String(opt.value)}>
                            {opt.label}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <Select
                        value={(() => {
                          const current = trackMappings.midi?.exactNote?.[slot];
                          return isValidMidiNoteNumber(current) ? String(current) : "0";
                        })()}
                        onChange={(e) => updateTrackMapping(slot, parseInt(e.target.value, 10))}
                        className="flex-1 text-[11px]"
                      >
                        {exactNoteOptions.map((opt) => {
                          const selected = trackMappings.midi?.exactNote?.[slot];
                          const usedByOtherSlot = Object.entries(
                            trackMappings.midi?.exactNote || {}
                          ).some(([s, v]) => {
                            if (parseInt(s, 10) === slot) return false;
                            return v === opt.value;
                          });
                          const disabled = usedByOtherSlot && opt.value !== selected;
                          return (
                            <option key={opt.value} value={String(opt.value)} disabled={disabled}>
                              {opt.label}
                            </option>
                          );
                        })}
                      </Select>
                    )
                  ) : (
                    <TextInput
                      value={trackMappings.osc?.[slot] ?? ""}
                      onChange={(e) => updateTrackMapping(slot, e.target.value)}
                      className="flex-1 text-[11px]"
                      placeholder={`/track/${slot}`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="text-neutral-500 text-[10px] font-mono border-t border-neutral-800 pt-4">
          These mappings define what trigger values are used for each slot across all tracks.
        </div>
      </div>
    </Modal>
  );
};
