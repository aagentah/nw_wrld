import { useIPCListener } from "./useIPC";

type PerfStats = { fps: number; frameMsAvg: number; longFramePct: number; at: number };

export const useProjectorPerfStats = (setPerfStats: (next: PerfStats) => void) => {
  useIPCListener("from-projector", (_event, data: unknown) => {
    if (!data || typeof data !== "object") return;
    const dataObj = data as Record<string, unknown>;
    if (dataObj.type !== "perf:stats") return;
    const p = dataObj.props;
    if (!p || typeof p !== "object") return;
    const pObj = p as Record<string, unknown>;
    const fps = typeof pObj.fps === "number" && Number.isFinite(pObj.fps) ? pObj.fps : null;
    const frameMsAvg =
      typeof pObj.frameMsAvg === "number" && Number.isFinite(pObj.frameMsAvg)
        ? pObj.frameMsAvg
        : null;
    const longFramePct =
      typeof pObj.longFramePct === "number" && Number.isFinite(pObj.longFramePct)
        ? pObj.longFramePct
        : 0;
    const at = typeof pObj.at === "number" && Number.isFinite(pObj.at) ? pObj.at : null;
    if (fps == null || frameMsAvg == null || at == null) return;
    setPerfStats({ fps, frameMsAvg, longFramePct, at });
  });
};

