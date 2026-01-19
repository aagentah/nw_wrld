import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "nw_wrld:updateCheck:v1";
const CHECK_TTL_MS = 6 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 5000;

const getBridge = () => globalThis.nwWrldBridge;

const normalizeVersion = (v: unknown) => {
  const s = String(v || "").trim();
  return s.startsWith("v") || s.startsWith("V") ? s.slice(1) : s;
};

type SemverishOk = {
  raw: string;
  ok: true;
  major: number;
  minor: number;
  patch: number;
  pre: string[];
};

type SemverishBad = {
  raw: string;
  ok: false;
};

type Semverish = SemverishOk | SemverishBad;

const parseSemverish = (raw: unknown): Semverish => {
  const v = normalizeVersion(raw);
  const match = v.match(
    /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+([0-9A-Za-z.-]+))?$/
  );
  if (!match) {
    return { raw: v, ok: false };
  }
  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);
  const pre = match[4] ? String(match[4]).split(".") : [];
  return { raw: v, ok: true, major, minor, patch, pre };
};

const comparePreSegments = (aSegs: unknown, bSegs: unknown) => {
  const a = Array.isArray(aSegs) ? aSegs : [];
  const b = Array.isArray(bSegs) ? bSegs : [];
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const as = a[i];
    const bs = b[i];
    if (as == null && bs == null) return 0;
    if (as == null) return -1;
    if (bs == null) return 1;

    const aNum = String(as).match(/^\d+$/) ? Number(as) : null;
    const bNum = String(bs).match(/^\d+$/) ? Number(bs) : null;

    if (aNum != null && bNum != null) {
      if (aNum !== bNum) return aNum < bNum ? -1 : 1;
      continue;
    }
    if (aNum != null && bNum == null) return -1;
    if (aNum == null && bNum != null) return 1;

    const aStr = String(as);
    const bStr = String(bs);
    if (aStr === bStr) continue;
    return aStr < bStr ? -1 : 1;
  }
  return 0;
};

const compareVersions = (aRaw: unknown, bRaw: unknown) => {
  const a = parseSemverish(aRaw);
  const b = parseSemverish(bRaw);

  if (a.ok && b.ok) {
    if (a.major !== b.major) return a.major < b.major ? -1 : 1;
    if (a.minor !== b.minor) return a.minor < b.minor ? -1 : 1;
    if (a.patch !== b.patch) return a.patch < b.patch ? -1 : 1;

    const aHasPre = a.pre.length > 0;
    const bHasPre = b.pre.length > 0;
    if (!aHasPre && !bHasPre) return 0;
    if (!aHasPre && bHasPre) return 1;
    if (aHasPre && !bHasPre) return -1;
    return comparePreSegments(a.pre, b.pre);
  }

  const aS = String(normalizeVersion(aRaw));
  const bS = String(normalizeVersion(bRaw));
  if (aS === bS) return 0;
  return aS < bS ? -1 : 1;
};

type RepoInfo = { owner: string; repo: string } | null;

const parseRepoFromUrl = (repoUrl: unknown): RepoInfo => {
  const raw = String(repoUrl || "").trim();
  if (!raw) return null;
  const normalized = raw.replace(/^git\+/i, "");

  try {
    const u = new URL(normalized);
    if (!u.hostname.endsWith("github.com")) return null;
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    const owner = parts[0];
    const repo = parts[1].replace(/\.git$/i, "");
    if (!owner || !repo) return null;
    return { owner, repo };
  } catch {
    return null;
  }
};

const safeReadCache = (key: string) => {
  try {
    const raw = globalThis.localStorage?.getItem?.(key);
    if (!raw) return null;
    const data = JSON.parse(raw) as unknown;
    return data && typeof data === "object" ? (data as Record<string, unknown>) : null;
  } catch {
    return null;
  }
};

const safeWriteCache = (key: string, data: unknown) => {
  try {
    globalThis.localStorage?.setItem?.(key, JSON.stringify(data));
  } catch {}
};

type UpdateCheckStatus =
  | "idle"
  | "checking"
  | "upToDate"
  | "updateAvailable"
  | "noStable"
  | "error";

type UpdateCheckState = {
  status: UpdateCheckStatus;
  currentVersion: string | null;
  latestStableVersion: string | null;
  latestStableUrl: string | null;
  releasesUrl: string | null;
  checkedAt: number | null;
};

