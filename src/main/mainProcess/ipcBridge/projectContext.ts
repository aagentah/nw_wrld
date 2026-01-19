import { state } from "../state";

export type WebContentsWithId = { id?: unknown };
export type SenderEvent = { sender?: WebContentsWithId };

export const getProjectDirForEvent = (event: SenderEvent): string | null => {
  try {
    const senderId = event?.sender?.id;
    if (typeof senderId === "number" && state.webContentsToProjectDir.has(senderId)) {
      return state.webContentsToProjectDir.get(senderId) || null;
    }
  } catch {}
  return state.currentProjectDir || null;
};

