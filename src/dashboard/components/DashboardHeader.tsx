import { FaBars, FaCog, FaCode, FaMusic, FaTag } from "react-icons/fa";
import { Button } from "./Button";
import { useUpdateCheck } from "../core/hooks/useUpdateCheck";

type DashboardHeaderProps = {
  onSets?: (() => void) | null;
  onTracks?: (() => void) | null;
  onModules?: (() => void) | null;
  onSettings?: (() => void) | null;
  onDebugOverlay?: (() => void) | null;
  onReleases?: (() => void) | null;
};

export const DashboardHeader = ({
  onSets,
  onTracks,
  onModules,
  onSettings,
  onDebugOverlay,
  onReleases,
}: DashboardHeaderProps) => {
  const update = useUpdateCheck();
  const hasUpdate = update.status === "updateAvailable";

  const handleOpenUpdates = () => {
    if (typeof onReleases === "function") {
      onReleases();
      return;
    }
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-[#101010] border-b border-neutral-800 px-6 py-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-6">
          <Button onClick={onSets} icon={<FaBars />}>
            SETS
          </Button>
          <Button onClick={onTracks} icon={<FaMusic />}>
            TRACKS
          </Button>
          <Button onClick={onModules} icon={<FaCode />}>
            MODULES
          </Button>
          <Button onClick={onSettings} icon={<FaCog />}>
            SETTINGS
          </Button>
          <Button onClick={onDebugOverlay} icon={<FaCode />}>
            DEBUG
          </Button>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="opacity-50 text-[11px] text-neutral-300">nw_wrld</div>
            <button
              type="button"
              onClick={handleOpenUpdates}
              className={`relative flex items-center ${
                hasUpdate ? "text-red-500/80 opacity-100" : "text-neutral-300 opacity-50"
              }`}
            >
              <FaTag size={12} className="opacity-75" />
              {hasUpdate ? (
                <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-red-500/80" />
              ) : null}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
