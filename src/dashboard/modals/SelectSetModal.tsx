import { useState } from "react";
import { FaPlus, FaEdit, FaTrash, FaClone } from "react-icons/fa";
import { Modal } from "../shared/Modal";
import { SortableWrapper } from "../shared/SortableWrapper";
import { SortableList, arrayMove } from "../shared/SortableList";
import { ModalHeader } from "../components/ModalHeader";
import { ModalFooter } from "../components/ModalFooter";
import { Button } from "../components/Button";
import { RadioButton } from "../components/FormInputs";
import { updateUserData } from "../core/utils";
import { EditSetModal } from "./EditSetModal";
import { ConfirmationModal } from "./ConfirmationModal";
import { deleteRecordingsForTracks } from "../../shared/json/recordingUtils";
import {
  duplicateName,
  duplicateSet,
  copyRecordingEntries,
} from "../../shared/utils/duplicateUtils";

type Set = {
  id: string;
  name: string;
  tracks: Array<{ id: string | number; isVisible?: boolean }>;
};

type SortableSetItemProps = {
  set: Set;
  activeSetId: string | null;
  onSetSelect: (setId: string) => void;
  onEdit: (setId: string) => void;
  onDuplicate: (setId: string) => void;
  onDelete: (setId: string) => void;
  canDelete: boolean;
};

const SortableSetItem = ({
  set,
  activeSetId,
  onSetSelect,
  onEdit,
  onDuplicate,
  onDelete,
  canDelete,
}: SortableSetItemProps) => {
  return (
    <SortableWrapper id={set.id}>
      {({ dragHandleProps, isDragging: _isDragging }) => (
        <div className="flex items-center gap-3 py-2">
          <span className="text-neutral-300 cursor-move text-md" {...dragHandleProps}>
            {"\u2261"}
          </span>
          <RadioButton
            id={`set-${set.id}`}
            name="set-visibility"
            checked={activeSetId === set.id}
            onChange={() => onSetSelect(set.id)}
          />
          <label
            htmlFor={`set-${set.id}`}
            className={`uppercase cursor-pointer text-[11px] font-mono flex-1 ${
              activeSetId === set.id ? "text-neutral-300" : "text-neutral-300/30"
            }`}
          >
            {set.name} ({set.tracks.length} tracks)
          </label>
          <button
            onClick={() => onEdit(set.id)}
            className="text-neutral-500 hover:text-neutral-300 text-[11px]"
          >
            <FaEdit />
          </button>
          <button
            onClick={() => onDuplicate(set.id)}
            className="text-neutral-500 hover:text-neutral-300 text-[11px]"
            data-testid="duplicate-set"
            data-set-id={set.id}
            aria-label="Duplicate set"
            title="Duplicate set"
          >
            <FaClone />
          </button>
          <button
            onClick={() => onDelete(set.id)}
            className="text-neutral-500 hover:text-red-500 text-[11px]"
            disabled={!canDelete}
            data-testid="delete-set"
            data-set-id={set.id}
            aria-label="Delete set"
          >
            <FaTrash />
          </button>
        </div>
      )}
    </SortableWrapper>
  );
};

type UserData = {
  sets: Set[];
  [key: string]: unknown;
};

type SelectSetModalProps = {
  isOpen: boolean;
  onClose: () => void;
  userData: UserData;
  setUserData: (updater: unknown) => void;
  setActiveTrackId: (id: string | number | null) => void;
  activeSetId: string | null;
  setActiveSetId: (id: string | null) => void;
  setRecordingData: (updater: (prev: Record<string, unknown>) => Record<string, unknown>) => void;
  onCreateSet: () => void;
  onConfirmDelete: (message: string, onConfirm: () => void) => void;
};

