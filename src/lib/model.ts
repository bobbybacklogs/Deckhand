import { loadConfig } from "./config.js";
import { gitDiff, gitStatus } from "./git.js";
import { FREE_ROTATION_SENTINEL } from "./free-models.js";
import { generateGatewayText, orderedModels } from "./router.js";

export async function gatewayModel(cwd?: string): Promise<string> {
  const pinned = loadConfig(cwd).model.trim();
  if (pinned && pinned !== FREE_ROTATION_SENTINEL) return pinned;
  const pool = await orderedModels(cwd);
  return pool[0] ?? pinned;
}

export async function generateCommitMessage(cwd?: string): Promise<string> {
  const config = loadConfig(cwd);
  const status = await gitStatus(cwd);
  const diff = await gitDiff(cwd);
  const staged = await gitDiff(cwd, true);
  const payload = [
    `Branch: ${status.branch}`,
    "Status:",
    ...status.changes.map((change) => `${change.kind} ${change.path}`),
    "Staged diff:",
    staged || "(none)",
    "Unstaged diff:",
    diff || "(none)",
  ].join("\n");

  return generateGatewayText(
    [
      "Write a conventional git commit message for these changes.",
      "Return only the commit message: a short subject line, optional blank line, optional body.",
      "Do not wrap the message in quotes or markdown fences.",
      config.commitPrefix ? `Prefix the subject with: ${config.commitPrefix}` : "",
      payload,
    ]
      .filter(Boolean)
      .join("\n\n"),
    cwd,
  );
}

export async function suggestConflictResolution(files: string[], cwd?: string): Promise<string> {
  return generateGatewayText(
    [
      "These git paths have merge conflicts.",
      "Explain how to resolve them using git and gh, without inventing file contents.",
      "Never recommend force-push or skipping hooks.",
      files.map((file) => `- ${file}`).join("\n"),
    ].join("\n\n"),
    cwd,
  );
}

export async function draftGithubBody(
  kind: "pr" | "issue",
  title: string,
  context: string,
  cwd?: string,
): Promise<string> {
  return generateGatewayText(
    [
      `Draft a concise GitHub ${kind} body in markdown.`,
      `Title: ${title}`,
      "Context:",
      context,
      "Return only the body.",
    ].join("\n\n"),
    cwd,
  );
}
