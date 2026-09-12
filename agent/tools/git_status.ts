import { defineTool } from "eve/tools";
import { z } from "zod";
import { formatStatus, gitStatus } from "../../dist/lib/git.js";

export default defineTool({
  description: "Read git status for the Deckhand workspace, including branch tracking and file changes.",
  inputSchema: z.object({}),
  label: { start: () => "Check git status" },
  async execute() {
    const status = await gitStatus();
    return { ...status, summary: formatStatus(status) };
  },
});
