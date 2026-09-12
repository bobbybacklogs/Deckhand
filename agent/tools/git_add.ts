import { defineTool } from "eve/tools";
import { z } from "zod";
import { gitAdd } from "../../dist/lib/git.js";

export default defineTool({
  description: "Stage files with git add. Pass an empty list to stage the whole workspace.",
  inputSchema: z.object({
    paths: z.array(z.string()).default([]),
  }),
  label: { start: ({ paths }) => (paths.length ? `Stage ${paths.join(", ")}` : "Stage all changes") },
  async execute({ paths }) {
    await gitAdd(paths);
    return { staged: paths.length ? paths : ["."] };
  },
});
