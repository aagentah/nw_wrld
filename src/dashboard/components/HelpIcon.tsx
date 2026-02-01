import { ReactNode } from "react";
import { FaQuestion } from "react-icons/fa";
import { Tooltip } from "./Tooltip";

type HelpIconProps = {
  helpText: ReactNode;
};

export const HelpIcon = ({ helpText }: HelpIconProps) => {
  if (helpText == null) return null;
  if (typeof helpText === "string" && helpText.trim().length === 0) return null;

  return (
    <Tooltip content={helpText} position="top">
      <span className="absolute top-[2px] -right-2 -translate-y-1/2 translate-x-1/2 cursor-help">
        <FaQuestion className="scale-[1] text-yellow-500/50 text-[10px]" />
      </span>
    </Tooltip>
  );
};

