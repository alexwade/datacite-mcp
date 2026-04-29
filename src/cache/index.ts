import { LRUCache } from "lru-cache";
import { config } from "../config.js";

function makeTtlCache<T extends {}>(ttlSeconds: number, max: number): LRUCache<string, T> {
  return new LRUCache<string, T>({
    max,
    ttl: ttlSeconds * 1000,
    ttlAutopurge: false,
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const doiCache = makeTtlCache<any>(config.cache.doiTtlSeconds, 500);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const searchCache = makeTtlCache<any>(config.cache.searchTtlSeconds, 100);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const staticCache = makeTtlCache<any>(config.cache.staticTtlSeconds, 50);

/**
 * Return a cached value for `key`, or call `fetcher()` to populate it.
 */
export async function getCached<T extends {}>(
  cache: LRUCache<string, T>,
  key: string,
  fetcher: () => Promise<T>
): Promise<T> {
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const value = await fetcher();
  cache.set(key, value);
  return value;
}
