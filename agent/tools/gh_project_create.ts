import { defineTool } from "eve/tools";
import { z } from "zod";
import { createProject } from "../../src/lib/gh.js";

export default defineTool({
  description: "Create a GitHub Project with gh project create.",
  inputSchema: z.object({
    title: z.string().min(1),
    owner: z.string().min(1),
  }),
  label: { start: ({ title }) => `Create project ${title}` },
  async execute(input) {
    return { result: await createProject(input) };
  },
});
