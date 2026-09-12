import { defineTool } from "eve/tools";
import { z } from "zod";
import { gitCheckoutBranch } from "../../src/lib/git.js";

export default defineTool({
  description: "Create or switch a git branch.",
  inputSchema: z.object({
    name: z.string().min(1),
    create: z.boolean().default(true),
  }),
  label: { start: ({ name, create }) => (create ? `Create branch ${name}` : `Switch to ${name}`) },
  async execute({ name, create }) {
    return { result: await gitCheckoutBranch(name, create) };
  },
});
