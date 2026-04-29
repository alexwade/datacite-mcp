import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { dataciteClient } from "../datacite/client.js";
import { getCached, searchCache } from "../cache/index.js";
import { formatDoiSummary } from "../utils/formatters.js";
import { apiError } from "../utils/errors.js";
import { normalizeDoi } from "../datacite/doi-normalizer.js";
import type { SearchResponse } from "../datacite/types.js";

const SearchByPersonSchema = z.object({
  orcid: z.string().optional(),
  name: z.string().optional(),
  role: z.enum(["creator", "contributor", "any"]).default("any"),
  resource_type: z.string().optional(),
  page_size: z.number().int().min(1).max(100).default(25),
}).refine((v) => v.orcid || v.name, {
  message: "At least one of 'orcid' or 'name' is required",
});

export function registerTool(server: McpServer): void {
  server.tool(
    "search_by_person",
    "Find all DOIs associated with a researcher by ORCID iD or name.",
    {
      orcid: z.string().optional(),
      name: z.string().optional(),
      role: z.enum(["creator", "contributor", "any"]).default("any"),
      resource_type: z.string().optional(),
      page_size: z.number().int().min(1).max(100).default(25),
    },
    async (params) => {
      const input = SearchByPersonSchema.parse(params);

      const queryParts: string[] = [];

      if (input.orcid) {
        const orcidId = input.orcid.replace(/^https?:\/\/orcid\.org\//, "");
        const orcidUrl = `https://orcid.org/${orcidId}`;
        if (input.role === "creator" || input.role === "any") {
          queryParts.push(
            `creators.nameIdentifiers.nameIdentifier:"${orcidUrl}"`
          );
        }
        if (input.role === "contributor") {
          queryParts.push(
            `contributors.nameIdentifiers.nameIdentifier:"${orcidUrl}"`
          );
        }
      } else if (input.name) {
        if (input.role === "creator" || input.role === "any") {
          queryParts.push(`creators.name:"${input.name}"`);
        }
        if (input.role === "contributor") {
          queryParts.push(`contributors.name:"${input.name}"`);
        }
      }

      const query = queryParts.join(" OR ");

      const apiParams: Record<string, string | number | boolean> = {
        query,
        "page[size]": input.page_size,
        detail: true,
      };

      if (input.resource_type) {
        apiParams["resource-type-id"] = input.resource_type.toLowerCase();
      }

      const cacheKey = JSON.stringify(
        Object.entries(apiParams).sort(([a], [b]) => a.localeCompare(b))
      );

      try {
        const response = await getCached<SearchResponse>(
          searchCache,
          cacheKey,
          () => dataciteClient.get<SearchResponse>("/dois", apiParams)
        );

        let next_cursor: string | null = null;
        if (response.links?.next) {
          try {
            const nextUrl = new URL(response.links.next);
            next_cursor = nextUrl.searchParams.get("page[cursor]");
          } catch {
            // ignore
          }
        }

        const results = (response.data ?? []).map(formatDoiSummary);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  results,
                  total_results: response.meta?.total ?? results.length,
                  next_cursor,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw apiError(msg);
      }
    }
  );
}
