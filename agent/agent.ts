import { defineAgent } from "eve";

export default defineAgent({
  model: process.env.DECKHAND_MODEL || "inclusionai/ling-3.0-flash-fin-free",
});
