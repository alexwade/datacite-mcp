// TypeScript interfaces for DataCite REST API responses (JSON:API format)

export interface Title {
  title: string;
  titleType?: string;
  lang?: string;
}

export interface NameIdentifier {
  nameIdentifier: string;
  nameIdentifierScheme: string;
  schemeUri?: string;
}

export interface AffiliationEntry {
  name: string;
  affiliationIdentifier?: string;
  affiliationIdentifierScheme?: string;
  schemeUri?: string;
  /** Normalized ROR URL if available */
  ror?: string;
}

export interface Creator {
  name: string;
  givenName?: string;
  familyName?: string;
  nameType?: string;
  /** Extracted ORCID URL from nameIdentifiers */
  orcid?: string;
  nameIdentifiers?: NameIdentifier[];
  affiliation?: AffiliationEntry[];
}

export interface Contributor {
  name: string;
  givenName?: string;
  familyName?: string;
  nameType?: string;
  contributorType?: string;
  nameIdentifiers?: NameIdentifier[];
  affiliation?: AffiliationEntry[];
}

export interface Description {
  description: string;
  descriptionType?: string;
  lang?: string;
}

export interface RelatedIdentifier {
  relatedIdentifier: string;
  relatedIdentifierType: string;
  relationType: string;
  resourceTypeGeneral?: string;
  relatedMetadataScheme?: string;
  schemeUri?: string;
  schemeType?: string;
}

export interface FundingReference {
  funderName: string;
  funderIdentifier?: string;
  funderIdentifierType?: string;
  awardNumber?: string;
  awardUri?: string;
  awardTitle?: string;
}

export interface Subject {
  subject: string;
  subjectScheme?: string;
  schemeUri?: string;
  valueUri?: string;
  lang?: string;
}

export interface Rights {
  rights?: string;
  rightsUri?: string;
  rightsIdentifier?: string;
  rightsIdentifierScheme?: string;
  schemeUri?: string;
  lang?: string;
}

export interface GeoLocationPoint {
  pointLongitude: number;
  pointLatitude: number;
}

export interface GeoLocationBox {
  westBoundLongitude: number;
  eastBoundLongitude: number;
  southBoundLatitude: number;
  northBoundLatitude: number;
}

export interface GeoLocation {
  geoLocationPlace?: string;
  geoLocationPoint?: GeoLocationPoint;
  geoLocationBox?: GeoLocationBox;
}

export interface TimePoint {
  yearMonth?: string;
  total?: number;
}

export interface DoiAttributes {
  doi: string;
  titles: Title[];
  creators: Creator[];
  descriptions: Description[];
  publicationYear?: number;
  resourceTypeGeneral?: string;
  resourceType?: string;
  publisher?: string;
  url?: string;
  relatedIdentifiers?: RelatedIdentifier[];
  contributors?: Contributor[];
  fundingReferences?: FundingReference[];
  subjects?: Subject[];
  rightsList?: Rights[];
  geoLocations?: GeoLocation[];
  viewCount?: number;
  downloadCount?: number;
  citationCount?: number;
  viewsOverTime?: TimePoint[];
  downloadsOverTime?: TimePoint[];
  citationsOverTime?: TimePoint[];
  schemaVersion?: string;
  /** Base64-encoded DataCite Schema XML */
  xml?: string;
  state?: string;
  created?: string;
  registered?: string;
  updated?: string;
  language?: string;
  sizes?: string[];
  formats?: string[];
  version?: string;
  identifiers?: Array<{ identifier: string; identifierType: string }>;
  types?: {
    resourceTypeGeneral?: string;
    resourceType?: string;
    schemaOrg?: string;
    bibtex?: string;
    citeproc?: string;
    ris?: string;
  };
  container?: {
    type?: string;
    identifier?: string;
    identifierType?: string;
    title?: string;
    volume?: string;
    issue?: string;
    firstPage?: string;
    lastPage?: string;
  };
}

export interface DoiRecord {
  id: string;
  type: string;
  attributes: DoiAttributes;
  relationships?: Record<string, unknown>;
}

export interface DoiResponse {
  data: DoiRecord;
}

export interface SearchMeta {
  total: number;
  totalPages: number;
  page: number;
  scroll?: string;
  [key: string]: unknown;
}

export interface SearchLinks {
  self?: string;
  first?: string;
  prev?: string;
  next?: string;
  last?: string;
}

export interface SearchResponse {
  data: DoiRecord[];
  meta: SearchMeta;
  links: SearchLinks;
}

// Client (repository) types

export interface ClientPrefixRelationship {
  data: Array<{ id: string; type: string }>;
}

export interface ClientProviderRelationship {
  data: { id: string; type: string };
}

export interface ClientRelationships {
  provider?: ClientProviderRelationship;
  prefixes?: ClientPrefixRelationship;
  [key: string]: unknown;
}

export interface ClientAttributes {
  name: string;
  symbol?: string;
  year?: number;
  alternateName?: string | null;
  contactEmail?: string;
  description?: string;
  language?: string[];
  clientType?: string;
  domains?: string;
  re3data?: string | null;
  opendoar?: string | null;
  /** For periodical-type clients */
  issn?: Record<string, unknown>;
  url?: string;
  created?: string;
  updated?: string;
  isActive?: boolean;
  hasPassword?: boolean;
  doiCount?: number;
  viewCount?: number;
  downloadCount?: number;
  citationCount?: number;
  crossrefEnabled?: boolean;
  certificate?: string[];
  repositoryType?: string[];
  software?: Array<{ name: string }>;
}

export interface ClientRecord {
  id: string;
  type: string;
  attributes: ClientAttributes;
  relationships?: ClientRelationships;
}

export interface ClientResponse {
  data: ClientRecord;
}

export interface ClientsMeta {
  total: number;
  totalPages?: number;
  page?: number;
  [key: string]: unknown;
}

export interface ClientsResponse {
  data: ClientRecord[];
  meta: ClientsMeta;
  links?: SearchLinks;
}

// Provider types

export interface ProviderAttributes {
  name: string;
  symbol?: string;
  displayName?: string;
  website?: string;
  description?: string;
  region?: string;
  country?: string;
  memberType?: string;
  organizationType?: string;
  focusArea?: string;
  logoUrl?: string;
  created?: string;
  updated?: string;
  isActive?: boolean;
  doiCount?: number;
  contactEmail?: string;
  rorId?: string;
}

export interface ProviderRecord {
  id: string;
  type: string;
  attributes: ProviderAttributes;
  relationships?: Record<string, unknown>;
}

export interface ProviderResponse {
  data: ProviderRecord;
}

export interface ProvidersMeta {
  total: number;
  totalPages?: number;
  page?: number;
  [key: string]: unknown;
}

export interface ProvidersResponse {
  data: ProviderRecord[];
  meta: ProvidersMeta;
  links?: SearchLinks;
}
