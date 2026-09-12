import { runCommand } from "./run.js";
import { loadConfig } from "./config.js";
import { gatewayCredentialDetail, loadEnvFiles } from "./env.js";
import { workspaceRoot } from "./workspace.js";

export type DoctorCheck = {
  name: string;
  ok: boolean;
  detail: string;
};

export async function runDoctor(cwd?: string): Promise<DoctorCheck[]> {
  loadEnvFiles(cwd);
  const root = workspaceRoot(cwd);
  const config = loadConfig(root);
  const checks: DoctorCheck[] = [];

  const git = await runCommand("git", ["--version"], { cwd: root });
  checks.push({
    name: "git",
    ok: git.code === 0,
    detail: git.code === 0 ? git.stdout.trim() : "git is not on PATH",
  });

  const gh = await runCommand("gh", ["--version"], { cwd: root });
  checks.push({
    name: "gh",
    ok: gh.code === 0,
    detail: gh.code === 0 ? gh.stdout.split("\n")[0] ?? "ok" : "GitHub CLI is not on PATH",
  });

  const auth = await runCommand("gh", ["auth", "status"], { cwd: root });
  checks.push({
    name: "gh auth",
    ok: auth.code === 0,
    detail: auth.code === 0 ? "authenticated" : auth.stderr.trim() || "run gh auth login",
  });

  const creds = gatewayCredentialDetail();
  checks.push({
    name: "ai gateway",
    ok: creds.ok,
    detail: creds.ok ? `${creds.detail}; model ${config.model}` : creds.detail,
  });

  const nodeMajor = Number(process.versions.node.split(".")[0]);
  checks.push({
    name: "node",
    ok: nodeMajor >= 20,
    detail: `v${process.versions.node}${nodeMajor >= 24 ? " (Eve-ready)" : " (CLI ok; Eve wants Node 24+)"}`,
  });

  return checks;
}
