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

function normalizeModules(value: Jsonish): { modules: Jsonish[]; changed: boolean } {
  const list = isArray(value) ? value : [];
  const out: Jsonish[] = [];
  let changed = !isArray(value);
  for (const m of list) {
    if (!isPlainObject(m)) {
      changed = true;
      continue;
    }
    const id = asNonEmptyString(m.id);
    const type = asNonEmptyString(m.type);
    if (!id || !type) {
      changed = true;
      continue;
    }

    const hasDisabledKey = Object.prototype.hasOwnProperty.call(m, "disabled");
    const disabledIsTrue = (m as Record<string, Jsonish>).disabled === true;

    const needsIdType = m.id !== id || m.type !== type;
    const needsDisabled = hasDisabledKey && !disabledIsTrue;

    if (!needsIdType && !needsDisabled) {
      out.push(m);
      continue;
    }

    changed = true;
    const next: Record<string, Jsonish> = { ...m, id, type };
    if (!disabledIsTrue) delete next.disabled;
    out.push(next);
  }
  return { modules: out, changed };
}

function normalizeTrack(value: Jsonish): Jsonish | null {
  if (!isPlainObject(value)) return null;
  let changed = false;
  let out: Record<string, Jsonish> = value;
  const ensure = () => {
    if (out === value) out = { ...value };
    changed = true;
  };

  const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);
  const clampInt = (n: number, min: number, max: number) => (n < min ? min : n > max ? max : n);
  const normalizeThreshold = (v: unknown, fallback: number) => {
    if (typeof v !== "number") return fallback;
    if (!Number.isFinite(v)) return fallback;
    return clamp01(v);
  };
  const normalizeIntervalMs = (v: unknown, fallback: number) => {
    if (typeof v !== "number") return fallback;
    if (!Number.isFinite(v)) return fallback;
    const n = Math.round(v);
    return clampInt(n, 0, 10_000);
  };
  const normalizeString = (v: unknown) => {
    if (typeof v !== "string") return "";
    const s = v.trim();
    return s ? s : "";
  };
  const DEFAULT_THRESHOLD = 0.5;
  const DEFAULT_MIN_INTERVAL_MS = 120;

  const { modules, changed: modulesChanged } = normalizeModules(out.modules);
  if (modulesChanged) {
    ensure();
    out.modules = modules;
  }

  if (!isPlainObject(out.modulesData)) {
    ensure();
    out.modulesData = {};
  }

  if (!isPlainObject(out.channelMappings)) {
    ensure();
    out.channelMappings = {};
  }

  let cm = out.channelMappings as Record<string, Jsonish>;
  const valid = new Set<number>();
  for (const k of Object.keys(cm)) {
    const n = parseInt(k, 10);
    if (!Number.isFinite(n)) continue;
    if (n < 1 || n > 12) continue;
    if (String(n) !== k) continue;
    valid.add(n);
  }

  if (valid.size < 3) {
    ensure();
    cm = { ...cm };
    out.channelMappings = cm;
    for (let slot = 1; slot <= 12 && valid.size < 3; slot++) {
      if (valid.has(slot)) continue;
      const key = String(slot);
      cm[key] = slot;
      valid.add(slot);
    }
  }

  const rawSignal = out.signal;
  const signalObj = isPlainObject(rawSignal) ? (rawSignal as Record<string, Jsonish>) : null;
  const rawAudio =
    signalObj && isPlainObject(signalObj.audio)
      ? (signalObj.audio as Record<string, Jsonish>)
      : null;
  const rawFile =
    signalObj && isPlainObject(signalObj.file) ? (signalObj.file as Record<string, Jsonish>) : null;

  const normalizeBandThresholds = (t: unknown) => {
    const obj =
      t && typeof t === "object" && !Array.isArray(t) ? (t as Record<string, unknown>) : null;
    const low = normalizeThreshold(obj ? obj.low : undefined, DEFAULT_THRESHOLD);
    const medium = normalizeThreshold(obj ? obj.medium : undefined, DEFAULT_THRESHOLD);
    const high = normalizeThreshold(obj ? obj.high : undefined, DEFAULT_THRESHOLD);
    return { low, medium, high };
  };

  const nextSignal = {
    audio: {
      thresholds: normalizeBandThresholds(rawAudio ? rawAudio.thresholds : undefined),
      minIntervalMs: normalizeIntervalMs(
        rawAudio ? rawAudio.minIntervalMs : undefined,
        DEFAULT_MIN_INTERVAL_MS
      ),
    },
    file: {
      thresholds: normalizeBandThresholds(rawFile ? rawFile.thresholds : undefined),
      minIntervalMs: normalizeIntervalMs(
        rawFile ? rawFile.minIntervalMs : undefined,
        DEFAULT_MIN_INTERVAL_MS
      ),
      assetRelPath: normalizeString(rawFile ? rawFile.assetRelPath : undefined),
      assetName: normalizeString(rawFile ? rawFile.assetName : undefined),
    },
  };

  const _existingSignal = signalObj ? (signalObj as unknown) : null;
  const needsSignal =
    !signalObj ||
    !isPlainObject(rawAudio) ||
    !isPlainObject(rawFile) ||
    !isPlainObject(rawAudio ? rawAudio.thresholds : null) ||
    !isPlainObject(rawFile ? rawFile.thresholds : null) ||
    (rawAudio ? rawAudio.minIntervalMs : undefined) !== nextSignal.audio.minIntervalMs ||
    (rawFile ? rawFile.minIntervalMs : undefined) !== nextSignal.file.minIntervalMs ||
    (rawFile ? rawFile.assetRelPath : undefined) !== nextSignal.file.assetRelPath ||
    (rawFile ? rawFile.assetName : undefined) !== nextSignal.file.assetName ||
    (rawAudio && isPlainObject(rawAudio.thresholds)
      ? (rawAudio.thresholds as Record<string, unknown>).low !== nextSignal.audio.thresholds.low ||
        (rawAudio.thresholds as Record<string, unknown>).medium !==
          nextSignal.audio.thresholds.medium ||
        (rawAudio.thresholds as Record<string, unknown>).high !== nextSignal.audio.thresholds.high
      : true) ||
    (rawFile && isPlainObject(rawFile.thresholds)
      ? (rawFile.thresholds as Record<string, unknown>).low !== nextSignal.file.thresholds.low ||
        (rawFile.thresholds as Record<string, unknown>).medium !==
          nextSignal.file.thresholds.medium ||
        (rawFile.thresholds as Record<string, unknown>).high !== nextSignal.file.thresholds.high
      : true);

  if (needsSignal) {
    ensure();
    out.signal = nextSignal as unknown as Jsonish;
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

export function sanitizeUserDataForBridge(value: Jsonish, defaultValue: Jsonish): Jsonish {
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

  let cfg = out.config as Record<string, Jsonish>;
  const ensureConfig = () => {
    const originalCfg =
      value && typeof value === "object"
        ? ((value as Record<string, Jsonish>).config as unknown)
        : null;
    if (cfg === originalCfg) {
      ensure();
      cfg = { ...cfg };
      out.config = cfg;
    }
  };
  const fallbackCfg = isPlainObject(fallback.config)
    ? (fallback.config as Record<string, Jsonish>)
    : {};

  const fallbackTrackMappings = isPlainObject(fallbackCfg.trackMappings)
    ? (fallbackCfg.trackMappings as Record<string, Jsonish>)
    : {};
  if (!isPlainObject(cfg.trackMappings)) {
    ensureConfig();
    ensure();
    cfg.trackMappings = fallbackTrackMappings;
  } else {
    const tm = cfg.trackMappings as Record<string, Jsonish>;
    if (!isPlainObject(tm.audio)) {
      ensureConfig();
      ensure();
      cfg.trackMappings = { ...tm, audio: {} };
    }
    if (!isPlainObject((cfg.trackMappings as Record<string, Jsonish>).file)) {
      const tm2 = cfg.trackMappings as Record<string, Jsonish>;
      ensureConfig();
      ensure();
      cfg.trackMappings = { ...tm2, file: {} };
    }
  }

  const fallbackChannelMappings = isPlainObject(fallbackCfg.channelMappings)
    ? (fallbackCfg.channelMappings as Record<string, Jsonish>)
    : {};
  if (!isPlainObject(cfg.channelMappings)) {
    ensureConfig();
    ensure();
    cfg.channelMappings = fallbackChannelMappings;
  } else {
    const cm = cfg.channelMappings as Record<string, Jsonish>;
    if (!isPlainObject(cm.audio)) {
      const fallbackAudio = isPlainObject(fallbackChannelMappings.audio)
        ? (fallbackChannelMappings.audio as Record<string, Jsonish>)
        : {};
      ensureConfig();
      ensure();
      cfg.channelMappings = { ...cm, audio: fallbackAudio };
    }
    if (!isPlainObject((cfg.channelMappings as Record<string, Jsonish>).file)) {
      const cm2 = cfg.channelMappings as Record<string, Jsonish>;
      const fallbackFile = isPlainObject(fallbackChannelMappings.file)
        ? (fallbackChannelMappings.file as Record<string, Jsonish>)
        : {};
      ensureConfig();
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
    out.sets = setsOut.length ? setsOut : isArray(fallback.sets) ? fallback.sets : [];
  }

  return changed ? out : value;
}
