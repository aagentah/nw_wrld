import React from "react";

export interface ModalFooterProps {
  children: React.ReactNode;
  isBottomAligned?: boolean;
}

export const ModalFooter = ({ children, isBottomAligned }: ModalFooterProps) => {
  const childCount = React.Children.count(children);
  const justifyClass = childCount > 1 ? "justify-between" : "justify-end";

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
