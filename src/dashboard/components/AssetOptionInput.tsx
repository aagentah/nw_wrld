import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { Select, TextInput } from "./FormInputs";
import { CUSTOM_VALUE } from "../core/constants";
import { isPlainObject } from "../core/utils";

type Listing = { ok: boolean; files: string[]; dirs: string[] };

const listAssetsCached = (() => {
  const cache = new Map<string, Listing | Promise<Listing>>();

  return async (relDir: string): Promise<Listing> => {
    const key = String(relDir || "").trim();
    if (!key) return { ok: false, files: [], dirs: [] };

    const existing = cache.get(key);
    if (existing && typeof (existing as Promise<Listing>).then === "function") {
      try {
        return await (existing as Promise<Listing>);
      } catch {
        return { ok: false, files: [], dirs: [] };
      }
    }
    if (existing && typeof existing === "object") return existing as Listing;

    const bridge = (globalThis as { nwWrldBridge?: unknown }).nwWrldBridge;
    const workspace = isPlainObject(bridge) ? (bridge as Record<string, unknown>)["workspace"] : null;
    const listAssetsValue = isPlainObject(workspace)
      ? (workspace as Record<string, unknown>)["listAssets"]
      : null;
    const fn =
      typeof listAssetsValue === "function"
        ? (listAssetsValue as (dir: string) => Promise<unknown>)
        : null;

    const p = (async (): Promise<Listing> => {
      if (!fn) return { ok: false, files: [], dirs: [] };
      try {
        const res = await fn(key);
        const ok = isPlainObject(res) ? Boolean(res.ok) : false;
        const filesRaw = isPlainObject(res) ? (res.files as unknown) : null;
        const dirsRaw = isPlainObject(res) ? (res.dirs as unknown) : null;
        const files = Array.isArray(filesRaw)
          ? filesRaw.map((n) => String(n || "")).filter(Boolean)
          : [];
        const dirs = Array.isArray(dirsRaw)
          ? dirsRaw.map((n) => String(n || "")).filter(Boolean)
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

function hasListSyntax(value: unknown): boolean {
  const s = String(value ?? "");
  return s.includes("\n") || s.includes(",");
}

function normalizeExtSet(extensions: unknown): Set<string> {
  const list = Array.isArray(extensions) ? extensions : [];
  const out = new Set<string>();
  list.forEach((e) => {
    const raw = String(e || "").trim();
    if (!raw) return;
    const ext = raw.startsWith(".") ? raw.toLowerCase() : `.${raw.toLowerCase()}`;
    out.add(ext);
  });
  return out;
}

type AssetOptionInputProps = {
  kind?: "file" | "dir";
  baseDir?: string;
  value: unknown;
  defaultValue?: unknown;
  onChange?: ((next: string) => void) | null;
  extensions?: unknown;
  allowCustom?: boolean;
  className?: string;
};

export function isAssetOptionCustomValue({
  allowCustom,
  value,
  defaultValue,
  availableValues,
}: {
  allowCustom: boolean;
  value: unknown;
  defaultValue?: unknown;
  availableValues: Set<string>;
}): boolean {
  if (!allowCustom) return false;

  const raw = String(value ?? "").trim();
  if (!raw) return false;
  if (hasListSyntax(raw)) return true;
  if (availableValues.has(raw)) return false;
  if (availableValues.size > 0) return true;

  const def = String(defaultValue ?? "").trim();
  return raw !== def;
}

export const AssetOptionInput = memo(
  ({
    kind = "file",
    baseDir = "",
    value,
    defaultValue,
    onChange,
    extensions = null,
    allowCustom = true,
    className = "w-20 py-0.5",
  }: AssetOptionInputProps) => {
    const [listing, setListing] = useState<Listing>({ ok: false, files: [], dirs: [] });
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

    const availableValues = useMemo(() => new Set(available.map((o) => o.value)), [available]);

    useEffect(() => {
      setIsCustom(
        isAssetOptionCustomValue({
          allowCustom,
          value,
          defaultValue,
          availableValues,
        })
      );
    }, [allowCustom, availableValues, defaultValue, value]);

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
      const def = String(defaultValue ?? "").trim();
      const needsDefault = def && !availableValues.has(def);

      if (!needsDefault) return available;

      return [...available, { value: def, label: def }];
    }, [available, availableValues, defaultValue]);

    const selectValue = isCustom ? CUSTOM_VALUE : current.trim();

    return (
      <div className="flex flex-col gap-1">
        <Select
          value={selectValue}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => {
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
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              if (typeof onChange === "function") onChange(e.target.value);
            }}
            className={className}
          />
        )}
      </div>
    );
  }
);

