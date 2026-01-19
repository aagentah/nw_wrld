import { ReactNode } from "react";
import { FaQuestionCircle } from "react-icons/fa";
import { Tooltip } from "./Tooltip";

type HelpIconProps = {
  helpText: ReactNode;
};

export const HelpIcon = ({ helpText }: HelpIconProps) => {
  if (helpText == null) return null;
  if (typeof helpText === "string" && helpText.trim().length === 0) return null;

  return (
    <Tooltip content={helpText} position="top">
      <span className="absolute top-[2px] -right-2 -translate-y-1/2 translate-x-1/2 cursor-help bg-neutral-200 rounded-full opacity-75">
        <FaQuestionCircle className="scale-[1.1] rounded-full text-blue-800 text-[10px]" />
      </span>
    </Tooltip>
  );
};

