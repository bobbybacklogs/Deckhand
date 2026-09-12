import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { generateText } from "ai";
import { loadConfig, type DeckhandConfig } from "./config.js";
import {
  CURATED_FREE_LANGUAGE_MODELS,
  fetchFreeLanguageModels,
  FREE_ROTATION_SENTINEL,
} from "./free-models.js";

type RouterState = {
  nextIndex: number;
  cooldownUntil: Record<string, number>;
};

const STATE_PATH = join(homedir(), ".deckhand", "router.json");
const COOLDOWN_MS = 60_000;

function loadState(): RouterState {
  try {
    const parsed = JSON.parse(readFileSync(STATE_PATH, "utf8")) as Partial<RouterState>;
    return {
      nextIndex: typeof parsed.nextIndex === "number" ? parsed.nextIndex : 0,
      cooldownUntil: parsed.cooldownUntil && typeof parsed.cooldownUntil === "object" ? parsed.cooldownUntil : {},
    };
  } catch {
    return { nextIndex: 0, cooldownUntil: {} };
  }
}

function saveState(state: RouterState): void {
  mkdirSync(dirname(STATE_PATH), { recursive: true });
  writeFileSync(STATE_PATH, `${JSON.stringify(state)}\n`);
}

export function isPinnedModel(config: DeckhandConfig = loadConfig()): boolean {
  const model = config.model.trim();
  return model.length > 0 && model !== FREE_ROTATION_SENTINEL;
}

export async function resolveModelPool(cwd?: string): Promise<string[]> {
  const config = loadConfig(cwd);
  if (config.models?.length) {
    return [...new Set(config.models)];
  }
  if (isPinnedModel(config)) {
    return [config.model];
  }
  const live = await fetchFreeLanguageModels();
  return live.length > 0 ? live : [...CURATED_FREE_LANGUAGE_MODELS];
}

function rotateOrder(pool: string[], start: number): string[] {
  if (pool.length === 0) return [];
  const index = ((start % pool.length) + pool.length) % pool.length;
  return [...pool.slice(index), ...pool.slice(0, index)];
}

function isCoolingDown(state: RouterState, model: string, now: number): boolean {
  const until = state.cooldownUntil[model] ?? 0;
  return until > now;
}

export async function orderedModels(cwd?: string): Promise<string[]> {
  const pool = await resolveModelPool(cwd);
  const state = loadState();
  const now = Date.now();
  const rotated = rotateOrder(pool, state.nextIndex);
  const ready = rotated.filter((model) => !isCoolingDown(state, model, now));
  return ready.length > 0 ? ready : rotated;
}

export function rememberRotation(used: string, pool: string[]): void {
  if (pool.length === 0) return;
  const state = loadState();
  const usedIndex = pool.indexOf(used);
  state.nextIndex = usedIndex >= 0 ? (usedIndex + 1) % pool.length : (state.nextIndex + 1) % pool.length;
  saveState(state);
}

function markCooldown(model: string): void {
  const state = loadState();
  state.cooldownUntil[model] = Date.now() + COOLDOWN_MS;
  saveState(state);
}

export function isRotatableError(error: unknown): boolean {
  const status =
    typeof error === "object" && error !== null && "statusCode" in error
      ? Number((error as { statusCode: unknown }).statusCode)
      : typeof error === "object" && error !== null && "status" in error
        ? Number((error as { status: unknown }).status)
        : undefined;
  if (status === 429 || status === 402 || status === 503) return true;
  const message = error instanceof Error ? error.message : String(error);
  return /429|402|rate limit|quota|insufficient.?credit|payment required|free tier|credits? exhausted|model .*not (available|allowed)/i.test(
    message,
  );
}

export async function takeNextModel(cwd?: string): Promise<string> {
  const pool = await resolveModelPool(cwd);
  const ordered = await orderedModels(cwd);
  const model = ordered[0] ?? pool[0];
  if (!model) {
    throw new Error("No AI Gateway models available for the Eve session");
  }
  rememberRotation(model, pool);
  return model;
}

export async function generateGatewayText(prompt: string, cwd?: string): Promise<string> {
  const pool = await orderedModels(cwd);
  if (pool.length === 0) {
    throw new Error("No AI Gateway models available. Set DECKHAND_MODEL or check https://ai-gateway.vercel.sh/v1/models");
  }

  let lastError: unknown;
  for (const [index, model] of pool.entries()) {
    const fallbacks = pool.filter((candidate) => candidate !== model);
    try {
      const { text } = await generateText({
        model,
        prompt,
        providerOptions: {
          gateway: {
            models: fallbacks,
          },
        },
      });
      rememberRotation(model, pool);
      return text.trim();
    } catch (error) {
      lastError = error;
      if (!isRotatableError(error) || index === pool.length - 1) {
        throw error;
      }
      markCooldown(model);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("All free Gateway models failed");
}

export async function describeRouter(cwd?: string): Promise<string> {
  const config = loadConfig(cwd);
  const pool = await resolveModelPool(cwd);
  if (config.models?.length) {
    return `rotating ${pool.join(", ")}`;
  }
  if (isPinnedModel(config)) {
    return `pinned ${config.model}`;
  }
  return `rotating ${pool.length} free models (${pool.join(", ")})`;
}
