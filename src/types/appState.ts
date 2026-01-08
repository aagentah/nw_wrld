import type { SetId, TrackId } from "./userData";

export interface AppState {
  activeTrackId: TrackId | null;
  activeSetId: SetId | null;
  sequencerMuted?: boolean;
}
