import "dotenv/config";

function getEnv(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue;
}

function getEnvNumber(key: string, defaultValue: number): number {
  const raw = process.env[key];
  if (raw === undefined) return defaultValue;
  const n = Number(raw);
  return isNaN(n) ? defaultValue : n;
}

export const config = {
  userAgentUrl: getEnv("MCP_USER_AGENT_URL", "https://github.com/datacite-mcp"),
  userAgentEmail: getEnv("MCP_USER_AGENT_EMAIL", ""),
  rateLimitRps: getEnvNumber("DATACITE_RATE_LIMIT_RPS", 10),
  cache: {
    doiTtlSeconds: getEnvNumber("CACHE_DOI_TTL_SECONDS", 3600),
    searchTtlSeconds: getEnvNumber("CACHE_SEARCH_TTL_SECONDS", 300),
    staticTtlSeconds: getEnvNumber("CACHE_STATIC_TTL_SECONDS", 86400),
  },
} as const;
