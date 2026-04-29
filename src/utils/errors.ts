import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";

export class DataCiteError extends Error {
  statusCode?: number;
  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = "DataCiteError";
    this.statusCode = statusCode;
  }
}

export function notFound(doi: string): McpError {
  return new McpError(
    ErrorCode.InvalidParams,
    `DOI not found: ${doi}`
  );
}

export function apiError(msg: string): McpError {
  return new McpError(ErrorCode.InternalError, `DataCite API error: ${msg}`);
}
