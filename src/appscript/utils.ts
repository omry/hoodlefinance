import type { StoredTextResource } from "../runtime/ResolverServices";
import type { AppsScriptCache } from "./host-types";

export function createStringCache(
  cache: AppsScriptCache,
): {
  getCachedString(key: string): string;
  putCachedString(key: string, value: string, ttlSeconds: number): string;
} {
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

export function createJsonCache(cache: AppsScriptCache): {
  getCachedJson(key: string): unknown;
  putCachedJson(key: string, value: unknown, ttlSeconds: number): unknown;
} {
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

function parseStoredTextResourcePayload(text: string | null | undefined) {
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

export function createStoredTextResourceStore(
  properties: {
    getProperty(key: string): string | null;
    setProperty(key: string, value: string): void;
  } | null,
): {
  getStoredTextResource(key: string): StoredTextResource | null;
  putStoredTextResource(
    key: string,
    text: string,
    fetchedAtMs: number,
  ): StoredTextResource | null;
} {
  return {
    getStoredTextResource(key) {
      if (!properties) {
        return null;
      }

      const payload = parseStoredTextResourcePayload(properties.getProperty(key));
      const text = String(payload?.text || "");
      const fetchedAtMs = Number(payload?.fetchedAtMs);

      if (!text) {
        return null;
      }

      return {
        fetchedAtMs,
        text,
      };
    },
    putStoredTextResource(key, text, fetchedAtMs) {
      if (!properties) {
        return null;
      }

      const resource = {
        fetchedAtMs: Number.isFinite(fetchedAtMs) ? fetchedAtMs : Date.now(),
        text: String(text || ""),
      };

      properties.setProperty(key, JSON.stringify(resource));

      return resource;
    },
  };
}
