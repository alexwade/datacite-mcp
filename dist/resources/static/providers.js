import { dataciteClient } from "../../datacite/client.js";
import { getCached, staticCache } from "../../cache/index.js";
const URI = "datacite://providers";
export function registerResource(server) {
    server.resource("datacite-providers", URI, {
        description: "All DataCite member providers (organisations)",
        mimeType: "application/json",
    }, async (_uri) => {
        const response = await getCached(staticCache, "providers:all", () => dataciteClient.get("/providers", {
            "page[size]": 500,
        }));
        const providers = (response.data ?? []).map((p) => ({
            id: p.id,
            name: p.attributes.name,
            description: p.attributes.description,
            website: p.attributes.website,
        }));
        return {
            contents: [
                {
                    uri: URI,
                    mimeType: "application/json",
                    text: JSON.stringify(providers, null, 2),
                },
            ],
        };
    });
}
