/**
 * Client-level statistics helpers.
 *
 * The DataCite /clients endpoint does not include DOI/usage counts in its
 * response attributes. These must be fetched separately via the /dois endpoint.
 */
/**
 * Fetch the total DOI count for a DataCite client by calling
 * GET /dois?client-id={clientId}&page[size]=0 and reading meta.total.
 *
 * Returns null (and logs a warning to stderr) if the call fails or if
 * meta.total is absent from the response. Never throws.
 */
export declare function fetchClientDoiCount(clientId: string): Promise<number | null>;
