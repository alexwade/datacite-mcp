import { registerResource as registerResourceTypes } from "./static/resource-types.js";
import { registerResource as registerProviders } from "./static/providers.js";
import { registerResource as registerClients } from "./static/clients.js";
import { registerResource as registerDoiRecord } from "./templates/doi-record.js";
import { registerResource as registerDoiCitations } from "./templates/doi-citations.js";
import { registerResource as registerDoiReferences } from "./templates/doi-references.js";
import { registerResource as registerProvider } from "./templates/provider.js";
import { registerResource as registerClient } from "./templates/client.js";
export function registerAllResources(server) {
    registerResourceTypes(server);
    registerProviders(server);
    registerClients(server);
    registerDoiRecord(server);
    registerDoiCitations(server);
    registerDoiReferences(server);
    registerProvider(server);
    registerClient(server);
}
