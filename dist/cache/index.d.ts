import { LRUCache } from "lru-cache";
export declare const doiCache: LRUCache<string, any, unknown>;
export declare const searchCache: LRUCache<string, any, unknown>;
export declare const staticCache: LRUCache<string, any, unknown>;
/**
 * Return a cached value for `key`, or call `fetcher()` to populate it.
 */
export declare function getCached<T extends {}>(cache: LRUCache<string, T>, key: string, fetcher: () => Promise<T>): Promise<T>;
