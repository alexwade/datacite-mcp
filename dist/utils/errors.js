import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
export class DataCiteError extends Error {
    statusCode;
    constructor(message, statusCode) {
        super(message);
        this.name = "DataCiteError";
        this.statusCode = statusCode;
    }
}
export function notFound(doi) {
    return new McpError(ErrorCode.InvalidParams, `DOI not found: ${doi}`);
}
export function apiError(msg) {
    return new McpError(ErrorCode.InternalError, `DataCite API error: ${msg}`);
}
