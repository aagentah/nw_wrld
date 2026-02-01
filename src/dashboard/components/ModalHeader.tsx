import { ReactNode } from "react";
import { Button } from "./Button";

type ModalHeaderProps = {
  title: ReactNode;
  onClose: () => void;
  closeLabel?: ReactNode;
  isBottomAligned?: boolean;
  showClose?: boolean;
  uppercase?: boolean;
  containerClassName?: string;
  titleClassName?: string;
};

export const ModalHeader = ({
  title,
  onClose,
  closeLabel = "CLOSE",
  isBottomAligned,
  showClose = true,
  uppercase = true,
  containerClassName = "",
  titleClassName = "",
}: ModalHeaderProps) => {
  return (
    <div className="mb-4 pb-4 border-b border-neutral-800 bg-[#101010]">
      <div
        className={`flex justify-between items-baseline ${
          isBottomAligned ? "px-6" : ""
        } ${containerClassName}`}
      >
        <span
          className={`${
            uppercase ? "uppercase" : "normal-case"
          } text-neutral-300 relative inline-block ${titleClassName}`}
        >
          {title}
        </span>
        {showClose ? (
          <Button as="button" onClick={onClose} type="secondary">
            {closeLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
};

ModalHeader.displayName = "ModalHeader";

