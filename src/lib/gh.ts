import { runOk } from "./run.js";
import { workspaceRoot } from "./workspace.js";

export async function gh(args: string[], cwd?: string): Promise<string> {
  const root = workspaceRoot(cwd);
  const result = await runOk("gh", args, { cwd: root });
  return (result.stdout + result.stderr).trim();
}

export async function ghAuthStatus(cwd?: string): Promise<string> {
  return gh(["auth", "status"], cwd);
}

export async function createPullRequest(input: {
  title: string;
  body: string;
  base?: string;
  draft?: boolean;
  cwd?: string;
}): Promise<string> {
  const args = ["pr", "create", "--title", input.title, "--body", input.body];
  if (input.base) args.push("--base", input.base);
  if (input.draft) args.push("--draft");
  return gh(args, input.cwd);
}

export async function createIssue(input: {
  title: string;
  body: string;
  labels?: string[];
  cwd?: string;
}): Promise<string> {
  const args = ["issue", "create", "--title", input.title, "--body", input.body];
  for (const label of input.labels ?? []) {
    args.push("--label", label);
  }
  return gh(args, input.cwd);
}

export async function createRepo(input: {
  name: string;
  description?: string;
  privateRepo?: boolean;
  cwd?: string;
}): Promise<string> {
  const args = ["repo", "create", input.name, "--source", ".", "--remote", "origin"];
  args.push(input.privateRepo ? "--private" : "--public");
  if (input.description) args.push("--description", input.description);
  return gh(args, input.cwd);
}

export async function createProject(input: {
  title: string;
  owner: string;
  cwd?: string;
}): Promise<string> {
  return gh(["project", "create", "--title", input.title, "--owner", input.owner], input.cwd);
}

export async function listChecks(cwd?: string): Promise<string> {
  return gh(["pr", "checks"], cwd);
}

export async function listRuns(cwd?: string): Promise<string> {
  return gh(["run", "list", "--limit", "10"], cwd);
}

export async function watchRun(runId: string | undefined, cwd?: string): Promise<string> {
  const args = runId ? ["run", "watch", runId] : ["run", "watch"];
  return gh(args, cwd);
}

export async function triggerWorkflow(input: {
  workflow: string;
  ref?: string;
  cwd?: string;
}): Promise<string> {
  const args = ["workflow", "run", input.workflow];
  if (input.ref) args.push("--ref", input.ref);
  return gh(args, input.cwd);
}
