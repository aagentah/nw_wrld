import React, { useCallback } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
  SortingStrategy,
} from "@dnd-kit/sortable";

export interface SortableItem {
  id: string;
  [key: string]: any;
}

export interface SortableListProps<T extends SortableItem> {
  items: T[];
  onReorder: (oldIndex: number, newIndex: number) => void;
  strategy?: SortingStrategy;
  children: React.ReactNode;
}

export function SortableList<T extends SortableItem>({
  items,
  onReorder,
  strategy = verticalListSortingStrategy,
  children,
}: SortableListProps<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over) return;

      const itemIds = items.map((item) => item.id);
      const oldIndex = itemIds.indexOf(active.id as string);
      const newIndex = itemIds.indexOf(over.id as string);

      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        onReorder(oldIndex, newIndex);
      }
    },
    [items, onReorder]
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={items.map((item) => item.id)}
        strategy={strategy}
      >
        {children}
      </SortableContext>
    </DndContext>
  );
}

export { arrayMove };
