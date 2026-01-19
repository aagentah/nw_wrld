import { memo, useState, useRef, useEffect, useCallback, useMemo, type ChangeEvent, type KeyboardEvent } from "react";
import { Modal } from "../shared/Modal";
import { ModalHeader } from "../components/ModalHeader";
import { Button } from "../components/Button";
import {
  Select,
  NumberInput,
  RadioButton,
  ColorInput,
  TextInput,
} from "../components/FormInputs";
import { HelpIcon } from "../components/HelpIcon";
import { HELP_TEXT } from "../../shared/helpText.ts";

const isValidHexColor = (value: string): boolean => /^#([0-9A-F]{3}){1,2}$/i.test(value);

const clampMidiChannel = (value: unknown, fallback = 1): number => {
  const n = parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(16, n));
};

const normalizeMidiNoteMatchMode = (value: unknown): "pitchClass" | "exactNote" =>
  value === "exactNote" ? "exactNote" : "pitchClass";

const normalizeHexColor = (value: unknown): string | null => {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const withHash = raw.startsWith("#") ? raw : `#${raw}`;
  if (!isValidHexColor(withHash)) return null;
  const hex = withHash.toLowerCase();
  if (hex.length === 4) {
    const r = hex[1];
    const g = hex[2];
    const b = hex[3];
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return hex;
};

type DraftIntInputProps = {
  value: number;
  fallback: number;
  onCommit: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  style?: React.CSSProperties;
  "data-testid"?: string;
};

const DraftIntInput = memo(({ value, fallback, onCommit, ...props }: DraftIntInputProps) => {
  const [draft, setDraft] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const skipCommitRef = useRef(false);

  useEffect(() => {
    if (!isFocused) setDraft(null);
  }, [isFocused, value]);

  const displayed = draft !== null ? draft : String(value ?? "");

  const commitIfValid = useCallback(
    (raw: string) => {
      const s = String(raw);
      const isIntermediate =
        s === "" || s === "-" || s === "." || s === "-." || s.endsWith(".") || /e[+-]?$/i.test(s);
      if (isIntermediate) return;
      const n = parseInt(s, 10);
      if (!Number.isFinite(n)) return;
      onCommit(n);
    },
    [onCommit]
  );

  const commitOnBlur = useCallback(() => {
    if (draft === null) return;
    const s = String(draft);
    const isIntermediate =
      s === "" || s === "-" || s === "." || s === "-." || s.endsWith(".") || /e[+-]?$/i.test(s);
    if (isIntermediate) {
      onCommit(fallback);
      return;
    }
    const n = parseInt(s, 10);
    if (!Number.isFinite(n)) {
      onCommit(fallback);
      return;
    }
    onCommit(n);
  }, [draft, fallback, onCommit]);

  return (
    <NumberInput
      {...props}
      value={displayed}
      onFocus={() => {
        skipCommitRef.current = false;
        setIsFocused(true);
        setDraft(String(value ?? ""));
      }}
      onChange={(e: ChangeEvent<HTMLInputElement>) => {
        const next = e.target.value;
        setDraft(next);
        commitIfValid(next);
      }}
      onBlur={() => {
        setIsFocused(false);
        if (skipCommitRef.current) {
          skipCommitRef.current = false;
          return;
        }
        commitOnBlur();
      }}
      onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          skipCommitRef.current = true;
          setDraft(null);
          e.currentTarget.blur();
        }
      }}
    />
  );
});

type UserColorsProps = {
  config: { userColors?: string[] };
  updateConfig: (updates: { userColors: string[] }) => void;
};

