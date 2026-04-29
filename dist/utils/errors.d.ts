import { McpError } from "@modelcontextprotocol/sdk/types.js";
export declare class DataCiteError extends Error {
    statusCode?: number;
    constructor(message: string, statusCode?: number);
}
export declare function notFound(doi: string): McpError;
export declare function apiError(msg: string): McpError;
