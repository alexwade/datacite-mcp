import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerPrompt as registerFindTopWorksByTopic } from "./find-top-works-by-topic.js";
import { registerPrompt as registerRepositorySummary } from "./repository-summary.js";
import { registerPrompt as registerResearcherProfile } from "./researcher-profile.js";

export function registerAllPrompts(server: McpServer): void {
  registerFindTopWorksByTopic(server);
  registerRepositorySummary(server);
  registerResearcherProfile(server);
}
