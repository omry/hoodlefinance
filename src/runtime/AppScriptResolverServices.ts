import {
  createJsonCache,
  createStoredTextResourceStore,
  createStringCache,
} from "../appscript/utils";
import type { AppScriptHostServices } from "../appscript/host-types";
import { ResolverServices, type StoredTextResource } from "./ResolverServices";

export class AppScriptResolverServices extends ResolverServices {
  private readonly jsonCache;
  private readonly storedTextResourceStore;
  private readonly stringCache;
  private readonly urlFetchApp: AppScriptHostServices["urlFetchApp"];

  constructor(options: AppScriptHostServices) {
    super();
    const scriptCache = options.cacheService.getScriptCache();
    const scriptProperties = options.propertiesService
      ? options.propertiesService.getScriptProperties()
      : null;

    this.jsonCache = createJsonCache(scriptCache);
    this.storedTextResourceStore =
      createStoredTextResourceStore(scriptProperties);
    this.stringCache = createStringCache(scriptCache);
    this.urlFetchApp = options.urlFetchApp;
  }

  override httpFetch = (url: string) => this.urlFetchApp.fetch(url);

  override getCachedJson = (cacheKey: string): unknown =>
    this.jsonCache.getCachedJson(cacheKey);

  override putCachedJson = (
    cacheKey: string,
    value: unknown,
    ttlSeconds: number,
  ): unknown => this.jsonCache.putCachedJson(cacheKey, value, ttlSeconds);

  override getCachedString = (cacheKey: string): string =>
    this.stringCache.getCachedString(cacheKey);

  override putCachedString = (
    cacheKey: string,
    value: string,
    ttlSeconds: number,
  ): string => this.stringCache.putCachedString(cacheKey, value, ttlSeconds);

  override getStoredTextResource = (
    resourceKey: string,
  ): StoredTextResource | null =>
    this.storedTextResourceStore.getStoredTextResource(resourceKey);

  override putStoredTextResource = (
    resourceKey: string,
    text: string,
    fetchedAtMs: number,
  ): StoredTextResource | null =>
    this.storedTextResourceStore.putStoredTextResource(
      resourceKey,
      text,
      fetchedAtMs,
    );
}
