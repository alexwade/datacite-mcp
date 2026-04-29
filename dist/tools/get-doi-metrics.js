import { z } from "zod";
import { dataciteClient } from "../datacite/client.js";
import { getCached, doiCache } from "../cache/index.js";
import { notFound, apiError, DataCiteError } from "../utils/errors.js";
import { normalizeDoi } from "../datacite/doi-normalizer.js";
const GetMetricsSchema = z.object({
    doi: z.string().min(1),
    include_time_series: z.boolean().default(false),
});
export function registerTool(server) {
    server.tool("get_doi_metrics", "Retrieve view, download, and citation counts for a DOI. Optionally include monthly time-series arrays.", GetMetricsSchema.shape, async (params) => {
        const input = GetMetricsSchema.parse(params);
        const doi = normalizeDoi(input.doi);
        try {
            const record = await getCached(doiCache, doi, () => dataciteClient
                .get(`/dois/${encodeURIComponent(doi)}`, { detail: true })
                .then((r) => r.data));
            const a = record.attributes;
            const result = {
                doi,
                view_count: a.viewCount ?? 0,
                download_count: a.downloadCount ?? 0,
                citation_count: a.citationCount ?? 0,
            };
            if (input.include_time_series) {
                result.views_over_time = a.viewsOverTime ?? [];
                result.downloads_over_time = a.downloadsOverTime ?? [];
                result.citations_over_time = a.citationsOverTime ?? [];
            }
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(result, null, 2),
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
