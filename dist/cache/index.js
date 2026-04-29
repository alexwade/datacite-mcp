import { LRUCache } from "lru-cache";
import { config } from "../config.js";
function makeTtlCache(ttlSeconds, max) {
    return new LRUCache({
        max,
        ttl: ttlSeconds * 1000,
        ttlAutopurge: false,
    });
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const doiCache = makeTtlCache(config.cache.doiTtlSeconds, 500);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const searchCache = makeTtlCache(config.cache.searchTtlSeconds, 100);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const staticCache = makeTtlCache(config.cache.staticTtlSeconds, 50);
/**
 * Return a cached value for `key`, or call `fetcher()` to populate it.
 */
export async function getCached(cache, key, fetcher) {
    const hit = cache.get(key);
    if (hit !== undefined)
        return hit;
    const value = await fetcher();
    cache.set(key, value);
    return value;
}
