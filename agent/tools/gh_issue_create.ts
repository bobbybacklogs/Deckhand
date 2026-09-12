import { defineTool } from "eve/tools";
import { z } from "zod";
import { createIssue } from "../../dist/lib/gh.js";

export default defineTool({
  description: "Create a GitHub issue with gh issue create.",
  inputSchema: z.object({
    title: z.string().min(1),
    body: z.string().min(1),
    labels: z.array(z.string()).default([]),
  }),
  label: { start: ({ title }) => `Open issue: ${title}` },
  async execute(input) {
    return { result: await createIssue(input) };
  },
});
