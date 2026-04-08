import { parsePreferredReitTickerSet } from "../core/preferred-yahoo-symbols";

export interface AppsScriptResponseLike {
  getContentText(): string;
  getResponseCode(): number;
}

export interface AppsScriptRequestLike {
  muteHttpExceptions?: boolean;
  url: string;
}

export interface AppsScriptUrlFetchLike {
  fetch(url: string): AppsScriptResponseLike;
  fetchAll(requests: AppsScriptRequestLike[]): AppsScriptResponseLike[];
}

export interface AppsScriptCacheLike {
  get(key: string): string | null;
  put(key: string, value: string, expirationInSeconds: number): void;
}

export interface StringCacheAdapter {
  getCachedString(key: string): string;
  putCachedString(key: string, value: string, ttlSeconds: number): string;
}

export interface JsonCacheAdapter {
  getCachedJson(key: string): unknown;
  putCachedJson(key: string, value: unknown, ttlSeconds: number): unknown;
}

export interface StoredTextState {
  fallbackText: string;
  freshText: string;
}

export function createStringCache(
  cache: AppsScriptCacheLike,
): StringCacheAdapter {
  return {
    getCachedString(key) {
      return String(cache.get(key) || "");
    },
    putCachedString(key, value, ttlSeconds) {
      const normalized = String(value || "");
      cache.put(key, normalized, Math.max(1, Math.floor(ttlSeconds || 1)));
      return normalized;
    },
  };
}

export function cacheTextResource(
  stringCache: StringCacheAdapter,
  cacheKey: string,
  cacheTtlSeconds: number,
  text: string,
): string {
  return stringCache.putCachedString(cacheKey, text, cacheTtlSeconds);
}

export function createJsonCache(cache: AppsScriptCacheLike): JsonCacheAdapter {
  return {
    getCachedJson(key) {
      const raw = cache.get(key);

      if (!raw) {
        return null;
      }

      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    },
    putCachedJson(key, value, ttlSeconds) {
      const serialized = JSON.stringify(value);
      cache.put(key, serialized, Math.max(1, Math.floor(ttlSeconds || 1)));
      return value;
    },
  };
}

export function createStoredTextState(
  text: string | null | undefined,
  fetchedAtMs: number,
  nowMs: number,
  refreshIntervalMs: number,
): StoredTextState {
  const fallbackText = String(text || "");

  return {
    fallbackText,
    freshText:
      fallbackText &&
      Number.isFinite(fetchedAtMs) &&
      nowMs - fetchedAtMs <= refreshIntervalMs
        ? fallbackText
        : "",
  };
}

export function createFetchAllInChunks(urlFetchApp: AppsScriptUrlFetchLike) {
  return function fetchAllInChunks<TRequest extends { url: string }>(
    _source: string,
    requests: TRequest[],
  ) {
    try {
      const responses = urlFetchApp.fetchAll(
        requests.map((request) => ({
          muteHttpExceptions: true,
          url: request.url,
        })),
      );

      return requests.map((request, index) => ({
        ...(responses[index]
          ? {
              request,
              response: responses[index],
            }
          : {
              error: new Error(`Missing fetchAll response for ${request.url}`),
              request,
            }),
      }));
    } catch {
      return requests.map((request) => {
        try {
          return {
            request,
            response: urlFetchApp.fetch(request.url),
          };
        } catch (error) {
          return {
            error,
            request,
          };
        }
      });
    }
  };
}

export function parsePreferredReitTickerSetIfValid(
  text: string | null | undefined,
) {
  const rawText = String(text || "");

  if (!rawText) {
    return null;
  }

  try {
    JSON.parse(rawText);
  } catch {
    return null;
  }

  return parsePreferredReitTickerSet(rawText);
}

export function parsePreferredReitTickerSetOrThrow(text: string) {
  const preferredReitTickerSet = parsePreferredReitTickerSetIfValid(text);

  if (!preferredReitTickerSet) {
    throw new Error("Invalid preferred REIT whitelist payload.");
  }

  return preferredReitTickerSet;
}

export function parseStoredTextResourcePayload(text: string | null | undefined) {
  const rawText = String(text || "");

  if (!rawText) {
    return null;
  }

  try {
    return JSON.parse(rawText) as {
      fetchedAtMs?: number;
      text?: string;
    };
  } catch {
    return null;
  }
}
