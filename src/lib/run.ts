import { spawn } from "node:child_process";

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

export function runCommand(
  command: string,
  args: string[],
  options: { cwd?: string; input?: string; timeoutMs?: number } = {},
): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: process.env,
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });

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

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
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
      child.stdin.write(options.input);
    }
    child.stdin.end();
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
