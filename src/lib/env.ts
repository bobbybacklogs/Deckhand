import { existsSync } from "node:fs";
import { join } from "node:path";
import { workspaceRoot } from "./workspace.js";

export function loadEnvFiles(cwd?: string): void {
  const root = workspaceRoot(cwd);
  // loadEnvFile does not overwrite existing vars, so load the override file first.
  for (const name of [".env.local", ".env"] as const) {
    const path = join(root, name);
    if (!existsSync(path)) continue;
    process.loadEnvFile(path);
  }
}

export function gatewayCredentialDetail(): { ok: boolean; detail: string } {
  if (process.env.AI_GATEWAY_API_KEY?.trim()) {
    return { ok: true, detail: "AI_GATEWAY_API_KEY is set" };
  }
  if (process.env.VERCEL_OIDC_TOKEN?.trim()) {
    return { ok: true, detail: "VERCEL_OIDC_TOKEN is set" };
  }
  return {
    ok: false,
    detail: "set AI_GATEWAY_API_KEY, or run vercel link && vercel env pull .env.local",
  };
}
