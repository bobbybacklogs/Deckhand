#!/usr/bin/env node
import { Command } from "commander";
import { loadConfig } from "./lib/config.js";
import { loadEnvFiles } from "./lib/env.js";
import { runDoctor } from "./lib/doctor.js";
import {
  formatStatus,
  gitAdd,
  gitCheckoutBranch,
  gitCommit,
  gitConflictFiles,
  gitPull,
  gitPush,
  gitStatus,
} from "./lib/git.js";
import {
  createIssue,
  createProject,
  createPullRequest,
  createRepo,
  listChecks,
  listRuns,
  triggerWorkflow,
  watchRun,
} from "./lib/gh.js";
import {
  draftGithubBody,
  generateCommitMessage,
  suggestConflictResolution,
} from "./lib/model.js";
import { watchWorkspace } from "./lib/watch.js";
import { describeRouter } from "./lib/router.js";
import { startEveDev } from "./eve-dev.js";
import { registerRunsCommand } from "./commands/runs.js";
import { workspaceRoot } from "./lib/workspace.js";
import { doctorTable, kvTable, notice, print, printError, section, statusTables } from "./ui/format.js";
import { printRootHelp, showHelpTopicOrCommand } from "./ui/help.js";
import { renderTable } from "./ui/table.js";
import { theme } from "./ui/theme.js";

loadEnvFiles();

const program = new Command();

program
  .name("deckhand")
  .description("Git, GitHub, and gated runs — via Eve and AI Gateway")
  .version("0.1.3")
  .addHelpCommand(false)
  .showHelpAfterError("Try deckhand help, or deckhand help topics.");

program
  .command("help")
  .description("Show the help system (overview, topics, or a command)")
  .argument("[topic]", "topic name, or a command (doctor, runs, git, …)")
  .action((topic?: string) => {
    showHelpTopicOrCommand(program, topic);
  });

program
  .command("doctor")
  .description("Check git, gh, AI Gateway credentials, and Node")
  .addHelpText("after", "\nExample:\n  $ deckhand doctor\n")
  .action(async () => {
    const checks = await runDoctor();
    print(doctorTable(checks));
    const failed = checks.filter((check) => !check.ok);
    if (failed.length > 0) {
      print("");
      print(notice("fail", `${failed.length} check(s) need attention. See: deckhand help getting-started`));
      process.exitCode = 1;
      return;
    }
    print("");
    print(notice("ok", "All checks passed."));
  });

program
  .command("status")
  .description("Report git status for the current workspace")
  .option("-C, --cwd <path>", "workspace directory")
  .addHelpText("after", "\nExample:\n  $ deckhand status\n  $ deckhand status -C ../other-repo\n")
  .action(async (options: { cwd?: string }) => {
    print(statusTables(await gitStatus(options.cwd)));
  });

program
  .command("watch")
  .description("Watch configured workspaces and print status on changes")
  .option("-C, --cwd <path>", "workspace directory")
  .action(async (options: { cwd?: string }) => {
    print(notice("info", `Watching ${workspaceRoot(options.cwd)}. Press Ctrl+C to stop.`));
    const handle = await watchWorkspace(options.cwd, (event) => {
      print(`\n${theme.muted(new Date().toISOString())}`);
      if (event.ok) print(statusTables(event.status));
      else print(notice("fail", event.error));
    });
    const stop = () => {
      handle.close();
      process.exit(0);
    };
    process.on("SIGINT", stop);
    process.on("SIGTERM", stop);
  });

program
  .command("sync")
  .description("Stage, commit with an AI Gateway message, and push")
  .option("-C, --cwd <path>", "workspace directory")
  .option("-m, --message <message>", "commit message (skips the model)")
  .option("--no-push", "commit without pushing")
  .addHelpText("after", "\nExamples:\n  $ deckhand sync\n  $ deckhand sync --no-push\n  $ deckhand sync -m \"chore: bump lockfile\"\n")
  .action(async (options: { cwd?: string; message?: string; push?: boolean }) => {
    const status = await gitStatus(options.cwd);
    if (status.clean) {
      print(statusTables(status));
      print(notice("ok", "Nothing to sync."));
      return;
    }
    print(statusTables(status));
    await gitAdd(["."], options.cwd);
    const message = options.message ?? (await generateCommitMessage(options.cwd));
    print("");
    print(section("Commit"));
    print(message);
    print(await gitCommit(message, options.cwd));
    if (options.push !== false) {
      try {
        print(await gitPush(options.cwd));
      } catch {
        print(await gitPush(options.cwd, true));
      }
    }
    print(notice("ok", "Sync complete."));
  });

program
  .command("pull")
  .description("Fast-forward pull")
  .option("-C, --cwd <path>", "workspace directory")
  .action(async (options: { cwd?: string }) => {
    print(await gitPull(options.cwd));
  });

program
  .command("branch")
  .description("Create or switch a branch")
  .argument("<name>", "branch name")
  .option("-C, --cwd <path>", "workspace directory")
  .option("--create", "create the branch", true)
  .action(async (name: string, options: { cwd?: string; create?: boolean }) => {
    print(await gitCheckoutBranch(name, options.create !== false, options.cwd));
  });

