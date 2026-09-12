import { Command } from "commander";
import {
  applyRun,
  findRun,
  initRunTemplate,
  installWorkflowTemplate,
  listTemplateRuns,
  listUserRuns,
} from "../lib/runs.js";
import { notice, print, runsTables, section } from "../ui/format.js";
import { renderTable } from "../ui/table.js";
import { theme } from "../ui/theme.js";

export function registerRunsCommand(program: Command): void {
  const runs = program
    .command("runs")
    .description("Gated cron-style Deckhand runs (YAML templates)")
    .addHelpText(
      "after",
      [
        "",
        "Examples:",
        "  $ deckhand runs list",
        "  $ deckhand runs init morning-pull",
        "  $ deckhand runs install-workflow morning-pull",
        "  $ deckhand runs apply morning-pull --approve",
        "",
        "More: deckhand help runs",
      ].join("\n"),
    );

  runs
    .command("list")
    .description("List packaged templates and local .deckhand/runs files")
    .option("-C, --cwd <path>", "workspace directory")
    .action((options: { cwd?: string }) => {
      print(runsTables(listTemplateRuns(), listUserRuns(options.cwd)));
    });

  runs
    .command("validate")
    .description("Parse and validate local and template run YAML")
    .option("-C, --cwd <path>", "workspace directory")
    .action((options: { cwd?: string }) => {
      const templates = listTemplateRuns();
      const local = listUserRuns(options.cwd);
      const all = [
        ...templates.map((entry) => ({ ...entry, source: "template" })),
        ...local.map((entry) => ({ ...entry, source: "local" })),
      ];
      print(section("Validate"));
      if (all.length === 0) {
        print(notice("warn", "No run YAML found."));
        return;
      }
      print(
        renderTable(
          ["Status", "Name", "Source", "Path"],
          all.map((entry) => [theme.ok("ok"), entry.run.metadata.name, entry.source, entry.path]),
        ),
      );
    });

  runs
    .command("init")
    .description("Copy a packaged run template into .deckhand/runs")
    .argument("<name>", "template name (e.g. morning-pull)")
    .option("-C, --cwd <path>", "workspace directory")
    .action((name: string, options: { cwd?: string }) => {
      const dest = initRunTemplate(name, options.cwd);
      print(notice("ok", `Wrote ${dest}`));
      print(theme.muted("Edit the YAML, then: deckhand runs apply " + name + " --approve"));
    });

  runs
    .command("install-workflow")
    .description("Copy a GitHub Actions workflow template into .github/workflows")
    .argument("<name>", "workflow template name (e.g. morning-pull)")
    .option("-C, --cwd <path>", "workspace directory")
    .action((name: string, options: { cwd?: string }) => {
      const dest = installWorkflowTemplate(name, options.cwd);
      print(notice("ok", `Wrote ${dest}`));
      print(theme.muted("Add required reviewers on GitHub Environment deckhand-gate."));
    });

  runs
    .command("apply")
    .description("Execute a gated run YAML (requires --approve when gated)")
    .argument("<name>", "run metadata.name")
    .option("-C, --cwd <path>", "workspace directory")
    .option("--approve", "pass the local gate after human review")
    .action(async (name: string, options: { cwd?: string; approve?: boolean }) => {
      const loaded = findRun(name, options.cwd);
      print(section(`Run  ${loaded.run.metadata.name}`));
      print(theme.muted(`${loaded.run.spec.action}  ·  ${loaded.run.spec.schedule.cron}  ·  ${loaded.path}`));
      print("");
      print(await applyRun(loaded, options));
      print("");
      print(notice("ok", "Run finished."));
    });
}