const UserColors = ({ config, updateConfig }: UserColorsProps) => {
  const userColors = useMemo(() => Array.isArray(config?.userColors) ? config.userColors : [], [config]);
  const [draft, setDraft] = useState(
    userColors[0] && isValidHexColor(userColors[0]) ? userColors[0] : "#ffffff"
  );
  const [draftText, setDraftText] = useState(String(draft));

  useEffect(() => {
    setDraftText(String(draft));
  }, [draft]);

  const addColor = useCallback(() => {
    const normalized = normalizeHexColor(draftText);
    if (!normalized) return;
    const next = Array.from(new Set([...userColors, normalized]));
    updateConfig({ userColors: next });
  }, [draftText, updateConfig, userColors]);

  const removeColor = useCallback(
    (hex: string) => {
      const safe = String(hex || "").trim();
      if (!safe) return;
      const next = userColors.filter((c) => c !== safe);
      updateConfig({ userColors: next });
    },
    [updateConfig, userColors]
  );

  return (
    <div className="flex flex-col gap-3 font-mono border-t border-neutral-800 pt-6">
      <div className="pl-12">
        <div className="opacity-50 mb-1 text-[11px]">User Colors:</div>
        <div className="flex items-center gap-2">
          <ColorInput
            value={draft}
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              const next = normalizeHexColor(e.target.value) || "#ffffff";
              setDraft(next);
            }}
          />
          <TextInput
            value={draftText}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setDraftText(e.target.value)}
            className="w-24 py-0.5"
          />
          <Button onClick={addColor} className="flex-1">
            ADD
          </Button>
        </div>
        {userColors.length > 0 ? (
          <div className="mt-2 flex flex-col gap-1">
            {userColors.map((hex) => (
              <div
                key={hex}
                className="flex items-center justify-between gap-2 text-[11px] text-neutral-300/80"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 border border-neutral-600"
                    style={{ backgroundColor: hex }}
                  />
                  <span>{hex}</span>
                </div>
                <div
                  className="px-1 text-red-500/50 cursor-pointer text-[11px]"
                  onClick={() => removeColor(hex)}
                  title="Remove"
                >
                  [{"\u00D7"}]
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-2 text-[10px] text-neutral-500">No user colors saved.</div>
        )}
      </div>
    </div>
  );
};

type AspectRatio = {
  id: string;
  label: string;
};

type BackgroundColor = {
  id: string;
  label: string;
};

type ProjectorSettingsProps = {
  aspectRatio: string;
  setAspectRatio: (ratio: string) => void;
  bgColor: string;
  setBgColor: (color: string) => void;
  settings: {
    aspectRatios: AspectRatio[];
    backgroundColors: BackgroundColor[];
  };
};

const ProjectorSettings = ({
  aspectRatio,
  setAspectRatio,
  bgColor,
  setBgColor,
  settings,
}: ProjectorSettingsProps) => {
  return (
    <div className="flex flex-col gap-3 font-mono">
      <div className="pl-12">
        <div className="mb-1 text-[11px] relative inline-block">
          <span className="opacity-50">Aspect Ratio:</span>
          <HelpIcon helpText={HELP_TEXT.aspectRatio} />
        </div>
        <Select
          id="aspectRatio"
          value={aspectRatio}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => setAspectRatio(e.target.value)}
          className="py-1 w-full"
        >
          {settings.aspectRatios.map((ratio) => (
            <option key={ratio.id} value={ratio.id} className="bg-[#101010]">
              {ratio.label}
            </option>
          ))}
        </Select>
      </div>

      <div className="pl-12">
        <div className="opacity-50 mb-1 text-[11px]">Background Color:</div>
        <Select
          id="bgColor"
          value={bgColor}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => setBgColor(e.target.value)}
          className="py-1 w-full"
        >
          {settings.backgroundColors.map((color) => (
            <option key={color.id} value={color.id} className="bg-[#101010]">
              {color.label}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
};

type MidiDevice = {
  id: string;
  name: string;
};

type InputConfig = {
  type?: string;
  deviceId?: string;
  deviceName?: string;
  methodTriggerChannel?: number;
  trackSelectionChannel?: number;
  noteMatchMode?: string;
  port?: number;
};

type Config = {
  sequencerMode?: boolean;
  sequencerBpm?: number;
  userColors?: string[];
};

type SettingsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  aspectRatio: string;
  setAspectRatio: (ratio: string) => void;
  bgColor: string;
  setBgColor: (color: string) => void;
  settings: {
    aspectRatios: AspectRatio[];
    backgroundColors: BackgroundColor[];
  };
  inputConfig: InputConfig;
  setInputConfig: (config: InputConfig) => void;
  availableMidiDevices: MidiDevice[];
  onOpenMappings: () => void;
  config: Config;
  updateConfig: (updates: Partial<Config>) => void;
  workspacePath: string | null;
  onSelectWorkspace: () => void;
};

export const SettingsModal = ({
  isOpen,
  onClose,
  aspectRatio,
  setAspectRatio,
  bgColor,
  setBgColor,
  settings,
  inputConfig,
  setInputConfig,
  availableMidiDevices,
  onOpenMappings,
  config,
  updateConfig,
  workspacePath,
  onSelectWorkspace,
}: SettingsModalProps) => {
  const normalizedInputType = inputConfig?.type === "osc" ? "osc" : "midi";
  const signalSourceValue = config.sequencerMode
    ? "sequencer"
    : normalizedInputType === "osc"
      ? "external-osc"
      : "external-midi";

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalHeader title="SETTINGS" onClose={onClose} />

      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3 font-mono border-b border-neutral-800 pb-6">
          <div className="pl-12">
            <div className="mb-1 text-[11px] relative inline-block">
              <span className="opacity-50">Signal Source:</span>
              <HelpIcon helpText={HELP_TEXT.sequencerMode} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-3 py-1">
                <RadioButton
                  id="signal-sequencer"
                  name="signalSource"
                  value="sequencer"
                  checked={signalSourceValue === "sequencer"}
                  onChange={() => updateConfig({ sequencerMode: true })}
                />
                <label
                  htmlFor="signal-sequencer"
                  className="cursor-pointer text-[11px] font-mono text-neutral-300"
                >
                  Sequencer (Pattern Grid)
                </label>
              </div>
              <div className="flex items-center gap-3 py-1">
                <RadioButton
                  id="signal-external-midi"
                  name="signalSource"
                  value="external-midi"
                  checked={signalSourceValue === "external-midi"}
                  onChange={() => {
                    updateConfig({ sequencerMode: false });
                    setInputConfig({ ...inputConfig, type: "midi" });
                  }}
                />
                <label
                  htmlFor="signal-external-midi"
                  className="cursor-pointer text-[11px] font-mono text-neutral-300"
                >
                  External MIDI
                </label>
              </div>
              <div className="flex items-center gap-3 py-1">
                <RadioButton
                  id="signal-external-osc"
                  name="signalSource"
                  value="external-osc"
                  checked={signalSourceValue === "external-osc"}
                  onChange={() => {
                    updateConfig({ sequencerMode: false });
                    setInputConfig({ ...inputConfig, type: "osc" });
                  }}
                />
                <label
                  htmlFor="signal-external-osc"
                  className="cursor-pointer text-[11px] font-mono text-neutral-300"
                >
                  External OSC
                </label>
              </div>
            </div>
          </div>

          {!config.sequencerMode && (
            <>
              {normalizedInputType === "midi" && (
                <>
                  <div className="pl-12">
                    <div className="opacity-50 mb-1 text-[11px]">MIDI Device:</div>
                    {(() => {
                      const selectedMidiDeviceId =
                        inputConfig.deviceId ||
                        (availableMidiDevices.find((d) => d.name === inputConfig.deviceName)?.id ??
                          "");
                      return (
                        <Select
                          id="midiDevice"
                          value={selectedMidiDeviceId}
                          onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                            const nextDeviceId = e.target.value;
                            const selected = availableMidiDevices.find(
                              (d) => d.id === nextDeviceId
                            );
                            setInputConfig({
                              ...inputConfig,
                              deviceId: nextDeviceId,
                              deviceName: selected?.name || "",
                            });
                          }}
                          className="py-1 w-full"
                        >
                          <option value="" className="bg-[#101010]">
                            Not configured
                          </option>
                          {availableMidiDevices.map((device) => (
                            <option key={device.id} value={device.id} className="bg-[#101010]">
                              {device.name}
                            </option>
                          ))}
                        </Select>
                      );
                    })()}
                  </div>

                  <div className="pl-12">
                    <div className="mb-1 text-[11px] relative inline-block">
                      <span className="opacity-50">MIDI Channels:</span>
                      <HelpIcon helpText={HELP_TEXT.midiChannels} />
                    </div>
                    <div className="flex flex-col gap-3">
                      <div>
                        <div className="opacity-50 mb-1 text-[11px]">
                          Method Triggers MIDI channel:
                        </div>
                        <DraftIntInput
                          value={inputConfig.methodTriggerChannel ?? 1}
                          fallback={inputConfig.methodTriggerChannel ?? 1}
                          onCommit={(next: number) =>
                            setInputConfig({
                              ...inputConfig,
                              methodTriggerChannel: clampMidiChannel(
                                next,
                                inputConfig.methodTriggerChannel ?? 1
                              ),
                            })
                          }
                          min={1}
                          max={16}
                          className="py-1 w-full"
                          style={{ width: "100%" }}
                        />
                      </div>
                      <div>
                        <div className="opacity-50 mb-1 text-[11px]">
                          Track Select MIDI channel:
                        </div>
                        <DraftIntInput
                          value={inputConfig.trackSelectionChannel ?? 2}
                          fallback={inputConfig.trackSelectionChannel ?? 2}
                          onCommit={(next: number) =>
                            setInputConfig({
                              ...inputConfig,
                              trackSelectionChannel: clampMidiChannel(
                                next,
                                inputConfig.trackSelectionChannel ?? 2
                              ),
                            })
                          }
                          min={1}
                          max={16}
                          className="py-1 w-full"
                          style={{ width: "100%" }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pl-12">
                    <div className="mb-1 text-[11px] relative inline-block">
                      <span className="opacity-50">MIDI Note Match:</span>
                      <HelpIcon helpText={HELP_TEXT.midiNoteMatchMode} />
                    </div>
                    <Select
                      id="midiNoteMatchMode"
                      value={normalizeMidiNoteMatchMode(inputConfig.noteMatchMode)}
                      onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                        setInputConfig({
                          ...inputConfig,
                          noteMatchMode: normalizeMidiNoteMatchMode(e.target.value),
                        })
                      }
                      className="py-1 w-full"
                    >
                      <option value="pitchClass" className="bg-[#101010]">
                        Pitch Class (C..B)
                      </option>
                      <option value="exactNote" className="bg-[#101010]">
                        Exact Note (0–127)
                      </option>
                    </Select>
                  </div>

                  <div className="pl-12">
                    <div className="text-[10px] opacity-50">Velocity set to 127</div>
                  </div>
                </>
              )}

              {normalizedInputType === "osc" && (
                <>
                  <div className="pl-12">
                    <div className="mb-1 text-[11px] relative inline-block">
                      <span className="opacity-50">OSC Port:</span>
                      <HelpIcon helpText={HELP_TEXT.oscPort} />
                    </div>
                    <NumberInput
                      id="oscPort"
                      value={inputConfig.port}
                      onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        setInputConfig({
                          ...inputConfig,
                          port: parseInt(e.target.value) || 8000,
                        })
                      }
                      className="py-1 w-full"
                      min={1024}
                      max={65535}
                    />
                  </div>

                  <div className="pl-12">
                    <div className="text-[10px] opacity-50">
                      Send OSC to: localhost:{inputConfig.port}
                    </div>
                  </div>
                </>
              )}

              <div className="pl-12">
                <div className="opacity-50 mb-1 text-[11px]">Global Input Mappings:</div>
                <Button onClick={onOpenMappings} className="w-full">
                  CONFIGURE MAPPINGS
                </Button>
              </div>
            </>
          )}

          {config.sequencerMode && (
            <div className="pl-12">
              <div className="mb-1 text-[11px] relative inline-block">
                <span className="opacity-50">Sequencer BPM:</span>
                <HelpIcon helpText={HELP_TEXT.sequencerBpm} />
              </div>
              <DraftIntInput
                value={config.sequencerBpm ?? 120}
                fallback={config.sequencerBpm ?? 120}
                onCommit={(next: number) => updateConfig({ sequencerBpm: next })}
                data-testid="sequencer-bpm-input"
                step={1}
                className="py-1 w-full"
                style={{ width: "100%" }}
              />
            </div>
          )}
        </div>

        <ProjectorSettings
          aspectRatio={aspectRatio}
          setAspectRatio={setAspectRatio}
          bgColor={bgColor}
          setBgColor={setBgColor}
          settings={settings}
        />

        <UserColors config={config} updateConfig={updateConfig} />

        <div className="flex flex-col gap-2 font-mono border-t border-neutral-800 pt-6">
          <div className="pl-12">
            <div className="opacity-50 mb-1 text-[11px]">Project Folder:</div>
            <div className="text-[11px] text-neutral-300/70 break-all">
              {workspacePath || "Not set"}
            </div>
          </div>
          <div className="pl-12">
            <Button onClick={onSelectWorkspace} className="w-full">
              {workspacePath ? "OPEN ANOTHER PROJECT" : "OPEN PROJECT"}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
