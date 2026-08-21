export type ReloadTarget =
  | { action: "select"; trackName: string }
  | { action: "empty"; message: string };

// A null/empty trackName means the active set has no selected track: show an empty
// state rather than falling back to the previously active track (which belongs to a
// different set and would surface as "Track X not found").
export function resolveReloadTarget(
  propsTrackName: unknown,
  trackCount: unknown
): ReloadTarget {
  const name = propsTrackName != null ? String(propsTrackName).trim() : "";
  if (name) {
    return { action: "select", trackName: name };
  }
  const count =
    typeof trackCount === "number" && Number.isFinite(trackCount) ? trackCount : 0;
  return {
    action: "empty",
    message: count > 0 ? "No track selected" : "No tracks in this set",
  };
}
