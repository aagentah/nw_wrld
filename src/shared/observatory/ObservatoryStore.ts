import * as fs from "node:fs";
import * as path from "node:path";

import { atomicWriteFileSync } from "../json/atomicWrite";
import { parseObservatoryGraphFile } from "../validation/observatoryGraphValidation";
import { applyEvent, startCapture } from "./contract";
import { OBSERVATORY_CONTRACT_VERSION } from "./types";
import type {
  ApplyEventResult,
  ObservatoryEventInput,
  ObservatoryState,
  PrivateEvidenceGraph,
  StartCaptureInput,
  StartCaptureResult,
} from "./types";

type ObservatoryStateListener = (state: ObservatoryState) => void;
type LoadResult = { loaded: number; skipped: number };

/**
 * Persistence boundary for operator-instrumented private evidence graphs.
 * Nothing creates the graphs directory before an explicit operator opt-in.
 */
export class ObservatoryStore {
  private readonly graphsDir: string;
  private readonly graphsBySourceRunId = new Map<string, PrivateEvidenceGraph>();
  private readonly listeners = new Set<ObservatoryStateListener>();

  constructor(rootDir: string) {
    this.graphsDir = path.join(rootDir, "graphs");
  }

  getState(): ObservatoryState {
    return {
      contractVersion: OBSERVATORY_CONTRACT_VERSION,
      runs: [...this.graphsBySourceRunId.values()].sort((left, right) => {
        const updatedAtOrder = right.updatedAt.localeCompare(left.updatedAt);
        return (
          updatedAtOrder || left.identity.sourceRunId.localeCompare(right.identity.sourceRunId)
        );
      }),
    };
  }

  loadAll(): LoadResult {
    if (!fs.existsSync(this.graphsDir)) return { loaded: 0, skipped: 0 };

    const loadedGraphs = new Map<string, PrivateEvidenceGraph>();
    let skipped = 0;
    const fileNames = fs
      .readdirSync(this.graphsDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => entry.name)
      .sort();

    for (const fileName of fileNames) {
      try {
        const raw = JSON.parse(
          fs.readFileSync(path.join(this.graphsDir, fileName), "utf8")
        ) as unknown;
        const graph = parseObservatoryGraphFile(raw);
        if (!graph) throw new Error("invalid graph contract");
        if (fileName !== `${graph.identity.sourceRunId}.json`) {
          throw new Error("source-run identity does not match file name");
        }
        if (loadedGraphs.has(graph.identity.sourceRunId)) {
          throw new Error("duplicate source-run identity");
        }
        loadedGraphs.set(graph.identity.sourceRunId, graph);
      } catch (error) {
        skipped += 1;
        const reason = error instanceof Error ? error.message : String(error);
        console.error(`ObservatoryStore skipped ${fileName}: ${reason}`);
      }
    }

    this.graphsBySourceRunId.clear();
    for (const [sourceRunId, graph] of loadedGraphs) {
      this.graphsBySourceRunId.set(sourceRunId, graph);
    }
    return { loaded: loadedGraphs.size, skipped };
  }

  startCapture(input: StartCaptureInput): StartCaptureResult {
    const result = startCapture(input);
    if (!result.ok) return result;

    fs.mkdirSync(this.graphsDir, { recursive: true });
    this.persist(result.graph);
    this.graphsBySourceRunId.set(result.graph.identity.sourceRunId, result.graph);
    this.notify();
    return result;
  }

  recordEvent(
    sourceRunId: string,
    input: ObservatoryEventInput
  ): ApplyEventResult | { ok: false; code: "NOT_INSTRUMENTED" } {
    const graph = this.graphsBySourceRunId.get(sourceRunId);
    if (!graph) return { ok: false, code: "NOT_INSTRUMENTED" };

    const result = applyEvent(graph, input);
    if (!result.ok) return result;

    this.persist(result.graph);
    this.graphsBySourceRunId.set(sourceRunId, result.graph);
    this.notify();
    return result;
  }

  subscribe(listener: ObservatoryStateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private persist(graph: PrivateEvidenceGraph): void {
    const filePath = path.join(this.graphsDir, `${graph.identity.sourceRunId}.json`);
    atomicWriteFileSync(filePath, `${JSON.stringify(graph)}\n`);
  }

  private notify(): void {
    const state = this.getState();
    for (const listener of this.listeners) listener(state);
  }
}