export const useUpdateCheck = () => {
  const [state, setState] = useState<UpdateCheckState>({
    status: "idle",
    currentVersion: null,
    latestStableVersion: null,
    latestStableUrl: null,
    releasesUrl: null,
    checkedAt: null,
  });

  const repoInfo = useMemo(() => {
    const bridge = getBridge();
    const repoUrl =
      bridge && bridge.app && typeof bridge.app.getRepositoryUrl === "function"
        ? bridge.app.getRepositoryUrl()
        : null;
    return parseRepoFromUrl(repoUrl);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const run = async () => {
      const bridge = getBridge();
      const currentVersion =
        bridge && bridge.app && typeof bridge.app.getVersion === "function"
          ? bridge.app.getVersion()
          : null;

      if (!repoInfo?.owner || !repoInfo?.repo) {
        if (!cancelled) {
          setState((prev) => ({
            ...prev,
            status: "error",
            currentVersion: currentVersion || prev.currentVersion,
          }));
        }
        return;
      }

      const releasesUrl = `https://github.com/${repoInfo.owner}/${repoInfo.repo}/releases`;
      const cache = safeReadCache(STORAGE_KEY);
      const now = Date.now();

      const cached =
        cache &&
        cache.repo === `${repoInfo.owner}/${repoInfo.repo}` &&
        typeof cache.checkedAt === "number" &&
        now - cache.checkedAt < CHECK_TTL_MS
          ? cache
          : null;

      if (cached && cached.latestStableVersion && cached.latestStableUrl) {
        const latestStableVersion = String(cached.latestStableVersion);
        const cmp =
          currentVersion && latestStableVersion
            ? compareVersions(currentVersion, latestStableVersion)
            : 0;
        const updateAvailable = cmp < 0;
        if (!cancelled) {
          setState({
            status: updateAvailable ? "updateAvailable" : "upToDate",
            currentVersion: currentVersion || null,
            latestStableVersion,
            latestStableUrl: String(cached.latestStableUrl),
            releasesUrl,
            checkedAt: typeof cached.checkedAt === "number" ? cached.checkedAt : null,
          });
        }
        return;
      }

      if (!cancelled) {
        setState((prev) => ({
          ...prev,
          status: "checking",
          currentVersion: currentVersion || prev.currentVersion,
          releasesUrl,
        }));
      }

      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const apiUrl = `https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/releases?per_page=10&page=1`;
        const res = await fetch(apiUrl, {
          method: "GET",
          headers: {
            Accept: "application/vnd.github+json",
          },
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error(`HTTP_${res.status}`);
        }

        const json = (await res.json()) as unknown;
        const releases = Array.isArray(json) ? json : [];
        const published = releases.filter((r) => r && (r as Record<string, unknown>).draft !== true);
        const stable =
          published.find((r) => (r as Record<string, unknown>).prerelease !== true) || null;

        const latestStableVersion =
          stable && (stable as Record<string, unknown>).tag_name
            ? String((stable as Record<string, unknown>).tag_name)
            : null;
        const latestStableUrl =
          stable && (stable as Record<string, unknown>).html_url
            ? String((stable as Record<string, unknown>).html_url)
            : null;

        if (!latestStableVersion || !latestStableUrl) {
          if (!cancelled) {
            setState({
              status: "noStable",
              currentVersion: currentVersion || null,
              latestStableVersion: null,
              latestStableUrl: null,
              releasesUrl,
              checkedAt: now,
            });
          }
          safeWriteCache(STORAGE_KEY, {
            repo: `${repoInfo.owner}/${repoInfo.repo}`,
            checkedAt: now,
            latestStableVersion: null,
            latestStableUrl: null,
          });
          return;
        }

        const cmp =
          currentVersion && latestStableVersion
            ? compareVersions(currentVersion, latestStableVersion)
            : 0;
        const updateAvailable = cmp < 0;

        const next: UpdateCheckState = {
          status: updateAvailable ? "updateAvailable" : "upToDate",
          currentVersion: currentVersion || null,
          latestStableVersion,
          latestStableUrl,
          releasesUrl,
          checkedAt: now,
        };

        safeWriteCache(STORAGE_KEY, {
          repo: `${repoInfo.owner}/${repoInfo.repo}`,
          checkedAt: now,
          latestStableVersion,
          latestStableUrl,
        });

        if (!cancelled) setState(next);
      } catch {
        if (!cancelled) {
          setState((prev) => ({
            ...prev,
            status: prev.latestStableVersion ? prev.status : "error",
            currentVersion: currentVersion || prev.currentVersion,
            releasesUrl,
          }));
        }
      } finally {
        clearTimeout(timeout);
      }
    };

    const t = setTimeout(() => {
      run();
    }, 750);

    return () => {
      cancelled = true;
      try {
        controller.abort();
      } catch {}
      clearTimeout(t);
    };
  }, [repoInfo?.owner, repoInfo?.repo]);

  return state;
};

