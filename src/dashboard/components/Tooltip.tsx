import { ReactNode, useEffect, useRef, useState } from "react";

type TooltipPosition = "top" | "bottom" | "left" | "right";

type TooltipProps = {
  children: ReactNode;
  content: ReactNode;
  position?: TooltipPosition;
};

export const Tooltip = ({ children, content, position = "top" }: TooltipProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const wrapperRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (isVisible && tooltipRef.current && wrapperRef.current) {
      const tooltip = tooltipRef.current;
      const wrapper = wrapperRef.current;

      const updatePosition = () => {
        let targetRect = wrapper.getBoundingClientRect();

        const absolutelyPositionedChild = wrapper.querySelector<HTMLElement>(
          '[class*="absolute"]'
        );
        if (absolutelyPositionedChild) {
          targetRect = absolutelyPositionedChild.getBoundingClientRect();
        }

        const tooltipRect = tooltip.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        let top = 0;
        let left = 0;

        switch (position) {
          case "top":
            top = targetRect.top - tooltipRect.height - 8;
            left =
              targetRect.left + targetRect.width / 2 - tooltipRect.width / 2;
            if (top < 0) {
              top = targetRect.bottom + 8;
            }
            if (left < 8) {
              left = 8;
            }
            if (left + tooltipRect.width > viewportWidth - 8) {
              left = viewportWidth - tooltipRect.width - 8;
            }
            break;
          case "bottom":
            top = targetRect.bottom + 8;
            left =
              targetRect.left + targetRect.width / 2 - tooltipRect.width / 2;
            if (top + tooltipRect.height > viewportHeight - 8) {
              top = targetRect.top - tooltipRect.height - 8;
            }
            if (left < 8) {
              left = 8;
            }
            if (left + tooltipRect.width > viewportWidth - 8) {
              left = viewportWidth - tooltipRect.width - 8;
            }
            break;
          case "left":
            top =
              targetRect.top + targetRect.height / 2 - tooltipRect.height / 2;
            left = targetRect.left - tooltipRect.width - 8;
            if (left < 8) {
              left = targetRect.right + 8;
            }
            if (top < 8) {
              top = 8;
            }
            if (top + tooltipRect.height > viewportHeight - 8) {
              top = viewportHeight - tooltipRect.height - 8;
            }
            break;
          case "right":
            top =
              targetRect.top + targetRect.height / 2 - tooltipRect.height / 2;
            left = targetRect.right + 8;
            if (left + tooltipRect.width > viewportWidth - 8) {
              left = targetRect.left - tooltipRect.width - 8;
            }
            if (top < 8) {
              top = 8;
            }
            if (top + tooltipRect.height > viewportHeight - 8) {
              top = viewportHeight - tooltipRect.height - 8;
            }
            break;
        }

        tooltip.style.top = `${top}px`;
        tooltip.style.left = `${left}px`;
      };

      updatePosition();
      window.addEventListener("scroll", updatePosition, true);
      window.addEventListener("resize", updatePosition);

      return () => {
        window.removeEventListener("scroll", updatePosition, true);
        window.removeEventListener("resize", updatePosition);
      };
    }
  }, [isVisible, position]);

  if (!content) {
    return children;
  }

  return (
    <span
      ref={wrapperRef}
      className="inline-block"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div
          ref={tooltipRef}
          className="fixed z-[1000] pointer-events-none bg-[#1a1a1a] border border-neutral-700 px-3 py-2 text-[10px] text-neutral-300 font-mono leading-tight max-w-[300px] shadow-lg"
          style={{ whiteSpace: "normal" }}
        >
          {content}
        </div>
      )}
    </span>
  );
};

