import { defineTool } from "eve/tools";
import { z } from "zod";
import { gitConflictFiles } from "../../dist/lib/git.js";
import { suggestConflictResolution } from "../../dist/lib/model.js";

export default defineTool({
  description: "List conflicted files and return AI Gateway guidance for resolving them.",
  inputSchema: z.object({}),
  label: { start: () => "Inspect merge conflicts" },
  async execute() {
    const files = await gitConflictFiles();
    const guidance = files.length ? await suggestConflictResolution(files) : "No merge conflicts.";
    return { files, guidance };
  },
});
