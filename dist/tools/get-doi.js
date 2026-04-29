import { z } from "zod";
import { dataciteClient } from "../datacite/client.js";
import { getCached, doiCache } from "../cache/index.js";
import { formatDoiFull } from "../utils/formatters.js";
import { notFound, apiError, DataCiteError } from "../utils/errors.js";
import { normalizeDoi } from "../datacite/doi-normalizer.js";
const GetDoiSchema = z.object({
    doi: z.string().min(1),
    include_xml: z.boolean().default(false),
});
export function registerTool(server) {
    server.tool("get_doi", "Retrieve complete metadata for a single DOI. Accepts any common DOI format (bare, URL, doi: prefix). Optionally includes the raw DataCite Schema XML.", GetDoiSchema.shape, async (params) => {
        const input = GetDoiSchema.parse(params);
        const doi = normalizeDoi(input.doi);
        try {
            const record = await getCached(doiCache, doi, () => dataciteClient
                .get(`/dois/${encodeURIComponent(doi)}`, { detail: true })
                .then((r) => r.data));
            const full = formatDoiFull(record);
            if (input.include_xml && record.attributes.xml) {
                full.xml = Buffer.from(record.attributes.xml, "base64").toString("utf-8");
            }
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(full, null, 2),
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
