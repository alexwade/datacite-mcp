/**
 * Client-level statistics helpers.
 *
 * The DataCite /clients endpoint does not include DOI/usage counts in its
 * response attributes. These must be fetched separately via the /dois endpoint.
 */
import { dataciteClient } from "./client.js";
import { getCached, searchCache } from "../cache/index.js";
/**
 * Fetch the total DOI count for a DataCite client by calling
 * GET /dois?client-id={clientId}&page[size]=0 and reading meta.total.
 *
 * Returns null (and logs a warning to stderr) if the call fails or if
 * meta.total is absent from the response. Never throws.
 */
export async function fetchClientDoiCount(clientId) {
    try {
        const response = await getCached(searchCache, `stats:client:${clientId}`, () => dataciteClient.get("/dois", {
            "client-id": clientId,
            "page[size]": 0,
        }));
        const total = response.meta?.total;
        if (total === undefined) {
            console.error(`[datacite-mcp] includeStats: meta.total absent for client ${clientId}`);
            return null;
        }
        return total;
    }
    catch (err) {
        console.error(`[datacite-mcp] includeStats: stats fetch failed for client ${clientId}:`, err instanceof Error ? err.message : String(err));
        return null;
    }
}
