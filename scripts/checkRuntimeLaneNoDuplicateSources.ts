import * as fs from "node:fs";
import * as path from "node:path";

function fileExists(p: string): boolean {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

function readJson(p: string): unknown {
  const raw = fs.readFileSync(p, "utf-8");
  return JSON.parse(raw) as unknown;
}

type Offender = {
  runtime: string;
  duplicates: string[];
};

export function findOffenders(repoRoot: string, tsconfigPath: string): Offender[] {
  const tsconfigRaw = readJson(tsconfigPath);
  const includesRaw =
    tsconfigRaw && typeof tsconfigRaw === "object" && "include" in tsconfigRaw
      ? (tsconfigRaw as { include?: unknown }).include
      : undefined;
  const includes = Array.isArray(includesRaw) ? includesRaw : [];

  const runtimeSources = includes
    .filter((p): p is string => typeof p === "string")
    .filter((p) => p.endsWith(".ts") || p.endsWith(".cts") || p.endsWith(".mts"));

  const offenders: Offender[] = [];
  for (const rel of runtimeSources) {
    const abs = path.join(repoRoot, rel);
    const dir = path.dirname(abs);
    const base = path.basename(abs).replace(/\.(cts|mts|ts)$/i, "");

    const js = path.join(dir, `${base}.js`);
    const cjs = path.join(dir, `${base}.cjs`);
    const mjs = path.join(dir, `${base}.mjs`);

    const dupes = [js, cjs, mjs].filter(fileExists);
    if (dupes.length) {
      offenders.push({
        runtime: path.relative(repoRoot, abs),
        duplicates: dupes.map((p) => path.relative(repoRoot, p)),
      });
    }
  }

  return offenders;
}

function main(): void {
  const cwdRoot = path.resolve(process.cwd());
  const cwdTsconfig = path.join(cwdRoot, "tsconfig.runtime.json");

  const repoRoot = fileExists(cwdTsconfig) ? cwdRoot : path.resolve(__dirname, "..", "..");
  const tsconfigPath = path.join(repoRoot, "tsconfig.runtime.json");
  const offenders = findOffenders(repoRoot, tsconfigPath);

  if (offenders.length) {
    console.error(
      "[runtime-ts] Duplicate source implementations detected for runtime lane modules."
    );
    for (const o of offenders) {
      console.error(`- ${o.runtime}`);
      for (const d of o.duplicates) console.error(`  - ${d}`);
    }
    console.error(
      "[runtime-ts] Fix: update consumers to use dist/runtime/** output and remove the legacy JS/CJS sources."
    );
    process.exitCode = 1;
    return;
  }

  process.exitCode = 0;
}

main();
