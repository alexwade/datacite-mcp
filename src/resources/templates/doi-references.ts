import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { dataciteClient } from "../../datacite/client.js";
import { getCached, searchCache } from "../../cache/index.js";
import { formatDoiSummary } from "../../utils/formatters.js";
import { normalizeDoi } from "../../datacite/doi-normalizer.js";
import type { SearchResponse } from "../../datacite/types.js";

export function registerResource(server: McpServer): void {
  server.resource(
    "datacite-doi-references",
    new ResourceTemplate("datacite://doi/{doi}/references", { list: undefined }),
    {
      description: "Works cited by the given DOI",
      mimeType: "application/json",
    },
    async (uri, variables) => {
      const rawDoi = Array.isArray(variables.doi) ? variables.doi[0] : variables.doi;
      const doi = normalizeDoi(decodeURIComponent(rawDoi ?? ""));

      const response = await getCached<SearchResponse>(
        searchCache,
        `references:${doi}:25`,
        () =>
          dataciteClient.get<SearchResponse>(`/dois/${encodeURIComponent(doi)}/references`, {
            "page[size]": 25,
            detail: true,
          })
      );

      const works = (response.data ?? []).map(formatDoiSummary);

      return {
        contents: [
          {
            uri: uri.toString(),
            mimeType: "application/json",
            text: JSON.stringify(
              { doi, works, total: response.meta?.total ?? works.length },
              null,
              2
            ),
          },
        ],
      };
    }
  );
}
