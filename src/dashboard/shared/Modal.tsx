import React from "react";

export type ModalPosition = "center" | "bottom";
export type ModalSize = "small" | "medium" | "large" | "full";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  onCloseHandler?: () => void;
  position?: ModalPosition;
  size?: ModalSize;
}

export const Modal = ({
  isOpen,
  onClose,
  children,
  onCloseHandler,
  position = "center",
  size = "medium",
}: ModalProps) => {
  if (!isOpen) return null;

  const handleOverlayClick = onCloseHandler || onClose;
  const isBottomAligned = position === "bottom";

  const getSizeClass = (): string => {
    if (isBottomAligned && size === "full") return "w-full";
    if (isBottomAligned) return "w-full";

    switch (size) {
      case "small":
        return "w-full max-w-[50vw]";
      case "medium":
        return "w-full max-w-[70vw]";
      case "large":
        return "w-full max-w-[90vw]";
      case "full":
        return "w-full";
      default:
        return "w-full max-w-[70vw]";
    }
  };

  const childrenArray = React.Children.toArray(children);

  const findComponent = (displayName: string): number => {
    return childrenArray.findIndex((child) => {
      if (React.isValidElement(child)) {
        const childType = child.type as any;
        if (childType?.displayName === displayName) return true;
        if (childType?.name === displayName) return true;
      }
      return false;
    });
  };

  const headerIndex = findComponent("ModalHeader");
  const footerIndex = findComponent("ModalFooter");
  const hasFixedLayout = headerIndex !== -1 || footerIndex !== -1;

  return (
    <div
      onClick={handleOverlayClick}
      className={`fixed top-0 left-0 right-0 ${
        isBottomAligned ? "bottom-[49px]" : "bottom-0"
      } z-50 flex ${
        isBottomAligned ? "items-end" : "items-center"
      } justify-center font-mono bg-black/80`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`${getSizeClass()} ${
          hasFixedLayout
            ? "max-h-[calc(100vh-12rem)] flex flex-col"
            : "max-h-[calc(100vh-12rem)] overflow-y-auto"
        } bg-[#101010] text-neutral-300 text-[11px] leading-[1.5] ${
          hasFixedLayout ? "" : "p-6"
        }`}
      >
        {hasFixedLayout ? (
          <>
            {childrenArray.map((child, index) => {
              const isHeader =
                (React.isValidElement(child) &&
                  ((child.type as any)?.displayName === "ModalHeader" ||
                    (child.type as any)?.name === "ModalHeader")) ||
                false;
              const isFooter =
                (React.isValidElement(child) &&
                  ((child.type as any)?.displayName === "ModalFooter" ||
                    (child.type as any)?.name === "ModalFooter")) ||
                false;

              if (isHeader && React.isValidElement(child)) {
                return (
                  <div
                    key={`header-${index}`}
                    className={`flex-shrink-0 ${
                      isBottomAligned ? "pb-0 pt-6" : "p-6 pb-0"
                    }`}
                  >
                    {React.cloneElement(child as React.ReactElement<any>, {
                      isBottomAligned,
                    })}
                  </div>
                );
              }
              if (isFooter && React.isValidElement(child)) {
                return (
                  <div
                    key={`footer-${index}`}
                    className={`flex-shrink-0 ${
                      isBottomAligned ? "pb-4 pt-0" : "p-6 pt-0"
                    }`}
                  >
                    {React.cloneElement(child as React.ReactElement<any>, {
                      isBottomAligned,
                    })}
                  </div>
                );
              }
              return (
                <div
                  key={`content-${index}`}
                  className="flex-1 overflow-y-auto p-6"
                >
                  {child}
                </div>
              );
            })}
          </>
        ) : (
          children
        )}
      </div>
    </div>
  );
};
