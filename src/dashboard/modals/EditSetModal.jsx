import React, { useState, useEffect } from "react";
import { useAtom } from "jotai";
import { Modal } from "../shared/Modal.jsx";
import { ModalHeader } from "../components/ModalHeader.js";
import { ModalFooter } from "../components/ModalFooter.js";
import { Button } from "../components/Button.js";
import { TextInput, Label, ValidationError } from "../components/FormInputs.js";
import { userDataAtom } from "../core/state.js";
import { updateUserData } from "../core/utils.js";
import { useNameValidation } from "../core/hooks/useNameValidation.js";

export const EditSetModal = ({ isOpen, onClose, setId, onAlert }) => {
  const [userData, setUserData] = useAtom(userDataAtom);
  const [setName, setSetName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const sets = userData.sets || [];
  const currentSet = sets.find((s) => s.id === setId);

  const { validate } = useNameValidation(sets, setId);
  const validation = validate(setName);

  useEffect(() => {
    if (isOpen && currentSet) {
      setSetName(currentSet.name);
    } else if (!isOpen) {
      setSetName("");
    }
  }, [isOpen, currentSet]);

  if (!isOpen) return null;

  const canSubmit = validation.isValid && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      updateUserData(setUserData, (draft) => {
        const set = draft.sets.find((s) => s.id === setId);
        if (set) {
          set.name = setName.trim();
        }
      });
      onClose();
    } catch (e) {
      console.error("Error updating set:", e);
      if (onAlert) onAlert("Failed to update set.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalHeader title="EDIT SET" onClose={onClose} />

      <div className="px-6 flex flex-col gap-4">
        <div>
          <Label>Set Name</Label>
          <TextInput
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
        <Button onClick={onClose} type="secondary">
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={!canSubmit}>
          {submitting ? "Saving..." : "Save Changes"}
        </Button>
      </ModalFooter>
    </Modal>
  );
};