export const SelectSetModal = ({
  isOpen,
  onClose,
  userData,
  setUserData,
  setActiveTrackId,
  activeSetId,
  setActiveSetId,
  setRecordingData,
  onCreateSet,
  onConfirmDelete,
}: SelectSetModalProps) => {
  const [editingSetId, setEditingSetId] = useState<string | null>(null);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  const sets = userData.sets || [];

  const handleSetSelect = (setId: string) => {
    setActiveSetId(setId);

    const newSet = sets.find((s) => s.id === setId);
    if (newSet && newSet.tracks.length > 0) {
      const firstTrack = newSet.tracks.find((t) => t.isVisible) || newSet.tracks[0];
      setActiveTrackId(firstTrack.id);
    } else {
      setActiveTrackId(null);
    }

    onClose();
  };

  const handleDuplicateSet = (setId: string) => {
    const sourceSet = sets.find((s) => s.id === setId);
    if (!sourceSet) return;

    const randomSuffix = () => Math.random().toString(36).slice(2, 11);
    const { set: newSet, trackIdMap } = duplicateSet(
      sourceSet as unknown as Record<string, unknown>,
      {
        newId: `set_${Date.now()}_${randomSuffix()}`,
        name: duplicateName(
          sourceSet.name,
          sets.map((s) => s.name)
        ),
        makeTrackId: () => `track_${Date.now()}_${randomSuffix()}`,
        makeModuleId: () => `inst_${Date.now()}_${randomSuffix()}`,
      }
    );

    updateUserData(setUserData, (draft) => {
      const d = draft as unknown as UserData;
      const index = d.sets.findIndex((s) => s.id === setId);
      d.sets.splice(index === -1 ? d.sets.length : index + 1, 0, newSet as unknown as Set);
    });

    if (Object.keys(trackIdMap).length > 0) {
      setRecordingData((prev) => copyRecordingEntries(prev, trackIdMap));
    }
  };

  const handleDeleteSet = (setId: string) => {
    if (sets.length <= 1) {
      setAlertMessage("Cannot delete the last set.");
      return;
    }

    const setToDelete = sets.find((s) => s.id === setId);
    if (!setToDelete) return;

    onConfirmDelete(`Are you sure you want to delete "${setToDelete.name}"?`, () => {
      const trackIdsToDelete = setToDelete.tracks.map((t) => t.id);

      updateUserData(setUserData, (draft) => {
        const d = draft as unknown as UserData;
        d.sets = d.sets.filter((s) => s.id !== setId);
      });

      if (trackIdsToDelete.length > 0) {
        setRecordingData((prev) => deleteRecordingsForTracks(prev, trackIdsToDelete.map(String)));
      }

      if (activeSetId === setId) {
        const newSet = sets.find((s) => s.id !== setId);
        if (newSet) {
          setActiveSetId(newSet.id);
          if (newSet.tracks.length > 0) {
            const firstTrack = newSet.tracks.find((t) => t.isVisible) || newSet.tracks[0];
            setActiveTrackId(firstTrack.id);
          } else {
            setActiveTrackId(null);
          }
        } else {
          setActiveSetId(null);
          setActiveTrackId(null);
        }
      }
    });
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} size="small">
        <ModalHeader title="SETS" onClose={onClose} />

        <div className="flex flex-col gap-4">
          <div>
            <div className="pl-6">
              <div className="opacity-50 text-[11px] mb-1 font-mono">Select Active Set:</div>
            </div>
            <div className="pl-6">
              <div className="pl-6">
                <SortableList
                  items={sets}
                  onReorder={(oldIndex: number, newIndex: number) => {
                    updateUserData(setUserData, (draft) => {
                      const d = draft as unknown as UserData;
                      d.sets = arrayMove(d.sets, oldIndex, newIndex);
                    });
                  }}
                >
                  <div className="flex flex-col gap-2">
                    {sets.map((set) => (
                      <SortableSetItem
                        key={set.id}
                        set={set}
                        activeSetId={activeSetId}
                        onSetSelect={handleSetSelect}
                        onEdit={setEditingSetId}
                        onDuplicate={handleDuplicateSet}
                        onDelete={handleDeleteSet}
                        canDelete={sets.length > 1}
                      />
                    ))}
                  </div>
                </SortableList>
              </div>
            </div>
          </div>
        </div>

        <ModalFooter>
          <Button onClick={onCreateSet} icon={<FaPlus />}>
            Create Set
          </Button>
        </ModalFooter>
      </Modal>

      <EditSetModal
        isOpen={!!editingSetId}
        onClose={() => setEditingSetId(null)}
        setId={editingSetId}
        onAlert={setAlertMessage}
      />

      <ConfirmationModal
        isOpen={!!alertMessage}
        onClose={() => setAlertMessage(null)}
        message={alertMessage}
        type="alert"
      />
    </>
  );
};
