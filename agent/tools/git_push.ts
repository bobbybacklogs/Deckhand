import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";
import { gitPush } from "../../dist/lib/git.js";

export default defineTool({
  description: "Push the current branch to origin. Never force-pushes.",
  inputSchema: z.object({
    setUpstream: z.boolean().default(false),
  }),
  approval: always(),
  label: { start: () => "Push to origin" },
  async execute({ setUpstream }) {
    return { result: await gitPush(undefined, setUpstream) };
  },
});
