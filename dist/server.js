import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAllTools } from "./tools/index.js";
import { registerAllResources } from "./resources/index.js";
import { registerAllPrompts } from "./prompts/index.js";
export const server = new McpServer({ name: "datacite-mcp", version: "0.1.0" }, { capabilities: { tools: {}, resources: {}, prompts: {} } });
registerAllTools(server);
registerAllResources(server);
registerAllPrompts(server);
