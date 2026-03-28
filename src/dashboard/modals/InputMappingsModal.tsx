import React, { useEffect, useRef, useState } from "react";
import { useAtom } from "jotai";
import { Modal } from "../shared/Modal";
import { ModalHeader } from "../components/ModalHeader";
import { TextInput, RadioButton, Select } from "../components/FormInputs";
import { userDataAtom } from "../core/state";
import { updateUserData } from "../core/utils";
import { DEFAULT_GLOBAL_MAPPINGS } from "../../shared/config/defaultConfig";
import { parsePitchClass, pitchClassToName } from "../../shared/midi/midiUtils";

type ActiveTab = "midi-pitchClass" | "midi-exactNote" | "osc" | "audio" | "file";

type InputMappingsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onBackToSettings: () => void;
};

export const InputMappingsModal = ({
  isOpen,
  onClose,
  onBackToSettings,
}: InputMappingsModalProps) => {
  const [userData, setUserData] = useAtom(userDataAtom);
  const [activeTab, setActiveTab] = useState<ActiveTab>("midi-pitchClass");
  const wasOpenRef = useRef(false);

  const isValidMidiNoteNumber = (n: unknown) =>
    typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 127;

  useEffect(() => {
    if (!isOpen) {
      wasOpenRef.current = false;
      return;
    }
    if (wasOpenRef.current) return;
    wasOpenRef.current = true;

    const cfg = (userData as Record<string, unknown>).config as Record<string, unknown> | undefined;
    const input = (cfg?.input as Record<string, unknown> | undefined) || undefined;
    const inputType = input?.type;
    const noteMatchMode = input?.noteMatchMode;
    const nextTab: ActiveTab =
      inputType === "osc"
        ? "osc"
        : inputType === "audio"
          ? "audio"
          : inputType === "file"
            ? "file"
            : noteMatchMode === "exactNote"
              ? "midi-exactNote"
              : "midi-pitchClass";
    setActiveTab(nextTab);
  }, [isOpen, userData]);

  const cfg = (userData as Record<string, unknown>).config as Record<string, unknown> | undefined;
  const trackMappings = (cfg?.trackMappings as Record<string, unknown>) || {};
  const channelMappings = (cfg?.channelMappings as Record<string, unknown>) || {};
  const isMidi = activeTab.startsWith("midi-");
  const isAudioOrFile = activeTab === "audio" || activeTab === "file";
  const midiMode = activeTab === "midi-exactNote" ? "exactNote" : "pitchClass";
  const trackSlots = isMidi ? 12 : 10;
  const triggerSlots = 12;

  useEffect(() => {
    if (!isOpen) return;
    if (!isMidi || midiMode !== "exactNote") return;
    updateUserData(setUserData, (draft: unknown) => {
      const d = draft as Record<string, unknown>;
      if (!d.config) d.config = {};
      const c = d.config as Record<string, unknown>;
      if (!c.input) c.input = {};
      (c.input as Record<string, unknown>).noteMatchMode = "exactNote";

      if (!c.trackMappings) {
        c.trackMappings = DEFAULT_GLOBAL_MAPPINGS.trackMappings;
      }
      const tm = c.trackMappings as Record<string, unknown>;
      if (!tm.midi) {
        tm.midi = {
          pitchClass: { ...DEFAULT_GLOBAL_MAPPINGS.trackMappings.midi.pitchClass },
          exactNote: { ...DEFAULT_GLOBAL_MAPPINGS.trackMappings.midi.exactNote },
        };
      }
      const midi = tm.midi as Record<string, unknown>;
      if (!midi.exactNote) {
        midi.exactNote = { ...DEFAULT_GLOBAL_MAPPINGS.trackMappings.midi.exactNote };
      }

      if (!c.channelMappings) {
        c.channelMappings = DEFAULT_GLOBAL_MAPPINGS.channelMappings;
      }
      const cm = c.channelMappings as Record<string, unknown>;
      if (!cm.midi) {
        cm.midi = {
          pitchClass: { ...DEFAULT_GLOBAL_MAPPINGS.channelMappings.midi.pitchClass },
          exactNote: { ...DEFAULT_GLOBAL_MAPPINGS.channelMappings.midi.exactNote },
        };
      }
      const cmMidi = cm.midi as Record<string, unknown>;
      if (!cmMidi.exactNote) {
        cmMidi.exactNote = { ...DEFAULT_GLOBAL_MAPPINGS.channelMappings.midi.exactNote };
      }

      const makeCandidateList = (defaultsObj: Record<string, unknown> | null) => {
        const defaults: number[] = [];
        for (let i = 1; i <= 12; i++) {
          const v = defaultsObj?.[String(i)];
          if (typeof v === "number") defaults.push(v);
        }
        const all = Array.from({ length: 128 }, (_, n) => n);
        return [...defaults, ...all];
      };

      const normalizeMapping = (
        mappingObj: Record<string, unknown> | null,
        defaultsObj: Record<string, unknown> | null
      ) => {
        const candidates = makeCandidateList(defaultsObj);
        const used = new Set<number>();
        const next: Record<string, unknown> = { ...(mappingObj || {}) };

        for (let slot = 1; slot <= 12; slot++) {
          const raw = next[String(slot)];
          const n = typeof raw === "number" ? raw : null;
          if (isValidMidiNoteNumber(n) && !used.has(n)) {
            used.add(n);
            continue;
          }
          next[String(slot)] = null;
        }

        for (let slot = 1; slot <= 12; slot++) {
          if (isValidMidiNoteNumber(next[String(slot)])) continue;
          const pick = candidates.find((n) => isValidMidiNoteNumber(n) && !used.has(n));
          if (pick === undefined) continue;
          next[String(slot)] = pick;
          used.add(pick);
        }

        return next;
      };

      const tmMidi = tm.midi as Record<string, unknown>;
      tmMidi.exactNote = normalizeMapping(
        tmMidi.exactNote as Record<string, unknown>,
        DEFAULT_GLOBAL_MAPPINGS.trackMappings.midi.exactNote as unknown as Record<string, unknown>
      );
      const cmMidi2 = cm.midi as Record<string, unknown>;
      cmMidi2.exactNote = normalizeMapping(
        cmMidi2.exactNote as Record<string, unknown>,
        DEFAULT_GLOBAL_MAPPINGS.channelMappings.midi.exactNote as unknown as Record<string, unknown>
      );
    });
  }, [isOpen, isMidi, midiMode, setUserData]);

  const updateTrackMapping = (slot: number, value: unknown) => {
    updateUserData(setUserData, (draft: unknown) => {
      const d = draft as Record<string, unknown>;
      if (!d.config) d.config = {};
      const c = d.config as Record<string, unknown>;
      if (!c.trackMappings) {
        c.trackMappings = DEFAULT_GLOBAL_MAPPINGS.trackMappings;
      }
      const tm = c.trackMappings as Record<string, unknown>;
      if (isMidi) {
        if (!c.input) c.input = {};
        (c.input as Record<string, unknown>).noteMatchMode = midiMode;
        const midi = tm.midi;
        const midiObj =
          (midi && typeof midi === "object" && !Array.isArray(midi)
            ? (midi as Record<string, unknown>)
            : null) || null;
        if (!midiObj || !("pitchClass" in midiObj) || !("exactNote" in midiObj)) {
          tm.midi = {
            pitchClass: { ...DEFAULT_GLOBAL_MAPPINGS.trackMappings.midi.pitchClass },
            exactNote: { ...DEFAULT_GLOBAL_MAPPINGS.trackMappings.midi.exactNote },
          };
        }
        const m = tm.midi as Record<string, unknown>;
        if (!m[midiMode]) {
          m[midiMode] = {};
        }
        (m[midiMode] as Record<string, unknown>)[String(slot)] = value;
      } else {
        if (activeTab === "osc") {
          if (!tm.osc) tm.osc = {};
          (tm.osc as Record<string, unknown>)[String(slot)] = value;
        } else if (activeTab === "audio") {
          if (!tm.audio) tm.audio = {};
          (tm.audio as Record<string, unknown>)[String(slot)] = value;
        } else if (activeTab === "file") {
          if (!tm.file) tm.file = {};
          (tm.file as Record<string, unknown>)[String(slot)] = value;
        }
      }
    });
  };

  const updateChannelMapping = (slot: number, value: unknown) => {
    updateUserData(setUserData, (draft: unknown) => {
      const d = draft as Record<string, unknown>;
      if (!d.config) d.config = {};
      const c = d.config as Record<string, unknown>;
      if (!c.channelMappings) {
        c.channelMappings = DEFAULT_GLOBAL_MAPPINGS.channelMappings;
      }
      const cm = c.channelMappings as Record<string, unknown>;
      if (isMidi) {
        if (!c.input) c.input = {};
        (c.input as Record<string, unknown>).noteMatchMode = midiMode;
        const midi = cm.midi;
        const midiObj =
          (midi && typeof midi === "object" && !Array.isArray(midi)
            ? (midi as Record<string, unknown>)
            : null) || null;
        if (!midiObj || !("pitchClass" in midiObj) || !("exactNote" in midiObj)) {
          cm.midi = {
            pitchClass: { ...DEFAULT_GLOBAL_MAPPINGS.channelMappings.midi.pitchClass },
            exactNote: { ...DEFAULT_GLOBAL_MAPPINGS.channelMappings.midi.exactNote },
          };
        }
        const m = cm.midi as Record<string, unknown>;
        if (!m[midiMode]) {
          m[midiMode] = {};
        }
        (m[midiMode] as Record<string, unknown>)[String(slot)] = value;
      } else {
        if (activeTab === "osc") {
          if (!cm.osc) cm.osc = {};
          (cm.osc as Record<string, unknown>)[String(slot)] = value;
        } else if (activeTab === "audio") {
          if (!cm.audio) cm.audio = {};
          (cm.audio as Record<string, unknown>)[String(slot)] = value;
        } else if (activeTab === "file") {
          if (!cm.file) cm.file = {};
          (cm.file as Record<string, unknown>)[String(slot)] = value;
        }
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

  const audioBandOptions = [
    { value: "low", label: "low" },
    { value: "medium", label: "medium" },
    { value: "high", label: "high" },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="large">
      <ModalHeader title="INPUT MAPPINGS" onClose={onBackToSettings} closeLabel="BACK" />

      <div className="px-6">
        <div className="flex flex-col gap-8 font-mono">
          <div>
            <div className="opacity-50 text-[11px] mb-1">Mapping Type:</div>
            <div className="pl-6 flex flex-col gap-2">
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
              <div className="flex items-center gap-3 py-1">
                <RadioButton
                  id="input-mappings-audio"
                  name="input-mappings-tab"
                  value="audio"
                  checked={activeTab === "audio"}
                  onChange={() => setActiveTab("audio")}
                />
                <label
                  htmlFor="input-mappings-audio"
                  className="cursor-pointer text-[11px] font-mono text-neutral-300"
                >
                  Audio (Low / Medium / High)
                </label>
              </div>
              <div className="flex items-center gap-3 py-1">
                <RadioButton
                  id="input-mappings-file"
                  name="input-mappings-tab"
                  value="file"
                  checked={activeTab === "file"}
                  onChange={() => setActiveTab("file")}
                />
                <label
                  htmlFor="input-mappings-file"
                  className="cursor-pointer text-[11px] font-mono text-neutral-300"
                >
                  File Upload (Low / Medium / High)
                </label>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <div>
              <div className="opacity-50 text-[11px] mb-3 font-mono">
                Method Trigger Mappings (1-{triggerSlots}):
              </div>
              <div className="pl-6">
                <div className="grid grid-cols-2 gap-2">
                  {Array.from({ length: triggerSlots }, (_, i) => i + 1).map((slot) => (
                    <div key={slot} className="flex items-center gap-2">
                      <span className="text-neutral-500 text-[11px] font-mono w-12">
                        Ch {slot}:
                      </span>
                      {isMidi ? (
                        midiMode === "pitchClass" ? (
                          <Select
                            value={(() => {
                              const cmMidi = (channelMappings as Record<string, unknown>).midi as
                                | Record<string, unknown>
                                | undefined;
                              const pitchMap = cmMidi?.pitchClass as
                                | Record<string, unknown>
                                | undefined;
                              const current = (pitchMap?.[String(slot)] ??
                                cmMidi?.[String(slot)]) as unknown;
                              if (typeof current === "number") return String(current);
                              const pc = parsePitchClass(current);
                              return pc === null ? "" : String(pc);
                            })()}
                            onChange={(e) =>
                              updateChannelMapping(slot, parseInt(e.target.value, 10))
                            }
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
                              const cmMidi = (channelMappings as Record<string, unknown>).midi as
                                | Record<string, unknown>
                                | undefined;
                              const exactMap =
                                (cmMidi?.exactNote as Record<string, unknown> | undefined) ||
                                undefined;
                              const current = exactMap?.[String(slot)];
                              return isValidMidiNoteNumber(current) ? String(current) : "0";
                            })()}
                            onChange={(e) =>
                              updateChannelMapping(slot, parseInt(e.target.value, 10))
                            }
                            className="flex-1 text-[11px]"
                          >
                            {exactNoteOptions.map((opt) => {
                              const cmMidi = (channelMappings as Record<string, unknown>).midi as
                                | Record<string, unknown>
                                | undefined;
                              const exactMap =
                                (cmMidi?.exactNote as Record<string, unknown> | undefined) ||
                                undefined;
                              const selected = exactMap?.[String(slot)];
                              const usedByOtherSlot = Object.entries(exactMap || {}).some(
                                ([s, v]) => {
                                  if (parseInt(s, 10) === slot) return false;
                                  return v === opt.value;
                                }
                              );
                              const disabled = usedByOtherSlot && opt.value !== selected;
                              return (
                                <option
                                  key={opt.value}
                                  value={String(opt.value)}
                                  disabled={disabled}
                                >
                                  {opt.label}
                                </option>
                              );
                            })}
                          </Select>
                        )
                      ) : activeTab === "audio" || activeTab === "file" ? (
                        <Select
                          value={(() => {
                            const cmBand = (channelMappings as Record<string, unknown>)[
                              activeTab
                            ] as Record<string, unknown> | undefined;
                            const raw = cmBand?.[String(slot)];
                            const v = typeof raw === "string" ? raw : "";
                            return v === "low" || v === "medium" || v === "high" ? v : "";
                          })()}
                          onChange={(e) => updateChannelMapping(slot, e.target.value)}
                          className="flex-1 text-[11px]"
                        >
                          <option value="">—</option>
                          {audioBandOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </Select>
                      ) : (
                        <TextInput
                          value={String(
                            (
                              (channelMappings as Record<string, unknown>).osc as
                                | Record<string, unknown>
                                | undefined
                            )?.[String(slot)] ?? ""
                          )}
                          onChange={(e) => updateChannelMapping(slot, e.target.value)}
                          className="flex-1 text-[11px]"
                          placeholder={`/ch/${slot}`}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {!isAudioOrFile && (
              <div>
                <div className="opacity-50 text-[11px] mb-3 font-mono">
                  Track Select Mappings (1-{trackSlots}):
                </div>
                <div className="pl-6">
                  <div className="grid grid-cols-2 gap-2">
                    {Array.from({ length: trackSlots }, (_, i) => i + 1).map((slot) => (
                      <div key={slot} className="flex items-center gap-2">
                        <span className="text-neutral-500 text-[11px] font-mono w-12">
                          Track {slot}:
                        </span>
                        {isMidi ? (
                          midiMode === "pitchClass" ? (
                            <Select
                              value={(() => {
                                const tmMidi = (trackMappings as Record<string, unknown>).midi as
                                  | Record<string, unknown>
                                  | undefined;
                                const pitchMap = tmMidi?.pitchClass as
                                  | Record<string, unknown>
                                  | undefined;
                                const current = pitchMap?.[String(slot)] ?? tmMidi?.[String(slot)];
                                if (typeof current === "number") return String(current);
                                const pc = parsePitchClass(current);
                                return pc === null ? "" : String(pc);
                              })()}
                              onChange={(e) =>
                                updateTrackMapping(slot, parseInt(e.target.value, 10))
                              }
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
                                const tmMidi = (trackMappings as Record<string, unknown>).midi as
                                  | Record<string, unknown>
                                  | undefined;
                                const exactMap = tmMidi?.exactNote as
                                  | Record<string, unknown>
                                  | undefined;
                                const current = exactMap?.[String(slot)];
                                return isValidMidiNoteNumber(current) ? String(current) : "0";
                              })()}
                              onChange={(e) =>
                                updateTrackMapping(slot, parseInt(e.target.value, 10))
                              }
                              className="flex-1 text-[11px]"
                            >
                              {exactNoteOptions.map((opt) => {
                                const tmMidi = (trackMappings as Record<string, unknown>).midi as
                                  | Record<string, unknown>
                                  | undefined;
                                const exactMap =
                                  (tmMidi?.exactNote as Record<string, unknown> | undefined) ||
                                  undefined;
                                const selected = exactMap?.[String(slot)];
                                const usedByOtherSlot = Object.entries(exactMap || {}).some(
                                  ([s, v]) => {
                                    if (parseInt(s, 10) === slot) return false;
                                    return v === opt.value;
                                  }
                                );
                                const disabled = usedByOtherSlot && opt.value !== selected;
                                return (
                                  <option
                                    key={opt.value}
                                    value={String(opt.value)}
                                    disabled={disabled}
                                  >
                                    {opt.label}
                                  </option>
                                );
                              })}
                            </Select>
                          )
                        ) : (
                          <TextInput
                            value={String(
                              (
                                (trackMappings as Record<string, unknown>).osc as
                                  | Record<string, unknown>
                                  | undefined
                              )?.[String(slot)] ?? ""
                            )}
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
            )}
          </div>

          <div className="text-neutral-500 text-[10px] font-mono border-t border-neutral-800 pt-4">
            These mappings define what trigger values are used for each slot across all tracks.
          </div>
        </div>
      </div>
    </Modal>
  );
};
