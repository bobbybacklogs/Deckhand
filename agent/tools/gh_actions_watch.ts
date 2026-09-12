import { defineTool } from "eve/tools";
import { z } from "zod";
import { watchRun } from "../../dist/lib/gh.js";

export default defineTool({
  description: "Watch a GitHub Actions run until it completes.",
  inputSchema: z.object({
    runId: z.string().optional(),
  }),
  label: { start: ({ runId }) => (runId ? `Watch run ${runId}` : "Watch latest run") },
  async execute({ runId }) {
    return { result: await watchRun(runId) };
  },
});
