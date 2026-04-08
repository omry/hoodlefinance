import { createHoodlefinanceRuntime } from "../runtime/host-adapter";
import {
  type AppsScriptCacheLike,
  type AppsScriptUrlFetchLike,
  createJsonCache,
  createStoredTextResourceStore,
  createStringCache,
} from "./utils";
import { type StoredTextResource } from "../core/resolver-services";

const DEFAULT_ATTRIBUTE = "price";

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
  const storedTextResourceStore =
    createStoredTextResourceStore(scriptProperties);
  const runtime = createHoodlefinanceRuntime({
    httpFetch(url) {
      return services.urlFetchApp.fetch(url).getContentText();
    },
    getCachedJson: jsonCache.getCachedJson,
    getCachedString: stringCache.getCachedString,
    getStoredTextResource(key): StoredTextResource | null {
      return storedTextResourceStore.getStoredTextResource(key);
    },
    putCachedJson: jsonCache.putCachedJson,
    putCachedString: stringCache.putCachedString,
    putStoredTextResource(key, text, fetchedAtMs): StoredTextResource | null {
      return storedTextResourceStore.putStoredTextResource(
        key,
        text,
        fetchedAtMs,
      );
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
