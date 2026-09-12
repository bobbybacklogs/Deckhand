import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";
import { triggerWorkflow } from "../../src/lib/gh.js";

export default defineTool({
  description: "Trigger a GitHub Actions workflow with gh workflow run.",
  inputSchema: z.object({
    workflow: z.string().min(1),
    ref: z.string().optional(),
  }),
  approval: always(),
  label: { start: ({ workflow }) => `Trigger ${workflow}` },
  async execute(input) {
    return { result: await triggerWorkflow(input) };
  },
});
