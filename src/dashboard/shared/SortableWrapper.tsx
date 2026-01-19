import { useSortable } from "@dnd-kit/sortable";
import type { CSSProperties, ReactNode } from "react";
import type { UniqueIdentifier } from "@dnd-kit/core";

type SortableWrapperRenderArgs = {
  dragHandleProps: Record<string, unknown>;
  isDragging: boolean;
};

type SortableWrapperProps = {
  id: UniqueIdentifier;
  disabled?: boolean;
  children: (args: SortableWrapperRenderArgs) => ReactNode;
};

export const SortableWrapper = ({ id, disabled = false, children }: SortableWrapperProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
  });

  const style: CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition,
    zIndex: isDragging ? 999 : "auto",
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      {children({
        dragHandleProps: {
          ...(attributes as unknown as Record<string, unknown>),
          ...(listeners as unknown as Record<string, unknown>),
        },
        isDragging,
      })}
    </div>
  );
};

