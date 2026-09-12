import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { workspaceRoot } from "./lib/workspace.js";

function packageRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..");
}

function eveBin(): string {
  const require = createRequire(import.meta.url);
  const evePackage = dirname(require.resolve("eve/package.json"));
  const candidates = [
    join(evePackage, "bin", "eve.js"),
    join(evePackage, "bin", "eve.mjs"),
    join(evePackage, "dist", "bin", "eve.js"),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return "eve";
}

export function startEveDev(): Promise<number> {
  const root = packageRoot();
  const cwd = workspaceRoot();
  const child = spawn(process.execPath, [eveBin(), "dev"], {
    cwd: existsSync(join(root, "agent")) ? root : cwd,
    env: {
      ...process.env,
      DECKHAND_CWD: cwd,
    },
    stdio: "inherit",
    windowsHide: false,
  });

  return new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => resolve(code ?? 1));
  });
}
