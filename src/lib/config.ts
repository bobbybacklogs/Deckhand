import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { workspaceRoot } from "./workspace.js";

export const DEFAULT_GATEWAY_MODEL = "openai/gpt-5.6-luna-fast";

export type DeckhandConfig = {
  workspaces: string[];
  model: string;
  autoSync: boolean;
  commitPrefix: string;
};

const DEFAULTS: DeckhandConfig = {
  workspaces: ["."],
  model: process.env.DECKHAND_MODEL ?? DEFAULT_GATEWAY_MODEL,
  autoSync: false,
  commitPrefix: "",
};

const CONFIG_NAMES = ["deckhand.json", ".deckhand.json"] as const;

export function loadConfig(cwd?: string): DeckhandConfig {
  const root = workspaceRoot(cwd);
  for (const name of CONFIG_NAMES) {
    const path = join(root, name);
    if (!existsSync(path)) continue;
    const parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<DeckhandConfig>;
    return {
      workspaces: parsed.workspaces?.length ? parsed.workspaces : DEFAULTS.workspaces,
      model: parsed.model ?? DEFAULTS.model,
      autoSync: parsed.autoSync ?? DEFAULTS.autoSync,
      commitPrefix: parsed.commitPrefix ?? DEFAULTS.commitPrefix,
    };
  }
  return { ...DEFAULTS };
}
