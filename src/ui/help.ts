import type { Command } from "commander";
import { banner, commandTable, print, section } from "./format.js";
import { renderTable } from "./table.js";
import { theme } from "./theme.js";

export const HELP_TOPICS = [
  "getting-started",
  "git",
  "github",
  "runs",
  "gateway",
  "examples",
] as const;

export type HelpTopic = (typeof HELP_TOPICS)[number];

function isHelpTopic(value: string): value is HelpTopic {
  return (HELP_TOPICS as readonly string[]).includes(value);
}

export function printRootHelp(program: Command): void {
  print(
    [
      banner(),
      "",
      theme.muted("Usage"),
      "  deckhand <command> [options]",
      "  deckhand help [topic|command]",
      "",
      commandTable([
        {
          title: "Workspace",
          rows: [
            ["doctor", "Check git, gh, AI Gateway, and Node"],
            ["status", "Repo, branch, and change table"],
            ["watch", "Live status as files change"],
            ["config", "Resolved Deckhand settings"],
          ],
        },
        {
          title: "Git",
          rows: [
            ["sync", "Stage, commit (Gateway message), push"],
            ["pull", "Fast-forward pull"],
            ["branch <name>", "Create or switch a branch"],
            ["conflicts", "Conflict list plus model guidance"],
          ],
        },
        {
          title: "GitHub",
          rows: [
            ["pr create", "Open a pull request"],
            ["issue create", "Open an issue"],
            ["repo create", "Create a repository"],
            ["project create", "Create a GitHub Project"],
            ["checks", "PR status checks"],
            ["actions list|watch|run", "GitHub Actions"],
          ],
        },
        {
          title: "Automation",
          rows: [
            ["runs", "Gated YAML schedules and templates"],
            ["agent", "Start the Eve terminal session"],
          ],
        },
      ]),
      "",
      section("Help"),
      renderTable(
        ["Command", "Opens"],
        [
          ["deckhand help", "This overview"],
          ["deckhand help topics", "All help topics"],
          ["deckhand help runs", "Gated-run guide"],
          ["deckhand <command> --help", "Flags for one command"],
        ],
      ),
      "",
      theme.muted("Global flags: -h, --help    -V, --version    -C, --cwd <path> on most commands"),
    ].join("\n"),
  );
  void program;
}

export function printTopicIndex(): void {
  print(
    [
      banner(),
      "",
      section("Help topics"),
      renderTable(
        ["Topic", "Covers"],
        [
          ["getting-started", "Install, auth, first commands"],
          ["git", "status, watch, sync, pull, conflicts"],
          ["github", "pr, issue, repo, project, checks, actions"],
          ["runs", "YAML gated runs and GitHub Environments"],
          ["gateway", "AI Gateway keys and models"],
          ["examples", "Copy-paste command recipes"],
        ],
      ),
      "",
      theme.muted("deckhand help <topic>"),
    ].join("\n"),
  );
}

export function printTopic(topic: HelpTopic): void {
  const body = topicBody(topic);
  print([banner(), "", body].join("\n"));
}

function topicBody(topic: HelpTopic): string {
  switch (topic) {
    case "getting-started":
      return [
        section("Getting started"),
        "1. npm install && npm run build",
        "2. gh auth login",
        "3. Copy .env.example to .env.local and set AI_GATEWAY_API_KEY",
        "4. deckhand doctor",
        "5. deckhand status",
        "",
        theme.muted("Eve agent (Node 24+): deckhand agent"),
      ].join("\n");
    case "git":
      return [
        section("Git"),
        "deckhand status              Change table for the current repo",
        "deckhand watch               Reprint status on filesystem events",
        "deckhand pull                git pull --ff-only",
        "deckhand sync                add + Gateway commit message + push",
        "deckhand sync --no-push      commit only",
        "deckhand sync -m \"msg\"       skip the model",
        "deckhand branch topic/fix    create or switch",
        "deckhand conflicts           list + resolution notes",
        "",
        theme.muted("Never force-pushes. Pulls are fast-forward only."),
      ].join("\n");
    case "github":
      return [
        section("GitHub"),
        "Requires gh on PATH (deckhand doctor).",
        "",
        "deckhand pr create -t \"Title\"",
        "deckhand issue create -t \"Title\"",
        "deckhand repo create my-repo --private",
        "deckhand project create -t \"Board\" -o my-org",
        "deckhand checks",
        "deckhand actions list",
        "deckhand actions watch [runId]",
        "deckhand actions run ci.yml --ref main",
      ].join("\n");
    case "runs":
      return [
        section("Gated runs"),
        "YAML under templates/runs and .deckhand/runs.",
        "GitHub Environment deckhand-gate holds execute jobs for review.",
        "",
        "deckhand runs list",
        "deckhand runs init morning-pull",
        "deckhand runs install-workflow morning-pull",
        "deckhand runs apply morning-pull --approve",
        "",
        "Gated apply without --approve exits with an error on purpose.",
        "GitHub cron is UTC; YAML timezone documents local intent.",
      ].join("\n");
    case "gateway":
      return [
        section("AI Gateway"),
        "Set AI_GATEWAY_API_KEY, or vercel link && vercel env pull .env.local",
        "Default: rotate $0 Gateway language models with tool-use (ids ending in -free).",
        "Catalog: https://ai-gateway.vercel.sh/v1/models — live list, curated fallback if offline.",
        "Pin a paid/specific slug with DECKHAND_MODEL or deckhand.json { \"model\": \"provider/model\" }",
        "Custom rotation: deckhand.json { \"model\": \"free\", \"models\": [\"inclusionai/ling-3.0-flash-fin-free\"] }",
        "",
        "deckhand doctor     shows whether credentials resolved",
        "deckhand config     prints the effective model and workspaces",
      ].join("\n");
    case "examples":
      return [
        section("Examples"),
        "deckhand doctor",
        "deckhand status -C ../other-repo",
        "deckhand sync --no-push",
        "deckhand pr create -t \"Tighten pull gates\" --draft",
        "deckhand runs list",
        "deckhand help git",
      ].join("\n");
    default: {
      const exhaustive: never = topic;
      return String(exhaustive);
    }
  }
}

export function showHelpTopicOrCommand(program: Command, topic?: string): void {
  if (!topic || topic === "help") {
    printRootHelp(program);
    return;
  }
  if (topic === "topics") {
    printTopicIndex();
    return;
  }
  if (isHelpTopic(topic)) {
    printTopic(topic);
    return;
  }
  const command = program.commands.find((entry) => entry.name() === topic || entry.aliases().includes(topic));
  if (command) {
    command.outputHelp();
    return;
  }
  print(`${theme.fail("Unknown help topic:")} ${topic}`);
  printTopicIndex();
}
