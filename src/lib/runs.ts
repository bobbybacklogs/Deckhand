import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { parse as parseYaml } from "yaml";
import { z } from "zod";
import { listChecks, listRuns } from "./gh.js";
import { formatStatus, gitAdd, gitCommit, gitPull, gitPush, gitStatus } from "./git.js";
import { generateCommitMessage } from "./model.js";
import { templatesRoot } from "./paths.js";
import { workspaceRoot } from "./workspace.js";

export const RUN_ACTIONS = ["status", "pull", "sync", "checks", "actions-list"] as const;
export type RunAction = (typeof RUN_ACTIONS)[number];

const cronField = z.string().regex(/^(\S+\s+){4}\S+$/, "cron must have 5 fields (min hour day month weekday)");

const gatedRunSchema = z.object({
  apiVersion: z.literal("deckhand/v1"),
  kind: z.literal("GatedRun"),
  metadata: z.object({
    name: z.string().min(1),
    description: z.string().optional(),
  }),
  spec: z.object({
    schedule: z.object({
      cron: cronField,
      timezone: z.string().default("UTC"),
    }),
    action: z.enum(RUN_ACTIONS),
    workspace: z.string().default("."),
    gate: z
      .object({
        enabled: z.boolean().default(true),
        environment: z.string().default("deckhand-gate"),
        requireCleanTree: z.boolean().default(true),
        requireChecks: z.boolean().default(false),
      })
      .default({
        enabled: true,
        environment: "deckhand-gate",
        requireCleanTree: true,
        requireChecks: false,
      }),
    sync: z
      .object({
        push: z.boolean().default(false),
        message: z.string().optional(),
      })
      .optional(),
  }),
});

export type GatedRun = z.infer<typeof gatedRunSchema>;

export type LoadedRun = {
  path: string;
  run: GatedRun;
};

export function userRunsDir(cwd?: string): string {
  return join(workspaceRoot(cwd), ".deckhand", "runs");
}

export function packagedRunTemplatesDir(): string {
  return join(templatesRoot(), "runs");
}

export function packagedWorkflowTemplatesDir(): string {
  return join(templatesRoot(), "github-actions");
}

export function parseGatedRun(raw: string, source: string): GatedRun {
  const parsed = gatedRunSchema.safeParse(parseYaml(raw));
  if (!parsed.success) {
    throw new Error(`${source}: ${parsed.error.issues.map((issue) => issue.message).join("; ")}`);
  }
  return parsed.data;
}

export function loadRunFile(path: string): LoadedRun {
  return { path, run: parseGatedRun(readFileSync(path, "utf8"), path) };
}

function yamlFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith(".yaml") || name.endsWith(".yml"))
    .map((name) => join(dir, name));
}

export function listTemplateRuns(): LoadedRun[] {
  return yamlFiles(packagedRunTemplatesDir()).map(loadRunFile);
}

export function listUserRuns(cwd?: string): LoadedRun[] {
  return yamlFiles(userRunsDir(cwd)).map(loadRunFile);
}

export function findRun(name: string, cwd?: string): LoadedRun {
  const fromUser = listUserRuns(cwd).find((entry) => entry.run.metadata.name === name);
  if (fromUser) return fromUser;
  const fromTemplates = listTemplateRuns().find((entry) => entry.run.metadata.name === name);
  if (fromTemplates) return fromTemplates;
  throw new Error(`No gated run named "${name}". Try: deckhand runs list`);
}

export function initRunTemplate(name: string, cwd?: string): string {
  const template = listTemplateRuns().find((entry) => entry.run.metadata.name === name);
  if (!template) {
    const available = listTemplateRuns()
      .map((entry) => entry.run.metadata.name)
      .join(", ");
    throw new Error(`Unknown template "${name}". Available: ${available}`);
  }
  const destDir = userRunsDir(cwd);
  mkdirSync(destDir, { recursive: true });
  const dest = join(destDir, basename(template.path));
  writeFileSync(dest, readFileSync(template.path, "utf8"));
  return dest;
}

export function installWorkflowTemplate(name: string, cwd?: string): string {
  const source = join(packagedWorkflowTemplatesDir(), `${name}.yml`);
  if (!existsSync(source)) {
    const available = yamlFiles(packagedWorkflowTemplatesDir())
      .map((path) => basename(path, ".yml"))
      .join(", ");
    throw new Error(`Unknown workflow template "${name}". Available: ${available}`);
  }
  const destDir = join(workspaceRoot(cwd), ".github", "workflows");
  mkdirSync(destDir, { recursive: true });
  const dest = join(destDir, `deckhand-${name}.yml`);
  writeFileSync(dest, readFileSync(source, "utf8"));
  return dest;
}

export async function applyRun(
  loaded: LoadedRun,
  options: { approve?: boolean; cwd?: string },
): Promise<string> {
  const { run } = loaded;
  const cwd = options.cwd ?? run.spec.workspace;
  const gate = run.spec.gate;

  if (gate.enabled && !options.approve && process.env.DECKHAND_RUN_APPROVED !== "1") {
    throw new Error(
      `Run "${run.metadata.name}" is gated by environment "${gate.environment}". Re-run with --approve after review, or set DECKHAND_RUN_APPROVED=1 on a trusted runner.`,
    );
  }

  if (gate.requireCleanTree && run.spec.action !== "status" && run.spec.action !== "sync") {
    const status = await gitStatus(cwd);
    if (!status.clean) {
      throw new Error(`Gate requires a clean tree:\n${formatStatus(status)}`);
    }
  }

  if (gate.requireChecks) {
    const checks = await listChecks(cwd);
    if (/fail|pending|error/i.test(checks)) {
      throw new Error(`Gate requires green PR checks:\n${checks}`);
    }
  }

  const action: RunAction = run.spec.action;
  switch (action) {
    case "status":
      return formatStatus(await gitStatus(cwd));
    case "pull":
      return gitPull(cwd);
    case "sync": {
      const status = await gitStatus(cwd);
      if (status.clean) return "Working tree is clean. Nothing to sync.";
      await gitAdd(["."], cwd);
      const message = run.spec.sync?.message ?? (await generateCommitMessage(cwd));
      const committed = await gitCommit(message, cwd);
      if (run.spec.sync?.push) {
        try {
          return `${committed}\n${await gitPush(cwd)}`;
        } catch {
          return `${committed}\n${await gitPush(cwd, true)}`;
        }
      }
      return committed;
    }
    case "checks":
      return listChecks(cwd);
    case "actions-list":
      return listRuns(cwd);
    default: {
      const exhaustive: never = action;
      throw new Error(`Unhandled run action: ${String(exhaustive)}`);
    }
  }
}
