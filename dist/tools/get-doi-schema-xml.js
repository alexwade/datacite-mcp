import { z } from "zod";
import { dataciteClient } from "../datacite/client.js";
import { getCached, doiCache } from "../cache/index.js";
import { notFound, apiError, DataCiteError } from "../utils/errors.js";
import { normalizeDoi } from "../datacite/doi-normalizer.js";
const GetDoiSchemaXmlSchema = z.object({
    doi: z.string().min(1),
});
export function registerTool(server) {
    server.tool("get_doi_schema_xml", "Fetch the raw DataCite Metadata Schema XML for a DOI (base64-decoded). Useful for inspecting the complete, canonical metadata record.", GetDoiSchemaXmlSchema.shape, async (params) => {
        const input = GetDoiSchemaXmlSchema.parse(params);
        const doi = normalizeDoi(input.doi);
        try {
            const record = await getCached(doiCache, doi, () => dataciteClient
                .get(`/dois/${encodeURIComponent(doi)}`, { detail: true })
                .then((r) => r.data));
            if (!record.attributes.xml) {
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({ doi, xml: null, message: "No XML available for this DOI." }, null, 2),
                        },
                    ],
                };
            }
            const xml = Buffer.from(record.attributes.xml, "base64").toString("utf-8");
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({ doi, xml }, null, 2),
                    },
                ],
            };
        }
        catch (err) {
            if (err instanceof DataCiteError && err.statusCode === 404) {
                throw notFound(doi);
            }
            const msg = err instanceof Error ? err.message : String(err);
            throw apiError(msg);
        }
    });
}
