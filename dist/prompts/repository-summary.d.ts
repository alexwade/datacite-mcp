import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
interface ResolvedClient {
    clientId: string;
    name: string;
}
interface ClientCandidate {
    clientId: string;
    name: string;
    doiCount: number;
}
type ResolveResult = {
    type: "found";
    client: ResolvedClient;
} | {
    type: "ambiguous";
    candidates: ClientCandidate[];
} | {
    type: "not_found";
};
export declare function resolveRepositoryName(repositoryName: string): Promise<ResolveResult>;
export declare function registerPrompt(server: McpServer): void;
export {};
