import { createHoodlefinanceRuntime } from "../runtime/host-adapter";
import {
  type AppsScriptCacheLike,
  type AppsScriptUrlFetchLike,
  cacheTextResource,
  createJsonCache,
  createStoredTextState,
  createStoredTextResourceStore,
  createStringCache,
} from "./utils";
import {
  createFxTickerParser,
  parseCurrencyCodeDataResource,
} from "../core/fx-normalization";
import type { StoredTextResource } from "../core/resolver-services";

const DEFAULT_ATTRIBUTE = "price";
const CURRENCY_CODES_CACHE_KEY = "hoodlefinance:currencyCodes";
const CURRENCY_CODES_CACHE_TTL_SECONDS = 6 * 60 * 60;
const CURRENCY_CODES_FETCHED_AT_PROPERTY =
  "hoodlefinance.currencyCodesFetchedAtMs";
const CURRENCY_CODES_PROPERTY = "hoodlefinance.currencyCodes";
const CURRENCY_CODES_STORED_KEY = "hoodlefinance.currencyCodes";
const CURRENCY_CODES_REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;
const CURRENCY_CODES_URL =
  "https://raw.githubusercontent.com/omry/hoodlefinance/main/data/currency-codes.json";

interface AppsScriptCacheServiceLike {
  getScriptCache(): AppsScriptCacheLike;
}

interface AppsScriptPropertiesLike {
  getProperty(key: string): string | null;
  setProperty(key: string, value: string): void;
}

interface AppsScriptPropertiesServiceLike {
  getScriptProperties(): AppsScriptPropertiesLike;
}

interface HoodlefinanceAppScriptServices {
  cacheService: AppsScriptCacheServiceLike;
  propertiesService?: AppsScriptPropertiesServiceLike;
  urlFetchApp: AppsScriptUrlFetchLike;
}

interface HoodlefinanceAppScriptBindings {
  HOODLEFINANCE(identifier: unknown, attribute?: unknown): unknown;
  hoodlefinanceDebugEnvelope(identifier: unknown, attribute?: unknown): string;
  hoodlefinanceBuildSheetsAddOnHomepage(): unknown;
}

interface HoodlefinanceAppScriptGlobals {
  CacheService: AppsScriptCacheServiceLike;
  CardService?: {
    newCardBuilder(): {
      addSection(section: unknown): unknown;
      build(): unknown;
    };
    newCardSection(): {
      addWidget(widget: unknown): unknown;
    };
    newTextParagraph(): {
      setText(text: string): unknown;
    };
  };
  PropertiesService?: AppsScriptPropertiesServiceLike;
  UrlFetchApp: AppsScriptUrlFetchLike;
}

function assertScalarIdentifier(identifier: unknown): void {
  if (Array.isArray(identifier)) {
    throw new Error(
      "Range identifiers are not yet supported in HOODLEFINANCE.",
    );
  }
}

function requireServices(
  overrides?: Partial<HoodlefinanceAppScriptServices>,
): HoodlefinanceAppScriptServices {
  const globalScope = globalThis as Partial<HoodlefinanceAppScriptGlobals>;
  const cacheService = overrides?.cacheService || globalScope.CacheService;
  const propertiesService =
    overrides?.propertiesService || globalScope.PropertiesService;
  const urlFetchApp = overrides?.urlFetchApp || globalScope.UrlFetchApp;

  if (!cacheService || !urlFetchApp) {
    throw new Error(
      "Apps Script services are not available. Expected CacheService and UrlFetchApp.",
    );
  }

  return {
    cacheService,
    ...(propertiesService ? { propertiesService } : {}),
    urlFetchApp,
  };
}

function createPendingAddOnHomepage(): () => unknown {
  return function hoodlefinanceBuildSheetsAddOnHomepage(): unknown {
    const cardService = (globalThis as Partial<HoodlefinanceAppScriptGlobals>)
      .CardService;

    if (!cardService) {
      throw new Error("CardService is not available.");
    }

    const cardBuilder = cardService.newCardBuilder();
    const section = cardService.newCardSection();
    const paragraph = cardService.newTextParagraph();

    paragraph.setText(
      "HOODLEFINANCE custom functions are available, but the Sheets add-on homepage is not implemented in the TypeScript bundle yet.",
    );
    section.addWidget(paragraph);
    cardBuilder.addSection(section);

    return cardBuilder.build();
  };
}

