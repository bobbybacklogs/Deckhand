import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";
import { createRepo } from "../../dist/lib/gh.js";

export default defineTool({
  description: "Create a GitHub repository from the current directory with gh repo create.",
  inputSchema: z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    privateRepo: z.boolean().default(false),
  }),
  approval: always(),
  label: { start: ({ name }) => `Create repo ${name}` },
  async execute(input) {
    return { result: await createRepo(input) };
  },
});
