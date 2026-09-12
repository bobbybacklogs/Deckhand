import { defineTool } from "eve/tools";
import { z } from "zod";
import { generateCommitMessage } from "../../src/lib/model.js";

export default defineTool({
  description: "Ask the AI Gateway model to draft a conventional commit message from the current diff.",
  inputSchema: z.object({}),
  label: { start: () => "Draft commit message" },
  async execute() {
    return { message: await generateCommitMessage() };
  },
});
