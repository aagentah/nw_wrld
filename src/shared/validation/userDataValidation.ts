type Jsonish = string | number | boolean | null | undefined | object;

function isPlainObject(value: Jsonish): value is Record<string, Jsonish> {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.prototype.toString.call(value) === "[object Object]"
  );
}

function isArray(value: Jsonish): value is Jsonish[] {
  return Array.isArray(value);
}

function asNonEmptyString(value: Jsonish): string | null {
  if (typeof value !== "string") return null;
  const s = value.trim();
  return s ? s : null;
}

function defaultUserData(defaultValue: Jsonish): Record<string, Jsonish> {
  if (isPlainObject(defaultValue)) return defaultValue;
  return { config: {}, sets: [] };
}

function normalizeModules(value: Jsonish): Jsonish[] {
  const list = isArray(value) ? value : [];
  const out: Jsonish[] = [];
  for (const m of list) {
    if (!isPlainObject(m)) continue;
    const id = asNonEmptyString(m.id);
    const type = asNonEmptyString(m.type);
    if (!id || !type) continue;
    out.push({ ...m, id, type });
  }
  return out;
}

function normalizeTrack(value: Jsonish): Jsonish | null {
  if (!isPlainObject(value)) return null;
  let changed = false;
  let out: Record<string, Jsonish> = value;
  const ensure = () => {
    if (out === value) out = { ...value };
    changed = true;
  };

  const modules = normalizeModules(out.modules);
  if (
    !isArray(out.modules) ||
    modules.length !== (out.modules as Jsonish[]).length
  ) {
    ensure();
    out.modules = modules;
  }

  if (!isPlainObject(out.modulesData)) {
    ensure();
    out.modulesData = {};
  }

  if (!isPlainObject(out.channelMappings) && out.channelMappings != null) {
    ensure();
    out.channelMappings = {};
  }

  return changed ? out : value;
}

function normalizeSet(value: Jsonish, index: number): Jsonish | null {
  if (!isPlainObject(value)) return null;
  let changed = false;
  let out: Record<string, Jsonish> = value;
  const ensure = () => {
    if (out === value) out = { ...value };
    changed = true;
  };

  const id = asNonEmptyString(out.id) || `set_${index + 1}`;
  if (out.id !== id) {
    ensure();
    out.id = id;
  }

  const name = asNonEmptyString(out.name) || `Set ${index + 1}`;
  if (out.name !== name) {
    ensure();
    out.name = name;
  }

  const tracksRaw = isArray(out.tracks) ? out.tracks : [];
  if (!isArray(out.tracks)) {
    ensure();
    out.tracks = tracksRaw;
  }

  const tracksOut: Jsonish[] = [];
  let tracksChanged = false;
  for (const t of tracksRaw) {
    const nt = normalizeTrack(t);
    if (!nt) {
      tracksChanged = true;
      continue;
    }
    tracksOut.push(nt);
    if (nt !== t) tracksChanged = true;
  }

  if (tracksChanged) {
    ensure();
    out.tracks = tracksOut;
  }

  return changed ? out : value;
}

export function sanitizeUserDataForBridge(
  value: Jsonish,
  defaultValue: Jsonish
): Jsonish {
  const fallback = defaultUserData(defaultValue);
  if (!isPlainObject(value)) return fallback;

  let changed = false;
  let out: Record<string, Jsonish> = value;
  const ensure = () => {
    if (out === value) out = { ...value };
    changed = true;
  };

  if (!isPlainObject(out.config)) {
    ensure();
    out.config = isPlainObject(fallback.config) ? fallback.config : {};
  }

  const cfg = out.config as Record<string, Jsonish>;
  const fallbackCfg = isPlainObject(fallback.config)
    ? (fallback.config as Record<string, Jsonish>)
    : {};

  const fallbackTrackMappings = isPlainObject(fallbackCfg.trackMappings)
    ? (fallbackCfg.trackMappings as Record<string, Jsonish>)
    : {};
  if (!isPlainObject(cfg.trackMappings)) {
    ensure();
    cfg.trackMappings = fallbackTrackMappings;
  } else {
    const tm = cfg.trackMappings as Record<string, Jsonish>;
    if (!isPlainObject(tm.audio)) {
      ensure();
      cfg.trackMappings = { ...tm, audio: {} };
    }
    if (!isPlainObject((cfg.trackMappings as Record<string, Jsonish>).file)) {
      const tm2 = cfg.trackMappings as Record<string, Jsonish>;
      ensure();
      cfg.trackMappings = { ...tm2, file: {} };
    }
  }

  const fallbackChannelMappings = isPlainObject(fallbackCfg.channelMappings)
    ? (fallbackCfg.channelMappings as Record<string, Jsonish>)
    : {};
  if (!isPlainObject(cfg.channelMappings)) {
    ensure();
    cfg.channelMappings = fallbackChannelMappings;
  } else {
    const cm = cfg.channelMappings as Record<string, Jsonish>;
    if (!isPlainObject(cm.audio)) {
      const fallbackAudio = isPlainObject(fallbackChannelMappings.audio)
        ? (fallbackChannelMappings.audio as Record<string, Jsonish>)
        : {};
      ensure();
      cfg.channelMappings = { ...cm, audio: fallbackAudio };
    }
    if (!isPlainObject((cfg.channelMappings as Record<string, Jsonish>).file)) {
      const cm2 = cfg.channelMappings as Record<string, Jsonish>;
      const fallbackFile = isPlainObject(fallbackChannelMappings.file)
        ? (fallbackChannelMappings.file as Record<string, Jsonish>)
        : {};
      ensure();
      cfg.channelMappings = { ...cm2, file: fallbackFile };
    }
  }

  let setsRaw: Jsonish[] = [];
  if (isArray(out.sets)) {
    setsRaw = out.sets;
  } else if (isArray((out as Record<string, Jsonish>).tracks)) {
    setsRaw = [
      {
        id: "set_1",
        name: "Set 1",
        tracks: (out as Record<string, Jsonish>).tracks,
      },
    ];
    ensure();
    out.sets = setsRaw;
  } else {
    setsRaw = isArray(fallback.sets) ? fallback.sets : [];
    ensure();
    out.sets = setsRaw;
  }

  const setsOut: Jsonish[] = [];
  let setsChanged = false;
  for (let i = 0; i < setsRaw.length; i++) {
    const s = setsRaw[i];
    const ns = normalizeSet(s, i);
    if (!ns) {
      setsChanged = true;
      continue;
    }
    setsOut.push(ns);
    if (ns !== s) setsChanged = true;
  }

  if (setsChanged) {
    ensure();
    out.sets = setsOut.length
      ? setsOut
      : isArray(fallback.sets)
      ? fallback.sets
      : [];
  }

  return changed ? out : value;
}
