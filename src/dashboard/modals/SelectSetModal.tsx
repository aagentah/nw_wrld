import React, { useState } from "react";
import { FaPlus, FaEdit, FaTrash } from "react-icons/fa";
import { Modal } from "../shared/Modal";
import { SortableWrapper } from "../shared/SortableWrapper";
import { SortableList, arrayMove } from "../shared/SortableList";
import { ModalHeader } from "../components/ModalHeader";
import { ModalFooter } from "../components/ModalFooter";
import { Button } from "../components/Button";
import { RadioButton, Label } from "../components/FormInputs";
import { updateUserData } from "../core/utils";
import { EditSetModal } from "./EditSetModal";
import { ConfirmationModal } from "./ConfirmationModal";
import { deleteRecordingsForTracks } from "../../shared/json/recordingUtils";
import type { UserData, SetId, TrackId, RecordingData } from "@/types";

export interface SelectSetModalProps {
  isOpen: boolean;
  onClose: () => void;
  userData: UserData;
  setUserData: React.Dispatch<React.SetStateAction<UserData>>;
  activeTrackId: TrackId | null;
  setActiveTrackId: (id: TrackId | null) => void;
  activeSetId: SetId | null;
  setActiveSetId: (id: SetId | null) => void;
  recordingData: RecordingData;
  setRecordingData: React.Dispatch<React.SetStateAction<RecordingData>>;
  onCreateSet: () => void;
  onConfirmDelete: (message: string, onConfirm: () => void) => void;
}

const SortableSetItem = ({
  set,
  activeSetId,
  onSetSelect,
  onEdit,
  onDelete,
  canDelete,
}: {
  set: { id: SetId; name: string; tracks: unknown[] };
  activeSetId: SetId | null;
  onSetSelect: (id: SetId) => void;
  onEdit: (id: SetId) => void;
  onDelete: (id: SetId) => void;
  canDelete: boolean;
}) => {
  return (
    <SortableWrapper id={set.id}>
      {({ dragHandleProps }) => (
        <div className="flex items-center gap-3 py-2">
          <span
            className="text-neutral-300 cursor-move text-md"
            {...dragHandleProps}
          >
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
              activeSetId === set.id
                ? "text-neutral-300"
                : "text-neutral-300/30"
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
            onClick={() => onDelete(set.id)}
            className="text-neutral-500 hover:text-red-500 text-[11px]"
            disabled={!canDelete}
          >
            <FaTrash />
          </button>
        </div>
      )}
    </SortableWrapper>
  );
};

export const SelectSetModal: React.FC<SelectSetModalProps> = ({
  isOpen,
  onClose,
  userData,
  setUserData,
  activeTrackId,
  setActiveTrackId,
  activeSetId,
  setActiveSetId,
  recordingData,
  setRecordingData,
  onCreateSet,
  onConfirmDelete,
}) => {
  const [editingSetId, setEditingSetId] = useState<SetId | null>(null);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  const sets = userData.sets || [];

  const handleSetSelect = (setId: SetId) => {
    setActiveSetId(setId);

    const newSet = sets.find((s) => s.id === setId);
    if (newSet && newSet.tracks.length > 0) {
      const firstTrack =
        newSet.tracks.find((t: any) => t.isVisible) || newSet.tracks[0];
      setActiveTrackId((firstTrack as any).id);
    } else {
      setActiveTrackId(null);
    }

    onClose();
  };

  const handleDeleteSet = (setId: SetId) => {
    if (sets.length <= 1) {
      setAlertMessage("Cannot delete the last set.");
      return;
    }

    const setToDelete = sets.find((s) => s.id === setId);
    if (!setToDelete) return;

    onConfirmDelete(
      `Are you sure you want to delete "${setToDelete.name}"?`,
      () => {
        const trackIdsToDelete = setToDelete.tracks.map((t: any) => t.id);

        updateUserData(setUserData, (draft) => {
          draft.sets = draft.sets.filter((s) => s.id !== setId);
        });

        if (trackIdsToDelete.length > 0) {
          setRecordingData((prev) => ({
            recordings: deleteRecordingsForTracks(prev.recordings, trackIdsToDelete)
          }));
        }

        if (activeSetId === setId) {
          const newSet = sets.find((s) => s.id !== setId);
          if (newSet) {
            setActiveSetId(newSet.id);
            if (newSet.tracks.length > 0) {
              const firstTrack =
                newSet.tracks.find((t: any) => t.isVisible) || newSet.tracks[0];
              setActiveTrackId(firstTrack.id);
            } else {
              setActiveTrackId(null);
            }
          } else {
            setActiveSetId(null);
            setActiveTrackId(null);
          }
        }
      }
    );
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} size="small">
        <ModalHeader title="SETS" onClose={onClose} />

        <div className="px-6 flex flex-col gap-4">
          <div>
            <Label>Select Active Set:</Label>
            <SortableList
              items={sets}
              onReorder={(oldIndex, newIndex) => {
                updateUserData(setUserData, (draft) => {
                  draft.sets = arrayMove(draft.sets, oldIndex, newIndex);
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
                    onDelete={handleDeleteSet}
                    canDelete={sets.length > 1}
                  />
                ))}
              </div>
            </SortableList>
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
        message={alertMessage || ""}
        type="alert"
      />
    </>
  );
};
