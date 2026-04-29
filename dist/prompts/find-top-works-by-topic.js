import { z } from "zod";
import { renderTemplate } from "./template-loader.js";
const RESOURCE_TYPE_ENUM = [
    "Audiovisual",
    "Book",
    "BookChapter",
    "Collection",
    "ComputationalNotebook",
    "ConferencePaper",
    "ConferenceProceeding",
    "DataPaper",
    "Dataset",
    "Dissertation",
    "Event",
    "Image",
    "Instrument",
    "InteractiveResource",
    "Journal",
    "JournalArticle",
    "Model",
    "OutputManagementPlan",
    "PeerReview",
    "PhysicalObject",
    "Preprint",
    "Report",
    "Service",
    "Software",
    "Sound",
    "Standard",
    "StudyRegistration",
    "Text",
    "Workflow",
    "Other",
];
const ArgsSchema = {
    resource_type: z
        .string()
        .transform((val, ctx) => {
        const match = RESOURCE_TYPE_ENUM.find((e) => e.toLowerCase() === val.toLowerCase());
        if (!match) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `Invalid resource_type "${val}". Expected one of: ${RESOURCE_TYPE_ENUM.join(", ")}.`,
            });
            return z.NEVER;
        }
        return match;
    })
        .describe("DataCite controlled resource type (e.g. Dataset, Software, Preprint). Case-insensitive."),
    topic: z
        .string()
        .min(1)
        .describe("Subject area or keywords to search (e.g. 'single-cell RNA sequencing', 'climate downscaling')."),
};
export function registerPrompt(server) {
    server.prompt("find-top-works-by-topic", "Find the top 10 most relevant works in DataCite for a given resource type and subject area.", ArgsSchema, (args) => {
        const resourceType = args.resource_type;
        const supplementaryNotes = {
            ComputationalNotebook: `
**Supplementary query required for ComputationalNotebook:**
Also call \`search_dois\` with:
- resource_type omitted
- query = \`types.resourceType:"Computational Notebook" AND ${args.topic}\`
- page_size = 10
- sort omitted

Many computational notebooks are filed under Software or Text with "Computational Notebook" in the free-text resource type field. Merge both result sets and deduplicate by DOI.
If the merged results are dominated by the supplementary query, note in the output: "Note: X% of matching records use the ComputationalNotebook general type; the rest are filed under other types with 'Computational Notebook' in the free-text field."`,
            Preprint: `
**Supplementary query required for Preprint:**
Also call \`search_dois\` with:
- resource_type = "Text"
- query = \`types.resourceType:Preprint AND ${args.topic}\`
- page_size = 10
- sort omitted

Pre-2020 preprints are often filed as Text in DataCite. Merge both result sets and deduplicate by DOI.`,
            Dataset: `
**Supplementary query for Dataset:**
Also call \`search_dois\` with:
- resource_type omitted
- query = \`types.resourceType:Dataset AND ${args.topic}\`
- page_size = 10
- sort omitted

Some datasets are registered under Collection, Other, or Text. Merge both result sets and deduplicate by DOI.`,
        };
        const supplementary = supplementaryNotes[resourceType] ?? "";
        const text = renderTemplate("find-top-works-by-topic.txt", {
            resource_type: resourceType,
            topic: args.topic,
            supplementary,
            supplementary_caveat: supplementary
                ? "\n- Explain why a supplementary query was run and what it found"
                : "",
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
