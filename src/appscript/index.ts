import {
  createHoodlefinanceRuntime,
  createPreferredYahooSymbolResolver,
  parsePropertiesMap,
} from "../runtime/host-adapter";
import {
  type AppsScriptCacheLike,
  type AppsScriptUrlFetchLike,
  cacheTextResource,
  createFetchAllInChunks,
  createJsonCache,
  createStoredTextState,
  createStringCache,
  parsePreferredReitTickerSetIfValid,
  parsePreferredReitTickerSetOrThrow,
  parseStoredTextResourcePayload,
} from "./utils";
import {
  createFxTickerParser,
  parseCurrencyCodeDataResource,
} from "../core/fx-normalization";

const DEFAULT_ATTRIBUTE = "price";
const CURRENCY_CODES_CACHE_KEY = "hoodlefinance:currencyCodes";
const CURRENCY_CODES_CACHE_TTL_SECONDS = 6 * 60 * 60;
const CURRENCY_CODES_FETCHED_AT_PROPERTY = "hoodlefinance.currencyCodesFetchedAtMs";
const CURRENCY_CODES_PROPERTY = "hoodlefinance.currencyCodes";
const CURRENCY_CODES_REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;
const CURRENCY_CODES_URL =
  "https://raw.githubusercontent.com/omry/hoodlefinance/main/data/currency-codes.json";
const PSE_ISIN_MAP_CACHE_KEY = "hoodlefinance:ts:pseIsinMap";
const PSE_ISIN_MAP_CACHE_TTL_SECONDS = 6 * 60 * 60;
const PSE_ISIN_MAP_URL =
  "https://raw.githubusercontent.com/omry/hoodlefinance/main/data/pse-isin-map.properties";
