export interface AppsScriptUrlFetchApp {
  fetch(url: string): {
    getContentText(): string;
    getResponseCode(): number;
  };
  fetchAll(requests: Array<{ muteHttpExceptions?: boolean; url: string }>): Array<{
    getContentText(): string;
    getResponseCode(): number;
  }>;
}

export interface AppsScriptCache {
  get(key: string): string | null;
  put(key: string, value: string, expirationInSeconds: number): void;
}

export interface AppScriptHostServices {
  cacheService: {
    getScriptCache(): AppsScriptCache;
  };
  propertiesService?: {
    getScriptProperties(): {
      getProperty(key: string): string | null;
      setProperty(key: string, value: string): void;
    };
  };
  urlFetchApp: AppsScriptUrlFetchApp;
}

export interface AppScriptGlobals {
  CacheService: AppScriptHostServices["cacheService"];
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
  PropertiesService?: NonNullable<AppScriptHostServices["propertiesService"]>;
  UrlFetchApp: AppsScriptUrlFetchApp;
}
