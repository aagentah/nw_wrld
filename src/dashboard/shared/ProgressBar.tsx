import React from "react";

export interface TerminalProgressBarProps {
  value: number;
  max?: number;
  width?: number;
  label?: string;
}

export const TerminalProgressBar = ({
  value,
  max = 100,
  width = 100,
  label,
}: TerminalProgressBarProps) => {
  const percentage = Math.min((value / max) * 100, 100);
  const filledWidth = Math.round((percentage / 100) * width);

  return (
    <div className="flex items-center gap-2 font-mono">
      {label && (
        <span className="text-[11px] text-neutral-300 min-w-[80px]">
          {label}:
        </span>
      )}
      <div
        className="h-3 bg-[#101010] border border-neutral-800 relative"
        style={{ width: `${width}px` }}
      >
        <div
          className="h-full bg-neutral-300"
          style={{ width: `${filledWidth}px` }}
        />
      </div>
      <span className="text-[11px] text-neutral-300/30 min-w-[40px]">
        {Math.round(percentage)}%
      </span>
    </div>
  );
};
