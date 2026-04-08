import { createHoodlefinanceRuntime } from "../runtime/host-adapter";
import {
  type AppsScriptCacheLike,
  type AppsScriptUrlFetchLike,
  cacheTextResource,
  createJsonCache,
  parsePreferredReitTickerSetIfValid,
  parseStoredTextResourcePayload,
  createStoredTextState,
  createStringCache,
} from "./utils";
import {
  createFxTickerParser,
  parseCurrencyCodeDataResource,
} from "../core/fx-normalization";

const DEFAULT_ATTRIBUTE = "price";
const CURRENCY_CODES_CACHE_KEY = "hoodlefinance:currencyCodes";
const CURRENCY_CODES_CACHE_TTL_SECONDS = 6 * 60 * 60;
const CURRENCY_CODES_FETCHED_AT_PROPERTY =
  "hoodlefinance.currencyCodesFetchedAtMs";
const CURRENCY_CODES_PROPERTY = "hoodlefinance.currencyCodes";
const CURRENCY_CODES_REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;
const CURRENCY_CODES_URL =
  "https://raw.githubusercontent.com/omry/hoodlefinance/main/data/currency-codes.json";
const PREFERRED_REIT_WHITELIST_CACHE_KEY =
  "hoodlefinance:ts:preferredReitWhitelist";
const PREFERRED_REIT_WHITELIST_CACHE_TTL_SECONDS = 6 * 60 * 60;
const PREFERRED_REIT_WHITELIST_PROPERTY =
  "hoodlefinance.preferredReitWhitelist";
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
  let fxTickerParser: ReturnType<typeof createFxTickerParser> | null = null;
  let suppressPreferredReitWhitelistStoreWrite = false;
  const readStoredPreferredReitWhitelist = () => {
    const storedPayload = parseStoredTextResourcePayload(
      scriptProperties
        ? scriptProperties.getProperty(PREFERRED_REIT_WHITELIST_PROPERTY)
        : null,
    );
    const storedTextState = createStoredTextState(
      storedPayload && storedPayload.text,
      Number(storedPayload && storedPayload.fetchedAtMs),
      Date.now(),
      PREFERRED_REIT_WHITELIST_REFRESH_INTERVAL_MS,
    );

    return {
      fallbackText: parsePreferredReitTickerSetIfValid(
        storedTextState.fallbackText,
      )
        ? storedTextState.fallbackText
        : "",
      freshText: parsePreferredReitTickerSetIfValid(storedTextState.freshText)
        ? storedTextState.freshText
        : "",
    };
  };
  const rememberPreferredReitWhitelist = (text: string) => {
    if (!scriptProperties || !parsePreferredReitTickerSetIfValid(text)) {
      return;
    }

    scriptProperties.setProperty(
      PREFERRED_REIT_WHITELIST_PROPERTY,
      JSON.stringify({
        fetchedAtMs: Date.now(),
        text,
      }),
    );
  };
  const runtime = createHoodlefinanceRuntime({
    httpFetch(url) {
      if (url !== PREFERRED_REIT_WHITELIST_URL) {
        return services.urlFetchApp.fetch(url).getContentText();
      }

      const storedTextState = readStoredPreferredReitWhitelist();

      try {
        const downloadedText = services.urlFetchApp.fetch(url).getContentText();

        if (parsePreferredReitTickerSetIfValid(downloadedText)) {
          rememberPreferredReitWhitelist(downloadedText);
          return downloadedText;
        }

        if (storedTextState.fallbackText) {
          suppressPreferredReitWhitelistStoreWrite = true;
          return storedTextState.fallbackText;
        }

        return downloadedText;
      } catch (error) {
        if (storedTextState.fallbackText) {
          suppressPreferredReitWhitelistStoreWrite = true;
          return storedTextState.fallbackText;
        }

        throw error;
      }
    },
    getCachedJson: jsonCache.getCachedJson,
    getCachedString(key) {
      const cachedText = stringCache.getCachedString(key);

      if (key !== PREFERRED_REIT_WHITELIST_CACHE_KEY) {
        return cachedText;
      }

      if (parsePreferredReitTickerSetIfValid(cachedText)) {
        return cachedText;
      }

      const storedTextState = readStoredPreferredReitWhitelist();

      if (storedTextState.freshText) {
        cacheTextResource(
          stringCache,
          PREFERRED_REIT_WHITELIST_CACHE_KEY,
          PREFERRED_REIT_WHITELIST_CACHE_TTL_SECONDS,
          storedTextState.freshText,
        );

        return storedTextState.freshText;
      }

      return "";
    },
    parseFxTicker(ticker) {
      if (!fxTickerParser) {
        const nowMs = Date.now();
        const storedTextState = createStoredTextState(
          scriptProperties
            ? scriptProperties.getProperty(CURRENCY_CODES_PROPERTY)
            : null,
          scriptProperties
            ? Number(
                scriptProperties.getProperty(
                  CURRENCY_CODES_FETCHED_AT_PROPERTY,
                ),
              )
            : NaN,
          nowMs,
          CURRENCY_CODES_REFRESH_INTERVAL_MS,
        );
        const cachedText = stringCache.getCachedString(
          CURRENCY_CODES_CACHE_KEY,
        );

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
    putCachedString(key, value, ttlSeconds) {
      const normalized = stringCache.putCachedString(key, value, ttlSeconds);

      if (key === PREFERRED_REIT_WHITELIST_CACHE_KEY) {
        if (suppressPreferredReitWhitelistStoreWrite) {
          suppressPreferredReitWhitelistStoreWrite = false;
        } else {
          rememberPreferredReitWhitelist(normalized);
        }
      }

      return normalized;
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
