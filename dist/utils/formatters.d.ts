import type { DoiRecord, Creator, AffiliationEntry, ClientRecord } from "../datacite/types.js";
export interface FormattedCreator {
    display_name: string;
    orcid?: string;
    affiliation?: string;
}
export declare function formatCreator(raw: Creator): FormattedCreator;
export declare function truncateAffiliations(affiliations: AffiliationEntry[]): AffiliationEntry[] | (AffiliationEntry & {
    _note: string;
})[];
export declare function formatDoiSummary(record: DoiRecord): object;
/**
 * Extract the flat list of DOI prefix strings from a client's JSON:API relationships.
 */
export declare function extractPrefixes(record: ClientRecord): string[];
export interface ClientStats {
    /** null signals "we tried but the secondary call failed or returned no value" */
    doiCount: number | null;
}
/**
 * Shape a ClientRecord into the standard MCP response object.
 *
 * @param stats - When provided, merges `doiCount` into the response.
 *   Omit entirely (or pass undefined) to exclude all count fields.
 *   Note: per-client viewCount/downloadCount/citationCount are not
 *   exposed by the DataCite /clients endpoint; only doiCount is supported.
 */
export declare function formatClientRecord(record: ClientRecord, stats?: ClientStats): Record<string, unknown>;
export declare function formatDoiFull(record: DoiRecord): object;