export function createHoodlefinanceAppScriptBindings(
  overrides?: Partial<HoodlefinanceAppScriptServices>,
): HoodlefinanceAppScriptBindings {
  const services = requireServices(overrides);
  const scriptCache = services.cacheService.getScriptCache();
  const stringCache = createStringCache(scriptCache);
  const jsonCache = createJsonCache(scriptCache);
  const scriptProperties = services.propertiesService
    ? services.propertiesService.getScriptProperties()
    : null;
  const storedTextResourceStore = createStoredTextResourceStore(scriptProperties);
  const getStoredTextResource = (key: string): StoredTextResource | null => {
    if (key !== CURRENCY_CODES_STORED_KEY) {
      return storedTextResourceStore.getStoredTextResource(key);
    }

    const text = scriptProperties
      ? scriptProperties.getProperty(CURRENCY_CODES_PROPERTY)
      : null;
    const fetchedAtMs = scriptProperties
      ? Number(scriptProperties.getProperty(CURRENCY_CODES_FETCHED_AT_PROPERTY))
      : NaN;

    return text
      ? {
          fetchedAtMs,
          text,
        }
      : null;
  };
  const putStoredTextResource = (
    key: string,
    text: string,
    fetchedAtMs: number,
  ): StoredTextResource | null => {
    if (key !== CURRENCY_CODES_STORED_KEY) {
      return storedTextResourceStore.putStoredTextResource(
        key,
        text,
        fetchedAtMs,
      );
    }

    if (!scriptProperties) {
      return null;
    }

    const resource = {
      fetchedAtMs: Number.isFinite(fetchedAtMs) ? fetchedAtMs : Date.now(),
      text: String(text || ""),
    };

    scriptProperties.setProperty(CURRENCY_CODES_PROPERTY, resource.text);
    scriptProperties.setProperty(
      CURRENCY_CODES_FETCHED_AT_PROPERTY,
      String(resource.fetchedAtMs),
    );

    return resource;
  };
  const loadTextResource = ({
    cacheKey,
    cacheTtlSeconds,
    fetchUrl,
    isValidText,
    refreshIntervalMs,
    storedResourceKey,
  }: {
    cacheKey: string;
    cacheTtlSeconds: number;
    fetchUrl: string;
    isValidText: (text: string) => boolean;
    refreshIntervalMs: number;
    storedResourceKey: string;
  }): string => {
    const cachedText = stringCache.getCachedString(cacheKey);

    if (isValidText(cachedText)) {
      return cachedText;
    }

    const storedResource = getStoredTextResource(storedResourceKey);
    const storedTextState = createStoredTextState(
      storedResource?.text,
      Number(storedResource?.fetchedAtMs),
      Date.now(),
      refreshIntervalMs,
    );
    const fallbackStoredText = isValidText(storedTextState.fallbackText)
      ? storedTextState.fallbackText
      : "";
    const freshStoredText = isValidText(storedTextState.freshText)
      ? storedTextState.freshText
      : "";

    if (freshStoredText) {
      cacheTextResource(
        stringCache,
        cacheKey,
        cacheTtlSeconds,
        freshStoredText,
      );

      return freshStoredText;
    }

    try {
      const downloadedText = services.urlFetchApp.fetch(fetchUrl).getContentText();

      if (!isValidText(downloadedText)) {
        throw new Error(`Invalid text resource payload for ${fetchUrl}`);
      }

      cacheTextResource(stringCache, cacheKey, cacheTtlSeconds, downloadedText);
      putStoredTextResource(storedResourceKey, downloadedText, Date.now());

      return downloadedText;
    } catch (error) {
      if (!fallbackStoredText) {
        throw error;
      }

      cacheTextResource(
        stringCache,
        cacheKey,
        cacheTtlSeconds,
        fallbackStoredText,
      );

      return fallbackStoredText;
    }
  };
  let fxTickerParser: ReturnType<typeof createFxTickerParser> | null = null;
  const runtime = createHoodlefinanceRuntime({
    httpFetch(url) {
      return services.urlFetchApp.fetch(url).getContentText();
    },
    getCachedJson: jsonCache.getCachedJson,
    getCachedString: stringCache.getCachedString,
    getStoredTextResource(key): StoredTextResource | null {
      return getStoredTextResource(key);
    },
    parseFxTicker(ticker) {
      if (!fxTickerParser) {
        try {
          fxTickerParser = createFxTickerParser(
            parseCurrencyCodeDataResource(
              loadTextResource({
                cacheKey: CURRENCY_CODES_CACHE_KEY,
                cacheTtlSeconds: CURRENCY_CODES_CACHE_TTL_SECONDS,
                fetchUrl: CURRENCY_CODES_URL,
                isValidText(text) {
                  try {
                    parseCurrencyCodeDataResource(text);
                    return true;
                  } catch {
                    return false;
                  }
                },
                refreshIntervalMs: CURRENCY_CODES_REFRESH_INTERVAL_MS,
                storedResourceKey: CURRENCY_CODES_STORED_KEY,
              }),
            ),
          );
        } catch {
          fxTickerParser = null;
        }

        if (!fxTickerParser) {
          throw new Error(
            "Failed to download the currency code data from GitHub.",
          );
        }
      }

      return fxTickerParser(ticker);
    },
    putCachedJson: jsonCache.putCachedJson,
    putCachedString: stringCache.putCachedString,
    putStoredTextResource(key, text, fetchedAtMs): StoredTextResource | null {
      return putStoredTextResource(key, text, fetchedAtMs);
    },
  });

  return {
    HOODLEFINANCE(identifier, attribute = DEFAULT_ATTRIBUTE) {
      assertScalarIdentifier(identifier);
      const result = runtime.lookup(String(identifier), String(attribute));

      if (result.status !== "success") {
        throw new Error(result.error || "Lookup failed.");
      }

      return result.value;
    },
    hoodlefinanceDebugEnvelope(identifier, attribute = DEFAULT_ATTRIBUTE) {
      assertScalarIdentifier(identifier);
      return JSON.stringify(
        runtime.lookupEnvelope(String(identifier), String(attribute)),
      );
    },
    hoodlefinanceBuildSheetsAddOnHomepage: createPendingAddOnHomepage(),
  };
}

export function installHoodlefinanceAppScriptBindings(
  scope: Record<string, unknown> = globalThis as Record<string, unknown>,
  overrides?: Partial<HoodlefinanceAppScriptServices>,
): HoodlefinanceAppScriptBindings {
  const bindings = createHoodlefinanceAppScriptBindings(overrides);

  scope.HOODLEFINANCE = bindings.HOODLEFINANCE;
  scope.hoodlefinanceBuildSheetsAddOnHomepage =
    bindings.hoodlefinanceBuildSheetsAddOnHomepage;

  return bindings;
}

export * from "./utils";
