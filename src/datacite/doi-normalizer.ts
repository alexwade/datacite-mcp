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
export function normalizeDoi(input: string): string {
  let doi = input.trim();

  // Strip URL prefixes
  if (doi.toLowerCase().startsWith("https://doi.org/")) {
    doi = doi.slice("https://doi.org/".length);
  } else if (doi.toLowerCase().startsWith("http://doi.org/")) {
    doi = doi.slice("http://doi.org/".length);
  } else if (doi.toLowerCase().startsWith("doi:")) {
    doi = doi.slice("doi:".length);
  }

  // Lowercase only the prefix (registrant prefix, e.g. "10.5061")
  const slashIndex = doi.indexOf("/");
  if (slashIndex !== -1) {
    const prefix = doi.slice(0, slashIndex).toLowerCase();
    const suffix = doi.slice(slashIndex + 1);
    doi = `${prefix}/${suffix}`;
  } else {
    doi = doi.toLowerCase();
  }

  return doi;
}
