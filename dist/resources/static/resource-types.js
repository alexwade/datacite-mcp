const RESOURCE_TYPES = [
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
export function registerResource(server) {
    server.resource("datacite-resource-types", "datacite://schema/resource-types", {
        description: "The complete DataCite resourceTypeGeneral controlled vocabulary",
        mimeType: "application/json",
    }, async (_uri) => ({
        contents: [
            {
                uri: "datacite://schema/resource-types",
                mimeType: "application/json",
                text: JSON.stringify(RESOURCE_TYPES, null, 2),
            },
        ],
    }));
}
