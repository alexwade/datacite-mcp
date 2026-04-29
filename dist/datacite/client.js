import Bottleneck from "bottleneck";
import { config } from "../config.js";
import { DataCiteError } from "../utils/errors.js";
const BASE_URL = "https://api.datacite.org";
function buildUserAgent() {
    const parts = [`datacite-mcp/0.1.0 (+${config.userAgentUrl}`];
    if (config.userAgentEmail) {
        parts[0] += `; mailto:${config.userAgentEmail}`;
    }
    parts[0] += ")";
    return parts[0];
}
const USER_AGENT = buildUserAgent();
async function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function jitter(base) {
    return base + Math.random() * base * 0.5;
}
export class DataCiteClient {
    limiter;
    constructor() {
        this.limiter = new Bottleneck({
            maxConcurrent: 5,
            minTime: Math.ceil(1000 / config.rateLimitRps),
        });
    }
    async fetchWithRetry(url, headers) {
        const maxRetries = 3;
        let lastError = null;
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            const res = await this.limiter.schedule(() => fetch(url, { headers }));
            if (res.ok)
                return res;
            if (res.status === 429 || res.status >= 500) {
                const delay = jitter(500 * Math.pow(2, attempt));
                lastError = new DataCiteError(`HTTP ${res.status} from DataCite API`, res.status);
                if (attempt < maxRetries - 1) {
                    await sleep(delay);
                    continue;
                }
            }
            else if (res.status === 404) {
                throw new DataCiteError(`Not found (404)`, 404);
            }
            else {
                const body = await res.text().catch(() => "");
                throw new DataCiteError(`HTTP ${res.status}: ${body.slice(0, 200)}`, res.status);
            }
        }
        throw lastError ?? new DataCiteError("Unknown fetch error");
    }
    async get(path, params) {
        const url = new URL(`${BASE_URL}${path}`);
        if (params) {
            for (const [k, v] of Object.entries(params)) {
                url.searchParams.set(k, String(v));
            }
        }
        const res = await this.fetchWithRetry(url.toString(), {
            Accept: "application/vnd.api+json",
            "User-Agent": USER_AGENT,
        });
        return res.json();
    }
    async getUrl(targetUrl) {
        const res = await this.fetchWithRetry(targetUrl, {
            Accept: "application/vnd.api+json",
            "User-Agent": USER_AGENT,
        });
        return res.json();
    }
    async getText(targetUrl, accept) {
        const res = await this.fetchWithRetry(targetUrl, {
            Accept: accept,
            "User-Agent": USER_AGENT,
        });
        return res.text();
    }
}
export const dataciteClient = new DataCiteClient();
