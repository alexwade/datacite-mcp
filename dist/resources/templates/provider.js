import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { dataciteClient } from "../../datacite/client.js";
import { getCached, staticCache } from "../../cache/index.js";
export function registerResource(server) {
    server.resource("datacite-provider", new ResourceTemplate("datacite://provider/{id}", { list: undefined }), {
        description: "Metadata for a specific DataCite provider",
        mimeType: "application/json",
    }, async (uri, variables) => {
        const rawId = Array.isArray(variables.id) ? variables.id[0] : variables.id;
        const id = decodeURIComponent(rawId ?? "");
        const response = await getCached(staticCache, `provider:${id}`, () => dataciteClient.get(`/providers/${encodeURIComponent(id)}`));
        const p = response.data;
        const result = {
            id: p.id,
            name: p.attributes.name,
            display_name: p.attributes.displayName,
            description: p.attributes.description,
            website: p.attributes.website,
            region: p.attributes.region,
            country: p.attributes.country,
            member_type: p.attributes.memberType,
            organization_type: p.attributes.organizationType,
            focus_area: p.attributes.focusArea,
            doi_count: p.attributes.doiCount,
            ror_id: p.attributes.rorId,
            created: p.attributes.created,
            updated: p.attributes.updated,
        };
        return {
            contents: [
                {
                    uri: uri.toString(),
                    mimeType: "application/json",
                    text: JSON.stringify(result, null, 2),
                },
            ],
        };
    });
}
