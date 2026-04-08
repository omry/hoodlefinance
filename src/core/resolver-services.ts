export interface StoredTextResource {
  fetchedAtMs: number;
  text: string;
}

export interface StoredTextState {
  fallbackText: string;
  freshText: string;
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

export interface LoadStoredTextResourceOptions<TValue> {
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
}

export interface LoadedStoredTextResource<TValue> {
  parsed: TValue;
  text: string;
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

export function loadStoredTextResource<TValue>(
  options: LoadStoredTextResourceOptions<TValue>,
): LoadedStoredTextResource<TValue> {
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