program
  .command("conflicts")
  .description("List conflicted files and ask the gateway model for resolution help")
  .option("-C, --cwd <path>", "workspace directory")
  .action(async (options: { cwd?: string }) => {
    const files = await gitConflictFiles(options.cwd);
    if (files.length === 0) {
      print(notice("ok", "No merge conflicts."));
      return;
    }
    print(section("Conflicts"));
    print(renderTable(["Path"], files.map((file) => [file])));
    print("");
    print(section("Guidance"));
    print(await suggestConflictResolution(files, options.cwd));
  });

const pr = program.command("pr").description("Pull request commands");
pr.command("create")
  .description("Create a pull request with gh")
  .requiredOption("-t, --title <title>", "PR title")
  .option("-b, --body <body>", "PR body")
  .option("--base <branch>", "base branch")
  .option("--draft", "open as draft")
  .option("-C, --cwd <path>", "workspace directory")
  .action(async (options: { title: string; body?: string; base?: string; draft?: boolean; cwd?: string }) => {
    const status = await gitStatus(options.cwd);
    const body =
      options.body ??
      (await draftGithubBody("pr", options.title, formatStatus(status), options.cwd));
    print(
      await createPullRequest({
        title: options.title,
        body,
        base: options.base,
        draft: options.draft,
        cwd: options.cwd,
      }),
    );
  });

const issue = program.command("issue").description("Issue commands");
issue
  .command("create")
  .description("Create a GitHub issue with gh")
  .requiredOption("-t, --title <title>", "issue title")
  .option("-b, --body <body>", "issue body")
  .option("-C, --cwd <path>", "workspace directory")
  .action(async (options: { title: string; body?: string; cwd?: string }) => {
    const body = options.body ?? (await draftGithubBody("issue", options.title, "User-requested issue", options.cwd));
    print(await createIssue({ title: options.title, body, cwd: options.cwd }));
  });

const repo = program.command("repo").description("Repository commands");
repo
  .command("create")
  .description("Create a GitHub repository from the current directory")
  .argument("<name>", "repository name")
  .option("-d, --description <text>", "description")
  .option("--private", "create as private")
  .option("-C, --cwd <path>", "workspace directory")
  .action(async (name: string, options: { description?: string; private?: boolean; cwd?: string }) => {
    print(
      await createRepo({
        name,
        description: options.description,
        privateRepo: options.private,
        cwd: options.cwd,
      }),
    );
  });

const project = program.command("project").description("GitHub Projects commands");
project
  .command("create")
  .description("Create a GitHub Project")
  .requiredOption("-t, --title <title>", "project title")
  .requiredOption("-o, --owner <login>", "user or org login")
  .option("-C, --cwd <path>", "workspace directory")
  .action(async (options: { title: string; owner: string; cwd?: string }) => {
    print(await createProject({ title: options.title, owner: options.owner, cwd: options.cwd }));
  });

const actions = program.command("actions").description("GitHub Actions commands");
actions
  .command("list")
  .description("List recent workflow runs")
  .option("-C, --cwd <path>", "workspace directory")
  .action(async (options: { cwd?: string }) => {
    print(await listRuns(options.cwd));
  });
actions
  .command("watch")
  .description("Watch a workflow run")
  .argument("[runId]", "run id (latest if omitted)")
  .option("-C, --cwd <path>", "workspace directory")
  .action(async (runId: string | undefined, options: { cwd?: string }) => {
    print(await watchRun(runId, options.cwd));
  });
actions
  .command("run")
  .description("Trigger a workflow")
  .argument("<workflow>", "workflow file or name")
  .option("--ref <ref>", "git ref")
  .option("-C, --cwd <path>", "workspace directory")
  .action(async (workflow: string, options: { ref?: string; cwd?: string }) => {
    print(await triggerWorkflow({ workflow, ref: options.ref, cwd: options.cwd }));
  });

program
  .command("checks")
  .description("Show pull request status checks")
  .option("-C, --cwd <path>", "workspace directory")
  .action(async (options: { cwd?: string }) => {
    print(await listChecks(options.cwd));
  });

program
  .command("agent")
  .alias("eve")
  .description("Start the Eve agent (AI Gateway) in the terminal")
  .action(async () => {
    const code = await startEveDev();
    process.exit(code);
  });

registerRunsCommand(program);

program
  .command("config")
  .description("Print resolved Deckhand config")
  .option("-C, --cwd <path>", "workspace directory")
  .action(async (options: { cwd?: string }) => {
    const config = loadConfig(options.cwd);
    print(
      kvTable("Config", {
        workspaces: config.workspaces.join(", "),
        model: config.model,
        routing: await describeRouter(options.cwd),
        autoSync: String(config.autoSync),
        commitPrefix: config.commitPrefix || "(none)",
      }),
    );
  });

const argv = process.argv.slice(2);
if (argv.length === 0 || (argv.length === 1 && (argv[0] === "-h" || argv[0] === "--help"))) {
  printRootHelp(program);
  process.exit(0);
}

program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  printError(message);
  print(theme.muted("deckhand help   ·   deckhand help topics"));
  process.exit(1);
});
