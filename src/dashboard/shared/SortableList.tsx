import { useCallback, type ReactNode } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
  type SortingStrategy,
} from "@dnd-kit/sortable";

export type SortableListItem = { id: UniqueIdentifier };

type SortableListProps<T extends SortableListItem> = {
  items: T[];
  onReorder: (oldIndex: number, newIndex: number) => void;
  strategy?: SortingStrategy;
  children: ReactNode;
};

export const SortableList = <T extends SortableListItem>({
  items,
  onReorder,
  strategy = verticalListSortingStrategy,
  children,
}: SortableListProps<T>) => {
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
      const oldIndex = itemIds.indexOf(active.id);
      const newIndex = itemIds.indexOf(over.id);

      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        onReorder(oldIndex, newIndex);
      }
    },
    [items, onReorder]
  );

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((item) => item.id)} strategy={strategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
};

export { arrayMove };

