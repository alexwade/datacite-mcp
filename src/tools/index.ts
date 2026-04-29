import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTool as registerSearchDois } from "./search-dois.js";
import { registerTool as registerGetDoi } from "./get-doi.js";
import { registerTool as registerFormatCitation } from "./format-citation.js";
import { registerTool as registerGetDoiMetrics } from "./get-doi-metrics.js";
import { registerTool as registerGetRelatedWorks } from "./get-related-works.js";
import { registerTool as registerSearchByPerson } from "./search-by-person.js";
import { registerTool as registerListRepositories } from "./list-repositories.js";
import { registerTool as registerGetRepository } from "./get-repository.js";
import { registerTool as registerGetDoiSchemaXml } from "./get-doi-schema-xml.js";

export function registerAllTools(server: McpServer): void {
  registerSearchDois(server);
  registerGetDoi(server);
  registerFormatCitation(server);
  registerGetDoiMetrics(server);
  registerGetRelatedWorks(server);
  registerSearchByPerson(server);
  registerListRepositories(server);
  registerGetRepository(server);
  registerGetDoiSchemaXml(server);
}
