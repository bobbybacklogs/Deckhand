import { spawn, type ChildProcess, type SpawnOptions } from "node:child_process";
import { existsSync } from "node:fs";
import { delimiter, extname, isAbsolute, join } from "node:path";

export type CommandResult = {
  command: string;
  args: string[];
  code: number;
  stdout: string;
  stderr: string;
};

export class CommandError extends Error {
  readonly result: CommandResult;

  constructor(result: CommandResult) {
    const detail = result.stderr.trim() || result.stdout.trim() || `exit ${result.code}`;
    super(`${result.command} ${result.args.join(" ")} failed: ${detail}`);
    this.name = "CommandError";
    this.result = result;
  }
}

const resolvedCommands = new Map<string, string>();

function quoteForCmd(value: string): string {
  if (value.length === 0) return '""';
  if (!/[\s"]/u.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

function lookupOnPath(command: string): string | undefined {
  if (isAbsolute(command) || command.includes("/") || command.includes("\\")) {
    return existsSync(command) ? command : undefined;
  }

  const pathExt =
    process.platform === "win32"
      ? (process.env.PATHEXT ?? ".EXE;.CMD;.BAT").split(";").filter(Boolean)
      : [""];
  const dirs = (process.env.PATH ?? "").split(delimiter);

  for (const dir of dirs) {
    if (!dir) continue;
    for (const ext of pathExt) {
      const candidate = join(dir, `${command}${ext}`);
      if (existsSync(candidate)) return candidate;
    }
    const bare = join(dir, command);
    if (existsSync(bare)) return bare;
  }

  return undefined;
}

function resolveCommand(command: string): string {
  const cached = resolvedCommands.get(command);
  if (cached) return cached;
  const resolved = lookupOnPath(command) ?? command;
  resolvedCommands.set(command, resolved);
  return resolved;
}

function spawnWithoutShell(command: string, args: string[], options: SpawnOptions): ChildProcess {
  if (process.platform !== "win32") {
    return spawn(command, args, { ...options, shell: false });
  }

  const resolved = resolveCommand(command);
  const extension = extname(resolved).toLowerCase();
  if (extension === ".exe" || extension === ".com") {
    return spawn(resolved, args, { ...options, shell: false });
  }

  const comspec = process.env.ComSpec || "cmd.exe";
  const cmdline = [quoteForCmd(resolved), ...args.map(quoteForCmd)].join(" ");
  return spawn(comspec, ["/d", "/s", "/c", `"${cmdline}"`], {
    ...options,
    shell: false,
    windowsVerbatimArguments: true,
  });
}

export function runCommand(
  command: string,
  args: string[],
  options: { cwd?: string; input?: string; timeoutMs?: number } = {},
): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawnWithoutShell(command, args, {
      cwd: options.cwd,
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });

    const stdoutStream = child.stdout;
    const stderrStream = child.stderr;
    const stdinStream = child.stdin;
    if (!stdoutStream || !stderrStream || !stdinStream) {
      child.kill();
      reject(new Error(`${command} spawned without stdio pipes`));
      return;
    }

    let stdout = "";
    let stderr = "";
    let settled = false;

    const timer =
      options.timeoutMs === undefined
        ? undefined
        : setTimeout(() => {
            child.kill();
            if (!settled) {
              settled = true;
              reject(
                new Error(
                  `${command} timed out after ${options.timeoutMs}ms`,
                ),
              );
            }
          }, options.timeoutMs);

    stdoutStream.setEncoding("utf8");
    stderrStream.setEncoding("utf8");
    stdoutStream.on("data", (chunk: string) => {
      stdout += chunk;
    });
    stderrStream.on("data", (chunk: string) => {
      stderr += chunk;
    });

    child.on("error", (error) => {
      if (timer) clearTimeout(timer);
      if (!settled) {
        settled = true;
        reject(error);
      }
    });

    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      if (settled) return;
      settled = true;
      resolve({
        command,
        args,
        code: code ?? 1,
        stdout,
        stderr,
      });
    });

    if (options.input) {
      stdinStream.write(options.input);
    }
    stdinStream.end();
  });
}

export async function runOk(
  command: string,
  args: string[],
  options: { cwd?: string; input?: string; timeoutMs?: number } = {},
): Promise<CommandResult> {
  const result = await runCommand(command, args, options);
  if (result.code !== 0) {
    throw new CommandError(result);
  }
  return result;
}
