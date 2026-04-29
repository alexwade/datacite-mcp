import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { dataciteClient } from "../../datacite/client.js";
import { getCached, staticCache } from "../../cache/index.js";
import type { ClientsResponse } from "../../datacite/types.js";

const URI = "datacite://clients";

export function registerResource(server: McpServer): void {
  server.resource(
    "datacite-clients",
    URI,
    {
      description: "All DataCite repository clients",
      mimeType: "application/json",
    },
    async (_uri) => {
      const response = await getCached<ClientsResponse>(
        staticCache,
        "clients:all",
        () =>
          dataciteClient.get<ClientsResponse>("/clients", {
            "page[size]": 500,
          })
      );

      const clients = (response.data ?? []).map((c) => ({
        id: c.id,
        name: c.attributes.name,
        description: c.attributes.description,
        url: c.attributes.url,
        doi_count: c.attributes.doiCount,
      }));

      return {
        contents: [
          {
            uri: URI,
            mimeType: "application/json",
            text: JSON.stringify(clients, null, 2),
          },
        ],
      };
    }
  );
}
