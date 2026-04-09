import {
  ResolverServices,
  type StoredTextResource,
} from "./ResolverServices";

export interface StandAloneResolverServicesOptions {
  httpFetch(url: string): string;
}

export class StandAloneResolverServices extends ResolverServices {
  private readonly fetchText: (url: string) => string;
  private readonly cachedJsonByKey = new Map<string, unknown>();
  private readonly cachedStringByKey = new Map<string, string>();
  private readonly storedTextResourceByKey = new Map<string, StoredTextResource>();

  constructor(options: StandAloneResolverServicesOptions) {
    super();
    this.fetchText = options.httpFetch;
  }

  override httpFetch = (url: string): string => this.fetchText(url);

  override getCachedJson = (cacheKey: string): unknown => {
    return this.cachedJsonByKey.has(cacheKey)
      ? this.cachedJsonByKey.get(cacheKey)
      : null;
  };

  override putCachedJson = (
    cacheKey: string,
    value: unknown,
    _ttlSeconds: number,
  ): unknown => {
    this.cachedJsonByKey.set(cacheKey, value);
    return value;
  };

  override getCachedString = (cacheKey: string): string =>
    this.cachedStringByKey.get(cacheKey) || "";

  override putCachedString = (
    cacheKey: string,
    value: string,
    _ttlSeconds: number,
  ): string => {
    const normalizedValue = String(value || "");
    this.cachedStringByKey.set(cacheKey, normalizedValue);
    return normalizedValue;
  };

  override getStoredTextResource = (
    resourceKey: string,
  ): StoredTextResource | null => this.storedTextResourceByKey.get(resourceKey) || null;

  override putStoredTextResource = (
    resourceKey: string,
    text: string,
    fetchedAtMs: number,
  ): StoredTextResource => {
    const resource = {
      fetchedAtMs: Number.isFinite(fetchedAtMs) ? fetchedAtMs : Date.now(),
      text: String(text || ""),
    };

    this.storedTextResourceByKey.set(resourceKey, resource);

    return resource;
  };
}
