import type { DoctorCheck } from "../lib/doctor.js";
import type { GitStatus } from "../lib/git.js";
import type { LoadedRun } from "../lib/runs.js";
import { renderTable } from "./table.js";
import { theme, VERSION } from "./theme.js";

export function banner(): string {
  const rule = theme.muted("─".repeat(Math.min(56, process.stdout.columns ?? 56)));
  return [
    theme.brand("Deckhand") + theme.muted(`  v${VERSION}`),
    theme.muted("Git, GitHub, and gated runs — via Eve and AI Gateway"),
    rule,
  ].join("\n");
}

export function section(title: string): string {
  return theme.heading(title);
}

export function notice(kind: "ok" | "fail" | "warn" | "info", message: string): string {
  const tag =
    kind === "ok"
      ? theme.ok("ok")
      : kind === "fail"
        ? theme.fail("fail")
        : kind === "warn"
          ? theme.warn("warn")
          : theme.info("info");
  return `${tag}  ${message}`;
}

export function print(text: string): void {
  console.log(text);
}

export function printError(message: string): void {
  console.error(notice("fail", message));
}

export function doctorTable(checks: DoctorCheck[]): string {
  const rows = checks.map((check) => [
    check.name,
    check.ok ? theme.ok("pass") : theme.fail("fail"),
    check.detail,
  ]);
  return [section("Doctor"), renderTable(["Check", "Status", "Detail"], rows)].join("\n");
}

export function statusTables(status: GitStatus): string {
  const tracking =
    status.ahead || status.behind ? `ahead ${status.ahead} / behind ${status.behind}` : "in sync";
  const meta = renderTable(
    ["Field", "Value"],
    [
      ["Repo", status.cwd],
      ["Branch", `${status.branch}${status.detached ? " (detached)" : ""}`],
      ["Tracking", tracking],
      ["Tree", status.clean ? theme.ok("clean") : theme.warn(`${status.changes.length} changes`)],
    ],
  );

  if (status.clean) {
    return [section("Status"), meta, notice("ok", "Working tree is clean.")].join("\n");
  }

  const changes = renderTable(
    ["Kind", "Index", "Worktree", "Path"],
    status.changes.map((change) => [
      change.kind,
      change.index.trim() ? change.index : "·",
      change.worktree.trim() ? change.worktree : "·",
      change.path,
    ]),
  );
  return [section("Status"), meta, "", section("Changes"), changes].join("\n");
}

export function runsTables(templates: LoadedRun[], local: LoadedRun[]): string {
  const toRows = (entries: LoadedRun[], source: string) =>
    entries.map((entry) => [
      entry.run.metadata.name,
      entry.run.spec.schedule.cron,
      entry.run.spec.schedule.timezone,
      entry.run.spec.action,
      entry.run.spec.gate.enabled ? theme.warn(entry.run.spec.gate.environment) : theme.ok("ungated"),
      source,
      entry.run.metadata.description ?? "",
    ]);

  const headers = ["Name", "Cron", "Timezone", "Action", "Gate", "Source", "Description"];
  const rows = [...toRows(templates, "template"), ...toRows(local, "local")];
  return [section("Gated runs"), renderTable(headers, rows)].join("\n");
}

export function kvTable(title: string, entries: Record<string, string>): string {
  return [
    section(title),
    renderTable(
      ["Key", "Value"],
      Object.entries(entries).map(([key, value]) => [key, value]),
    ),
  ].join("\n");
}

export function commandTable(
  groups: { title: string; rows: [string, string][] }[],
): string {
  return groups
    .map((group) => [section(group.title), renderTable(["Command", "What it does"], group.rows)].join("\n"))
    .join("\n\n");
}
