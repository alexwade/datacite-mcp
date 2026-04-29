import { dataciteClient } from "../../datacite/client.js";
import { getCached, staticCache } from "../../cache/index.js";
const URI = "datacite://clients";
export function registerResource(server) {
    server.resource("datacite-clients", URI, {
        description: "All DataCite repository clients",
        mimeType: "application/json",
    }, async (_uri) => {
        const response = await getCached(staticCache, "clients:all", () => dataciteClient.get("/clients", {
            "page[size]": 500,
        }));
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
    });
}
