import { ReactNode, Children } from "react";

type ModalFooterJustify = "center" | "between" | "end";

type ModalFooterProps = {
  children?: ReactNode;
  isBottomAligned?: boolean;
  justify?: ModalFooterJustify;
};

export const ModalFooter = ({ children, isBottomAligned, justify }: ModalFooterProps) => {
  const childCount = Children.count(children);
  const defaultJustifyClass =
    childCount > 1 ? "justify-between" : "justify-end";
  const justifyClass =
    justify === "center"
      ? "justify-center"
      : justify === "between"
      ? "justify-between"
      : justify === "end"
      ? "justify-end"
      : defaultJustifyClass;

  return (
    <div className="mt-4 pt-4 border-t border-neutral-800 bg-[#101010]">
      <div
        className={`flex flex-row gap-2 ${justifyClass} items-center ${
          isBottomAligned ? "px-6" : ""
        }`}
      >
        {children}
      </div>
    </div>
  );
};

ModalFooter.displayName = "ModalFooter";

