import React, { useState, useEffect } from "react";
import { useAtom } from "jotai";
import { Modal } from "../shared/Modal";
import { ModalHeader } from "../components/ModalHeader";
import { ModalFooter } from "../components/ModalFooter";
import { Button } from "../components/Button";
import { TextInput, Label, ValidationError } from "../components/FormInputs";
import { userDataAtom } from "../core/state";
import { updateUserData } from "../core/utils";
import { useNameValidation } from "../core/hooks/useNameValidation";

type EditSetModalProps = {
  isOpen: boolean;
  onClose: () => void;
  setId: string | null;
  onAlert?: ((message: string) => void) | null;
};

type SetLike = {
  id?: unknown;
  name?: unknown;
};

export const EditSetModal = ({ isOpen, onClose, setId, onAlert }: EditSetModalProps) => {
  const [userData, setUserData] = useAtom(userDataAtom);
  const [setName, setSetName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const sets = Array.isArray(userData.sets)
    ? (userData.sets as Array<Record<string, unknown>>)
    : [];
  const currentSet = (sets as unknown[]).find((s) => (s as SetLike | null)?.id === setId) as
    | SetLike
    | undefined;

  const { validate } = useNameValidation(sets, setId);
  const validation = validate(setName);

  useEffect(() => {
    if (isOpen && currentSet) {
      setSetName(typeof currentSet.name === "string" ? currentSet.name : "");
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
      updateUserData(setUserData, (draft: unknown) => {
        const d = draft as Record<string, unknown>;
        const draftSets = Array.isArray(d.sets) ? (d.sets as unknown[]) : [];
        const set = draftSets.find((s) => (s as SetLike | null)?.id === setId) as
          | (SetLike & Record<string, unknown>)
          | undefined;
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

