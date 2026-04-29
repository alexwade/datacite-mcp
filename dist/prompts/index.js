import { registerPrompt as registerFindTopWorksByTopic } from "./find-top-works-by-topic.js";
import { registerPrompt as registerRepositorySummary } from "./repository-summary.js";
import { registerPrompt as registerResearcherProfile } from "./researcher-profile.js";
export function registerAllPrompts(server) {
    registerFindTopWorksByTopic(server);
    registerRepositorySummary(server);
    registerResearcherProfile(server);
}
