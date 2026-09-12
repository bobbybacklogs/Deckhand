import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { workspaceRoot } from "./workspace.js";
import { FREE_ROTATION_SENTINEL } from "./free-models.js";

export const DEFAULT_GATEWAY_MODEL = FREE_ROTATION_SENTINEL;

export type DeckhandConfig = {
  workspaces: string[];
  model: string;
  models?: string[];
  autoSync: boolean;
  commitPrefix: string;
};

const DEFAULTS = {
  workspaces: ["."],
  autoSync: false,
  commitPrefix: "",
};

const CONFIG_NAMES = ["deckhand.json", ".deckhand.json"] as const;

function envModel(): string {
  return process.env.DECKHAND_MODEL?.trim() || DEFAULT_GATEWAY_MODEL;
}

export function loadConfig(cwd?: string): DeckhandConfig {
  const root = workspaceRoot(cwd);
  for (const name of CONFIG_NAMES) {
    const path = join(root, name);
    if (!existsSync(path)) continue;
    const parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<DeckhandConfig>;
    return {
      workspaces: parsed.workspaces?.length ? parsed.workspaces : DEFAULTS.workspaces,
      model: parsed.model ?? envModel(),
      models: parsed.models?.length ? parsed.models : undefined,
      autoSync: parsed.autoSync ?? DEFAULTS.autoSync,
      commitPrefix: parsed.commitPrefix ?? DEFAULTS.commitPrefix,
    };
  }
  return {
    workspaces: DEFAULTS.workspaces,
    model: envModel(),
    autoSync: DEFAULTS.autoSync,
    commitPrefix: DEFAULTS.commitPrefix,
  };
}
