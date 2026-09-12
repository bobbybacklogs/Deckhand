import { defineTool } from "eve/tools";
import { z } from "zod";
import { createPullRequest } from "../../src/lib/gh.js";

export default defineTool({
  description: "Create a GitHub pull request with gh pr create.",
  inputSchema: z.object({
    title: z.string().min(1),
    body: z.string().min(1),
    base: z.string().optional(),
    draft: z.boolean().default(false),
  }),
  label: { start: ({ title }) => `Open PR: ${title}` },
  async execute(input) {
    return { result: await createPullRequest(input) };
  },
});
