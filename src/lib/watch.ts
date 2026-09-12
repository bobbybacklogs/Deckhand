import { watch as watchFiles } from "node:fs";
import { resolve } from "node:path";
import { loadConfig } from "./config.js";
import { gitStatus, type GitStatus } from "./git.js";
import { workspaceRoot } from "./workspace.js";

export type WatchHandle = {
  close: () => void;
};

export type WatchEvent = { ok: true; status: GitStatus } | { ok: false; error: string };

export async function watchWorkspace(
  cwd: string | undefined,
  onChange: (event: WatchEvent) => void,
): Promise<WatchHandle> {
  const root = workspaceRoot(cwd);
  const config = loadConfig(root);
  const watchers = config.workspaces.map((relative) => {
    const target = resolve(root, relative);
    return watchFiles(
      target,
      { recursive: true },
      debounce(800, async () => {
        try {
          onChange({ ok: true, status: await gitStatus(root) });
        } catch (error) {
          onChange({ ok: false, error: error instanceof Error ? error.message : String(error) });
        }
      }),
    );
  });

  onChange({ ok: true, status: await gitStatus(root) });

  return {
    close: () => {
      for (const watcher of watchers) watcher.close();
    },
  };
}

function debounce(ms: number, fn: () => void | Promise<void>): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      void fn();
    }, ms);
  };
}
