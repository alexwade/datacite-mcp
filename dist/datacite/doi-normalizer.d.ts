/**
 * Normalize a DOI from any common input format to a bare DOI string.
 * Handles:
 *   - https://doi.org/10.1234/foo
 *   - http://doi.org/10.1234/foo
 *   - doi:10.1234/foo
 *   - 10.1234/foo
 * The prefix (everything before the first '/') is lowercased.
 * The suffix is preserved as-is.
 */
export declare function normalizeDoi(input: string): string;
