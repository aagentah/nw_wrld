import { Children, cloneElement, type MouseEvent, type ReactElement, type ReactNode } from "react";

type ModalPosition = "center" | "bottom";
type ModalSize = "small" | "medium" | "large" | "full";

type ModalProps = {
  isOpen: boolean;
  onClose: (event?: MouseEvent<HTMLDivElement>) => void;
  children: ReactNode;
  onCloseHandler?: (event: MouseEvent<HTMLDivElement>) => void;
  position?: ModalPosition;
  size?: ModalSize;
};

type ModalAugmentedChildProps = { isBottomAligned?: boolean };
type ModalAugmentedChildElement = ReactElement<Record<string, unknown> & ModalAugmentedChildProps>;

function isReactElement(value: unknown): value is ModalAugmentedChildElement {
  return Boolean(value) && typeof value === "object" && "type" in (value as Record<string, unknown>);
}

function getComponentName(el: ReactElement): string | null {
  const t = el.type as unknown;
  if (!t) return null;
  if (typeof t === "string") return t;
  const rec = t as unknown as Record<string, unknown>;
  const maybeDisplayName = rec.displayName;
  if (typeof maybeDisplayName === "string") return maybeDisplayName;
  const maybeName = rec.name;
  if (typeof maybeName === "string") return maybeName;
  return null;
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

  const getSizeClass = () => {
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

  const childrenArray = Children.toArray(children);

  const findComponent = (displayName: string) => {
    return childrenArray.findIndex((child) => {
      if (!isReactElement(child)) return false;
      const name = getComponentName(child);
      if (!name) return false;
      return name === displayName;
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
      } z-50 flex ${isBottomAligned ? "items-end" : "items-center"} justify-center font-mono bg-black/80`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`${getSizeClass()} ${
          hasFixedLayout ? "max-h-[calc(100vh-12rem)] flex flex-col" : "max-h-[calc(100vh-12rem)] overflow-y-auto"
        } bg-[#101010] text-neutral-300 text-[11px] leading-[1.5] ${hasFixedLayout ? "" : "p-6"}`}
      >
        {hasFixedLayout ? (
          <>
            {childrenArray.map((child, index) => {
              const isHeader =
                isReactElement(child) && (getComponentName(child) === "ModalHeader");
              const isFooter =
                isReactElement(child) && (getComponentName(child) === "ModalFooter");

              if (isHeader) {
                return (
                  <div
                    key={`header-${index}`}
                    className={`flex-shrink-0 ${isBottomAligned ? "pb-0 pt-6" : "p-6 pb-0"}`}
                  >
                    {cloneElement(child, { isBottomAligned })}
                  </div>
                );
              }
              if (isFooter) {
                return (
                  <div
                    key={`footer-${index}`}
                    className={`flex-shrink-0 ${isBottomAligned ? "pb-4 pt-0" : "p-6 pt-0"}`}
                  >
                    {cloneElement(child, { isBottomAligned })}
                  </div>
                );
              }
              return (
                <div key={`content-${index}`} className="flex-1 overflow-y-auto p-6">
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

