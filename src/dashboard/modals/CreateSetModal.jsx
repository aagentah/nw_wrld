import React, { useState, useEffect } from "react";
import { useAtom } from "jotai";
import { Modal } from "../shared/Modal.jsx";
import { ModalHeader } from "../components/ModalHeader";
import { ModalFooter } from "../components/ModalFooter";
import { Button } from "../components/Button";
import { TextInput, Label, ValidationError } from "../components/FormInputs";
import { useNameValidation } from "../core/hooks/useNameValidation";
import {
  userDataAtom,
  activeTrackIdAtom,
  activeSetIdAtom,
} from "../core/state.ts";
import { updateUserData } from "../core/utils";

export const CreateSetModal = ({ isOpen, onClose, onAlert }) => {
  const [userData, setUserData] = useAtom(userDataAtom);
  const [, setActiveTrackId] = useAtom(activeTrackIdAtom);
  const [, setActiveSetId] = useAtom(activeSetIdAtom);
  const [setName, setSetName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const sets = userData.sets || [];

  const { validate } = useNameValidation(sets);
  const validation = validate(setName);

  useEffect(() => {
    if (!isOpen) {
      setSetName("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const canSubmit = validation.isValid && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const newSetId = `set_${Date.now()}`;
      updateUserData(setUserData, (draft) => {
        if (!Array.isArray(draft.sets)) {
          draft.sets = [];
        }
        draft.sets.push({
          id: newSetId,
          name: setName.trim(),
          tracks: [],
        });
      });

      setActiveSetId(newSetId);
      setActiveTrackId(null);
      onClose();
    } catch (e) {
      console.error("Error creating set:", e);
      if (onAlert) onAlert("Failed to create set.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalHeader title="CREATE SET" onClose={onClose} />

      <div className="flex flex-col gap-4 p-6">
        <div>
          <Label htmlFor="set-name">Set Name</Label>
          <TextInput
            id="set-name"
            value={setName}
            onChange={(e) => setSetName(e.target.value)}
            placeholder="Enter set name"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && canSubmit) {
                handleSubmit();
              }
            }}
          />
          <ValidationError value={setName} validation={validation} />
        </div>
      </div>

      <ModalFooter>
        <Button onClick={onClose} type="secondary">Cancel</Button>
        <Button onClick={handleSubmit} disabled={!canSubmit}>
          {submitting ? "Creating..." : "Create Set"}
        </Button>
      </ModalFooter>
    </Modal>
  );
};
