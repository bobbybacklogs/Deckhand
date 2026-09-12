export const GATEWAY_MODELS_URL = "https://ai-gateway.vercel.sh/v1/models";

/** Language models tagged free with tool-use, used when the live catalog is unreachable. */
export const CURATED_FREE_LANGUAGE_MODELS = [
  "inclusionai/ling-3.0-flash-fin-free",
  "inclusionai/ling-3.0-flash-sante-free",
  "inclusionai/ling-3.0-flash-vl-free",
  "poolside/laguna-s-2.1-free",
] as const;

export const FREE_ROTATION_SENTINEL = "free";

type GatewayPricing = {
  input?: string;
  output?: string;
};

type GatewayModel = {
  id?: string;
  type?: string;
  name?: string;
  tags?: string[];
  pricing?: GatewayPricing;
};

type GatewayModelList = {
  data?: GatewayModel[];
};

const FETCH_MS = 8_000;
let cachedPool: { at: number; models: string[] } | undefined;
const CACHE_MS = 10 * 60 * 1000;

function isZeroPrice(value: string | undefined): boolean {
  if (value === undefined || value === "") return false;
  const amount = Number(value);
  return Number.isFinite(amount) && amount === 0;
}

function isFreeLanguageModel(model: GatewayModel): boolean {
  if (model.type !== "language" || typeof model.id !== "string" || !model.id.includes("/")) {
    return false;
  }
  const tags = model.tags ?? [];
  const id = model.id.toLowerCase();
  const name = (model.name ?? "").toLowerCase();
  const taggedFree =
    tags.includes("free") || id.endsWith("-free") || id.includes("-free-") || name.includes("(free)");
  const zeroPrice = isZeroPrice(model.pricing?.input) && isZeroPrice(model.pricing?.output);
  if (!taggedFree && !zeroPrice) return false;
  return tags.includes("tool-use");
}

function preferExplicitFreeIds(ids: string[]): string[] {
  const set = new Set(ids);
  return ids.filter((id) => {
    if (id.endsWith("-free")) return true;
    return !set.has(`${id}-free`);
  });
}

function orderPool(ids: string[]): string[] {
  const unique = [...new Set(ids)];
  const curated: string[] = CURATED_FREE_LANGUAGE_MODELS.filter((id) => unique.includes(id));
  const rest = unique.filter((id) => !curated.includes(id));
  rest.sort((a, b) => a.localeCompare(b));
  return [...curated, ...rest];
}

export function parseFreeLanguageModelIds(payload: unknown): string[] {
  const list = (payload as GatewayModelList | undefined)?.data;
  if (!Array.isArray(list)) return [...CURATED_FREE_LANGUAGE_MODELS];
  const ids = list.filter(isFreeLanguageModel).map((model) => model.id as string);
  const preferred = preferExplicitFreeIds(ids);
  return preferred.length > 0 ? orderPool(preferred) : [...CURATED_FREE_LANGUAGE_MODELS];
}

export async function fetchFreeLanguageModels(): Promise<string[]> {
  const now = Date.now();
  if (cachedPool && now - cachedPool.at < CACHE_MS) {
    return cachedPool.models;
  }

  try {
    const response = await fetch(GATEWAY_MODELS_URL, {
      signal: AbortSignal.timeout(FETCH_MS),
      headers: { accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(`Gateway models HTTP ${response.status}`);
    }
    const models = parseFreeLanguageModelIds(await response.json());
    cachedPool = { at: now, models };
    return models;
  } catch {
    const fallback = [...CURATED_FREE_LANGUAGE_MODELS];
    cachedPool = { at: now, models: fallback };
    return fallback;
  }
}
