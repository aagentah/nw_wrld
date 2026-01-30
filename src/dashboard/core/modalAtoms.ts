import { atom } from "jotai"
import { Confirmation } from "../modals/ConfirmationModal"

export const confirmationModalAtom = atom<Confirmation>()

export const workspaceModalAtom = atom(false)
export const selectSetModalAtom = atom(false)
export const selectTrackModalAtom = atom(false)
export const createSetModalAtom = atom(false)
export const createTrackModalAtom = atom(false)
export const settingsModalAtom = atom(false)
export const inputMappingsModalAtom = atom(false)
export const releaseNotesModalAtom = atom(false)
export const addModuleModalAtom = atom<"add-to-track" | "manage-modules" | false>(false)
export const moduleEditorModalAtom = atom(false)
export const debugOverlayModalAtom = atom(false)
