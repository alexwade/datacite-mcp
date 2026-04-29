import { z } from "zod";
import { dataciteClient } from "../datacite/client.js";
import { normalizeDoi } from "../datacite/doi-normalizer.js";
import { apiError } from "../utils/errors.js";
const FormatCitationSchema = z.object({
    doi: z.string().min(1),
    style: z
        .enum(["apa", "mla", "chicago", "harvard", "ieee", "vancouver", "bibtex", "citeproc-json"])
        .default("apa"),
    locale: z.string().default("en-US"),
});
function getAcceptHeader(style, locale) {
    if (style === "bibtex")
        return "application/x-bibtex";
    if (style === "citeproc-json")
        return "application/vnd.citationstyles.csl+json";
    return `text/x-bibliography; style=${style}; locale=${locale}`;
}
export function registerTool(server) {
    server.tool("format_citation", "Format a DOI as a citation string. Supports APA, MLA, Chicago, Harvard, IEEE, Vancouver, BibTeX, and CSL JSON styles.", FormatCitationSchema.shape, async (params) => {
        const input = FormatCitationSchema.parse(params);
        const doi = normalizeDoi(input.doi);
        const accept = getAcceptHeader(input.style, input.locale);
        const url = `https://doi.org/${doi}`;
        try {
            const citation = await dataciteClient.getText(url, accept);
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({ citation: citation.trim(), style: input.style, doi }, null, 2),
                    },
                ],
            };
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            throw apiError(msg);
        }
    });
}
