import { ChangeEventHandler, useState } from "react";
import { NumberInput } from "./FormInputs";
import { HelpIcon } from "./HelpIcon";
import { HELP_TEXT } from "../../shared/helpText";

type TrackChannel = string | { name: string };

type SequencerGridProps = {
  track: { channels?: TrackChannel[] } | null;
  pattern: Record<string, number[]>;
  bpm: number;
  isPlaying: boolean;
  currentStep: number;
  onToggleStep: (channelName: string, stepIndex: number) => void;
  onBpmChange: ChangeEventHandler<HTMLInputElement>;
};

export const SequencerGrid = ({
  track,
  pattern,
  bpm,
  isPlaying,
  currentStep,
  onToggleStep,
  onBpmChange,
}: SequencerGridProps) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const channels = track?.channels || [];
  const steps = 16;

  if (channels.length === 0) {
    return (
      <div className="border-t border-neutral-800 py-4 px-6">
        <div className="text-neutral-500 font-mono text-[11px] text-center">
          No channels available. Add modules with channels to use the sequencer.
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-neutral-800 py-4 px-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="text-neutral-300 hover:text-white font-mono text-[11px] transition-colors"
          >
            {isCollapsed ? "▶" : "▼"} SEQUENCER
          </button>
          {!isCollapsed && <HelpIcon helpText={HELP_TEXT.sequencerGrid} />}
        </div>

        {!isCollapsed && (
          <div className="flex items-center gap-2">
            <span className="text-neutral-400 font-mono text-[11px]">BPM:</span>
            <NumberInput
              value={bpm}
              onChange={onBpmChange}
              min={60}
              max={130}
              step={1}
              className="w-16"
            />
            <HelpIcon helpText={HELP_TEXT.sequencerBpm} />
          </div>
        )}
      </div>

      {!isCollapsed && (
        <div className="font-mono">
          <div className="flex gap-0.5 mb-2">
            <div className="w-20 flex-shrink-0" />
            {Array.from({ length: steps }).map((_, stepIndex) => (
              <div
                key={stepIndex}
                className="w-6 h-6 flex items-center justify-center text-[9px] text-neutral-500"
              >
                {stepIndex + 1}
              </div>
            ))}
          </div>

          <div className="space-y-0.5">
            {channels.map((channel) => {
              const channelName =
                typeof channel === "string" ? channel : channel.name;
              const channelSteps = pattern[channelName] || [];

              return (
                <div key={channelName} className="flex gap-0.5 items-center">
                  <div
                    className="w-20 flex-shrink-0 text-[10px] text-neutral-300 truncate pr-2"
                    title={channelName}
                  >
                    {channelName}
                  </div>

                  {Array.from({ length: steps }).map((_, stepIndex) => {
                    const isActive = channelSteps.includes(stepIndex);
                    const isCurrentStep = isPlaying && currentStep === stepIndex;

                    return (
                      <button
                        key={stepIndex}
                        onClick={() => onToggleStep(channelName, stepIndex)}
                        className={`
                          w-6 h-6 border transition-all
                          ${
                            isActive
                              ? "bg-[#b85c5c] border-[#b85c5c]"
                              : "bg-[#1a1a1a] border-neutral-700 hover:border-neutral-500"
                          }
                          ${
                            isCurrentStep
                              ? "ring-2 ring-neutral-400 ring-offset-1 ring-offset-[#101010]"
                              : ""
                          }
                        `}
                        title={`${channelName} - Step ${stepIndex + 1}`}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

