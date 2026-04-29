import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { dataciteClient } from "../../datacite/client.js";
import { getCached, doiCache } from "../../cache/index.js";
import { formatDoiFull } from "../../utils/formatters.js";
import { normalizeDoi } from "../../datacite/doi-normalizer.js";
import type { DoiResponse, DoiRecord } from "../../datacite/types.js";

export function registerResource(server: McpServer): void {
  server.resource(
    "datacite-doi-record",
    new ResourceTemplate("datacite://doi/{doi}", { list: undefined }),
    {
      description: "Full metadata record for a given DOI as JSON",
      mimeType: "application/json",
    },
    async (uri, variables) => {
      const rawDoi = Array.isArray(variables.doi) ? variables.doi[0] : variables.doi;
      const doi = normalizeDoi(decodeURIComponent(rawDoi ?? ""));

      const record = await getCached<DoiRecord>(
        doiCache,
        doi,
        () =>
          dataciteClient
            .get<DoiResponse>(`/dois/${encodeURIComponent(doi)}`, { detail: true })
            .then((r) => r.data)
      );

      const full = formatDoiFull(record);

      return {
        contents: [
          {
            uri: uri.toString(),
            mimeType: "application/json",
            text: JSON.stringify(full, null, 2),
          },
        ],
      };
    }
  );
}
