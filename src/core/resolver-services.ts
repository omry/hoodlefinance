export interface ResolverServices {
  httpFetch?(url: string): string;
  getCachedJson?(cacheKey: string): unknown;
  getCachedString?(cacheKey: string): string;
  putCachedJson?(cacheKey: string, value: unknown, ttlSeconds: number): unknown;
  putCachedString?(cacheKey: string, value: string, ttlSeconds: number): string;
}
