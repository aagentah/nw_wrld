import React, { useState } from "react";
import { FaPlus, FaEdit, FaTrash } from "react-icons/fa";
import { Modal } from "../shared/Modal";
import { SortableWrapper } from "../shared/SortableWrapper";
import { SortableList, arrayMove } from "../shared/SortableList";
import { ModalHeader } from "../components/ModalHeader";
import { ModalFooter } from "../components/ModalFooter";
import { Button } from "../components/Button";
import { RadioButton, Label } from "../components/FormInputs";
import { updateActiveSet } from "../core/utils";
import { getActiveSetTracks, getActiveSet } from "../../shared/utils/setUtils";
import { EditTrackModal } from "./EditTrackModal";
import { deleteRecordingsForTracks } from "../../shared/json/recordingUtils";
import type { UserData, TrackId, SetId, RecordingData, Track } from "@/types";

export interface SelectTrackModalProps {
  isOpen: boolean;
  onClose: () => void;
  userData: UserData;
  setUserData: React.Dispatch<React.SetStateAction<UserData>>;
  activeTrackId: TrackId | null;
  setActiveTrackId: (id: TrackId | null) => void;
  activeSetId: SetId | null;
  recordingData: RecordingData;
  setRecordingData: React.Dispatch<React.SetStateAction<RecordingData>>;
  onCreateTrack: () => void;
  onConfirmDelete: (message: string, onConfirm: () => void) => void;
}

const SortableTrackItem = ({
  track,
  trackIndex,
  activeTrackId,
  onTrackSelect,
  onEdit,
  onDelete,
}: {
  track: Track;
  trackIndex: number;
  activeTrackId: TrackId | null;
  onTrackSelect: (id: TrackId) => void;
  onEdit: (index: number) => void;
  onDelete: (index: number) => void;
}) => {
  return (
    <SortableWrapper id={track.id}>
      {({ dragHandleProps }) => (
        <div className="flex items-center gap-3 py-2">
          <span
            className="text-neutral-300 cursor-move text-md"
            {...dragHandleProps}
          >
            {"\u2261"}
          </span>
          <RadioButton
            id={`track-${track.id}`}
            name="track-visibility"
            checked={activeTrackId === track.id}
            onChange={() => onTrackSelect(track.id)}
          />
          <label
            htmlFor={`track-${track.id}`}
            className={`uppercase cursor-pointer text-[11px] font-mono flex-1 ${
              activeTrackId === track.id
                ? "text-neutral-300"
                : "text-neutral-300/30"
            }`}
          >
            {track.name} ({track.modules?.length || 0} modules)
          </label>
          <button
            onClick={() => onEdit(trackIndex)}
            className="text-neutral-500 hover:text-neutral-300 text-[11px]"
          >
            <FaEdit />
          </button>
          <button
            onClick={() => onDelete(trackIndex)}
            className="text-neutral-500 hover:text-red-500 text-[11px]"
          >
            <FaTrash />
          </button>
        </div>
      )}
    </SortableWrapper>
  );
};

export const SelectTrackModal: React.FC<SelectTrackModalProps> = ({
  isOpen,
  onClose,
  userData,
  setUserData,
  activeTrackId,
  setActiveTrackId,
  activeSetId,
  recordingData,
  setRecordingData,
  onCreateTrack,
  onConfirmDelete,
}) => {
  const [editingTrackIndex, setEditingTrackIndex] = useState<number | null>(null);

  const tracks = getActiveSetTracks(userData, activeSetId);
  const activeSet = getActiveSet(userData, activeSetId);

  const handleTrackSelect = (trackId: TrackId) => {
    setActiveTrackId(trackId);
    onClose();
  };

  const handleDeleteTrack = (trackIndex: number) => {
    const track = tracks[trackIndex];
    if (!track) return;

    onConfirmDelete(
      `Are you sure you want to delete track "${track.name}"?`,
      () => {
        updateActiveSet(setUserData, activeSetId, (activeSet) => {
          activeSet.tracks.splice(trackIndex, 1);
        });

        setRecordingData((prev) => ({
          recordings: deleteRecordingsForTracks(prev.recordings, [String(track.id)])
        }));

        if (activeTrackId === track.id) {
          const remainingTracks = tracks.filter((t, idx) => idx !== trackIndex);
          if (remainingTracks.length > 0) {
            setActiveTrackId(remainingTracks[0].id);
          } else {
            setActiveTrackId(null);
          }
        }
      }
    );
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} size="small">
        <ModalHeader title="TRACKS" onClose={onClose} />

        <div className="px-6 flex flex-col gap-4">
          <div>
            <Label>Select Active Track:</Label>
            {tracks.length === 0 ? (
              <div className="text-neutral-500 text-[11px] font-mono py-2">
                No tracks in this set
              </div>
            ) : (
              <SortableList
                items={tracks as any}
                onReorder={(oldIndex, newIndex) => {
                  updateActiveSet(setUserData, activeSetId, (activeSet) => {
                    activeSet.tracks = arrayMove(activeSet.tracks, oldIndex, newIndex);
                  });
                }}
              >
                <div className="flex flex-col gap-2">
                  {tracks.map((track, trackIndex) => (
                    <SortableTrackItem
                      key={track.id}
                      track={track}
                      trackIndex={trackIndex}
                      activeTrackId={activeTrackId}
                      onTrackSelect={handleTrackSelect}
                      onEdit={setEditingTrackIndex}
                      onDelete={handleDeleteTrack}
                    />
                  ))}
                </div>
              </SortableList>
            )}
          </div>
        </div>

        <ModalFooter>
          <Button onClick={onCreateTrack} icon={<FaPlus />}>
            Create Track
          </Button>
        </ModalFooter>
      </Modal>

      {editingTrackIndex !== null && (
        <EditTrackModal
          isOpen={true}
          onClose={() => setEditingTrackIndex(null)}
          trackIndex={editingTrackIndex}
          inputConfig={userData.config?.input}
        />
      )}
    </>
  );
};
