import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { takeNextModel } from "./lib/router.js";
import { workspaceRoot } from "./lib/workspace.js";

function packageRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..");
}

function withNodeOption(flag: string): string {
  const existing = process.env.NODE_OPTIONS ?? "";
  const tokens = existing.split(/\s+/).filter(Boolean);
  if (tokens.includes(flag)) return existing;
  return [...tokens, flag].join(" ");
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

export async function startEveDev(): Promise<number> {
  const root = packageRoot();
  const cwd = workspaceRoot();
  const model = await takeNextModel(cwd);
  const child = spawn(process.execPath, [eveBin(), "dev"], {
    cwd: existsSync(join(root, "agent")) ? root : cwd,
    env: {
      ...process.env,
      DECKHAND_CWD: cwd,
      DECKHAND_MODEL: model,
      NODE_OPTIONS: withNodeOption("--disable-warning=DEP0190"),
    },
    stdio: "inherit",
    windowsHide: false,
  });

  return new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => resolve(code ?? 1));
  });
}
