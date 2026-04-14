import type { TextHttpResponse } from "./text-http-response";

export interface StoredTextResource {
  fetchedAtMs: number;
  text: string;
}

export abstract class ResolverServices {
  abstract httpFetch(url: string): TextHttpResponse;

  getCachedJson(_cacheKey: string): unknown {
    return null;
  }

  putCachedJson(
    _cacheKey: string,
    value: unknown,
    _ttlSeconds: number,
  ): unknown {
    return value;
  }

  getCachedString(_cacheKey: string): string {
    return "";
  }

  putCachedString(
    _cacheKey: string,
    value: string,
    _ttlSeconds: number,
  ): string {
    return String(value || "");
  }

  getStoredTextResource(_resourceKey: string): StoredTextResource | null {
    return null;
  }

  putStoredTextResource(
    _resourceKey: string,
    _text: string,
    _fetchedAtMs: number,
  ): StoredTextResource | null {
    return null;
  }
}

function createStoredTextState(
  text: string | null | undefined,
  fetchedAtMs: number,
  nowMs: number,
  refreshIntervalMs: number,
): { fallbackText: string; freshText: string } {
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

export function loadStoredTextResource<TValue>(
  options: {
    cacheKey: string;
    cacheTtlSeconds: number;
    fetchText(): string;
    getCachedString?: ((cacheKey: string) => string) | undefined;
    getStoredTextResource?:
      | ((resourceKey: string) => StoredTextResource | null)
      | undefined;
    invalidPayloadMessage?: string | undefined;
    putCachedString?:
      | ((cacheKey: string, value: string, ttlSeconds: number) => string)
      | undefined;
    putStoredTextResource?:
      | ((
          resourceKey: string,
          text: string,
          fetchedAtMs: number,
        ) => StoredTextResource | null)
      | undefined;
    refreshIntervalMs: number;
    storedResourceKey: string;
    tryParse(text: string): TValue | null;
  },
) {
  const cachedText =
    typeof options.getCachedString === "function"
      ? String(options.getCachedString(options.cacheKey) || "")
      : "";
  const cachedParsed = cachedText ? options.tryParse(cachedText) : null;

  if (cachedParsed) {
    return {
      parsed: cachedParsed,
      text: cachedText,
    };
  }

  const storedResource =
    typeof options.getStoredTextResource === "function"
      ? options.getStoredTextResource(options.storedResourceKey)
      : null;
  const storedText = String(storedResource?.text || "");
  const storedParsed = storedText ? options.tryParse(storedText) : null;
  const storedTextState = createStoredTextState(
    storedParsed ? storedText : "",
    Number(storedResource?.fetchedAtMs),
    Date.now(),
    options.refreshIntervalMs,
  );

  if (storedParsed && storedTextState.freshText) {
    if (typeof options.putCachedString === "function") {
      options.putCachedString(
        options.cacheKey,
        storedTextState.freshText,
        options.cacheTtlSeconds,
      );
    }

    return {
      parsed: storedParsed,
      text: storedTextState.freshText,
    };
  }

  try {
    const downloadedText = String(options.fetchText() || "");
    const downloadedParsed = options.tryParse(downloadedText);

    if (!downloadedParsed) {
      throw new Error(
        options.invalidPayloadMessage ||
          `Invalid text resource payload for ${options.storedResourceKey}.`,
      );
    }

    if (typeof options.putCachedString === "function") {
      options.putCachedString(
        options.cacheKey,
        downloadedText,
        options.cacheTtlSeconds,
      );
    }
    if (typeof options.putStoredTextResource === "function") {
      options.putStoredTextResource(
        options.storedResourceKey,
        downloadedText,
        Date.now(),
      );
    }

    return {
      parsed: downloadedParsed,
      text: downloadedText,
    };
  } catch (error) {
    if (!storedParsed || !storedTextState.fallbackText) {
      throw error;
    }

    if (typeof options.putCachedString === "function") {
      options.putCachedString(
        options.cacheKey,
        storedTextState.fallbackText,
        options.cacheTtlSeconds,
      );
    }

    return {
      parsed: storedParsed,
      text: storedTextState.fallbackText,
    };
  }
}
