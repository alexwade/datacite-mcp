import { z } from "zod";
import { renderTemplate } from "./template-loader.js";
const ORCID_PATTERN = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/;
const ArgsSchema = {
    identifier: z
        .string()
        .min(1)
        .describe("ORCID iD (e.g. 0000-0001-8135-3489, with or without https://orcid.org/ prefix) " +
        "or researcher name (e.g. 'Jane Smith' or 'Smith, Jane')."),
};
export function registerPrompt(server) {
    server.prompt("researcher-profile", "Generate a researcher profile showing all works registered with DataCite. " +
        "Provide an ORCID iD for exact matching, or a name for fuzzy search with disambiguation.", ArgsSchema, (args) => {
        const stripped = args.identifier
            .trim()
            .replace(/^https?:\/\/orcid\.org\//i, "");
        const isOrcid = ORCID_PATTERN.test(stripped);
        const today = new Date().toISOString().slice(0, 10);
        const text = isOrcid
            ? renderTemplate("researcher-profile-orcid.txt", {
                orcid: stripped,
                today,
            })
            : renderTemplate("researcher-profile-name.txt", {
                name: args.identifier.trim(),
                name_reversed: args.identifier.trim().split(" ").reverse().join(", "),
                today,
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
