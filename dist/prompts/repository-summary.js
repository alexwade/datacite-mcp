import { z } from "zod";
import { dataciteClient } from "../datacite/client.js";
import { renderTemplate } from "./template-loader.js";
// In-memory cache for the server's lifetime.
const nameCache = new Map();
export async function resolveRepositoryName(repositoryName) {
    const key = repositoryName.trim().toLowerCase();
    if (nameCache.has(key)) {
        const cached = nameCache.get(key);
        return cached === null
            ? { type: "not_found" }
            : { type: "found", client: cached };
    }
    const response = await dataciteClient.get("/clients", {
        query: `name:"${repositoryName.trim()}"`,
        "page[size]": 5,
    });
    const data = response.data ?? [];
    if (data.length === 0) {
        nameCache.set(key, null);
        return { type: "not_found" };
    }
    const exactMatches = data.filter((r) => r.attributes.name.toLowerCase() === key);
    const pool = exactMatches.length > 0 ? exactMatches : data;
    if (pool.length === 1) {
        const match = { clientId: pool[0].id, name: pool[0].attributes.name };
        nameCache.set(key, match);
        return { type: "found", client: match };
    }
    // Multiple candidates — fetch DOI counts for ranking.
    const withCounts = await Promise.all(pool.map(async (r) => {
        let doiCount = 0;
        try {
            const res = await dataciteClient.get("/dois", { "client-id": r.id, "page[size]": 0 });
            doiCount = res.meta?.total ?? 0;
        }
        catch { }
        return { clientId: r.id, name: r.attributes.name, doiCount };
    }));
    withCounts.sort((a, b) => b.doiCount - a.doiCount);
    if (exactMatches.length > 0) {
        // Multiple exact name matches — pick the one with the most DOIs.
        const best = { clientId: withCounts[0].clientId, name: withCounts[0].name };
        nameCache.set(key, best);
        return { type: "found", client: best };
    }
    // Fuzzy matches only — ask the user to disambiguate.
    return { type: "ambiguous", candidates: withCounts };
}
const ArgsSchema = {
    repository_name: z
        .string()
        .min(1)
        .describe("Common repository name (e.g. 'Zenodo', 'Dryad', 'arXiv'). Case-insensitive."),
};
export function registerPrompt(server) {
    server.prompt("repository-summary", "Generate a comprehensive metadata quality and activity report for a DataCite repository.", ArgsSchema, async (args) => {
        const resolution = await resolveRepositoryName(args.repository_name);
        if (resolution.type === "not_found") {
            return {
                messages: [
                    {
                        role: "user",
                        content: {
                            type: "text",
                            text: `No DataCite repository found matching "${args.repository_name}". Try a different spelling, or browse repositories at https://commons.datacite.org/repositories.`,
                        },
                    },
                ],
            };
        }
        if (resolution.type === "ambiguous") {
            const rows = resolution.candidates
                .map((c, i) => `${i + 1}. **${c.name}** — client_id: \`${c.clientId}\` — DOIs: ${c.doiCount.toLocaleString()}`)
                .join("\n");
            return {
                messages: [
                    {
                        role: "user",
                        content: {
                            type: "text",
                            text: `Multiple repositories match "${args.repository_name}". Re-run with the exact name of the one you want:\n\n${rows}`,
                        },
                    },
                ],
            };
        }
        const { clientId, name: repoName } = resolution.client;
        const currentYear = new Date().getFullYear();
        const startYear = currentYear - 5;
        const yearList = Array.from({ length: 6 }, (_, i) => startYear + i).join(", ");
        const text = renderTemplate("repository-summary.txt", {
            repo_name: repoName,
            client_id: clientId,
            current_year: String(currentYear),
            start_year: String(startYear),
            prev_year: String(currentYear - 1),
            year_list: yearList,
            today: new Date().toISOString().slice(0, 10),
        });
        return {
            messages: [
                {
                    role: "user",
                    content: { type: "text", text },
                },
            ],
        };
    });
}
