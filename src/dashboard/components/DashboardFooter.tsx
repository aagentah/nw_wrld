import { useAtom } from "jotai";
import { FaPlay, FaStop } from "react-icons/fa";
import { recordingDataAtom } from "../core/state";
import { Checkbox } from "./FormInputs";
import { Button } from "./Button";

type InputConfig = {
  type?: string;
  port?: number;
  deviceName?: string;
};

type InputStatus = {
  status: string;
  message?: string;
  config?: { input?: InputConfig } | null;
};

type DashboardConfig = { sequencerMode?: boolean } & Record<string, unknown>;

type DashboardFooterProps = {
  track: unknown | null;
  isPlaying: boolean;
  onPlayPause: () => void;
  onStop: () => void;
  inputStatus: InputStatus;
  inputConfig: InputConfig | null;
  onSettingsClick: () => void;
  config: DashboardConfig | null;
  isMuted: boolean;
  onMuteChange: (next: boolean) => void;
  isProjectorReady: boolean;
};

export const DashboardFooter = ({
  track,
  isPlaying,
  onPlayPause,
  onStop,
  inputStatus,
  inputConfig,
  onSettingsClick,
  config,
  isMuted,
  onMuteChange,
  isProjectorReady,
}: DashboardFooterProps) => {
  const [_recordingData] = useAtom(recordingDataAtom);
  const isFileMode = !config?.sequencerMode && inputConfig?.type === "file";
  const trackObj = track && typeof track === "object" ? (track as Record<string, unknown>) : null;
  const trackSignal =
    trackObj && trackObj.signal && typeof trackObj.signal === "object"
      ? (trackObj.signal as Record<string, unknown>)
      : null;
  const trackFile =
    trackSignal && trackSignal.file && typeof trackSignal.file === "object"
      ? (trackSignal.file as Record<string, unknown>)
      : null;
  const trackFileAssetRelPath =
    trackFile && typeof trackFile.assetRelPath === "string" ? trackFile.assetRelPath : "";

  const getStatusColor = () => {
    switch (inputStatus.status) {
      case "connected":
        return "text-blue-500";
      case "connecting":
        return "text-yellow-500";
      case "error":
        return "text-red-500";
      default:
        return "text-neutral-500";
    }
  };

  const getStatusIcon = () => {
    switch (inputStatus.status) {
      case "connected":
        return "●";
      case "connecting":
        return "◐";
      case "error":
        return "✕";
      default:
        return "○";
    }
  };

  const getStatusText = () => {
    if (inputStatus?.message && inputStatus.message !== "") {
      return inputStatus.message;
    }

    const statusInput = inputStatus?.config?.input || null;
    if (statusInput && statusInput.type) {
      if (statusInput.type === "osc") {
        return `Listening on Port ${statusInput.port || 8000}`;
      } else if (statusInput.type === "midi") {
        return `MIDI: ${statusInput.deviceName || "Not configured"}`;
      }
    }

    if (inputConfig?.type === "osc") {
      return `Listening on Port ${inputConfig.port || 8000}`;
    } else if (inputConfig?.type === "midi") {
      return `MIDI: ${inputConfig.deviceName || "Not configured"}`;
    }

    return "No input";
  };

  if (!track) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#101010] border-t border-neutral-800 px-6 py-4">
        <div className="w-full flex justify-start gap-4 items-center">
          <div className="text-neutral-300/30 text-[11px]">No track selected</div>
          {!config?.sequencerMode && (
            <button
              onClick={onSettingsClick}
              className={`text-[10px] font-mono flex items-center gap-2 cursor-pointer hover:opacity-70 transition-opacity ${getStatusColor()}`}
              title={`${inputStatus.status}: ${getStatusText()}`}
            >
              <span>{getStatusIcon()}</span>
              <span>{getStatusText()}</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#101010]">
      <div className="border-t border-neutral-800 py-4 px-6">
        <div className="flex justify-start items-start">
          <div className="text-[10px] text-neutral-600 font-mono leading-tight">
            <span>
              nw_wrld is developed & maintained by{" "}
              <a
                target="_blank"
                rel="noopener noreferrer"
                href="https://daniel.aagentah.tech/"
                className="underline"
              >
                Daniel Aagentah
              </a>{" "}
              [Open-sourced under GPL-3.0 license.]
            </span>
          </div>
        </div>
      </div>

      <div className="border-t border-neutral-800 py-4 px-6">
        <div className="w-full flex justify-start gap-4 items-center">
          {config?.sequencerMode || isFileMode ? (
            <>
              <Button
                onClick={isPlaying ? onStop : onPlayPause}
                className={isPlaying ? "decoration-neutral-300" : ""}
                title={
                  isPlaying
                    ? "Stop playback"
                    : config?.sequencerMode
                      ? "Play sequencer"
                      : "Play file"
                }
                icon={isPlaying ? <FaStop /> : <FaPlay />}
                disabled={
                  (!isProjectorReady && !isPlaying) ||
                  (isFileMode && !trackFileAssetRelPath && !isPlaying)
                }
                as="button"
                data-testid={config?.sequencerMode ? "sequencer-play-toggle" : "file-play-toggle"}
              >
                <span className="relative inline-block">{isPlaying ? "STOP" : "PLAY"}</span>
              </Button>
              <label
                className="flex items-center gap-2 cursor-pointer text-[11px] text-neutral-300 font-mono"
                onClickCapture={(e) => {
                  if (e.detail === 0) return;
                  const input = e.currentTarget.querySelector(
                    'input[type="checkbox"]'
                  ) as HTMLInputElement | null;
                  if (!input) return;
                  setTimeout(() => input.blur(), 0);
                }}
              >
                <Checkbox checked={isMuted} onChange={(e) => onMuteChange(e.target.checked)} />
                <span>Mute</span>
              </label>
            </>
          ) : (
            <button
              onClick={onSettingsClick}
              className={`text-[10px] font-mono flex items-center gap-2 cursor-pointer hover:opacity-70 transition-opacity ${getStatusColor()}`}
              title={`${inputStatus.status}: ${getStatusText()}`}
            >
              <span>{getStatusIcon()}</span>
              <span>{getStatusText()}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
