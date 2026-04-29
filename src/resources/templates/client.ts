import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { dataciteClient } from "../../datacite/client.js";
import { getCached, staticCache } from "../../cache/index.js";
import { formatClientRecord, type ClientStats } from "../../utils/formatters.js";
import { fetchClientDoiCount } from "../../datacite/stats.js";
import type { ClientResponse } from "../../datacite/types.js";

export function registerResource(server: McpServer): void {
  server.resource(
    "datacite-client",
    new ResourceTemplate("datacite://client/{id}", { list: undefined }),
    {
      description:
        "Full metadata for a specific DataCite repository client, including " +
        "re3data, prefixes, isActive, language, issn, lifecycle timestamps, and doiCount.",
      mimeType: "application/json",
    },
    async (uri, variables) => {
      const rawId = Array.isArray(variables.id) ? variables.id[0] : variables.id;
      const id = decodeURIComponent(rawId ?? "");

      const [response, doiCount] = await Promise.all([
        getCached<ClientResponse>(
          staticCache,
          `client:${id}`,
          () =>
            dataciteClient.get<ClientResponse>(
              `/clients/${encodeURIComponent(id)}`,
              { include: "prefixes" }
            )
        ),
        fetchClientDoiCount(id),
      ]);

      // Resource templates always show stats; null means the secondary call failed.
      const stats: ClientStats = { doiCount: doiCount ?? null };

      const result = formatClientRecord(response.data, stats);

      return {
        contents: [
          {
            uri: uri.toString(),
            mimeType: "application/json",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );
}
