import { defineTool } from "eve/tools";
import { z } from "zod";
import { listChecks } from "../../src/lib/gh.js";

export default defineTool({
  description: "Show GitHub Actions / status checks for the current pull request.",
  inputSchema: z.object({}),
  label: { start: () => "Read PR checks" },
  async execute() {
    return { result: await listChecks() };
  },
});
