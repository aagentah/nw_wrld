import * as path from "node:path";
import { _electron as electron, type ElectronApplication } from "playwright";

export async function launchNwWrld({
  projectDir,
  env,
}: {
  projectDir: string;
  env?: Record<string, string>;
}): Promise<ElectronApplication> {
  const repoRoot = path.join(__dirname, "..", "..", "..");
  const appPath = path.join(repoRoot, "src");

  return await electron.launch({
    executablePath: require("electron") as string,
    args: [appPath],
    env: {
      ...process.env,
      NODE_ENV: "test",
      NW_WRLD_TEST_PROJECT_DIR: projectDir,
      ...(env || {}),
    },
  });
}

