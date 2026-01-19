import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

export async function createTestWorkspace(): Promise<{
  dir: string;
  cleanup: () => Promise<void>;
}> {
  const base = await fs.promises.mkdtemp(path.join(os.tmpdir(), "nw-wrld-e2e-"));

  const cleanup = async () => {
    try {
      await fs.promises.rm(base, { recursive: true, force: true });
    } catch {}
  };

  return { dir: base, cleanup };
}

