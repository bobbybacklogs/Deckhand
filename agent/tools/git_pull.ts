import { defineTool } from "eve/tools";
import { z } from "zod";
import { gitPull } from "../../dist/lib/git.js";

export default defineTool({
  description: "Fast-forward pull from the remote tracking branch.",
  inputSchema: z.object({}),
  label: { start: () => "Pull --ff-only" },
  async execute() {
    return { result: await gitPull() };
  },
});
