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
import {
  parsePitchClass,
  pitchClassToName,
  resolveTrackTrigger,
} from "../../shared/midi/midiUtils";
import { useAtom, useSetAtom } from "jotai";
import { confirmationModalAtom, createTrackModalAtom, editTrackModalAtom, selectTrackModalAtom } from "../core/modalAtoms";

type Track = {
  id: string | number;
  name: string;
};

type SortableTrackItemProps = {
  track: Track;
  trackIndex: number;
  activeTrackId: string | number | null;
  inputType: string;
  globalMappings: Record<string, unknown>;
  onTrackSelect: (id: string | number) => void;
  onDelete: (index: number) => void;
};

const SortableTrackItem = ({
  track,
  trackIndex,
  activeTrackId,
  inputType,
  globalMappings,
  onTrackSelect,
  onDelete,
}: SortableTrackItemProps) => {
  const setEditTrack = useSetAtom(editTrackModalAtom)
  return (
    <SortableWrapper id={track.id}>
      {({ dragHandleProps, isDragging: _isDragging }) => (
        <div className="flex items-center gap-3 py-2">
          <span className="text-neutral-300 cursor-move text-md" {...dragHandleProps}>
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
              activeTrackId === track.id ? "text-neutral-300" : "text-neutral-300/30"
            }`}
          >
            {(() => {
              const rawTrigger = resolveTrackTrigger(track, inputType, globalMappings);
              const trigger =
                inputType === "midi" &&
                rawTrigger !== "" &&
                rawTrigger !== null &&
                rawTrigger !== undefined
                  ? (() => {
                      const inputUnknown = (globalMappings as Record<string, unknown>)?.input;
                      const noteMatchMode =
                        typeof inputUnknown === "object" &&
                        inputUnknown !== null &&
                        (inputUnknown as Record<string, unknown>)?.noteMatchMode === "exactNote"
                          ? "exactNote"
                          : "pitchClass";
                      if (noteMatchMode === "exactNote") return String(rawTrigger);
                      const pc =
                        typeof rawTrigger === "number" ? rawTrigger : parsePitchClass(rawTrigger);
                      if (pc === null) return String(rawTrigger);
                      return pitchClassToName(pc) || String(pc);
                    })()
                  : rawTrigger;
              return trigger !== "" && trigger !== null && trigger !== undefined
                ? `${track.name} [${trigger}]`
                : `${track.name}`;
            })()}
          </label>
          <button
            onClick={() => setEditTrack({isOpen: true, trackIndex})}
            className="text-neutral-500 hover:text-neutral-300 text-[11px]"
          >
            <FaEdit />
          </button>
          <button
            onClick={() => onDelete(trackIndex)}
            className="text-neutral-500 hover:text-red-500 text-[11px]"
            data-testid="delete-track"
            aria-label="Delete track"
          >
            <FaTrash />
          </button>
        </div>
      )}
    </SortableWrapper>
  );
};

type UserData = {
  config?: {
    input?: Record<string, unknown>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

type SelectTrackModalProps = {
  userData: UserData;
  setUserData: (updater: unknown) => void;
  activeTrackId: string | number | null;
  setActiveTrackId: (id: string | number | null) => void;
  activeSetId: string | null;
  recordingData: Record<string, unknown>;
  setRecordingData: (updater: (prev: Record<string, unknown>) => Record<string, unknown>) => void;
};

export const SelectTrackModal = ({
  userData,
  setUserData,
  activeTrackId,
  setActiveTrackId,
  activeSetId,
  recordingData: _recordingData,
  setRecordingData,
}: SelectTrackModalProps) => {
  const [isOpen, setIsOpen] = useAtom(selectTrackModalAtom)
  const [_, setCreateTrackIsOpen] = useAtom(createTrackModalAtom)
  const setConfirmationModal = useSetAtom(confirmationModalAtom)
  const onClose = () => setIsOpen(false)

  const tracks = getActiveSetTracks(userData, activeSetId);
  const _activeSet = getActiveSet(userData, activeSetId);
  const inputType = userData?.config?.input?.type || "midi";
  const globalMappings = userData?.config || {};

  const handleTrackSelect = (trackId: string | number) => {
    setActiveTrackId(trackId);
    onClose();
  };

  const handleCreateTrack = () => {
    onClose()
    setCreateTrackIsOpen(true);
  }

  const handleDeleteTrack = (trackIndex: number) => {
    const track = tracks[trackIndex];
    if (!track) return;

    const onConfirm = () => {
      updateActiveSet(setUserData, activeSetId, (activeSet) => {
        const tracksUnknown = (activeSet as Record<string, unknown>).tracks;
        if (Array.isArray(tracksUnknown)) {
          tracksUnknown.splice(trackIndex, 1);
        }
      });

      setRecordingData((prev) => deleteRecordingsForTracks(prev, [track.id]));

      if (activeTrackId === track.id) {
        const remainingTracks = tracks.filter((t, idx) => idx !== trackIndex);
        if (remainingTracks.length > 0) {
          setActiveTrackId(remainingTracks[0].id);
        } else {
          setActiveTrackId(null);
        }
      }
    }
    setConfirmationModal({
      message: `Are you sure you want to delete track "${track.name}"?`,
      onConfirm
    });
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
                items={tracks}
                onReorder={(oldIndex: number, newIndex: number) => {
                  updateActiveSet(setUserData, activeSetId, (activeSet) => {
                    const tracksUnknown = (activeSet as Record<string, unknown>).tracks;
                    if (Array.isArray(tracksUnknown)) {
                      (activeSet as Record<string, unknown>).tracks = arrayMove(
                        tracksUnknown,
                        oldIndex,
                        newIndex
                      );
                    }
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
                      inputType={String(inputType)}
                      globalMappings={globalMappings}
                      onTrackSelect={handleTrackSelect}
                      onDelete={handleDeleteTrack}
                    />
                  ))}
                </div>
              </SortableList>
            )}
          </div>
        </div>

        <ModalFooter>
          <Button onClick={handleCreateTrack} icon={<FaPlus />}>
            Create Track
          </Button>
        </ModalFooter>
      </Modal>

      <EditTrackModal inputConfig={userData.config?.input || {}} />
    </>
  );
};
