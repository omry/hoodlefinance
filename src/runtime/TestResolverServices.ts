import {
  ResolverServices,
  type StoredTextResource,
} from "./ResolverServices";
import {
  StandAloneResolverServices,
  type StandAloneResolverServicesOptions,
} from "./StandAloneResolverServices";

export interface TestResolverServicesOptions
  extends Partial<StandAloneResolverServicesOptions> {
  getCachedJson?(cacheKey: string): unknown;
  getCachedString?(cacheKey: string): string;
  getStoredTextResource?(resourceKey: string): StoredTextResource | null;
  putCachedJson?(cacheKey: string, value: unknown, ttlSeconds: number): unknown;
  putCachedString?(cacheKey: string, value: string, ttlSeconds: number): string;
  putStoredTextResource?(
    resourceKey: string,
    text: string,
    fetchedAtMs: number,
  ): StoredTextResource | null;
}

export class TestResolverServices extends ResolverServices {
  private readonly fallback: StandAloneResolverServices;
  private readonly options: TestResolverServicesOptions;

  constructor(options: TestResolverServicesOptions = {}) {
    super();
    this.fallback = new StandAloneResolverServices({
      httpFetch(url: string): string {
        if (typeof options.httpFetch !== "function") {
          throw new Error(`TestResolverServices missing httpFetch for "${url}".`);
        }

        return options.httpFetch(url);
      },
    });
    this.options = options;
  }

  override httpFetch = (url: string): string => this.fallback.httpFetch(url);

  override getCachedJson = (cacheKey: string): unknown => {
    return typeof this.options.getCachedJson === "function"
      ? this.options.getCachedJson(cacheKey)
      : this.fallback.getCachedJson(cacheKey);
  };

  override getCachedString = (cacheKey: string): string => {
    return typeof this.options.getCachedString === "function"
      ? this.options.getCachedString(cacheKey)
      : this.fallback.getCachedString(cacheKey);
  };

  override getStoredTextResource = (
    resourceKey: string,
  ): StoredTextResource | null => {
    return typeof this.options.getStoredTextResource === "function"
      ? this.options.getStoredTextResource(resourceKey)
      : this.fallback.getStoredTextResource(resourceKey);
  };

  override putCachedJson = (
    cacheKey: string,
    value: unknown,
    ttlSeconds: number,
  ): unknown => {
    return typeof this.options.putCachedJson === "function"
      ? this.options.putCachedJson(cacheKey, value, ttlSeconds)
      : this.fallback.putCachedJson(cacheKey, value, ttlSeconds);
  };

  override putCachedString = (
    cacheKey: string,
    value: string,
    ttlSeconds: number,
  ): string => {
    return typeof this.options.putCachedString === "function"
      ? this.options.putCachedString(cacheKey, value, ttlSeconds)
      : this.fallback.putCachedString(cacheKey, value, ttlSeconds);
  };

  override putStoredTextResource = (
    resourceKey: string,
    text: string,
    fetchedAtMs: number,
  ): StoredTextResource | null => {
    if (typeof this.options.putStoredTextResource === "function") {
      return this.options.putStoredTextResource(
        resourceKey,
        text,
        fetchedAtMs,
      );
    }

    return this.fallback.putStoredTextResource(resourceKey, text, fetchedAtMs);
  };
}
