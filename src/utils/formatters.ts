import type { DoiRecord, Creator, AffiliationEntry, ClientRecord } from "../datacite/types.js";

export interface FormattedCreator {
  display_name: string;
  orcid?: string;
  affiliation?: string;
}

export function formatCreator(raw: Creator): FormattedCreator {
  const result: FormattedCreator = {
    display_name: raw.name ?? [raw.familyName, raw.givenName].filter(Boolean).join(", "),
  };

  // Extract ORCID from nameIdentifiers
  if (raw.nameIdentifiers && raw.nameIdentifiers.length > 0) {
    for (const ni of raw.nameIdentifiers) {
      const scheme = ni.nameIdentifierScheme?.toUpperCase();
      if (scheme === "ORCID" || ni.nameIdentifier?.includes("orcid.org")) {
        result.orcid = ni.nameIdentifier;
        break;
      }
    }
  }

  // Take first affiliation name
  if (raw.affiliation && raw.affiliation.length > 0) {
    result.affiliation = raw.affiliation[0].name;
  }

  return result;
}

export function truncateAffiliations(
  affiliations: AffiliationEntry[]
): AffiliationEntry[] | (AffiliationEntry & { _note: string })[] {
  if (affiliations.length <= 3) return affiliations;
  const truncated = affiliations.slice(0, 3) as Array<AffiliationEntry & { _note?: string }>;
  // Add note to last entry
  const last = { ...truncated[2], _note: `... and ${affiliations.length - 3} more` };
  return [truncated[0], truncated[1], last];
}

export function formatDoiSummary(record: DoiRecord): object {
  const a = record.attributes;
  const title = a.titles?.[0]?.title ?? "(no title)";
  const creators = (a.creators ?? []).slice(0, 3).map(formatCreator);
  const firstDesc = a.descriptions?.[0]?.description ?? "";
  const abstract_snippet = firstDesc.length > 300 ? firstDesc.slice(0, 300) + "…" : firstDesc;

  return {
    doi: a.doi ?? record.id,
    title,
    creators,
    year: a.publicationYear,
    resource_type: a.types?.resourceTypeGeneral ?? a.resourceTypeGeneral,
    publisher: a.publisher,
    abstract_snippet: abstract_snippet || undefined,
    view_count: a.viewCount,
    download_count: a.downloadCount,
    citation_count: a.citationCount,
  };
}

/**
 * Extract the flat list of DOI prefix strings from a client's JSON:API relationships.
 */
export function extractPrefixes(record: ClientRecord): string[] {
  const prefixData = record.relationships?.prefixes?.data;
  if (!Array.isArray(prefixData)) return [];
  return prefixData.map((p) => p.id).filter(Boolean);
}

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
export function formatClientRecord(
  record: ClientRecord,
  stats?: ClientStats
): Record<string, unknown> {
  const a = record.attributes;
  const result: Record<string, unknown> = {
    id: record.id,
    name: a.name,
    symbol: a.symbol,
    alternateName: a.alternateName ?? null,
    description: a.description ?? null,
    url: a.url ?? null,
    clientType: a.clientType ?? null,
    isActive: a.isActive ?? null,
    year: a.year ?? null,
    language: a.language ?? [],
    domains: a.domains ?? null,
    re3data: a.re3data ?? null,
    opendoar: a.opendoar ?? null,
    issn: a.issn ?? {},
    prefixes: extractPrefixes(record),
    providerId: record.relationships?.provider?.data?.id ?? null,
    created: a.created ?? null,
    updated: a.updated ?? null,
  };

  if (stats !== undefined) {
    result.doiCount = stats.doiCount;
  }

  return result;
}

export function formatDoiFull(record: DoiRecord): object {
  const a = record.attributes;

  const creators = (a.creators ?? []).map((c) => {
    const formatted = formatCreator(c);
    const affs = c.affiliation ?? [];
    return {
      ...formatted,
      affiliations: truncateAffiliations(affs),
    };
  });

  return {
    doi: a.doi ?? record.id,
    titles: a.titles,
    creators,
    descriptions: a.descriptions,
    publication_year: a.publicationYear,
    resource_type: a.types?.resourceTypeGeneral ?? a.resourceTypeGeneral,
    resource_type_detail: a.types?.resourceType ?? a.resourceType,
    publisher: a.publisher,
    url: a.url,
    language: a.language,
    subjects: a.subjects,
    rights_list: a.rightsList,
    funding_references: a.fundingReferences,
    related_identifiers: a.relatedIdentifiers,
    geo_locations: a.geoLocations,
    sizes: a.sizes,
    formats: a.formats,
    version: a.version,
    container: a.container,
    identifiers: a.identifiers,
    contributors: a.contributors,
    schema_version: a.schemaVersion,
    state: a.state,
    created: a.created,
    registered: a.registered,
    updated: a.updated,
    view_count: a.viewCount,
    download_count: a.downloadCount,
    citation_count: a.citationCount,
  };
}
