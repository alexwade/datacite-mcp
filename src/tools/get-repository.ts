import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { dataciteClient } from "../datacite/client.js";
import { getCached, staticCache } from "../cache/index.js";
import { apiError, notFound, DataCiteError } from "../utils/errors.js";
import { formatClientRecord, type ClientStats } from "../utils/formatters.js";
import { fetchClientDoiCount } from "../datacite/stats.js";
import type { ClientResponse } from "../datacite/types.js";

const GetRepositorySchema = z.object({
  id: z
    .string()
    .min(1)
    .describe(
      "DataCite client ID (e.g. 'cern.zenodo', 'dryad.dryad'). " +
        "Use list_repositories to discover IDs."
    ),
  includeStats: z
    .boolean()
    .default(false)
    .describe(
      "When true, adds doiCount fetched via /dois?client-id={id}&page[size]=0. " +
        "Returns doiCount:null if the secondary call fails. " +
        "Note: viewCount/downloadCount/citationCount are not available from the DataCite API."
    ),
});

export function registerTool(server: McpServer): void {
  server.tool(
    "get_repository",
    "Retrieve full metadata for a single DataCite repository (client) by its ID. " +
      "Returns name, symbol, alternateName, clientType, isActive, re3data, opendoar, " +
      "issn, prefixes, language, year, created, updated, and more. " +
      "Pass includeStats:true to add doiCount (fetched via a secondary /dois call). " +
      "Note: per-client view/download/citation counts are not exposed by the DataCite API.",
    GetRepositorySchema.shape,
    async (params) => {
      const input = GetRepositorySchema.parse(params);

      try {
        const [response, doiCount] = await Promise.all([
          getCached<ClientResponse>(
            staticCache,
            `client:${input.id}`,
            () =>
              dataciteClient.get<ClientResponse>(
                `/clients/${encodeURIComponent(input.id)}`,
                { include: "prefixes" }
              )
          ),
          input.includeStats
            ? fetchClientDoiCount(input.id)
            : Promise.resolve(undefined),
        ]);

        // doiCount is number | null | undefined:
        //   undefined  → includeStats:false, omit from response
        //   null       → call failed, include doiCount:null
        //   number     → successful fetch
        const stats: ClientStats | undefined =
          input.includeStats ? { doiCount: doiCount ?? null } : undefined;

        const result = formatClientRecord(response.data, stats);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (err) {
        if (err instanceof DataCiteError && err.statusCode === 404) {
          throw notFound(input.id);
        }
        const msg = err instanceof Error ? err.message : String(err);
        throw apiError(msg);
      }
    }
  );
}
