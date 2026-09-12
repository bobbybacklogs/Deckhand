import { runCommand, runOk } from "./run.js";
import { workspaceRoot } from "./workspace.js";

export type GitChangeKind = "untracked" | "modified" | "added" | "deleted" | "renamed" | "copied" | "conflict" | "unmodified" | "ignored" | "unknown";

export type GitChange = {
  path: string;
  index: string;
  worktree: string;
  kind: GitChangeKind;
};

export type GitStatus = {
  cwd: string;
  branch: string;
  ahead: number;
  behind: number;
  detached: boolean;
  clean: boolean;
  changes: GitChange[];
};

function kindFromCodes(index: string, worktree: string): GitChangeKind {
  const codes = `${index}${worktree}`;
  if (index === "U" || worktree === "U" || codes === "AA" || codes === "DD") return "conflict";
  if (index === "?" || worktree === "?") return "untracked";
  if (index === "!" || worktree === "!") return "ignored";
  if (index === "A" || worktree === "A") return "added";
  if (index === "D" || worktree === "D") return "deleted";
  if (index === "R" || worktree === "R") return "renamed";
  if (index === "C" || worktree === "C") return "copied";
  if (index === "M" || worktree === "M") return "modified";
  if (index === " " && worktree === " ") return "unmodified";
  return "unknown";
}

function parsePorcelain(output: string): {
  branch: string;
  ahead: number;
  behind: number;
  detached: boolean;
  changes: GitChange[];
} {
  let branch = "HEAD";
  let ahead = 0;
  let behind = 0;
  let detached = false;
  const changes: GitChange[] = [];

  for (const line of output.split("\n")) {
    if (!line) continue;
    if (line.startsWith("## ")) {
      const header = line.slice(3);
      detached = header.startsWith("HEAD");
      const aheadMatch = header.match(/ahead (\d+)/);
      const behindMatch = header.match(/behind (\d+)/);
      ahead = aheadMatch ? Number(aheadMatch[1]) : 0;
      behind = behindMatch ? Number(behindMatch[1]) : 0;
      const name = header.split("...")[0]?.split(" ")[0] ?? "HEAD";
      branch = name;
      continue;
    }
    const index = line[0] ?? " ";
    const worktree = line[1] ?? " ";
    const rest = line.slice(3);
    const path = rest.includes(" -> ") ? rest.split(" -> ").at(-1) ?? rest : rest;
    changes.push({
      path,
      index,
      worktree,
      kind: kindFromCodes(index, worktree),
    });
  }

  return { branch, ahead, behind, detached, changes };
}

export async function gitStatus(cwd?: string): Promise<GitStatus> {
  const root = workspaceRoot(cwd);
  const result = await runOk("git", ["status", "--porcelain=v1", "-b"], { cwd: root });
  const parsed = parsePorcelain(result.stdout);
  return {
    cwd: root,
    ...parsed,
    clean: parsed.changes.length === 0,
  };
}

export async function gitDiff(cwd?: string, staged = false): Promise<string> {
  const root = workspaceRoot(cwd);
  const args = staged ? ["diff", "--cached"] : ["diff"];
  const result = await runOk("git", args, { cwd: root });
  return result.stdout;
}

export async function gitAdd(paths: string[], cwd?: string): Promise<void> {
  const root = workspaceRoot(cwd);
  const targets = paths.length > 0 ? paths : ["."];
  await runOk("git", ["add", "--", ...targets], { cwd: root });
}

export async function gitCommit(message: string, cwd?: string): Promise<string> {
  const root = workspaceRoot(cwd);
  const result = await runOk("git", ["commit", "-F", "-"], { cwd: root, input: message });
  return result.stdout.trim();
}

export async function gitPush(cwd?: string, setUpstream = false): Promise<string> {
  const root = workspaceRoot(cwd);
  const args = setUpstream ? ["push", "-u", "origin", "HEAD"] : ["push"];
  const result = await runOk("git", args, { cwd: root });
  return (result.stdout + result.stderr).trim();
}

export async function gitPull(cwd?: string): Promise<string> {
  const root = workspaceRoot(cwd);
  const result = await runOk("git", ["pull", "--ff-only"], { cwd: root });
  return (result.stdout + result.stderr).trim();
}

export async function gitCheckoutBranch(name: string, create: boolean, cwd?: string): Promise<string> {
  const root = workspaceRoot(cwd);
  const args = create ? ["checkout", "-b", name] : ["checkout", name];
  const result = await runOk("git", args, { cwd: root });
  return (result.stdout + result.stderr).trim();
}

export async function gitConflictFiles(cwd?: string): Promise<string[]> {
  const status = await gitStatus(cwd);
  return status.changes.filter((change) => change.kind === "conflict").map((change) => change.path);
}

export async function gitShowFile(path: string, cwd?: string): Promise<string> {
  const root = workspaceRoot(cwd);
  const result = await runCommand("git", ["show", `:${path}`], { cwd: root });
  if (result.code !== 0) {
    return result.stderr;
  }
  return result.stdout;
}

export function formatStatus(status: GitStatus): string {
  const tracking =
    status.ahead || status.behind
      ? ` [ahead ${status.ahead}, behind ${status.behind}]`
      : "";
  const lines = [
    `Repo: ${status.cwd}`,
    `Branch: ${status.branch}${status.detached ? " (detached)" : ""}${tracking}`,
  ];
  if (status.clean) {
    lines.push("Working tree is clean.");
    return lines.join("\n");
  }
  lines.push(`${status.changes.length} change(s):`);
  for (const change of status.changes) {
    lines.push(`  ${change.kind.padEnd(10)} ${change.path}`);
  }
  return lines.join("\n");
}
