import {
  createHoodlefinanceRuntime,
  createPreferredYahooSymbolResolver,
  parsePreferredReitTickerSet,
  parsePropertiesMap,
} from "../runtime/host-adapter";

const DEFAULT_ATTRIBUTE = "price";
const PSE_ISIN_MAP_CACHE_KEY = "hoodlefinance:ts:pseIsinMap";
const PSE_ISIN_MAP_CACHE_TTL_SECONDS = 6 * 60 * 60;
const PSE_ISIN_MAP_URL =
  "https://raw.githubusercontent.com/omry/hoodlefinance/main/data/pse-isin-map.properties";
const PREFERRED_REIT_WHITELIST_CACHE_KEY = "hoodlefinance:ts:preferredReitWhitelist";
const PREFERRED_REIT_WHITELIST_CACHE_TTL_SECONDS = 6 * 60 * 60;
const PREFERRED_REIT_WHITELIST_URL =
  "https://raw.githubusercontent.com/omry/hoodlefinance/main/data/preferred-reit-whitelist.json";

interface AppsScriptResponseLike {
  getContentText(): string;
  getResponseCode(): number;
}

interface AppsScriptRequestLike {
  muteHttpExceptions?: boolean;
  url: string;
}

interface AppsScriptUrlFetchLike {
  fetch(url: string): AppsScriptResponseLike;
  fetchAll(requests: AppsScriptRequestLike[]): AppsScriptResponseLike[];
}

interface AppsScriptCacheLike {
  get(key: string): string | null;
  put(key: string, value: string, expirationInSeconds: number): void;
}

interface AppsScriptCacheServiceLike {
  getScriptCache(): AppsScriptCacheLike;
}

interface HoodlefinanceAppScriptServices {
  cacheService: AppsScriptCacheServiceLike;
  urlFetchApp: AppsScriptUrlFetchLike;
}

interface HoodlefinanceAppScriptBindings {
  HOODLEFINANCE_TS(identifier: unknown, attribute?: unknown): unknown;
  HOODLEFINANCE_TS_ENVELOPE(identifier: unknown, attribute?: unknown): string;
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
  UrlFetchApp: AppsScriptUrlFetchLike;
}

function createStringCache(
  cache: AppsScriptCacheLike,
): Pick<
  Parameters<typeof createHoodlefinanceRuntime>[0],
  "getCachedString" | "putCachedString"
> {
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

function createJsonCache(
  cache: AppsScriptCacheLike,
): Pick<
  Parameters<typeof createHoodlefinanceRuntime>[0],
  "getCachedJson" | "putCachedJson"
> {
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

function createFetchAllInChunks(urlFetchApp: AppsScriptUrlFetchLike) {
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

function assertScalarIdentifier(identifier: unknown): void {
  if (Array.isArray(identifier)) {
    throw new Error(
      "Range identifiers are not yet supported in HOODLEFINANCE_TS.",
    );
  }
}

function requireServices(
  overrides?: Partial<HoodlefinanceAppScriptServices>,
): HoodlefinanceAppScriptServices {
  const globalScope = globalThis as Partial<HoodlefinanceAppScriptGlobals>;
  const cacheService = overrides?.cacheService || globalScope.CacheService;
  const urlFetchApp = overrides?.urlFetchApp || globalScope.UrlFetchApp;

  if (!cacheService || !urlFetchApp) {
    throw new Error(
      "Apps Script services are not available. Expected CacheService and UrlFetchApp.",
    );
  }

  return {
    cacheService,
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
      "HOODLEFINANCE_TS custom functions are available, but the Sheets add-on homepage is not implemented in the TypeScript bundle yet.",
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
  let pseIsinMap: Record<string, string> | null = null;
  let preferredReitTickerSet: Set<string> | null = null;
  const runtime = createHoodlefinanceRuntime({
    fetchAllInChunks: createFetchAllInChunks(services.urlFetchApp),
    fetchText(url) {
      return services.urlFetchApp.fetch(url).getContentText();
    },
    getCachedJson: jsonCache.getCachedJson,
    getCachedString: stringCache.getCachedString,
    putCachedJson: jsonCache.putCachedJson,
    putCachedString: stringCache.putCachedString,
    resolvePreferredYahooSymbol(ticker) {
      try {
        if (!preferredReitTickerSet) {
          let rawWhitelist = stringCache.getCachedString(
            PREFERRED_REIT_WHITELIST_CACHE_KEY,
          );

          if (!rawWhitelist) {
            rawWhitelist = services.urlFetchApp
              .fetch(PREFERRED_REIT_WHITELIST_URL)
              .getContentText();
            stringCache.putCachedString(
              PREFERRED_REIT_WHITELIST_CACHE_KEY,
              rawWhitelist,
              PREFERRED_REIT_WHITELIST_CACHE_TTL_SECONDS,
            );
          }

          preferredReitTickerSet = parsePreferredReitTickerSet(rawWhitelist);
        }
      } catch {
        return "";
      }

      return createPreferredYahooSymbolResolver(preferredReitTickerSet)(ticker);
    },
    resolvePseTickerFromIsinMap(isin) {
      if (!pseIsinMap) {
        let rawMap = stringCache.getCachedString(PSE_ISIN_MAP_CACHE_KEY);

        if (!rawMap) {
          rawMap = services.urlFetchApp.fetch(PSE_ISIN_MAP_URL).getContentText();
          stringCache.putCachedString(
            PSE_ISIN_MAP_CACHE_KEY,
            rawMap,
            PSE_ISIN_MAP_CACHE_TTL_SECONDS,
          );
        }

        pseIsinMap = parsePropertiesMap(rawMap);
      }

      return pseIsinMap[String(isin || "").trim().toUpperCase()] || "";
    },
  });

  return {
    HOODLEFINANCE_TS(identifier, attribute = DEFAULT_ATTRIBUTE) {
      assertScalarIdentifier(identifier);
      const result = runtime.lookup(identifier, attribute);

      if (result.status !== "success") {
        throw new Error(result.error || "Lookup failed.");
      }

      return result.value;
    },
    HOODLEFINANCE_TS_ENVELOPE(identifier, attribute = DEFAULT_ATTRIBUTE) {
      assertScalarIdentifier(identifier);
      return JSON.stringify(runtime.lookupEnvelope(identifier, attribute));
    },
    hoodlefinanceBuildSheetsAddOnHomepage: createPendingAddOnHomepage(),
  };
}

export function installHoodlefinanceAppScriptBindings(
  scope: Record<string, unknown> = globalThis as Record<string, unknown>,
  overrides?: Partial<HoodlefinanceAppScriptServices>,
): HoodlefinanceAppScriptBindings {
  const bindings = createHoodlefinanceAppScriptBindings(overrides);

  scope.HOODLEFINANCE_TS = bindings.HOODLEFINANCE_TS;
  scope.HOODLEFINANCE_TS_ENVELOPE = bindings.HOODLEFINANCE_TS_ENVELOPE;
  scope.hoodlefinanceBuildSheetsAddOnHomepage =
    bindings.hoodlefinanceBuildSheetsAddOnHomepage;

  return bindings;
}
