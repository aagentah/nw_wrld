import React from "react";
import { FaBars, FaCog, FaCode, FaMusic } from "react-icons/fa";
import { Button } from "./Button.js";

export const DashboardHeader = ({
  onSets,
  onTracks,
  onModules,
  onSettings,
  onDebugOverlay,
}) => {
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
          <div className="opacity-50 text-[11px] text-neutral-300">nw_wrld</div>
        </div>
      </div>
    </div>
  );
};
