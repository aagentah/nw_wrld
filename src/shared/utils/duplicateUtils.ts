type JsonRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is JsonRecord =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const deepCopy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const COPY_SUFFIX = /\s*\(Copy(?: \d+)?\)$/i;

export const duplicateName = (sourceName: string, existingNames: Iterable<string>): string => {
  const taken = new Set<string>();
  for (const name of existingNames) {
    if (typeof name === "string") taken.add(name.trim().toLowerCase());
  }
  const base = sourceName.replace(COPY_SUFFIX, "").trim();
  for (let n = 1; ; n++) {
    const candidate = n === 1 ? `${base} (Copy)` : `${base} (Copy ${n})`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
};

type DuplicateTrackOptions = {
  newId: string;
  name: string;
  trackSlot: number | null;
  makeModuleId: () => string;
};

export const duplicateTrack = (track: JsonRecord, options: DuplicateTrackOptions): JsonRecord => {
  const copy = deepCopy(track);
  copy.id = options.newId;
  copy.name = options.name;
  if (options.trackSlot !== null) {
    copy.trackSlot = options.trackSlot;
  }

  const modules = Array.isArray(copy.modules) ? (copy.modules as unknown[]) : [];
  const modulesData = isRecord(copy.modulesData) ? copy.modulesData : null;
  const remapped: JsonRecord = {};
  for (const moduleInstance of modules) {
    if (!isRecord(moduleInstance)) continue;
    const oldId = typeof moduleInstance.id === "string" ? moduleInstance.id : null;
    const newId = options.makeModuleId();
    moduleInstance.id = newId;
    if (oldId && modulesData && oldId in modulesData) {
      remapped[newId] = modulesData[oldId];
    }
  }
  if (modulesData) {
    copy.modulesData = remapped;
  }
  return copy;
};

type DuplicateSetOptions = {
  newId: string;
  name: string;
  makeTrackId: () => string;
  makeModuleId: () => string;
};

export const duplicateSet = (
  set: JsonRecord,
  options: DuplicateSetOptions
): { set: JsonRecord; trackIdMap: Record<string, string> } => {
  const tracks = Array.isArray(set.tracks) ? (set.tracks as unknown[]) : [];
  const trackIdMap: Record<string, string> = {};
  const newTracks: JsonRecord[] = [];
  for (const track of tracks) {
    if (!isRecord(track)) continue;
    const oldId = track.id == null ? null : String(track.id);
    const newTrack = duplicateTrack(track, {
      newId: options.makeTrackId(),
      name: typeof track.name === "string" ? track.name : "",
      trackSlot: null,
      makeModuleId: options.makeModuleId,
    });
    if (oldId) trackIdMap[oldId] = String(newTrack.id);
    newTracks.push(newTrack);
  }
  const copy = deepCopy(set);
  copy.id = options.newId;
  copy.name = options.name;
  copy.tracks = newTracks;
  return { set: copy, trackIdMap };
};

export const duplicateModuleInstanceInTrack = (
  track: JsonRecord,
  instanceId: string,
  newInstanceId: string
): boolean => {
  const modules = Array.isArray(track.modules) ? (track.modules as unknown[]) : null;
  if (!modules) return false;
  const index = modules.findIndex(
    (m) => isRecord(m) && String((m as JsonRecord).id ?? "") === instanceId
  );
  if (index === -1) return false;

  const sourceInstance = modules[index] as JsonRecord;
  const newInstance = deepCopy(sourceInstance);
  newInstance.id = newInstanceId;
  modules.splice(index + 1, 0, newInstance);

  const modulesData = isRecord(track.modulesData) ? track.modulesData : null;
  if (modulesData && instanceId in modulesData) {
    modulesData[newInstanceId] = deepCopy(modulesData[instanceId]);
  }
  return true;
};

export const copyRecordingEntries = (
  recordings: Record<string, unknown>,
  trackIdMap: Record<string, string>
): Record<string, unknown> => {
  const result: Record<string, unknown> = { ...recordings };
  for (const [oldId, newId] of Object.entries(trackIdMap)) {
    if (oldId in recordings) {
      result[newId] = deepCopy(recordings[oldId]);
    }
  }
  return result;
};
