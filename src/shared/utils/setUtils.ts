type Jsonish = string | number | boolean | null | undefined | object;

type SetEntry = {
  id?: unknown;
  name?: unknown;
  tracks?: unknown;
};

type UserDataLike = {
  config?: unknown;
  sets?: unknown;
  tracks?: unknown;
};

const toSpreadableObject = (value: unknown): Record<string, unknown> => {
  if (value == null) return {};
  try {
    return Object(value) as Record<string, unknown>;
  } catch {
    return {};
  }
};

export const getActiveSet = (userData: unknown, activeSetId: unknown) => {
  const ud = userData as UserDataLike | null;
  const sets = ud && Array.isArray(ud.sets) ? (ud.sets as unknown[]) : null;

  if (!ud || !sets || sets.length === 0) {
    return null;
  }

  if (activeSetId) {
    const active = sets.find((set) => {
      const s = set as SetEntry | null;
      return s ? s.id === activeSetId : false;
    });
    if (active) {
      return active;
    }
  }

  return sets[0] || null;
};

export const getActiveSetTracks = (userData: unknown, activeSetId: unknown) => {
  const activeSet = getActiveSet(userData, activeSetId) as SetEntry | null;
  const tracks = activeSet?.tracks;
  return Array.isArray(tracks) ? tracks : [];
};

export const migrateToSets = (userData: unknown) => {
  if (!userData) {
    return {
      config: {},
      sets: [],
    };
  }

  const ud = userData as UserDataLike;

  if (Array.isArray(ud.sets)) {
    return userData as Jsonish;
  }

  if (Array.isArray(ud.tracks)) {
    const migratedData = {
      ...(ud as Record<string, unknown>),
      config: {
        ...toSpreadableObject(ud.config),
        activeSetId: "set_1",
      },
      sets: [
        {
          id: "set_1",
          name: "Set 1",
          tracks: ud.tracks,
        },
      ],
    } as Record<string, unknown>;
    delete migratedData.tracks;
    return migratedData as Jsonish;
  }

  return {
    ...(ud as Record<string, unknown>),
    config: {
      ...toSpreadableObject(ud.config),
      activeSetId: null,
    },
    sets: [],
  } as Jsonish;
};

