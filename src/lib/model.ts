import { generateText } from "ai";
import { loadConfig } from "./config.js";
import { gitDiff, gitStatus } from "./git.js";

export function gatewayModel(cwd?: string): string {
  return loadConfig(cwd).model;
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

  const { text } = await generateText({
    model: gatewayModel(cwd),
    prompt: [
      "Write a conventional git commit message for these changes.",
      "Return only the commit message: a short subject line, optional blank line, optional body.",
      "Do not wrap the message in quotes or markdown fences.",
      config.commitPrefix ? `Prefix the subject with: ${config.commitPrefix}` : "",
      payload,
    ]
      .filter(Boolean)
      .join("\n\n"),
  });

  return text.trim();
}

export async function suggestConflictResolution(files: string[], cwd?: string): Promise<string> {
  const { text } = await generateText({
    model: gatewayModel(cwd),
    prompt: [
      "These git paths have merge conflicts.",
      "Explain how to resolve them using git and gh, without inventing file contents.",
      "Never recommend force-push or skipping hooks.",
      files.map((file) => `- ${file}`).join("\n"),
    ].join("\n\n"),
  });
  return text.trim();
}

export async function draftGithubBody(
  kind: "pr" | "issue",
  title: string,
  context: string,
  cwd?: string,
): Promise<string> {
  const { text } = await generateText({
    model: gatewayModel(cwd),
    prompt: [
      `Draft a concise GitHub ${kind} body in markdown.`,
      `Title: ${title}`,
      "Context:",
      context,
      "Return only the body.",
    ].join("\n\n"),
  });
  return text.trim();
}
