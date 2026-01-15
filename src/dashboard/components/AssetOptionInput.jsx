import React, { useEffect, useMemo, useRef, useState } from "react";
import { Select, TextInput } from "./FormInputs";

const CUSTOM_VALUE = "__nw_wrld_custom__";

const listAssetsCached = (() => {
  const cache = new Map();

  return async (relDir) => {
    const key = String(relDir || "").trim();
    if (!key) return { ok: false, files: [], dirs: [] };

    const existing = cache.get(key);
    if (existing && typeof existing.then === "function") {
      try {
        return await existing;
      } catch {
        return { ok: false, files: [], dirs: [] };
      }
    }
    if (existing && typeof existing === "object") return existing;

    const bridge = globalThis.nwWrldBridge;
    const fn =
      bridge &&
      bridge.workspace &&
      typeof bridge.workspace.listAssets === "function"
        ? bridge.workspace.listAssets
        : null;

    const p = (async () => {
      if (!fn) return { ok: false, files: [], dirs: [] };
      try {
        const res = await fn(key);
        const ok = Boolean(res?.ok);
        const files = Array.isArray(res?.files)
          ? res.files.map((n) => String(n || "")).filter(Boolean)
          : [];
        const dirs = Array.isArray(res?.dirs)
          ? res.dirs.map((n) => String(n || "")).filter(Boolean)
          : [];
        return { ok, files, dirs };
      } catch {
        return { ok: false, files: [], dirs: [] };
      }
    })();

    cache.set(key, p);
    const resolved = await p;
    cache.set(key, resolved);
    return resolved;
  };
})();

const hasListSyntax = (value) => {
  const s = String(value ?? "");
  return s.includes("\n") || s.includes(",");
};

const normalizeExtSet = (extensions) => {
  const list = Array.isArray(extensions) ? extensions : [];
  const out = new Set();
  list.forEach((e) => {
    const raw = String(e || "").trim();
    if (!raw) return;
    const ext = raw.startsWith(".") ? raw.toLowerCase() : `.${raw.toLowerCase()}`;
    out.add(ext);
  });
  return out;
};

export const AssetOptionInput = React.memo(
  ({
    kind = "file",
    baseDir = "",
    value,
    onChange,
    extensions = null,
    allowCustom = true,
    className = "w-20 py-0.5",
  }) => {
    const [listing, setListing] = useState({ ok: false, files: [], dirs: [] });
    const [isCustom, setIsCustom] = useState(false);
    const didAutoPickRef = useRef(false);

    const base = String(baseDir || "").replace(/\/+$/, "");
    const relDir = base;

    const extSet = useMemo(() => normalizeExtSet(extensions), [extensions]);

    useEffect(() => {
      let cancelled = false;
      listAssetsCached(relDir).then((res) => {
        if (cancelled) return;
        setListing(res);
      });
      return () => {
        cancelled = true;
      };
    }, [relDir]);

    const available = useMemo(() => {
      if (kind === "dir") {
        const baseOpt = base ? [{ value: base, label: `${base}/` }] : [];
        const dirs = (listing.dirs || [])
          .map((name) => String(name || "").trim())
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b))
          .map((name) => ({
            value: base ? `${base}/${name}` : name,
            label: name,
          }));
        return [...baseOpt, ...dirs];
      }

      return (listing.files || [])
        .map((name) => String(name || "").trim())
        .filter(Boolean)
        .filter((name) => {
          if (!extSet || extSet.size === 0) return true;
          const dot = name.lastIndexOf(".");
          if (dot <= 0) return false;
          return extSet.has(name.slice(dot).toLowerCase());
        })
        .sort((a, b) => a.localeCompare(b))
        .map((name) => ({
          value: base ? `${base}/${name}` : name,
          label: name,
        }));
    }, [base, extSet, kind, listing.dirs, listing.files]);

    const availableValues = useMemo(
      () => new Set(available.map((o) => o.value)),
      [available]
    );

    useEffect(() => {
      if (!allowCustom) {
        setIsCustom(false);
        return;
      }
      const raw = String(value ?? "").trim();
      if (!raw) {
        setIsCustom(false);
        return;
      }
      if (hasListSyntax(raw)) {
        setIsCustom(true);
        return;
      }
      if (!availableValues.has(raw)) {
        setIsCustom(true);
        return;
      }
      setIsCustom(false);
    }, [allowCustom, availableValues, value]);

    const current = String(value ?? "");

    useEffect(() => {
      if (kind !== "dir") return;
      if (!allowCustom) return;
      if (didAutoPickRef.current) return;
      if (!available.length) return;
      const raw = String(value ?? "").trim();
      if (!raw) return;
      if (!/\/yourFolder$/i.test(raw)) return;
      didAutoPickRef.current = true;
      if (typeof onChange === "function") onChange(available[0].value);
    }, [allowCustom, available, kind, onChange, value]);

    const options = useMemo(() => {
      if (!current.trim() || availableValues.has(current.trim())) return available;
      return [{ value: current.trim(), label: current.trim() }, ...available];
    }, [available, availableValues, current]);

    const selectValue = isCustom ? CUSTOM_VALUE : current.trim();

    return (
      <div className="flex flex-col gap-1">
        <Select
          value={selectValue}
          onChange={(e) => {
            const next = e.target.value;
            if (next === CUSTOM_VALUE) {
              setIsCustom(true);
              return;
            }
            setIsCustom(false);
            if (typeof onChange === "function") onChange(next);
          }}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-[#101010]">
              {opt.label}
            </option>
          ))}
          {allowCustom && (
            <option value={CUSTOM_VALUE} className="bg-[#101010]">
              custom…
            </option>
          )}
        </Select>

        {allowCustom && isCustom && (
          <TextInput
            value={current}
            onChange={(e) => {
              if (typeof onChange === "function") onChange(e.target.value);
            }}
            className={className}
          />
        )}
      </div>
    );
  }
);


