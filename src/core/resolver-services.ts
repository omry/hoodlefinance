export interface StoredTextResource {
  fetchedAtMs: number;
  text: string;
}

export interface ResolverServices {
  // Network fetches for live upstream resources.
  httpFetch?(url: string): string;

  // JSON cache for structured quote and lookup payloads.
  getCachedJson?(cacheKey: string): unknown;
  putCachedJson?(cacheKey: string, value: unknown, ttlSeconds: number): unknown;

  // String cache for raw text resources such as maps and whitelists.
  getCachedString?(cacheKey: string): string;
  putCachedString?(cacheKey: string, value: string, ttlSeconds: number): string;

  // Durable stored text resources for environments with a backing store.
  getStoredTextResource?(resourceKey: string): StoredTextResource | null;
  putStoredTextResource?(
    resourceKey: string,
    text: string,
    fetchedAtMs: number,
  ): StoredTextResource | null;
}
