import { defineTool } from "eve/tools";
import { z } from "zod";
import { listRuns } from "../../dist/lib/gh.js";

export default defineTool({
  description: "List recent GitHub Actions workflow runs.",
  inputSchema: z.object({}),
  label: { start: () => "List Actions runs" },
  async execute() {
    return { result: await listRuns() };
  },
});