const PREFERRED_REIT_WHITELIST_CACHE_KEY = "hoodlefinance:ts:preferredReitWhitelist";
const PREFERRED_REIT_WHITELIST_CACHE_TTL_SECONDS = 6 * 60 * 60;
const PREFERRED_REIT_WHITELIST_PROPERTY = "hoodlefinance.preferredReitWhitelist";
const PREFERRED_REIT_WHITELIST_REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000;
const PREFERRED_REIT_WHITELIST_URL =
  "https://raw.githubusercontent.com/omry/hoodlefinance/main/data/preferred-reit-whitelist.json";

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
  PropertiesService?: AppsScriptPropertiesServiceLike;
  UrlFetchApp: AppsScriptUrlFetchLike;
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
  const scriptProperties = services.propertiesService
    ? services.propertiesService.getScriptProperties()
    : null;
  let fxTickerParser: ReturnType<typeof createFxTickerParser> | null = null;
  let pseIsinMap: Record<string, string> | null = null;
  let preferredReitTickerSet: Set<string> | null = null;
  const runtime = createHoodlefinanceRuntime({
    fetchAllInChunks: createFetchAllInChunks(services.urlFetchApp),
    fetchText(url) {
      return services.urlFetchApp.fetch(url).getContentText();
    },
    getCachedJson: jsonCache.getCachedJson,
    getCachedString: stringCache.getCachedString,
    parseFxTicker(ticker) {
      if (!fxTickerParser) {
        const nowMs = Date.now();
        const storedTextState = createStoredTextState(
          scriptProperties
            ? scriptProperties.getProperty(CURRENCY_CODES_PROPERTY)
            : null,
          scriptProperties
            ? Number(scriptProperties.getProperty(CURRENCY_CODES_FETCHED_AT_PROPERTY))
            : NaN,
          nowMs,
          CURRENCY_CODES_REFRESH_INTERVAL_MS,
        );
        const cachedText = stringCache.getCachedString(CURRENCY_CODES_CACHE_KEY);

        if (cachedText) {
          fxTickerParser = createFxTickerParser(
            parseCurrencyCodeDataResource(cachedText),
          );
        } else if (storedTextState.freshText) {
          try {
            fxTickerParser = createFxTickerParser(
              parseCurrencyCodeDataResource(storedTextState.freshText),
            );
            cacheTextResource(
              stringCache,
              CURRENCY_CODES_CACHE_KEY,
              CURRENCY_CODES_CACHE_TTL_SECONDS,
              storedTextState.freshText,
            );
          } catch {
            storedTextState.fallbackText = "";
          }
        }

        if (!fxTickerParser) {
          try {
            const downloadedText = services.urlFetchApp
              .fetch(CURRENCY_CODES_URL)
              .getContentText();

            cacheTextResource(
              stringCache,
              CURRENCY_CODES_CACHE_KEY,
              CURRENCY_CODES_CACHE_TTL_SECONDS,
              downloadedText,
            );

            if (scriptProperties) {
              scriptProperties.setProperty(
                CURRENCY_CODES_PROPERTY,
                downloadedText,
              );
              scriptProperties.setProperty(
                CURRENCY_CODES_FETCHED_AT_PROPERTY,
                String(nowMs),
              );
            }

            fxTickerParser = createFxTickerParser(
              parseCurrencyCodeDataResource(downloadedText),
            );
          } catch {
            if (storedTextState.fallbackText) {
              cacheTextResource(
                stringCache,
                CURRENCY_CODES_CACHE_KEY,
                CURRENCY_CODES_CACHE_TTL_SECONDS,
                storedTextState.fallbackText,
              );
              fxTickerParser = createFxTickerParser(
                parseCurrencyCodeDataResource(storedTextState.fallbackText),
              );
            }
          }
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
    resolvePreferredYahooSymbol(ticker) {
      try {
        if (!preferredReitTickerSet) {
          const nowMs = Date.now();
          const storedPayload = parseStoredTextResourcePayload(
            scriptProperties
              ? scriptProperties.getProperty(PREFERRED_REIT_WHITELIST_PROPERTY)
              : null,
          );
          const storedTextState = createStoredTextState(
            storedPayload && storedPayload.text,
            Number(storedPayload && storedPayload.fetchedAtMs),
            nowMs,
            PREFERRED_REIT_WHITELIST_REFRESH_INTERVAL_MS,
          );
          const cachedText = stringCache.getCachedString(
            PREFERRED_REIT_WHITELIST_CACHE_KEY,
          );
          const cachedTickerSet = parsePreferredReitTickerSetIfValid(cachedText);
          let resolvedTickerSet = cachedTickerSet;

          if (!resolvedTickerSet && storedTextState.freshText) {
            const storedTickerSet = parsePreferredReitTickerSetIfValid(
              storedTextState.freshText,
            );

            if (storedTickerSet) {
              resolvedTickerSet = storedTickerSet;
              cacheTextResource(
                stringCache,
                PREFERRED_REIT_WHITELIST_CACHE_KEY,
                PREFERRED_REIT_WHITELIST_CACHE_TTL_SECONDS,
                storedTextState.freshText,
              );
            }
          }

          if (!resolvedTickerSet) {
            try {
              const downloadedText = services.urlFetchApp
                .fetch(PREFERRED_REIT_WHITELIST_URL)
                .getContentText();
              const preferredTickerSet =
                parsePreferredReitTickerSetOrThrow(downloadedText);

              cacheTextResource(
                stringCache,
                PREFERRED_REIT_WHITELIST_CACHE_KEY,
                PREFERRED_REIT_WHITELIST_CACHE_TTL_SECONDS,
                downloadedText,
              );

              if (scriptProperties) {
                scriptProperties.setProperty(
                  PREFERRED_REIT_WHITELIST_PROPERTY,
                  JSON.stringify({
                    fetchedAtMs: nowMs,
                    text: downloadedText,
                  }),
                );
              }

              resolvedTickerSet = preferredTickerSet;
            } catch {
              if (storedTextState.fallbackText) {
                resolvedTickerSet = parsePreferredReitTickerSetOrThrow(
                  storedTextState.fallbackText,
                );
              }
            }
          }

          if (!resolvedTickerSet) {
            throw new Error("Failed to load the preferred REIT whitelist.");
          }

          preferredReitTickerSet = resolvedTickerSet;
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
          cacheTextResource(
            stringCache,
            PSE_ISIN_MAP_CACHE_KEY,
            PSE_ISIN_MAP_CACHE_TTL_SECONDS,
            rawMap,
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

export * from "./utils";
