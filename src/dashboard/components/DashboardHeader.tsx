import { FaBars, FaCog, FaCode, FaMusic, FaTag } from "react-icons/fa";
import { Button } from "./Button";
import { useUpdateCheck } from "../core/hooks/useUpdateCheck";
import {
  debugOverlayModalAtom,
  addModuleModalAtom,
  releaseNotesModalAtom,
  selectSetModalAtom,
  selectTrackModalAtom,
  settingsModalAtom
} from "../core/modalAtoms";
import { useSetAtom } from "jotai";

export const DashboardHeader = () => {
  const openSelectSet = useSetAtom(selectSetModalAtom)
  const openSelectTracks = useSetAtom(selectTrackModalAtom)
  const openAddModule = useSetAtom(addModuleModalAtom)
  const openSettings = useSetAtom(settingsModalAtom)
  const openDebugOverlay = useSetAtom(debugOverlayModalAtom)
  const openReleaseNotes = useSetAtom(releaseNotesModalAtom)

  const update = useUpdateCheck();
  const hasUpdate = update.status === "updateAvailable";

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-[#101010] border-b border-neutral-800 px-6 py-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-6">
          <Button onClick={() => openSelectSet(true)} icon={<FaBars />}>
            SETS
          </Button>
          <Button onClick={() => openSelectTracks(true)} icon={<FaMusic />}>
            TRACKS
          </Button>
          <Button onClick={() => openAddModule('manage-modules')} icon={<FaCode />}>
            MODULES
          </Button>
          <Button onClick={() => openSettings(true)} icon={<FaCog />}>
            SETTINGS
          </Button>
          <Button onClick={() => openDebugOverlay(true)} icon={<FaCode />}>
            DEBUG
          </Button>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="opacity-50 text-[11px] text-neutral-300">nw_wrld</div>
            <button
              type="button"
              onClick={() => openReleaseNotes(true)}
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
