import { defineTool } from "eve/tools";
import { z } from "zod";
import { gitCommit } from "../../dist/lib/git.js";

export default defineTool({
  description: "Create a git commit with the given message. Does not skip hooks.",
  inputSchema: z.object({
    message: z.string().min(1),
  }),
  label: { start: ({ message }) => `Commit: ${message.split("\n")[0]}` },
  async execute({ message }) {
    return { result: await gitCommit(message) };
  },
});
