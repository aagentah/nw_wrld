import { Modal } from "../shared/Modal";
import { ModalHeader } from "./ModalHeader";
import { ModalFooter } from "./ModalFooter";
import { Button } from "./Button";

type WorkspaceGateModalProps = {
  isOpen: boolean;
  mode: "initial" | "lostSync";
  workspacePath: string | null;
  workspaceModalPath: string | null;
  onSelectWorkspace: () => void;
};

export const WorkspaceGateModal = ({
  isOpen,
  mode,
  workspacePath,
  workspaceModalPath,
  onSelectWorkspace,
}: WorkspaceGateModalProps) => {
  return (
    <Modal isOpen={isOpen} onClose={() => {}}>
      <ModalHeader
        title={mode === "lostSync" ? "PROJECT FOLDER NOT FOUND" : `Welcome to "nw_wrld"`}
        onClose={() => {}}
        showClose={false}
        uppercase={mode === "lostSync"}
        containerClassName="justify-center"
        titleClassName="block w-full text-center"
      />
      <div className="flex flex-col gap-4">
        <div className="text-neutral-400">
          {mode === "lostSync"
            ? "We lost sync with your project folder. It may have been moved or renamed. Reopen the project folder to continue."
            : "Open or create a project to begin. This project folder will contain your modules and performance data."}
        </div>
        {mode === "lostSync" ? null : (
          <div className="text-neutral-500">
            PS: This app is currently in beta and changes frequently. Projects created with earlier
            versions may not load correctly; backwards compatibility is not guaranteed until a
            stable release.
          </div>
        )}
        {workspaceModalPath || workspacePath ? (
          <div className="text-neutral-300/50 break-all">{workspaceModalPath || workspacePath}</div>
        ) : null}
      </div>
      <ModalFooter justify={mode === "lostSync" ? "end" : "center"}>
        <Button type="secondary" onClick={onSelectWorkspace}>
          {mode === "lostSync" ? "REOPEN PROJECT" : "OPEN PROJECT"}
        </Button>
      </ModalFooter>
    </Modal>
  );
};

