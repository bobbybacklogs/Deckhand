import { resolve } from "node:path";

export function workspaceRoot(explicit?: string): string {
  return resolve(explicit ?? process.env.DECKHAND_CWD ?? process.cwd());
}
