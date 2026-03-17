const HOODLEFINANCE_VERSION_ = "0.9.2";

const HOODLEFINANCE_SUPPORTED_ATTRIBUTES_ = {
  exchange: function (quote, context) {
    return hoodlefinanceResolveExchangeAttribute_(quote, context, "google");
  },
  "exchange:google": function (quote, context) {
    return hoodlefinanceResolveExchangeAttribute_(quote, context, "google");
  },
  "exchange:yahoo": function (quote, context) {
    return hoodlefinanceResolveExchangeAttribute_(quote, context, "yahoo");
  },
  currency: function (quote) {
    return hoodlefinanceExtractCurrencyValue_(quote);
  },
  datadelay: function (quote) {
    return quote.exchangeDataDelayedBy != null ? quote.exchangeDataDelayedBy : 0;
  },
  close: function (quote) {
    return hoodlefinanceNormalizeMoney_(quote, hoodlefinancePreviousClose_(quote));
  },
  high: function (quote) {
    return hoodlefinanceNormalizeMoney_(quote, quote.regularMarketDayHigh);
  },
  low: function (quote) {
    return hoodlefinanceNormalizeMoney_(quote, quote.regularMarketDayLow);
  },
  isin: function (quote, context) {
    return hoodlefinanceResolveDefaultIsin_(quote, context);
  },
  name: function (quote) {
    return quote.longName || quote.shortName || quote.displayName || quote.symbol || "";
  },
  price: function (quote) {
    return hoodlefinanceNormalizeMoney_(quote, hoodlefinancePickPrice_(quote));
  },
  symbol: function (quote, context) {
    return hoodlefinanceResolveSymbolAttribute_(quote, context, "google");
  },
  "symbol:google": function (quote, context) {
    return hoodlefinanceResolveSymbolAttribute_(quote, context, "google");
  },
  "symbol:yahoo": function (quote, context) {
    return hoodlefinanceResolveSymbolAttribute_(quote, context, "yahoo");
  },
  tradetime: function (quote) {
    const timestamp = quote.regularMarketTime || quote.postMarketTime || quote.preMarketTime;
    if (timestamp == null) {
      throw new Error("No trade time is available for this ticker.");
    }
    return new Date(timestamp * 1000);
  },
  volume: function (quote) {
    if (quote.regularMarketVolume == null) {
      throw new Error("No volume is available for this ticker.");
    }
    return quote.regularMarketVolume;
  },
  changepct: function (quote) {
    return hoodlefinanceChange_(quote) / hoodlefinancePreviousClose_(quote);
  },
  change: function (quote) {
    return hoodlefinanceNormalizeMoney_(quote, hoodlefinanceChange_(quote));
  },
};

const HOODLEFINANCE_PUBLIC_ATTRIBUTES_ = [
  "exchange",
  "exchange:google",
  "exchange:yahoo",
  "currency",
  "datadelay",
  "close",
  "high",
  "low",
  "isin",
  "name",
  "price",
  "symbol",
  "symbol:google",
  "symbol:yahoo",
  "tradetime",
  "volume",
  "changepct",
  "change",
];

const HOODLEFINANCE_SOURCE_OVERRIDES_ = {
  ARIVA: true,
  GOOGLE: true,
  IBKR: true,
  LON: true,
  PSE: true,
  TRADINGVIEW: true,
  YAHOO: true,
};

const HOODLEFINANCE_GITHUB_REPO_URL_ = "https://github.com/omry/hoodlefinance";
const HOODLEFINANCE_GITHUB_RAW_URL_ = "https://raw.githubusercontent.com/omry/hoodlefinance/main/hoodlefinance.js";
const HOODLEFINANCE_GITHUB_README_URL_ = "https://github.com/omry/hoodlefinance/blob/main/README.md";
const HOODLEFINANCE_GITHUB_RELEASE_NOTES_HISTORY_URL_ = "https://github.com/omry/hoodlefinance/blob/main/docs/release-notes/RELEASE_NOTES.md";
const HOODLEFINANCE_GITHUB_RELEASE_NOTES_BASE_URL_ = "https://github.com/omry/hoodlefinance/blob/main/docs/release-notes/";
const HOODLEFINANCE_GITHUB_CURRENCY_CODES_URL_ = "https://raw.githubusercontent.com/omry/hoodlefinance/main/data/currency-codes.json";
const HOODLEFINANCE_GITHUB_PSE_ISIN_MAP_URL_ = "https://raw.githubusercontent.com/omry/hoodlefinance/main/data/pse-isin-map.properties";
const HOODLEFINANCE_CURRENCY_CODES_PROPERTY_ = "hoodlefinance.currencyCodes";
const HOODLEFINANCE_CURRENCY_CODES_FETCHED_AT_PROPERTY_ = "hoodlefinance.currencyCodesFetchedAtMs";
const HOODLEFINANCE_LAST_UPDATE_CHECK_PROPERTY_ = "hoodlefinance.lastUpdateCheckMs";
const HOODLEFINANCE_PSE_ISIN_MAP_PROPERTY_ = "hoodlefinance.pseIsinMap";
const HOODLEFINANCE_SUPPRESS_UPDATE_CHECKS_PROPERTY_ = "hoodlefinance.suppressUpdateChecks";
const HOODLEFINANCE_CURRENCY_CODES_REFRESH_INTERVAL_MS_ = 24 * 60 * 60 * 1000;
const HOODLEFINANCE_CURRENCY_CODES_CACHE_KEY_ = "hoodlefinance:currencyCodes";
const HOODLEFINANCE_CURRENCY_CODES_CACHE_TTL_SECONDS_ = 6 * 60 * 60;
const HOODLEFINANCE_PSE_ISIN_MAP_REFRESH_INTERVAL_MS_ = 24 * 60 * 60 * 1000;
const HOODLEFINANCE_UPDATE_CHECK_INTERVAL_MS_ = 24 * 60 * 60 * 1000;
const HOODLEFINANCE_PSE_ISIN_MAP_CACHE_KEY_ = "hoodlefinance:pseIsinMap";
const HOODLEFINANCE_PSE_ISIN_MAP_CACHE_TTL_SECONDS_ = 6 * 60 * 60;
const HOODLEFINANCE_PSE_LISTING_CACHE_KEY_PREFIX_ = "hoodlefinance:pse:listing:";
const HOODLEFINANCE_PSE_LISTING_CACHE_TTL_SECONDS_ = 6 * 60 * 60;
const HOODLEFINANCE_UPDATE_CACHE_KEY_ = "hoodlefinance:update:latestVersion";
const HOODLEFINANCE_UPDATE_CACHE_TTL_SECONDS_ = 6 * 60 * 60;
const HOODLEFINANCE_MENU_TITLE_ = "Hoodlefinance";
const HOODLEFINANCE_FETCHALL_BATCH_SIZE_ = 50;

const HOODLEFINANCE_EXCHANGE_SUFFIXES_ = {
  AMS: ".AS",
  ASX: ".AX",
  BIT: ".MI",
  BMV: ".MX",
  BOM: ".BO",
  BRU: ".BR",
  BSE: ".BO",
  BVMF: ".SA",
  CPH: ".CO",
  CVE: ".V",
  EPA: ".PA",
  ETR: ".DE",
  FRA: ".F",
  HEL: ".HE",
  HKG: ".HK",
  ICE: ".IC",
  IST: ".IS",
  JSE: ".JO",
  KOSDAQ: ".KQ",
  KRX: ".KS",
  LON: ".L",
  MAD: ".MC",
  NEO: ".NE",
  NSE: ".NS",
  NZE: ".NZ",
  OSL: ".OL",
  PAR: ".PA",
  SGX: ".SI",
  SHA: ".SS",
  SHE: ".SZ",
  SIX: ".SW",
  STO: ".ST",
  SWX: ".SW",
  TPE: ".TW",
  TLV: ".TA",
  TASE: ".TA",
  TSX: ".TO",
  TSE: ".TO",
  TYO: ".T",
  VIE: ".VI",
  WSE: ".WA",
};

const HOODLEFINANCE_PREFIXLESS_EXCHANGES_ = {
  AMEX: true,
  ARCA: true,
  BATS: true,
  INDEXDJX: true,
  INDEXNASDAQ: true,
  INDEXRUSSELL: true,
  INDEXSP: true,
  NASDAQ: true,
  NYSE: true,
  NYSEAMERICAN: true,
  NYSEARCA: true,
  OTCMKTS: true,
};

const HOODLEFINANCE_IBKR_SEARCH_URL_ = "https://contract.ibkr.info/v3.10/index.php?action=Stock%20Search&lang=en&wlId=IB&showEntities=Y&symbol=";
const HOODLEFINANCE_IBKR_DETAIL_URL_ = "https://contract.ibkr.info/v3.10/index.php?action=Conid%20Info&wlId=IB&lang=en&conid=";
const HOODLEFINANCE_ARIVA_BASE_URL_ = "https://www.ariva.de";
const HOODLEFINANCE_ARIVA_LIVESEARCH_URL_ = "https://www.ariva.de/search/livesearch.m?searchname=";
const HOODLEFINANCE_LSE_SEARCH_URL_ = "https://www.londonstockexchange.com/exchange/instrument-result.html?codeName=";
const HOODLEFINANCE_TRADINGVIEW_SYMBOL_URL_ = "https://www.tradingview.com/symbols/";

const HOODLEFINANCE_PSE_SEARCH_URL_ = "https://edge.pse.com.ph/companyDirectory/search.ax?keyword=";
const HOODLEFINANCE_PSE_STOCK_DATA_URL_ = "https://edge.pse.com.ph/companyPage/stockData.do";

let HOODLEFINANCE_PSE_ISIN_TICKER_MAP_CACHE_ = null;
let HOODLEFINANCE_CURRENCY_CODE_DATA_CACHE_ = null;

const HOODLEFINANCE_IBKR_EXCHANGE_BY_YAHOO_EXCHANGE_ = {
  AMEX: "AMEX",
  AMS: "AEB",
  ARCA: "ARCA",
  ASX: "ASX",
  BATS: "BATS",
  BIT: "BVME",
  BMV: "MEXI",
  BOM: "BSE",
  BRU: "ENEXT.BE",
  BSE: "BSE",
  BVMF: "BOVESPA",
  CPH: "CSE",
  CVE: "VENTURE",
  EPA: "SBF",
  ETR: "IBIS",
  FRA: "FWB",
  HEL: "HEX",
  HKG: "SEHK",
  ICE: "ICEX",
  INDEXDJX: "INDEX",
  INDEXNASDAQ: "INDEX",
  INDEXRUSSELL: "INDEX",
  INDEXSP: "INDEX",
  IST: "ISE",
  JSE: "JSE",
  KOSDAQ: "KOSDAQ",
  KRX: "KSE",
  LON: "LSEETF",
  MAD: "BM",
  NEO: "",
  NASDAQ: "NASDAQ",
  NSE: "NSE",
  NYSE: "NYSE",
  NYSEAMERICAN: "AMEX",
  NYSEARCA: "ARCA",
  NZE: "NZSE",
  OSL: "OSE",
  OTCMKTS: "PINK",
  PAR: "SBF",
  SGX: "",
  SHA: "",
  SHE: "",
  SIX: "EBS",
  STO: "SFB",
  SWX: "EBS",
  TPE: "TSE",
  TLV: "",
  TASE: "",
  TSX: "TSE",
  TSE: "TSE",
  TYO: "TSEJ",
  VIE: "VSE",
  WSE: "WSE",
};

const HOODLEFINANCE_IBKR_EXCHANGE_BY_YAHOO_SUFFIX_ = {
  AS: "AEB",
  AX: "ASX",
  BO: "BSE",
  BR: "ENEXT.BE",
  CO: "CSE",
  DE: "IBIS",
  F: "FWB",
  HE: "HEX",
  HK: "SEHK",
  IC: "ICEX",
  IS: "ISE",
  JO: "JSE",
  KQ: "KOSDAQ",
  KS: "KSE",
  L: "LSEETF",
  MC: "BM",
  NE: "",
  MI: "BVME",
  MX: "MEXI",
  NS: "NSE",
  NZ: "NZSE",
  OL: "OSE",
  PA: "SBF",
  SI: "",
  SA: "BOVESPA",
  SS: "",
  ST: "SFB",
  SW: "EBS",
  SZ: "",
  T: "TSEJ",
  TA: "",
  TO: "TSE",
  TW: "TSE",
  V: "VENTURE",
  VI: "VSE",
  WA: "WSE",
};

const HOODLEFINANCE_YAHOO_EXCHANGE_BY_SUFFIX_ = {
  AS: "AMS",
  AX: "ASX",
  BO: "BOM",
  BR: "BRU",
  CO: "CPH",
  DE: "ETR",
  F: "FRA",
  HE: "HEL",
  HK: "HKG",
  IC: "ICE",
  IS: "IST",
  JO: "JSE",
  KQ: "KOSDAQ",
  KS: "KRX",
  L: "LON",
  MC: "MAD",
  NE: "NEO",
  MI: "BIT",
  MX: "BMV",
  NS: "NSE",
  NZ: "NZE",
  OL: "OSL",
  PA: "PAR",
  SI: "SGX",
  SA: "BVMF",
  SS: "SHA",
  ST: "STO",
  SW: "SIX",
  SZ: "SHE",
  T: "TYO",
  TA: "TLV",
  TO: "TSX",
  TW: "TPE",
  V: "CVE",
  VI: "VIE",
  WA: "WSE",
};

const HOODLEFINANCE_YAHOO_EXCHANGE_BY_META_NAME_ = {
  AMEX: "AMEX",
  ARCA: "NYSEARCA",
  ARCX: "NYSEARCA",
  ASE: "AMEX",
  BATS: "BATS",
  NASDAQ: "NASDAQ",
  NEO: "NEO",
  NMS: "NASDAQ",
  PCX: "NYSEARCA",
  "NYSE ARCA": "NYSEARCA",
  NYSEARCA: "NYSEARCA",
  NYQ: "NYSE",
  NYSE: "NYSE",
  OQX: "OTCMKTS",
  OTO: "OTCMKTS",
  PNK: "OTCMKTS",
};

const HOODLEFINANCE_GOOGLE_EXCHANGE_BY_YAHOO_IDENTITY_ = {
  AMEX: "AMEX",
  ARCA: "NYSEARCA",
  ARCX: "NYSEARCA",
  ASE: "AMEX",
  BATS: "BATS",
  CURRENCY: "CURRENCY",
  NASDAQ: "NASDAQ",
  NEO: "NEO",
  NMS: "NASDAQ",
  NYQ: "NYSE",
  NYSE: "NYSE",
  "NYSE ARCA": "NYSEARCA",
  OQX: "OTCMKTS",
  OTO: "OTCMKTS",
  PCX: "NYSEARCA",
  PNK: "OTCMKTS",
  PSE: "PSE",
};

const HOODLEFINANCE_TRADINGVIEW_EXCHANGE_BY_YAHOO_EXCHANGE_ = {
  AMEX: "AMEX",
  ETR: "XETR",
  HKG: "HKEX",
  LON: "LSE",
  NASDAQ: "NASDAQ",
  NEO: "NEO",
  NYSE: "NYSE",
  NYSEAMERICAN: "AMEX",
  NYSEARCA: "AMEX",
  OTCMKTS: "OTC",
  SGX: "SGX",
  TLV: "TASE",
};

const HOODLEFINANCE_ISIN_SOURCE_BY_EXCHANGE_ = {
  AMEX: "TRADINGVIEW",
  ETR: "TRADINGVIEW",
  HKG: "TRADINGVIEW",
  LON: "LON",
  NASDAQ: "TRADINGVIEW",
  NEO: "TRADINGVIEW",
  NYSE: "TRADINGVIEW",
  NYSEAMERICAN: "TRADINGVIEW",
  NYSEARCA: "TRADINGVIEW",
  OTCMKTS: "TRADINGVIEW",
  PSE: "PSE",
  SGX: "TRADINGVIEW",
  TLV: "TRADINGVIEW",
};

/**
 * Partial GOOGLEFINANCE-compatible quote function for supported current quote
 * attributes, including single-cell and spilled-array workflows.
 *
 * Supported attributes in this version:
 * - "price" (default)
 * - "name"
 * - "currency"
 * - "symbol"
 * - "symbol:yahoo"
 * - "symbol:google"
 * - "exchange"
 * - "exchange:yahoo"
 * - "exchange:google"
 * - "tradetime"
 * - "datadelay"
 * - "volume"
 * - "high"
 * - "low"
 * - "isin"
 * - "close"
 * - "changepct"
 * - "change"
 *
 * Examples:
 *   =HOODLEFINANCE("NASDAQ:GOOG")
 *   =HOODLEFINANCE("NASDAQ:GOOG", "price")
 *   =HOODLEFINANCE("NYSE:IBM", "name")
 *   =HOODLEFINANCE("CURRENCY:USDEUR", "price")
 *   =HOODLEFINANCE("LON:SJPA", "isin")
 *   =HOODLEFINANCE("ISIN:IE00B3XXRP09", "price")
 *   =HOODLEFINANCE("PSE:AAA", "price")
 *
 * @param {string|Array<Array<string>>} ticker Ticker symbol, optionally in GOOGLEFINANCE format.
 * @param {string|Array<Array<string>>} attribute Optional attribute name. Defaults to "price".
 * @param {*} startDate Unsupported for now.
 * @param {*} endDateOrNumDays Unsupported for now.
 * @param {*} interval Unsupported for now.
 * @return {string|number|Array<Array<string|number>>} The requested quote field or a spilled result grid.
 * @customfunction
 */
function HOODLEFINANCE(ticker, attribute, startDate, endDateOrNumDays, interval) {
  const rawAttribute = attribute == null ? "price" : hoodlefinanceCoerceScalar_(attribute, "attribute");
  const normalizedAttribute = hoodlefinanceNormalizeAttribute_(rawAttribute);

  if (
    hoodlefinanceHasValue_(startDate) ||
    hoodlefinanceHasValue_(endDateOrNumDays) ||
    hoodlefinanceHasValue_(interval)
  ) {
    throw new Error("Historical data arguments are not supported yet.");
  }

  const tickerGrid = hoodlefinanceNormalizeTickerGrid_(ticker);

  if (hoodlefinanceIsSingleBlankTickerGrid_(tickerGrid)) {
    throw new Error("Ticker is required.");
  }

  const resultGrid = hoodlefinanceResolveTickerGrid_(tickerGrid, normalizedAttribute);
  return hoodlefinanceUnwrapTickerGridResult_(resultGrid);
}

/**
 * Returns the current HOODLEFINANCE script version.
 *
 * @return {string}
 * @customfunction
 */
function HOODLEFINANCE_VERSION() {
  return HOODLEFINANCE_VERSION_;
}

function onOpen() {
  hoodlefinanceAddMenu_();
  hoodlefinanceMaybeCheckForUpdates_();
}

function hoodlefinanceCheckForUpdates() {
  return hoodlefinanceRunVersionCheck_({
    force: true,
    interactive: true,
  });
}

function hoodlefinanceShowInstalledVersion() {
  const ui = hoodlefinanceGetUi_();

  if (!ui) {
    return HOODLEFINANCE_VERSION_;
  }

  ui.alert("HOODLEFINANCE version", "Installed version: " + HOODLEFINANCE_VERSION_, ui.ButtonSet.OK);
  return HOODLEFINANCE_VERSION_;
}

function hoodlefinanceSuppressUpdateChecks() {
  const userProperties = hoodlefinanceGetUserProperties_();
  const ui = hoodlefinanceGetUi_();

  if (userProperties) {
    userProperties.setProperty(HOODLEFINANCE_SUPPRESS_UPDATE_CHECKS_PROPERTY_, "true");
  }

  if (ui) {
    ui.alert(
      "HOODLEFINANCE updates",
      "Automatic update checks are now suppressed for this user. You can re-enable them from the Hoodlefinance menu.",
      ui.ButtonSet.OK
    );
  }

  hoodlefinanceAddMenu_();
}

function hoodlefinanceEnableUpdateChecks() {
  const userProperties = hoodlefinanceGetUserProperties_();
  const ui = hoodlefinanceGetUi_();

  if (userProperties) {
    userProperties.deleteProperty(HOODLEFINANCE_SUPPRESS_UPDATE_CHECKS_PROPERTY_);
  }

  if (ui) {
    ui.alert(
      "HOODLEFINANCE updates",
      "Automatic update checks are enabled again.",
      ui.ButtonSet.OK
    );
  }

  hoodlefinanceAddMenu_();
}

function hoodlefinanceDismissUpdateNotice() {
  return true;
}

function hoodlefinanceMaybeCheckForUpdates_() {
  return hoodlefinanceRunVersionCheck_({
    force: false,
    interactive: false,
  });
}

function hoodlefinanceRunVersionCheck_(options) {
  const normalizedOptions = options || {};
  const interactive = !!normalizedOptions.interactive;
  const force = !!normalizedOptions.force;
  const userProperties = hoodlefinanceGetUserProperties_();
  const now = new Date();
  let latestInfo;
  let comparison;

  if (!hoodlefinanceGetUi_()) {
    return { status: "no-ui" };
  }

  if (!force) {
    if (hoodlefinanceIsUpdateCheckSuppressed_(userProperties)) {
      return { status: "suppressed" };
    }

    if (!hoodlefinanceShouldRunVersionCheckNow_(hoodlefinanceGetLastUpdateCheckMs_(userProperties), now.getTime())) {
      return { status: "skipped" };
    }
  }

  latestInfo = hoodlefinanceFetchLatestVersionInfo_({
    useCache: !force,
  });
  hoodlefinanceMarkUpdateCheckRun_(userProperties, now.getTime());

  if (!latestInfo.version) {
    if (interactive) {
      hoodlefinanceGetUi_().alert(
        "HOODLEFINANCE updates",
        "Unable to determine the latest published version right now." +
          (latestInfo.error ? "\n\nDetails:\n" + latestInfo.error : ""),
        hoodlefinanceGetUi_().ButtonSet.OK
      );
    }

    return { status: "error" };
  }

  comparison = hoodlefinanceCompareVersions_(latestInfo.version, HOODLEFINANCE_VERSION_);

  if (comparison > 0) {
    hoodlefinanceShowUpdateDialog_(latestInfo.version);
    return {
      latestVersion: latestInfo.version,
      status: "outdated",
    };
  }

  if (interactive) {
    hoodlefinanceGetUi_().alert(
      "HOODLEFINANCE updates",
      "You are up to date. Installed version: " + HOODLEFINANCE_VERSION_,
      hoodlefinanceGetUi_().ButtonSet.OK
    );
  }

  return {
    latestVersion: latestInfo.version,
    status: "current",
  };
}

function hoodlefinanceAddMenu_() {
  const ui = hoodlefinanceGetUi_();
  const userProperties = hoodlefinanceGetUserProperties_();
  const isSuppressed = hoodlefinanceIsUpdateCheckSuppressed_(userProperties);
  let menu;

  if (!ui || !ui.createMenu) {
    return null;
  }

  menu = ui.createMenu(HOODLEFINANCE_MENU_TITLE_);
  menu.addItem("Check for updates", "hoodlefinanceCheckForUpdates");
  menu.addItem("Show installed version", "hoodlefinanceShowInstalledVersion");
  menu.addSeparator();
  menu.addItem(
    isSuppressed ? "Enable automatic update checks" : "Suppress automatic update checks",
    isSuppressed ? "hoodlefinanceEnableUpdateChecks" : "hoodlefinanceSuppressUpdateChecks"
  );
  menu.addToUi();
  return menu;
}

function hoodlefinanceGetUi_() {
  if (typeof SpreadsheetApp === "undefined" || !SpreadsheetApp || !SpreadsheetApp.getUi) {
    return null;
  }

  return SpreadsheetApp.getUi();
}

function hoodlefinanceGetUserProperties_() {
  if (typeof PropertiesService === "undefined" || !PropertiesService || !PropertiesService.getUserProperties) {
    return null;
  }

  return PropertiesService.getUserProperties();
}

function hoodlefinanceIsUpdateCheckSuppressed_(userProperties) {
  return !!(
    userProperties &&
    String(userProperties.getProperty(HOODLEFINANCE_SUPPRESS_UPDATE_CHECKS_PROPERTY_) || "").toLowerCase() === "true"
  );
}

function hoodlefinanceGetLastUpdateCheckMs_(userProperties) {
  const rawValue = userProperties ? userProperties.getProperty(HOODLEFINANCE_LAST_UPDATE_CHECK_PROPERTY_) : "";
  const parsedValue = rawValue ? Number(rawValue) : NaN;

  return isNaN(parsedValue) ? 0 : parsedValue;
}

function hoodlefinanceMarkUpdateCheckRun_(userProperties, nowMs) {
  if (userProperties) {
    userProperties.setProperty(HOODLEFINANCE_LAST_UPDATE_CHECK_PROPERTY_, String(nowMs));
  }
}

function hoodlefinanceShouldRunVersionCheckNow_(lastCheckMs, nowMs) {
  const previousCheck = Number(lastCheckMs) || 0;
  const currentTime = Number(nowMs) || 0;

  return !previousCheck || currentTime - previousCheck >= HOODLEFINANCE_UPDATE_CHECK_INTERVAL_MS_;
}

function hoodlefinanceCompareVersions_(left, right) {
  const leftParts = String(left || "0").split(".");
  const rightParts = String(right || "0").split(".");
  const length = Math.max(leftParts.length, rightParts.length);
  let i;
  let leftValue;
  let rightValue;

  for (i = 0; i < length; i += 1) {
    leftValue = Number(leftParts[i] || 0);
    rightValue = Number(rightParts[i] || 0);

    if (leftValue > rightValue) {
      return 1;
    }

    if (leftValue < rightValue) {
      return -1;
    }
  }

  return 0;
}

function hoodlefinanceFetchLatestVersionInfo_(options) {
  const cache = CacheService.getScriptCache();
  const normalizedOptions = options || {};
  const cached = normalizedOptions.useCache === false
    ? null
    : cache.get(hoodlefinanceVersionCacheKey_(HOODLEFINANCE_UPDATE_CACHE_KEY_));
  let response;
  let version;

  if (cached) {
    return JSON.parse(cached);
  }

  try {
    response = UrlFetchApp.fetch(HOODLEFINANCE_GITHUB_RAW_URL_, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept-Language": "en-US,en;q=0.9"
      },
      muteHttpExceptions: true,
    });
  } catch (error) {
    return {
      error: HOODLEFINANCE_GITHUB_RAW_URL_ + " -> " + String(error && error.message ? error.message : error),
      version: "",
    };
  }

  if (response.getResponseCode() !== 200) {
    return {
      error: HOODLEFINANCE_GITHUB_RAW_URL_ + " -> HTTP " + response.getResponseCode(),
      version: "",
    };
  }

  version = hoodlefinanceExtractVersionFromSource_(response.getContentText());

  if (!version) {
    return {
      error: HOODLEFINANCE_GITHUB_RAW_URL_ + " -> version string not found",
      version: "",
    };
  }

  cache.put(
    hoodlefinanceVersionCacheKey_(HOODLEFINANCE_UPDATE_CACHE_KEY_),
    JSON.stringify({ version: version }),
    HOODLEFINANCE_UPDATE_CACHE_TTL_SECONDS_
  );

  return { version: version };
}

function hoodlefinanceExtractVersionFromSource_(sourceText) {
  const match = String(sourceText || "").match(/const HOODLEFINANCE_VERSION_ = "([^"]+)"/);
  return match ? match[1] : "";
}

function hoodlefinanceGetPersistentProperties_() {
  if (typeof PropertiesService === "undefined" || !PropertiesService) {
    return null;
  }

  if (PropertiesService.getScriptProperties) {
    return PropertiesService.getScriptProperties();
  }

  if (PropertiesService.getUserProperties) {
    return PropertiesService.getUserProperties();
  }

  return null;
}

function hoodlefinanceDownloadGitHubText_(url) {
  let response;
  let text;

  try {
    response = UrlFetchApp.fetch(url, hoodlefinanceBuildFetchOptions_());
  } catch (error) {
    return {
      error: url + " -> " + hoodlefinanceErrorMessage_(error),
      text: "",
    };
  }

  if (response.getResponseCode() !== 200) {
    return {
      error: url + " -> HTTP " + response.getResponseCode(),
      text: "",
    };
  }

  text = response.getContentText();

  if (!String(text || "").trim()) {
    return {
      error: url + " -> empty response",
      text: "",
    };
  }

  return {
    error: "",
    text: text,
  };
}

function hoodlefinanceDownloadPseIsinMapText_() {
  return hoodlefinanceDownloadGitHubText_(HOODLEFINANCE_GITHUB_PSE_ISIN_MAP_URL_);
}

function hoodlefinanceDownloadCurrencyCodeDataText_() {
  return hoodlefinanceDownloadGitHubText_(HOODLEFINANCE_GITHUB_CURRENCY_CODES_URL_);
}

function hoodlefinanceParsePseIsinMapProperties_(sourceText) {
  const lines = String(sourceText || "").split(/\r?\n/);
  const map = {};
  let i;
  let line;
  let separatorIndex;
  let isin;
  let ticker;

  for (i = 0; i < lines.length; i += 1) {
    line = lines[i].trim();

    if (!line || line.charAt(0) === "#") {
      continue;
    }

    separatorIndex = line.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    isin = line.slice(0, separatorIndex).trim().toUpperCase();
    ticker = line.slice(separatorIndex + 1).trim().toUpperCase();

    if (!isin || !ticker) {
      continue;
    }

    map[isin] = ticker;
  }

  if (!Object.keys(map).length) {
    throw new Error("No PSE ISIN mappings were found in the downloaded map.");
  }

  return map;
}

function hoodlefinanceParsePseIsinMapPayload_(payloadText) {
  const payload = JSON.parse(payloadText);

  if (!payload || typeof payload !== "object" || typeof payload.text !== "string") {
    throw new Error("Cached PSE ISIN map payload is invalid.");
  }

  return payload;
}

function hoodlefinanceVersionCacheKey_(cacheKey) {
  const key = String(cacheKey || "");

  if (!key) {
    return "";
  }

  if (key !== key.trim() || key.indexOf("hoodlefinance:") !== 0 || key.indexOf("hoodlefinance:v") === 0) {
    throw new Error('Cache key must be a normalized unversioned "hoodlefinance:" key.');
  }

  return "hoodlefinance:v" + HOODLEFINANCE_VERSION_ + key.slice("hoodlefinance".length);
}

function hoodlefinanceGetCachedString_(cacheKey) {
  const versionedCacheKey = hoodlefinanceVersionCacheKey_(cacheKey);
  return versionedCacheKey ? (CacheService.getScriptCache().get(versionedCacheKey) || "") : "";
}

function hoodlefinancePutCachedString_(cacheKey, value, ttlSeconds) {
  const versionedCacheKey = hoodlefinanceVersionCacheKey_(cacheKey);

  if (!versionedCacheKey || !value) {
    return value;
  }

  CacheService.getScriptCache().put(versionedCacheKey, value, ttlSeconds);
  return value;
}

function hoodlefinanceResolveCachedString_(cacheKey, ttlSeconds, resolveValue) {
  const cached = hoodlefinanceGetCachedString_(cacheKey);

  if (cached) {
    return cached;
  }

  return hoodlefinancePutCachedString_(cacheKey, resolveValue(), ttlSeconds);
}

function hoodlefinanceGetCachedJson_(cacheKey, parseValue) {
  const cached = hoodlefinanceGetCachedString_(cacheKey);

  if (!cached) {
    return null;
  }

  return (typeof parseValue === "function" ? parseValue : JSON.parse)(cached);
}

function hoodlefinancePutCachedJson_(cacheKey, value, ttlSeconds, serializeValue) {
  if (!cacheKey || !value) {
    return value;
  }

  hoodlefinancePutCachedString_(
    cacheKey,
    typeof serializeValue === "function" ? serializeValue(value) : JSON.stringify(value),
    ttlSeconds
  );

  return value;
}

function hoodlefinanceResolveCachedJson_(cacheKey, ttlSeconds, resolveValue, parseValue, serializeValue) {
  const cached = hoodlefinanceGetCachedJson_(cacheKey, parseValue);

  if (cached != null) {
    return cached;
  }

  return hoodlefinancePutCachedJson_(cacheKey, resolveValue(), ttlSeconds, serializeValue);
}

function hoodlefinanceBuildPseListingCacheKey_(symbol) {
  return HOODLEFINANCE_PSE_LISTING_CACHE_KEY_PREFIX_ + String(symbol || "").trim().toUpperCase();
}

function hoodlefinanceParsePseListingPayload_(payloadText) {
  const payload = JSON.parse(payloadText);

  if (
    !payload ||
    typeof payload !== "object" ||
    !payload.companyId ||
    !payload.securityId ||
    !payload.symbol
  ) {
    throw new Error("Cached PSE listing payload is invalid.");
  }

  return {
    companyId: String(payload.companyId),
    name: String(payload.name || ""),
    securityId: String(payload.securityId),
    symbol: String(payload.symbol).trim().toUpperCase(),
  };
}

function hoodlefinanceSerializePseListingPayload_(listing) {
  return JSON.stringify({
    companyId: String(listing.companyId),
    name: String(listing.name || ""),
    securityId: String(listing.securityId),
    symbol: String(listing.symbol).trim().toUpperCase(),
  });
}

function hoodlefinanceGetCachedPseListing_(symbol) {
  return hoodlefinanceGetCachedJson_(hoodlefinanceBuildPseListingCacheKey_(symbol), hoodlefinanceParsePseListingPayload_);
}

function hoodlefinanceCachePseListing_(listing) {
  if (!listing || !listing.companyId || !listing.securityId || !listing.symbol) {
    return listing;
  }

  return hoodlefinancePutCachedJson_(
    hoodlefinanceBuildPseListingCacheKey_(listing.symbol),
    listing,
    HOODLEFINANCE_PSE_LISTING_CACHE_TTL_SECONDS_,
    hoodlefinanceSerializePseListingPayload_
  );
}

function hoodlefinanceParseCurrencyCodeDataResource_(sourceText) {
  const payload = JSON.parse(sourceText);
  const unitsByCode = {};
  const aliasPayload = payload && payload.aliases && typeof payload.aliases === "object" ? payload.aliases : {};
  const cryptoCodeList = payload && Array.isArray(payload.cryptoCodes) ? payload.cryptoCodes : [];
  let canonicalCodeList;
  let i;
  let canonicalCode;
  let aliasCode;
  let aliasEntry;
  let normalizedAliasCode;
  let aliasCanonicalCode;
  let upperAliasCode;
  let factor;

  if (!payload || typeof payload !== "object" || !Array.isArray(payload.canonicalCodes)) {
    throw new Error("Currency code data is invalid.");
  }

  canonicalCodeList = payload.canonicalCodes;

  for (i = 0; i < canonicalCodeList.length; i += 1) {
    canonicalCode = String(canonicalCodeList[i] || "").trim().toUpperCase();

    if (!/^[A-Z]{3}$/.test(canonicalCode)) {
      continue;
    }

    unitsByCode[canonicalCode] = {
      assetClass: "currency",
      canonicalCode: canonicalCode,
      displayCode: canonicalCode,
      factor: 1,
    };
  }

  for (i = 0; i < cryptoCodeList.length; i += 1) {
    canonicalCode = String(cryptoCodeList[i] || "").trim().toUpperCase();

    if (!/^[A-Z]{3,4}$/.test(canonicalCode) || unitsByCode[canonicalCode]) {
      continue;
    }

    unitsByCode[canonicalCode] = {
      assetClass: "crypto",
      canonicalCode: canonicalCode,
      displayCode: canonicalCode,
      factor: 1,
    };
  }

  if (!Object.keys(unitsByCode).length) {
    throw new Error("No canonical currency codes were found in the downloaded data.");
  }

  for (aliasCode in aliasPayload) {
    if (!Object.prototype.hasOwnProperty.call(aliasPayload, aliasCode)) {
      continue;
    }

    normalizedAliasCode = String(aliasCode || "").trim();
    aliasEntry = aliasPayload[aliasCode];
    aliasCanonicalCode = String(aliasEntry && aliasEntry.canonicalCode || "").trim().toUpperCase();
    factor = Number(aliasEntry && aliasEntry.factor);

    if (!/^[A-Za-z]{3,4}$/.test(normalizedAliasCode) || !unitsByCode[aliasCanonicalCode] || !isFinite(factor) || factor <= 0) {
      throw new Error('Currency alias "' + aliasCode + '" is invalid.');
    }

    unitsByCode[normalizedAliasCode] = {
      assetClass: unitsByCode[aliasCanonicalCode].assetClass || "currency",
      canonicalCode: aliasCanonicalCode,
      displayCode: normalizedAliasCode,
      factor: factor,
    };

    upperAliasCode = normalizedAliasCode.toUpperCase();

    if (!unitsByCode[upperAliasCode]) {
      unitsByCode[upperAliasCode] = unitsByCode[normalizedAliasCode];
    }
  }

  return unitsByCode;
}

function hoodlefinanceGetPseIsinMap_() {
  const cache = CacheService.getScriptCache();
  const properties = hoodlefinanceGetPersistentProperties_();
  const cached = cache.get(hoodlefinanceVersionCacheKey_(HOODLEFINANCE_PSE_ISIN_MAP_CACHE_KEY_));
  const nowMs = new Date().getTime();
  let storedPayloadText;
  let storedPayload;
  let downloadResult;
  let nextPayloadText;

  if (HOODLEFINANCE_PSE_ISIN_TICKER_MAP_CACHE_) {
    return HOODLEFINANCE_PSE_ISIN_TICKER_MAP_CACHE_;
  }

  if (cached) {
    HOODLEFINANCE_PSE_ISIN_TICKER_MAP_CACHE_ = hoodlefinanceParsePseIsinMapProperties_(cached);
    return HOODLEFINANCE_PSE_ISIN_TICKER_MAP_CACHE_;
  }

  storedPayloadText = properties ? properties.getProperty(HOODLEFINANCE_PSE_ISIN_MAP_PROPERTY_) : null;

  if (storedPayloadText) {
    try {
      storedPayload = hoodlefinanceParsePseIsinMapPayload_(storedPayloadText);

      if (
        storedPayload.fetchedAtMs != null &&
        nowMs - Number(storedPayload.fetchedAtMs) <= HOODLEFINANCE_PSE_ISIN_MAP_REFRESH_INTERVAL_MS_
      ) {
        cache.put(
          hoodlefinanceVersionCacheKey_(HOODLEFINANCE_PSE_ISIN_MAP_CACHE_KEY_),
          storedPayload.text,
          HOODLEFINANCE_PSE_ISIN_MAP_CACHE_TTL_SECONDS_
        );
        HOODLEFINANCE_PSE_ISIN_TICKER_MAP_CACHE_ = hoodlefinanceParsePseIsinMapProperties_(storedPayload.text);
        return HOODLEFINANCE_PSE_ISIN_TICKER_MAP_CACHE_;
      }
    } catch (error) {
      storedPayload = null;
    }
  }

  downloadResult = hoodlefinanceDownloadPseIsinMapText_();

  if (downloadResult.text) {
    nextPayloadText = JSON.stringify({
      fetchedAtMs: nowMs,
      text: downloadResult.text,
    });

    cache.put(
      hoodlefinanceVersionCacheKey_(HOODLEFINANCE_PSE_ISIN_MAP_CACHE_KEY_),
      downloadResult.text,
      HOODLEFINANCE_PSE_ISIN_MAP_CACHE_TTL_SECONDS_
    );

    if (properties) {
      properties.setProperty(HOODLEFINANCE_PSE_ISIN_MAP_PROPERTY_, nextPayloadText);
    }

    HOODLEFINANCE_PSE_ISIN_TICKER_MAP_CACHE_ = hoodlefinanceParsePseIsinMapProperties_(downloadResult.text);
    return HOODLEFINANCE_PSE_ISIN_TICKER_MAP_CACHE_;
  }

  if (storedPayload && storedPayload.text) {
    cache.put(
      hoodlefinanceVersionCacheKey_(HOODLEFINANCE_PSE_ISIN_MAP_CACHE_KEY_),
      storedPayload.text,
      HOODLEFINANCE_PSE_ISIN_MAP_CACHE_TTL_SECONDS_
    );
    HOODLEFINANCE_PSE_ISIN_TICKER_MAP_CACHE_ = hoodlefinanceParsePseIsinMapProperties_(storedPayload.text);
    return HOODLEFINANCE_PSE_ISIN_TICKER_MAP_CACHE_;
  }

  throw new Error("Failed to download the PSE ISIN map from GitHub.\n" + downloadResult.error);
}

function hoodlefinanceGetCurrencyCodeData_() {
  const cache = CacheService.getScriptCache();
  const properties = hoodlefinanceGetPersistentProperties_();
  const cached = cache.get(hoodlefinanceVersionCacheKey_(HOODLEFINANCE_CURRENCY_CODES_CACHE_KEY_));
  const nowMs = new Date().getTime();
  let storedPayloadText;
  let storedFetchedAtMs;
  let downloadResult;

  if (HOODLEFINANCE_CURRENCY_CODE_DATA_CACHE_) {
    return HOODLEFINANCE_CURRENCY_CODE_DATA_CACHE_;
  }

  if (cached) {
    HOODLEFINANCE_CURRENCY_CODE_DATA_CACHE_ = hoodlefinanceParseCurrencyCodeDataResource_(cached);
    return HOODLEFINANCE_CURRENCY_CODE_DATA_CACHE_;
  }

  storedPayloadText = properties ? properties.getProperty(HOODLEFINANCE_CURRENCY_CODES_PROPERTY_) : null;
  storedFetchedAtMs = properties ? Number(properties.getProperty(HOODLEFINANCE_CURRENCY_CODES_FETCHED_AT_PROPERTY_)) : NaN;

  if (storedPayloadText) {
    try {
      if (isFinite(storedFetchedAtMs) && nowMs - storedFetchedAtMs <= HOODLEFINANCE_CURRENCY_CODES_REFRESH_INTERVAL_MS_) {
        cache.put(
          hoodlefinanceVersionCacheKey_(HOODLEFINANCE_CURRENCY_CODES_CACHE_KEY_),
          storedPayloadText,
          HOODLEFINANCE_CURRENCY_CODES_CACHE_TTL_SECONDS_
        );
        HOODLEFINANCE_CURRENCY_CODE_DATA_CACHE_ = hoodlefinanceParseCurrencyCodeDataResource_(storedPayloadText);
        return HOODLEFINANCE_CURRENCY_CODE_DATA_CACHE_;
      }
    } catch (error) {
      storedPayloadText = "";
    }
  }

  downloadResult = hoodlefinanceDownloadCurrencyCodeDataText_();

  if (downloadResult.text) {
    cache.put(
      hoodlefinanceVersionCacheKey_(HOODLEFINANCE_CURRENCY_CODES_CACHE_KEY_),
      downloadResult.text,
      HOODLEFINANCE_CURRENCY_CODES_CACHE_TTL_SECONDS_
    );

    if (properties) {
      properties.setProperty(HOODLEFINANCE_CURRENCY_CODES_PROPERTY_, downloadResult.text);
      properties.setProperty(HOODLEFINANCE_CURRENCY_CODES_FETCHED_AT_PROPERTY_, String(nowMs));
    }

    HOODLEFINANCE_CURRENCY_CODE_DATA_CACHE_ = hoodlefinanceParseCurrencyCodeDataResource_(downloadResult.text);
    return HOODLEFINANCE_CURRENCY_CODE_DATA_CACHE_;
  }

  if (storedPayloadText) {
    cache.put(
      hoodlefinanceVersionCacheKey_(HOODLEFINANCE_CURRENCY_CODES_CACHE_KEY_),
      storedPayloadText,
      HOODLEFINANCE_CURRENCY_CODES_CACHE_TTL_SECONDS_
    );
    HOODLEFINANCE_CURRENCY_CODE_DATA_CACHE_ = hoodlefinanceParseCurrencyCodeDataResource_(storedPayloadText);
    return HOODLEFINANCE_CURRENCY_CODE_DATA_CACHE_;
  }

  throw new Error("Failed to download the currency code data from GitHub.\n" + downloadResult.error);
}

function hoodlefinanceShowUpdateDialog_(latestVersion) {
  const ui = hoodlefinanceGetUi_();
  const releaseNotesUrl = hoodlefinanceBuildGitHubReleaseNotesUrl_(latestVersion);
  let output;

  if (!ui) {
    return;
  }

  if (typeof HtmlService === "undefined" || !HtmlService || !HtmlService.createHtmlOutput) {
    ui.alert(
      "HOODLEFINANCE updates",
      "A newer version is available (" +
        latestVersion +
        ").\n\nRelease notes: " +
        releaseNotesUrl +
        "\nFull history: " +
        HOODLEFINANCE_GITHUB_RELEASE_NOTES_HISTORY_URL_ +
        "\nUpdate link: " +
        HOODLEFINANCE_GITHUB_RAW_URL_,
      ui.ButtonSet.OK
    );
    return;
  }

  output = HtmlService.createHtmlOutput(hoodlefinanceBuildUpdateDialogHtml_(latestVersion, releaseNotesUrl))
    .setWidth(520)
    .setHeight(280);

  ui.showModalDialog(output, "HOODLEFINANCE update available");
}

function hoodlefinanceBuildGitHubReleaseNotesUrl_(version) {
  if (/^\d+\.\d+\.\d+$/.test(String(version || ""))) {
    return HOODLEFINANCE_GITHUB_RELEASE_NOTES_BASE_URL_ + "v" + String(version) + ".md";
  }

  return HOODLEFINANCE_GITHUB_RELEASE_NOTES_HISTORY_URL_;
}

function hoodlefinanceBuildUpdateDialogHtml_(latestVersion, releaseNotesUrl) {
  return (
    '<div style="font-family:Arial,sans-serif;padding:16px;line-height:1.5;">' +
      "<h2 style=\"margin:0 0 12px 0;font-size:18px;\">HOODLEFINANCE update available</h2>" +
      "<p style=\"margin:0 0 12px 0;\">Installed version: <code>" + hoodlefinanceEscapeHtml_(HOODLEFINANCE_VERSION_) + "</code><br>" +
      "Latest version: <code>" + hoodlefinanceEscapeHtml_(latestVersion) + "</code></p>" +
      "<p style=\"margin:0 0 16px 0;\">Read the release notes first, then open the latest script and paste it into <code>Code.gs</code> to update.</p>" +
      "<p style=\"margin:0 0 16px 0;\">" +
        '<a href="' + hoodlefinanceEscapeHtml_(releaseNotesUrl) + '" target="_blank">What\'s new in ' + hoodlefinanceEscapeHtml_(latestVersion) + "</a>" +
        " | " +
        '<a href="' + hoodlefinanceEscapeHtml_(HOODLEFINANCE_GITHUB_RELEASE_NOTES_HISTORY_URL_) + '" target="_blank">Release history</a>' +
        " | " +
        '<a href="' + hoodlefinanceEscapeHtml_(HOODLEFINANCE_GITHUB_RAW_URL_) + '" target="_blank">Open raw source</a>' +
        " | " +
        '<a href="' + hoodlefinanceEscapeHtml_(HOODLEFINANCE_GITHUB_README_URL_) + '" target="_blank">Open README</a>' +
        " | " +
        '<a href="' + hoodlefinanceEscapeHtml_(HOODLEFINANCE_GITHUB_REPO_URL_) + '" target="_blank">Open repository</a>' +
      "</p>" +
      "<div>" +
        '<button onclick="google.script.run.withSuccessHandler(closeDialog).hoodlefinanceSuppressUpdateChecks()" style="margin-right:8px;">Suppress automatic checks</button>' +
        '<button onclick="closeDialog()">Later</button>' +
      "</div>" +
      "<script>function closeDialog(){google.script.host.close();}</script>" +
    "</div>"
  );
}

function hoodlefinanceEscapeHtml_(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function hoodlefinanceFetchQuote_(ticker) {
  const normalizedTicker = String(ticker).trim();
  const fxPair = hoodlefinanceParseFxTicker_(normalizedTicker);
  let yahooSymbol;
  let cacheKey;
  let cached;
  let response;
  let meta;
  let fallbackInfo;

  if (hoodlefinanceIsPseTicker_(normalizedTicker)) {
    return hoodlefinanceFetchPseQuote_(normalizedTicker);
  }

  if (fxPair && fxPair.isSameCurrency) {
    return hoodlefinanceBuildSameCurrencyQuote_(fxPair);
  }

  if (fxPair) {
    return hoodlefinanceFetchGoogleFinanceFxPairQuote_(fxPair);
  }

  yahooSymbol = fxPair ? fxPair.yahooSymbol : hoodlefinanceNormalizeTicker_(normalizedTicker);

  if (hoodlefinanceIsPseTicker_(yahooSymbol)) {
    return hoodlefinanceFetchPseQuote_(yahooSymbol);
  }

  cacheKey = "hoodlefinance:" + yahooSymbol;
  cached = hoodlefinanceGetCachedJson_(cacheKey);

  if (cached) {
    return hoodlefinanceDecorateFxQuote_(cached, fxPair);
  }

  response = UrlFetchApp.fetch(hoodlefinanceBuildYahooChartUrl_(yahooSymbol), hoodlefinanceBuildFetchOptions_());

  try {
    meta = hoodlefinanceExtractYahooQuoteMetaFromResponse_(response, ticker);
  } catch (error) {
    if (!hoodlefinanceShouldUseIsraeliFundTradingviewFallback_({ plan: { yahooSymbol: yahooSymbol } }, error)) {
      throw error;
    }

    fallbackInfo = hoodlefinanceBuildIsraeliFundTradingviewFallbackInfo_(normalizedTicker, yahooSymbol);
    meta = hoodlefinanceExtractTradingviewFundQuote_(
      hoodlefinanceFetchText_(fallbackInfo.url),
      yahooSymbol,
      fallbackInfo.expectedSymbol
    );
  }

  hoodlefinancePutCachedJson_(cacheKey, meta, 60);
  return hoodlefinanceDecorateFxQuote_(meta, fxPair);
}

function hoodlefinanceFetchPseQuote_(ticker) {
  const symbol = hoodlefinanceParsePseSymbol_(ticker);
  const cacheKey = "hoodlefinance:pse:" + symbol;
  let listing;
  let html;

  return hoodlefinanceResolveCachedJson_(cacheKey, 300, function () {
    const quote = (function () {
      listing = hoodlefinanceResolvePseListing_(symbol);
      html = hoodlefinanceFetchPseText_(
        HOODLEFINANCE_PSE_STOCK_DATA_URL_ +
          "?cmpy_id=" +
          encodeURIComponent(listing.companyId) +
          "&security_id=" +
          encodeURIComponent(listing.securityId)
      );

      return hoodlefinanceExtractPseQuote_(html, listing);
    }());

    if (!quote || !quote.symbol) {
      throw new Error("No PSE quote data was found for " + ticker + ".");
    }

    return quote;
  });
}

function hoodlefinanceNormalizeTicker_(ticker) {
  const value = String(hoodlefinanceStripTickerSourceOverride_(ticker) || "").trim();
  const upperValue = value.toUpperCase();

  if (hoodlefinanceLooksLikeIsin_(value)) {
    return hoodlefinanceResolveIsin_(upperValue);
  }

  if (upperValue.indexOf("ISIN:") === 0) {
    return hoodlefinanceResolveIsin_(upperValue.slice(5).trim());
  }

  return hoodlefinanceNormalizeTickerWithoutIsin_(value);
}

function hoodlefinanceResolveCurrencyUnit_(code) {
  const value = String(code || "").trim();
  const unitsByCode = hoodlefinanceGetCurrencyCodeData_();

  return unitsByCode[value] || unitsByCode[value.toUpperCase()] || null;
}

function hoodlefinanceBuildFxPair_(baseUnit, quoteUnit) {
  const hasCrypto = (baseUnit.assetClass === "crypto") || (quoteUnit.assetClass === "crypto");
  const canonicalPair = baseUnit.canonicalCode + quoteUnit.canonicalCode;

  return {
    baseAssetClass: baseUnit.assetClass || "currency",
    baseCanonicalCode: baseUnit.canonicalCode,
    baseDisplayCode: baseUnit.displayCode,
    canonicalPair: canonicalPair,
    displayQuoteCode: quoteUnit.displayCode,
    googlePairSlug: baseUnit.canonicalCode + "-" + quoteUnit.canonicalCode,
    googleSymbol: baseUnit.displayCode.length === 3 && quoteUnit.displayCode.length === 3
      ? "CURRENCY:" + baseUnit.displayCode + quoteUnit.displayCode
      : "CURRENCY:" + baseUnit.displayCode + "." + quoteUnit.displayCode,
    hasCrypto: hasCrypto,
    isSameCurrency: baseUnit.canonicalCode === quoteUnit.canonicalCode,
    pairDisplay: baseUnit.displayCode + quoteUnit.displayCode,
    quoteAssetClass: quoteUnit.assetClass || "currency",
    quoteCanonicalCode: quoteUnit.canonicalCode,
    quoteDisplayCode: quoteUnit.displayCode,
    scale: baseUnit.factor / quoteUnit.factor,
    yahooChartSymbol: hasCrypto ? baseUnit.canonicalCode + "-" + quoteUnit.canonicalCode : canonicalPair + "=X",
    yahooSymbol: canonicalPair + "=X",
  };
}

function hoodlefinanceFindCompactFxPairCandidates_(pairText) {
  const candidates = [];
  let baseLength;
  let quoteLength;
  let baseUnit;
  let quoteUnit;

  for (baseLength = 3; baseLength <= 4; baseLength += 1) {
    quoteLength = pairText.length - baseLength;

    if (quoteLength < 3 || quoteLength > 4) {
      continue;
    }

    baseUnit = hoodlefinanceResolveCurrencyUnit_(pairText.slice(0, baseLength));
    quoteUnit = hoodlefinanceResolveCurrencyUnit_(pairText.slice(baseLength));

    if (!baseUnit || !quoteUnit) {
      continue;
    }

    candidates.push(hoodlefinanceBuildFxPair_(baseUnit, quoteUnit));
  }

  return candidates;
}

function hoodlefinanceBuildAmbiguousFxTickerError_(ticker, candidates) {
  const suggestions = candidates
    .slice(0, 2)
    .map(function (candidate) {
      return "CURRENCY:" + candidate.baseDisplayCode + "." + candidate.quoteDisplayCode;
    })
    .join(" or ");

  return new Error('Currency ticker "' + ticker + '" is ambiguous. Use ' + suggestions + ".");
}

function hoodlefinanceLooksLikeIncompleteExplicitFxPair_(pairText) {
  const value = String(pairText || "").trim();
  let parts;

  if (!value) {
    return true;
  }

  if (/^[A-Za-z]{3,4}$/.test(value)) {
    return true;
  }

  if (!/^[A-Za-z]{0,4}\.[A-Za-z]{0,4}$/.test(value)) {
    return false;
  }

  parts = value.split(".");
  return !parts[0] || !parts[1];
}

function hoodlefinanceFetchGoogleFinanceFxPairQuote_(fxPair) {
  const cacheKey = "hoodlefinance:google-finance:" + fxPair.googlePairSlug;
  const cached = hoodlefinanceGetCachedJson_(cacheKey);
  let quote;

  if (cached) {
    return hoodlefinanceDecorateFxQuote_(cached, fxPair);
  }

  quote = hoodlefinanceExtractGoogleFinanceFxPairQuote_(
    hoodlefinanceFetchText_(hoodlefinanceBuildGoogleFinanceQuoteUrl_(fxPair.googlePairSlug)),
    fxPair
  );

  hoodlefinancePutCachedJson_(cacheKey, quote, 60);
  return hoodlefinanceDecorateFxQuote_(quote, fxPair);
}

function hoodlefinanceParseFxTicker_(ticker) {
  const value = String(hoodlefinanceStripTickerSourceOverride_(ticker) || "").trim();
  const explicitMatch = value.match(/^([^:]+):(.*)$/);
  const exchange = explicitMatch ? explicitMatch[1].trim().toUpperCase() : "";
  const pairText = explicitMatch ? explicitMatch[2].trim() : value;
  const dottedMatch = explicitMatch ? pairText.match(/^([A-Za-z]{3,4})\.([A-Za-z]{3,4})$/) : null;
  const looksLikeCompactPair = /^[A-Za-z]{6,8}$/.test(pairText);
  const compactCandidates = looksLikeCompactPair ? hoodlefinanceFindCompactFxPairCandidates_(pairText) : [];
  let baseUnit;
  let quoteUnit;

  if (explicitMatch && exchange !== "CURRENCY") {
    return null;
  }

  if (dottedMatch) {
    baseUnit = hoodlefinanceResolveCurrencyUnit_(dottedMatch[1]);
    quoteUnit = hoodlefinanceResolveCurrencyUnit_(dottedMatch[2]);

    if (!baseUnit || !quoteUnit) {
      throw new Error('Currency ticker "' + ticker + '" must use supported 3- or 4-character currency codes.');
    }

    return hoodlefinanceBuildFxPair_(baseUnit, quoteUnit);
  }

  if (explicitMatch && !looksLikeCompactPair) {
    throw new Error('Currency ticker "' + ticker + '" must look like CURRENCY:USDEUR or CURRENCY:USDT.USD.');
  }

  if (!looksLikeCompactPair) {
    return null;
  }

  if (!compactCandidates.length) {
    if (explicitMatch) {
      throw new Error('Currency ticker "' + ticker + '" must use supported 3- or 4-character currency codes.');
    }

    return null;
  }

  if (compactCandidates.length > 1) {
    if (explicitMatch) {
      throw hoodlefinanceBuildAmbiguousFxTickerError_(ticker, compactCandidates);
    }

    return null;
  }

  return compactCandidates[0];
}

function hoodlefinanceNormalizeTickerWithoutIsin_(ticker) {
  const value = String(hoodlefinanceStripTickerSourceOverride_(ticker) || "").trim();
  const fxPair = hoodlefinanceParseFxTicker_(value);
  const parts = value.split(":");
  let normalizedSymbol;

  if (fxPair) {
    return fxPair.yahooSymbol;
  }

  if (parts.length < 2) {
    return hoodlefinanceNormalizeYahooStyleIsraeliFundTicker_(value);
  }

  const exchange = parts[0].trim().toUpperCase();
  const symbol = parts.slice(1).join(":").trim();

  if (!symbol) {
    throw new Error('Ticker "' + ticker + '" is invalid.');
  }

  if (HOODLEFINANCE_PREFIXLESS_EXCHANGES_[exchange]) {
    return symbol;
  }

  if (HOODLEFINANCE_EXCHANGE_SUFFIXES_[exchange]) {
    normalizedSymbol = hoodlefinanceNormalizeExchangeSymbol_(exchange, symbol);
    return normalizedSymbol + HOODLEFINANCE_EXCHANGE_SUFFIXES_[exchange];
  }

  if (hoodlefinanceNormalizeExplicitIbkrExchange_(exchange)) {
    return symbol;
  }

  throw new Error('Unsupported exchange prefix "' + exchange + '" in ticker "' + ticker + '".');
}

function hoodlefinanceNormalizeExchangeSymbol_(exchange, symbol) {
  if (exchange === "TLV" || exchange === "TASE") {
    return hoodlefinanceNormalizeIsraeliFundCode_(symbol);
  }

  return symbol;
}

function hoodlefinanceNormalizeYahooStyleIsraeliFundTicker_(ticker) {
  const match = String(ticker || "").trim().match(/^(.+)\.TA$/i);

  if (!match) {
    return ticker;
  }

  return hoodlefinanceNormalizeIsraeliFundCode_(match[1]) + ".TA";
}

function hoodlefinanceNormalizeIsraeliFundCode_(code) {
  const value = String(code || "").trim().toUpperCase();
  const undottedMatch = value.match(/^([A-Z]+)F([0-9]+)$/);
  const dottedMatch = value.match(/^([A-Z]+)\.F([0-9]+)$/);

  if (undottedMatch) {
    return undottedMatch[1] + ".F" + undottedMatch[2];
  }

  if (dottedMatch) {
    return dottedMatch[1] + ".F" + dottedMatch[2];
  }

  return code;
}

function hoodlefinanceLooksLikeIsraeliFundCode_(code) {
  return /^[A-Z]+(?:\.?F[0-9]+)$/i.test(String(code || "").trim());
}

function hoodlefinanceLooksLikeIsraeliFundYahooSymbol_(symbol) {
  return /^[A-Z]+\.F[0-9]+\.TA$/i.test(String(symbol || "").trim());
}

function hoodlefinanceCoerceScalar_(value, label) {
  if (Array.isArray(value)) {
    if (value.length !== 1 || !Array.isArray(value[0]) || value[0].length !== 1) {
      throw new Error("Only a single-cell " + label + " is supported.");
    }
    return value[0][0];
  }

  return value;
}

function hoodlefinanceNormalizeAttribute_(attribute) {
  const normalizedAttribute = String(attribute == null ? "price" : attribute).trim();
  return normalizedAttribute ? normalizedAttribute : "price";
}

function hoodlefinanceParseTickerRequest_(ticker) {
  const value = String(ticker == null ? "" : ticker).trim();
  const atIndex = value.lastIndexOf("@");
  const candidateTicker = atIndex > 0 ? value.slice(0, atIndex).trim() : "";
  const candidateSource = atIndex > 0 ? value.slice(atIndex + 1).trim().toUpperCase() : "";

  if (candidateTicker && candidateSource === "?") {
    return {
      infoMode: "source-name",
      sourceOverride: "",
      ticker: candidateTicker,
    };
  }

  if (candidateTicker && HOODLEFINANCE_SOURCE_OVERRIDES_[candidateSource]) {
    return {
      infoMode: "",
      sourceOverride: candidateSource,
      ticker: candidateTicker,
    };
  }

  if (candidateTicker) {
    return {
      infoMode: "source-list",
      sourceOverride: "",
      ticker: candidateTicker,
    };
  }

  return {
    infoMode: "",
    sourceOverride: "",
    ticker: value,
  };
}

function hoodlefinanceStripTickerSourceOverride_(ticker) {
  return hoodlefinanceParseTickerRequest_(ticker).ticker;
}

function hoodlefinanceExtractTickerSourceOverride_(ticker) {
  return hoodlefinanceParseTickerRequest_(ticker).sourceOverride;
}

function hoodlefinanceExtractTickerInfoMode_(ticker) {
  return hoodlefinanceParseTickerRequest_(ticker).infoMode;
}

function hoodlefinanceListSupportedSources_() {
  return Object.keys(HOODLEFINANCE_SOURCE_OVERRIDES_).sort().join(", ");
}

function hoodlefinanceNormalizeTickerGrid_(ticker) {
  let i;
  const grid = [];

  if (!Array.isArray(ticker)) {
    return [[ticker]];
  }

  for (i = 0; i < ticker.length; i += 1) {
    grid.push(Array.isArray(ticker[i]) ? ticker[i].slice() : [ticker[i]]);
  }

  return grid;
}

function hoodlefinanceIsSingleBlankTickerGrid_(tickerGrid) {
  return (
    tickerGrid.length === 1 &&
    tickerGrid[0] &&
    tickerGrid[0].length === 1 &&
    !String(tickerGrid[0][0] == null ? "" : tickerGrid[0][0]).trim()
  );
}

function hoodlefinanceUnwrapTickerGridResult_(grid) {
  if (grid.length === 1 && grid[0] && grid[0].length === 1) {
    return grid[0][0];
  }

  return grid;
}

function hoodlefinanceResolveTickerGrid_(tickerGrid, attribute) {
  const allowImplicitBlankTickers = hoodlefinanceIsMultiCellTickerGrid_(tickerGrid);
  const jobs = hoodlefinanceCollectTickerJobs_(tickerGrid, attribute, allowImplicitBlankTickers);

  hoodlefinancePrefetchTickerJobs_(jobs);
  hoodlefinanceResolvePrefetchedTickerJobs_(jobs);

  return hoodlefinanceBuildTickerResultGrid_(tickerGrid, jobs.jobByKey, attribute, allowImplicitBlankTickers);
}

function hoodlefinanceCollectTickerJobs_(tickerGrid, attribute, allowImplicitBlankTickers) {
  const orderedJobs = [];
  const jobByKey = {};
  let rowIndex;
  let columnIndex;
  let value;
  let normalizedTicker;
  let key;

  for (rowIndex = 0; rowIndex < tickerGrid.length; rowIndex += 1) {
    for (columnIndex = 0; columnIndex < tickerGrid[rowIndex].length; columnIndex += 1) {
      value = tickerGrid[rowIndex][columnIndex];
      normalizedTicker = hoodlefinanceNormalizeTickerGridCellValue_(value, allowImplicitBlankTickers);

      if (!normalizedTicker) {
        continue;
      }

      key = hoodlefinanceBuildTickerJobKey_(normalizedTicker, attribute);

      if (!jobByKey[key]) {
        jobByKey[key] = {
          attribute: attribute,
          key: key,
          quote: null,
          tickerInput: normalizedTicker,
          value: null,
          valueResolved: false,
        };
        orderedJobs.push(jobByKey[key]);
      }
    }
  }

  return {
    jobByKey: jobByKey,
    orderedJobs: orderedJobs,
  };
}

function hoodlefinanceBuildTickerJobKey_(ticker, attribute) {
  return String(ticker).trim() + "\n" + String(attribute).trim().toLowerCase();
}

function hoodlefinanceIsMultiCellTickerGrid_(tickerGrid) {
  return tickerGrid.length !== 1 || !tickerGrid[0] || tickerGrid[0].length !== 1;
}

function hoodlefinanceNormalizeTickerGridCellValue_(value, allowImplicitBlankTickers) {
  const normalizedTicker = String(value == null ? "" : value).trim();

  if (!normalizedTicker || !allowImplicitBlankTickers) {
    return normalizedTicker;
  }

  return hoodlefinanceShouldTreatRangeTickerAsBlank_(normalizedTicker) ? "" : normalizedTicker;
}

function hoodlefinanceShouldTreatRangeTickerAsBlank_(ticker) {
  const value = String(hoodlefinanceStripTickerSourceOverride_(ticker) || "").trim();
  const parts = value.split(":");
  const exchange = parts.length > 1 ? parts[0].trim().toUpperCase() : "";
  const symbol = parts.length > 1 ? parts.slice(1).join(":").trim() : "";

  if (!exchange) {
    return false;
  }

  if (!symbol) {
    return true;
  }

  return exchange === "CURRENCY" && hoodlefinanceLooksLikeIncompleteExplicitFxPair_(symbol);
}

function hoodlefinancePrefetchTickerJobs_(jobs) {
  const orderedJobs = jobs.orderedJobs;
  const googleFinanceFxJobs = [];
  const yahooIsinJobs = [];
  const yahooChartJobs = [];
  const pseJobs = [];
  let i;
  let plan;

  for (i = 0; i < orderedJobs.length; i += 1) {
    try {
      plan = hoodlefinanceClassifyTickerJob_(orderedJobs[i].tickerInput, orderedJobs[i].attribute);
      orderedJobs[i].plan = plan;

      if (plan.source === "source-debug") {
        orderedJobs[i].value = plan.debugValue;
        orderedJobs[i].valueResolved = true;
        continue;
      }

      if (plan.source === "local-fx") {
        orderedJobs[i].quote = hoodlefinanceBuildSameCurrencyQuote_(plan.fxPair);
        continue;
      }

      if (plan.source === "yahoo-isin-search") {
        yahooIsinJobs.push(orderedJobs[i]);
        continue;
      }

      if (plan.source === "google-finance-fx") {
        googleFinanceFxJobs.push(orderedJobs[i]);
        continue;
      }

      if (plan.source === "yahoo-chart") {
        yahooChartJobs.push(orderedJobs[i]);
        continue;
      }

      if (plan.source === "pse") {
        pseJobs.push(orderedJobs[i]);
      }
    } catch (error) {
      orderedJobs[i].error = hoodlefinanceErrorMessage_(error);
    }
  }

  hoodlefinancePrefetchYahooIsinJobs_(yahooIsinJobs);

  for (i = 0; i < yahooIsinJobs.length; i += 1) {
    if (!yahooIsinJobs[i].error && yahooIsinJobs[i].plan && yahooIsinJobs[i].plan.yahooSymbol) {
      if (hoodlefinanceIsPseTicker_(yahooIsinJobs[i].plan.yahooSymbol)) {
        pseJobs.push(yahooIsinJobs[i]);
      } else {
        yahooChartJobs.push(yahooIsinJobs[i]);
      }
    }
  }

  hoodlefinancePrefetchGoogleFinanceFxJobs_(googleFinanceFxJobs);
  hoodlefinancePrefetchYahooChartJobs_(yahooChartJobs);
  hoodlefinancePrefetchPseJobs_(pseJobs);
}

function hoodlefinanceBuildForcedSourcePlan_(normalizedTicker, normalizedAttribute, upperTicker, fxPair, sourceOverride) {
  let pseTicker;

  if (sourceOverride === "YAHOO") {
    if (hoodlefinanceLooksLikeIsin_(normalizedTicker)) {
      return {
        isin: upperTicker,
        noSourceFallback: true,
        source: "yahoo-isin-search",
        sourceOverride: sourceOverride,
      };
    }

    if (upperTicker.indexOf("ISIN:") === 0) {
      return {
        isin: upperTicker.slice(5).trim(),
        noSourceFallback: true,
        source: "yahoo-isin-search",
        sourceOverride: sourceOverride,
      };
    }

    return {
      fxPair: fxPair,
      noSourceFallback: true,
      source: "yahoo-chart",
      sourceOverride: sourceOverride,
      yahooSymbol: hoodlefinanceIsPseTicker_(normalizedTicker)
        ? hoodlefinanceParsePseSymbol_(normalizedTicker) + ".PS"
        : (fxPair ? fxPair.yahooChartSymbol : hoodlefinanceNormalizeTickerWithoutIsin_(normalizedTicker)),
    };
  }

  if (sourceOverride === "GOOGLE") {
    if (!fxPair) {
      throw new Error('Source override "@GOOGLE" is only implemented for FX pairs.');
    }

    return {
      fxPair: fxPair,
      noSourceFallback: true,
      source: "google-finance-fx",
      sourceOverride: sourceOverride,
    };
  }

  if (sourceOverride === "PSE") {
    if (hoodlefinanceIsPseTicker_(normalizedTicker)) {
      return {
        noSourceFallback: true,
        source: "pse",
        sourceOverride: sourceOverride,
        symbol: hoodlefinanceParsePseSymbol_(normalizedTicker),
      };
    }

    if (hoodlefinanceLooksLikeIsin_(normalizedTicker)) {
      pseTicker = hoodlefinanceResolvePseTickerFromIsinMap_(upperTicker);

      if (!pseTicker) {
        throw new Error('No PSE ticker was found for ISIN "' + upperTicker + '" when forcing "@PSE".');
      }

      return {
        noSourceFallback: true,
        source: "pse",
        sourceOverride: sourceOverride,
        symbol: hoodlefinanceParsePseSymbol_(pseTicker),
      };
    }

    if (upperTicker.indexOf("ISIN:") === 0) {
      pseTicker = hoodlefinanceResolvePseTickerFromIsinMap_(upperTicker.slice(5).trim());

      if (!pseTicker) {
        throw new Error('No PSE ticker was found for ISIN "' + upperTicker.slice(5).trim() + '" when forcing "@PSE".');
      }

      return {
        noSourceFallback: true,
        source: "pse",
        sourceOverride: sourceOverride,
        symbol: hoodlefinanceParsePseSymbol_(pseTicker),
      };
    }

    throw new Error('Source override "@PSE" is only implemented for PSE tickers and PSE-mapped ISINs.');
  }

  if (normalizedAttribute === "isin") {
    return null;
  }

  throw new Error('Source override "@' + sourceOverride + '" is only implemented for isin lookups.');
}

function hoodlefinanceDescribePlanSource_(plan) {
  if (!plan || !plan.source) {
    return "";
  }

  if (plan.source === "google-finance-fx") {
    return "GOOGLE";
  }

  if (plan.source === "local-fx") {
    return "LOCAL";
  }

  if (plan.source === "pse") {
    return "PSE";
  }

  if (plan.source === "yahoo-chart" || plan.source === "yahoo-isin-search") {
    return "YAHOO";
  }

  return String(plan.source).toUpperCase();
}

function hoodlefinanceClassifyTickerJob_(ticker, attribute) {
  const normalizedTicker = String(ticker).trim();
  const normalizedAttribute = String(attribute == null ? "price" : attribute).trim().toLowerCase();
  const request = hoodlefinanceParseTickerRequest_(normalizedTicker);
  const infoMode = request.infoMode;
  const requestTicker = request.ticker;
  const sourceOverride = request.sourceOverride;
  const requestUpperTicker = requestTicker.toUpperCase();
  const fxPair = hoodlefinanceParseFxTicker_(requestTicker);
  let plan;

  if (infoMode === "source-list") {
    return {
      debugValue: hoodlefinanceListSupportedSources_(),
      source: "source-debug",
    };
  }

  if (infoMode === "source-name") {
    plan = hoodlefinanceClassifyTickerJob_(requestTicker, attribute);
    return {
      debugValue: hoodlefinanceDescribePlanSource_(plan),
      source: "source-debug",
    };
  }

  if (sourceOverride) {
    plan = hoodlefinanceBuildForcedSourcePlan_(requestTicker, normalizedAttribute, requestUpperTicker, fxPair, sourceOverride);

    if (plan) {
      return plan;
    }
  }

  if (hoodlefinanceIsPseTicker_(requestTicker)) {
    return {
      sourceOverride: sourceOverride,
      source: "pse",
      symbol: hoodlefinanceParsePseSymbol_(requestTicker),
    };
  }

  if (fxPair && fxPair.isSameCurrency) {
    return {
      fxPair: fxPair,
      sourceOverride: sourceOverride,
      source: "local-fx",
    };
  }

  if (fxPair) {
    return {
      fxPair: fxPair,
      sourceOverride: sourceOverride,
      source: "google-finance-fx",
    };
  }

  if (hoodlefinanceLooksLikeIsin_(requestTicker)) {
    return {
      isin: requestUpperTicker,
      sourceOverride: sourceOverride,
      source: "yahoo-isin-search",
    };
  }

  if (requestUpperTicker.indexOf("ISIN:") === 0) {
    return {
      isin: requestUpperTicker.slice(5).trim(),
      sourceOverride: sourceOverride,
      source: "yahoo-isin-search",
    };
  }

  return {
    fxPair: fxPair,
    sourceOverride: sourceOverride,
    source: "yahoo-chart",
    yahooSymbol: fxPair ? fxPair.yahooSymbol : hoodlefinanceNormalizeTickerWithoutIsin_(requestTicker),
  };
}

function hoodlefinancePrefetchGoogleFinanceFxJobs_(jobs) {
  let i;

  for (i = 0; i < jobs.length; i += 1) {
    try {
      jobs[i].quote = hoodlefinanceFetchGoogleFinanceFxPairQuote_(jobs[i].plan.fxPair);
    } catch (error) {
      jobs[i].error = hoodlefinanceErrorMessage_(error);
    }
  }
}

function hoodlefinancePrefetchYahooIsinJobs_(jobs) {
  const requests = [];
  let i;
  let cacheKey;
  let cached;
  let pseTicker;
  let responses;

  for (i = 0; i < jobs.length; i += 1) {
    cacheKey = "hoodlefinance:isin:" + jobs[i].plan.isin;
    cached = hoodlefinanceGetCachedString_(cacheKey);

    if (cached) {
      jobs[i].plan.yahooSymbol = cached;
      if (hoodlefinanceIsPseTicker_(cached)) {
        jobs[i].plan.symbol = hoodlefinanceParsePseSymbol_(cached);
      }
      continue;
    }

    pseTicker = jobs[i].plan.noSourceFallback ? "" : hoodlefinanceResolvePseTickerFromIsinMap_(jobs[i].plan.isin);

    if (pseTicker) {
      jobs[i].plan.yahooSymbol = pseTicker;
      jobs[i].plan.symbol = hoodlefinanceParsePseSymbol_(pseTicker);
      hoodlefinancePutCachedString_(cacheKey, pseTicker, 21600);
      continue;
    }

    requests.push({
      cacheKey: cacheKey,
      job: jobs[i],
      url: hoodlefinanceBuildYahooIsinSearchUrl_(jobs[i].plan.isin),
    });
  }

  responses = hoodlefinanceFetchAllInChunks_("yahoo-isin-search", requests);

  for (i = 0; i < responses.length; i += 1) {
    if (responses[i].error) {
      responses[i].request.job.error = hoodlefinanceErrorMessage_(
        hoodlefinanceBuildPseUnavailableError_(responses[i].error)
      );
      continue;
    }

    try {
      responses[i].request.job.plan.yahooSymbol = responses[i].request.job.plan.noSourceFallback
        ? hoodlefinanceExtractYahooSymbolFromSearchResponse_(
          responses[i].response,
          responses[i].request.job.plan.isin
        )
        : hoodlefinanceResolveIsinFromSearchResponse_(
          responses[i].response,
          responses[i].request.job.plan.isin
        );
      if (hoodlefinanceIsPseTicker_(responses[i].request.job.plan.yahooSymbol)) {
        responses[i].request.job.plan.symbol = hoodlefinanceParsePseSymbol_(responses[i].request.job.plan.yahooSymbol);
      }
      hoodlefinancePutCachedString_(responses[i].request.cacheKey, responses[i].request.job.plan.yahooSymbol, 21600);
    } catch (error) {
      responses[i].request.job.error = hoodlefinanceErrorMessage_(error);
    }
  }
}

function hoodlefinancePrefetchYahooChartJobs_(jobs) {
  const requests = [];
  const fallbackJobs = [];
  let i;
  let cacheKey;
  let cached;
  let responses;

  for (i = 0; i < jobs.length; i += 1) {
    if (jobs[i].error) {
      continue;
    }

    cacheKey = "hoodlefinance:" + jobs[i].plan.yahooSymbol;
    cached = hoodlefinanceGetCachedJson_(cacheKey);

    if (cached) {
      jobs[i].quote = hoodlefinanceDecorateFxQuote_(cached, jobs[i].plan.fxPair);
      continue;
    }

    requests.push({
      cacheKey: cacheKey,
      job: jobs[i],
      url: hoodlefinanceBuildYahooChartUrl_(jobs[i].plan.yahooSymbol),
    });
  }

  responses = hoodlefinanceFetchAllInChunks_("yahoo-chart", requests);

  for (i = 0; i < responses.length; i += 1) {
    if (responses[i].error) {
      responses[i].request.job.error = hoodlefinanceErrorMessage_(
        hoodlefinanceBuildPseUnavailableError_(responses[i].error)
      );
      continue;
    }

    try {
      responses[i].request.job.quote = hoodlefinanceDecorateFxQuote_(
        hoodlefinanceExtractYahooQuoteMetaFromResponse_(
          responses[i].response,
          responses[i].request.job.tickerInput
        ),
        responses[i].request.job.plan.fxPair
      );
      hoodlefinancePutCachedJson_(
        responses[i].request.cacheKey,
        hoodlefinanceExtractRawQuote_(responses[i].request.job.quote),
        60
      );
    } catch (error) {
      if (!responses[i].request.job.plan.noSourceFallback &&
        hoodlefinanceShouldUseIsraeliFundTradingviewFallback_(responses[i].request.job, error)) {
        fallbackJobs.push(responses[i].request.job);
      } else {
        responses[i].request.job.error = hoodlefinanceErrorMessage_(error);
      }
    }
  }

  hoodlefinancePrefetchIsraeliTradingviewFundJobs_(fallbackJobs);
}

function hoodlefinancePrefetchPseJobs_(jobs) {
  const searchRequests = [];
  const stockRequests = [];
  let i;
  let cacheKey;
  let cached;
  let responses;
  let listing;
  let html;
  let quote;

  for (i = 0; i < jobs.length; i += 1) {
    cacheKey = "hoodlefinance:pse:" + jobs[i].plan.symbol;
    cached = hoodlefinanceGetCachedJson_(cacheKey);

    if (cached) {
      jobs[i].quote = cached;
      continue;
    }

    listing = hoodlefinanceGetCachedPseListing_(jobs[i].plan.symbol);

    if (listing) {
      jobs[i].plan.listing = listing;
      stockRequests.push({
        cacheKey: cacheKey,
        job: jobs[i],
        url:
          HOODLEFINANCE_PSE_STOCK_DATA_URL_ +
          "?cmpy_id=" +
          encodeURIComponent(listing.companyId) +
          "&security_id=" +
          encodeURIComponent(listing.securityId),
      });
      continue;
    }

    searchRequests.push({
      job: jobs[i],
      url: HOODLEFINANCE_PSE_SEARCH_URL_ + encodeURIComponent(jobs[i].plan.symbol),
    });
  }

  responses = hoodlefinanceFetchAllInChunks_("pse", searchRequests);

  for (i = 0; i < responses.length; i += 1) {
    if (responses[i].error) {
      responses[i].request.job.error = hoodlefinanceErrorMessage_(
        hoodlefinanceBuildPseUnavailableError_(responses[i].error)
      );
      continue;
    }

    if (responses[i].response.getResponseCode() !== 200) {
      responses[i].request.job.error = hoodlefinanceErrorMessage_(
        hoodlefinanceBuildPseUnavailableError_(
          hoodlefinanceBuildPseHttpErrorMessage_(responses[i].response.getResponseCode())
        )
      );
      continue;
    }

    try {
      listing = hoodlefinanceResolvePseListingFromHtml_(
        responses[i].response.getContentText(),
        responses[i].request.job.plan.symbol
      );
      hoodlefinanceCachePseListing_(listing);
      responses[i].request.job.plan.listing = listing;
      stockRequests.push({
        cacheKey: "hoodlefinance:pse:" + responses[i].request.job.plan.symbol,
        job: responses[i].request.job,
        url:
          HOODLEFINANCE_PSE_STOCK_DATA_URL_ +
          "?cmpy_id=" +
          encodeURIComponent(listing.companyId) +
          "&security_id=" +
          encodeURIComponent(listing.securityId),
      });
    } catch (error) {
      responses[i].request.job.error = hoodlefinanceErrorMessage_(error);
    }
  }

  responses = hoodlefinanceFetchAllInChunks_("pse", stockRequests);

  for (i = 0; i < responses.length; i += 1) {
    if (responses[i].error) {
      responses[i].request.job.error = hoodlefinanceErrorMessage_(
        hoodlefinanceBuildPseUnavailableError_(responses[i].error)
      );
      continue;
    }

    if (responses[i].response.getResponseCode() !== 200) {
      responses[i].request.job.error = hoodlefinanceErrorMessage_(
        hoodlefinanceBuildPseUnavailableError_(
          hoodlefinanceBuildPseHttpErrorMessage_(responses[i].response.getResponseCode())
        )
      );
      continue;
    }

    try {
      html = responses[i].response.getContentText();
      quote = hoodlefinanceExtractPseQuote_(html, responses[i].request.job.plan.listing);

      if (!quote || !quote.symbol) {
        throw new Error("No PSE quote data was found for " + responses[i].request.job.tickerInput + ".");
      }

      responses[i].request.job.quote = quote;
      hoodlefinancePutCachedJson_(responses[i].request.cacheKey, quote, 300);
    } catch (error) {
      responses[i].request.job.error = hoodlefinanceErrorMessage_(error);
    }
  }
}

function hoodlefinanceResolvePrefetchedTickerJobs_(jobs) {
  let i;

  for (i = 0; i < jobs.orderedJobs.length; i += 1) {
    if (jobs.orderedJobs[i].error) {
      throw new Error(jobs.orderedJobs[i].error);
    }

    if (jobs.orderedJobs[i].valueResolved) {
      continue;
    }

    jobs.orderedJobs[i].value = hoodlefinanceExtractAttribute_(
      jobs.orderedJobs[i].quote,
      jobs.orderedJobs[i].attribute,
      {
        plan: jobs.orderedJobs[i].plan,
        tickerInput: jobs.orderedJobs[i].tickerInput,
      }
    );
    jobs.orderedJobs[i].valueResolved = true;
  }
}

function hoodlefinanceBuildTickerResultGrid_(tickerGrid, jobByKey, attribute, allowImplicitBlankTickers) {
  const resultGrid = [];
  let rowIndex;
  let columnIndex;
  let value;
  let normalizedTicker;
  let key;
  let row;

  for (rowIndex = 0; rowIndex < tickerGrid.length; rowIndex += 1) {
    row = [];

    for (columnIndex = 0; columnIndex < tickerGrid[rowIndex].length; columnIndex += 1) {
      value = tickerGrid[rowIndex][columnIndex];
      normalizedTicker = hoodlefinanceNormalizeTickerGridCellValue_(value, allowImplicitBlankTickers);

      if (!normalizedTicker) {
        row.push("");
        continue;
      }

      key = hoodlefinanceBuildTickerJobKey_(normalizedTicker, attribute);
      row.push(jobByKey[key].value);
    }

    resultGrid.push(row);
  }

  return resultGrid;
}

function hoodlefinanceIsPseTicker_(ticker) {
  return String(hoodlefinanceStripTickerSourceOverride_(ticker) || "").trim().toUpperCase().indexOf("PSE:") === 0;
}

function hoodlefinanceParsePseSymbol_(ticker) {
  const value = String(hoodlefinanceStripTickerSourceOverride_(ticker) || "").trim();
  const parts = value.split(":");
  const symbol = parts.length > 1 ? parts.slice(1).join(":").trim().toUpperCase() : "";

  if (!symbol) {
    throw new Error('PSE ticker "' + ticker + '" is invalid.');
  }

  return symbol;
}

function hoodlefinanceBuildSameCurrencyQuote_(fxPair) {
  const quoteCurrency = fxPair.quoteCanonicalCode;
  const nowSeconds = Math.floor(new Date().getTime() / 1000);

  return {
    currency: quoteCurrency,
    exchangeDataDelayedBy: 0,
    financialCurrency: quoteCurrency,
    hoodlefinanceFxGoogleSymbol: fxPair.googleSymbol,
    hoodlefinanceFxDisplayCurrency: fxPair.displayQuoteCode,
    hoodlefinanceFxUnitScale: fxPair.scale,
    previousClose: 1,
    regularMarketDayHigh: 1,
    regularMarketDayLow: 1,
    regularMarketPreviousClose: 1,
    regularMarketPrice: 1,
    regularMarketTime: nowSeconds,
    shortName: fxPair.pairDisplay,
    symbol: fxPair.canonicalPair,
  };
}

function hoodlefinanceDecorateFxQuote_(quote, fxPair) {
  if (!fxPair) {
    return quote;
  }

  const nextQuote = Object.assign({}, quote);

  nextQuote.hoodlefinanceFxGoogleSymbol = fxPair.googleSymbol;
  nextQuote.hoodlefinanceFxDisplayCurrency = fxPair.displayQuoteCode;
  nextQuote.hoodlefinanceFxUnitScale = fxPair.scale;
  nextQuote.shortName = fxPair.pairDisplay;
  nextQuote.symbol = fxPair.canonicalPair;

  return nextQuote;
}

function hoodlefinanceExtractRawQuote_(quote) {
  if (!quote || (quote.hoodlefinanceFxDisplayCurrency == null &&
      quote.hoodlefinanceFxGoogleSymbol == null &&
      quote.hoodlefinanceFxUnitScale == null)) {
    return quote;
  }

  const rawQuote = Object.assign({}, quote);

  delete rawQuote.hoodlefinanceFxDisplayCurrency;
  delete rawQuote.hoodlefinanceFxGoogleSymbol;
  delete rawQuote.hoodlefinanceFxUnitScale;

  return rawQuote;
}

function hoodlefinanceExtractAttribute_(quote, attribute, context) {
  const normalizedAttribute = String(attribute).trim().toLowerCase();
  const extractor = HOODLEFINANCE_SUPPORTED_ATTRIBUTES_[normalizedAttribute];

  if (!extractor) {
    throw new Error(
      'Unsupported attribute "' +
        attribute +
        '". Supported attributes: ' +
        HOODLEFINANCE_PUBLIC_ATTRIBUTES_.join(", ")
    );
  }

  return extractor(quote, context || {});
}

function hoodlefinanceHasValue_(value) {
  return value != null && value !== "";
}

function hoodlefinancePickPrice_(quote) {
  if (quote.regularMarketPrice != null) {
    return quote.regularMarketPrice;
  }
  if (quote.postMarketPrice != null) {
    return quote.postMarketPrice;
  }
  if (quote.preMarketPrice != null) {
    return quote.preMarketPrice;
  }
  throw new Error("No price is available for this ticker.");
}

function hoodlefinancePreviousClose_(quote) {
  if (quote.regularMarketPreviousClose != null) {
    return quote.regularMarketPreviousClose;
  }
  if (quote.previousClose != null) {
    return quote.previousClose;
  }
  if (quote.chartPreviousClose != null) {
    return quote.chartPreviousClose;
  }
  throw new Error("No previous close is available for this ticker.");
}

function hoodlefinanceChange_(quote) {
  return hoodlefinancePickPrice_(quote) - hoodlefinancePreviousClose_(quote);
}

function hoodlefinanceExtractCurrencyValue_(quote) {
  if (quote && quote.hoodlefinanceFxDisplayCurrency) {
    return String(quote.hoodlefinanceFxDisplayCurrency);
  }

  return hoodlefinanceNormalizeCurrency_(quote.currency || quote.financialCurrency || "");
}

function hoodlefinanceNormalizeCurrency_(currency) {
  return currency === "GBp" ? "GBP" : currency === "ILA" ? "ILS" : currency;
}

function hoodlefinanceNormalizeMoney_(quote, value) {
  const rawCurrency = quote.currency || quote.financialCurrency || "";
  const normalizedCurrency = hoodlefinanceNormalizeCurrency_(rawCurrency);
  const fxScale = quote && quote.hoodlefinanceFxUnitScale != null ? Number(quote.hoodlefinanceFxUnitScale) : null;

  if (value == null) {
    throw new Error("No value is available for this ticker.");
  }

  if (fxScale != null && isFinite(fxScale)) {
    return value * fxScale;
  }

  return (normalizedCurrency === "GBP" && (quote.currency === "GBp" || quote.financialCurrency === "GBp")) ||
    (normalizedCurrency === "ILS" && (quote.currency === "ILA" || quote.financialCurrency === "ILA"))
    ? value / 100
    : value;
}

function hoodlefinanceShouldUseIsraeliFundTradingviewFallback_(job, error) {
  const yahooSymbol = job && job.plan && job.plan.yahooSymbol ? String(job.plan.yahooSymbol).trim().toUpperCase() : "";
  const message = hoodlefinanceErrorMessage_(error);

  if (!hoodlefinanceLooksLikeIsraeliFundYahooSymbol_(yahooSymbol)) {
    return false;
  }

  return /No quote data was found|Quote lookup failed/i.test(message);
}

function hoodlefinancePrefetchIsraeliTradingviewFundJobs_(jobs) {
  const requests = [];
  let i;
  let fallbackInfo;
  let cacheKey;
  let primaryCacheKey;
  let cached;
  let responses;

  for (i = 0; i < jobs.length; i += 1) {
    fallbackInfo = hoodlefinanceBuildIsraeliFundTradingviewFallbackInfo_(jobs[i].tickerInput, jobs[i].plan.yahooSymbol);
    cacheKey = "hoodlefinance:tradingview:quote:" + fallbackInfo.yahooSymbol;
    primaryCacheKey = "hoodlefinance:" + fallbackInfo.yahooSymbol;
    cached = hoodlefinanceGetCachedJson_(cacheKey);

    if (cached) {
      jobs[i].quote = cached;
      jobs[i].error = null;
      hoodlefinancePutCachedJson_(primaryCacheKey, cached, 60);
      continue;
    }

    requests.push({
      cacheKey: cacheKey,
      expectedSymbol: fallbackInfo.expectedSymbol,
      job: jobs[i],
      primaryCacheKey: primaryCacheKey,
      url: fallbackInfo.url,
      yahooSymbol: fallbackInfo.yahooSymbol,
    });
  }

  responses = hoodlefinanceFetchAllInChunks_("tradingview-quote", requests);

  for (i = 0; i < responses.length; i += 1) {
    if (responses[i].error) {
      responses[i].request.job.error = hoodlefinanceErrorMessage_(responses[i].error);
      continue;
    }

    try {
      responses[i].request.job.quote = hoodlefinanceExtractTradingviewFundQuoteFromResponse_(
        responses[i].response,
        responses[i].request.yahooSymbol,
        responses[i].request.expectedSymbol
      );
      responses[i].request.job.error = null;
      hoodlefinancePutCachedJson_(responses[i].request.cacheKey, responses[i].request.job.quote, 60);
      hoodlefinancePutCachedJson_(responses[i].request.primaryCacheKey, responses[i].request.job.quote, 60);
    } catch (error) {
      responses[i].request.job.error = hoodlefinanceErrorMessage_(error);
    }
  }
}

function hoodlefinanceBuildIsraeliFundTradingviewFallbackInfo_(tickerInput, yahooSymbol) {
  const normalizedYahooSymbol = String(yahooSymbol || "").trim().toUpperCase();
  const code = normalizedYahooSymbol.replace(/\.TA$/i, "");

  return {
    expectedSymbol: "TASE:" + code,
    url: HOODLEFINANCE_TRADINGVIEW_SYMBOL_URL_ + "TASE-" + code + "/",
    yahooSymbol: normalizedYahooSymbol,
  };
}

function hoodlefinanceResolvePseListing_(symbol) {
  const normalizedSymbol = String(symbol || "").trim().toUpperCase();

  return hoodlefinanceResolveCachedJson_(
    hoodlefinanceBuildPseListingCacheKey_(normalizedSymbol),
    HOODLEFINANCE_PSE_LISTING_CACHE_TTL_SECONDS_,
    function () {
      const html = hoodlefinanceFetchPseText_(HOODLEFINANCE_PSE_SEARCH_URL_ + encodeURIComponent(normalizedSymbol));

      return hoodlefinanceResolvePseListingFromHtml_(html, normalizedSymbol);
    },
    hoodlefinanceParsePseListingPayload_,
    hoodlefinanceSerializePseListingPayload_
  );
}

function hoodlefinanceResolveLonListing_(code) {
  const normalizedCode = String(code || "").trim().toUpperCase();
  const html = hoodlefinanceFetchText_(HOODLEFINANCE_LSE_SEARCH_URL_ + encodeURIComponent(normalizedCode));
  const listings = hoodlefinanceExtractLonListings_(html);
  let i;

  for (i = 0; i < listings.length; i += 1) {
    if (listings[i].code === normalizedCode) {
      return listings[i];
    }
  }

  throw new Error('No LON listing was found for "' + normalizedCode + '".');
}

function hoodlefinanceExtractPseListings_(html) {
  const text = String(html || "");
  const pattern = /<tr>[\s\S]*?cmDetail\('(\d+)','(\d+)'\);return false;">([\s\S]*?)<\/a>[\s\S]*?<td class="alignC"><a[\s\S]*?>([\s\S]*?)<\/a>[\s\S]*?<\/tr>/gi;
  const listings = [];
  let match;

  while ((match = pattern.exec(text))) {
    listings.push({
      companyId: match[1],
      name: hoodlefinanceCleanHtmlText_(match[3]),
      securityId: match[2],
      symbol: hoodlefinanceCleanHtmlText_(match[4]).toUpperCase(),
    });
  }

  return listings;
}

function hoodlefinanceBuildPseUnavailableError_(detail) {
  const normalizedDetail = detail == null ? "" : String(detail).trim();

  return new Error(
    "The PSE data source is currently unavailable" +
      (normalizedDetail ? " (" + normalizedDetail + ")" : "") +
      ". Please try again later."
  );
}

function hoodlefinanceBuildPseHttpErrorMessage_(statusCode) {
  const numericCode = Number(statusCode);

  if (numericCode >= 520 && numericCode < 530) {
    return "PSE upstream returned Cloudflare HTTP " + numericCode + ".";
  }

  return "PSE upstream returned HTTP " + statusCode + ".";
}

function hoodlefinanceFetchPseText_(url) {
  let response;

  try {
    response = UrlFetchApp.fetch(url, hoodlefinanceBuildFetchOptions_());
  } catch (error) {
    throw hoodlefinanceBuildPseUnavailableError_(error && error.message ? error.message : error);
  }

  if (response.getResponseCode() !== 200) {
    throw hoodlefinanceBuildPseUnavailableError_(
      hoodlefinanceBuildPseHttpErrorMessage_(response.getResponseCode())
    );
  }

  return response.getContentText();
}

function hoodlefinanceExtractLonListings_(html) {
  const text = String(html || "");
  const pattern = /<tr[^>]*>[\s\S]*?<td>\s*([^<]+?)\s*<\/td>[\s\S]*?UpdateOpener\(\s*'(?:[^'\\]|\\.)*'\s*,\s*'([\s\S]*?)'\s*\)\s*;?[\s\S]*?>([\s\S]*?)<\/a>[\s\S]*?<\/tr>/gi;
  const listings = [];
  let match;

  while ((match = pattern.exec(text))) {
    const code = hoodlefinanceCleanHtmlText_(match[1]).toUpperCase();
    const payload = hoodlefinanceExtractLonListingPayload_(match[2]);

    if (!code || !payload.isin) {
      continue;
    }

    listings.push({
      code: code,
      countryCode: payload.countryCode,
      currency: payload.currency,
      isin: payload.isin,
      marketCode: payload.marketCode,
      name: hoodlefinanceCleanHtmlText_(match[3]),
      sedol: payload.sedol,
      symbol: payload.symbol || code,
    });
  }

  return listings;
}

function hoodlefinanceExtractLonListingPayload_(text) {
  const normalizedText = String(text || "")
    .replace(/\\r/g, " ")
    .replace(/\\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const parts = normalizedText ? normalizedText.split("|") : [];

  return {
    countryCode: parts[1] ? parts[1].trim().toUpperCase() : "",
    currency: parts[2] ? parts[2].trim().toUpperCase() : "",
    isin: parts[0] ? parts[0].trim().toUpperCase() : "",
    marketCode: parts[3] ? parts[3].trim().toUpperCase() : "",
    sedol: parts[4] ? parts[4].trim().toUpperCase() : "",
    symbol: parts[5] ? parts[5].trim().toUpperCase() : "",
  };
}

function hoodlefinanceExtractPseQuote_(html, listing) {
  const previousClose = hoodlefinanceParseNumber_(hoodlefinanceExtractPseField_(html, "Previous Close and Date"));
  const lastPrice = hoodlefinanceParseNumber_(hoodlefinanceExtractPseField_(html, "Last Traded Price"));
  const changeText = hoodlefinanceExtractPseField_(html, "Change(% Change)");
  const price = lastPrice != null ? lastPrice : previousClose;
  const asOf = hoodlefinanceExtractPseAsOf_(html);
  const change = hoodlefinanceExtractPseChange_(changeText, price, previousClose);
  const changePercent = hoodlefinanceExtractPseChangePercent_(changeText, change, previousClose);

  return {
    currency: "PHP",
    exchangeDataDelayedBy: 0,
    financialCurrency: "PHP",
    isin: hoodlefinanceExtractPseField_(html, "ISIN").toUpperCase(),
    longName: hoodlefinanceExtractPseCompanyName_(html) || (listing && listing.name) || "",
    regularMarketChange: change,
    regularMarketChangePercent: changePercent,
    regularMarketDayHigh: hoodlefinanceParseNumber_(hoodlefinanceExtractPseField_(html, "High")),
    regularMarketDayLow: hoodlefinanceParseNumber_(hoodlefinanceExtractPseField_(html, "Low")),
    regularMarketOpen: hoodlefinanceParseNumber_(hoodlefinanceExtractPseField_(html, "Open")),
    regularMarketPreviousClose: previousClose,
    regularMarketPrice: price,
    regularMarketTime: asOf ? Math.floor(asOf.getTime() / 1000) : null,
    regularMarketVolume: hoodlefinanceParseNumber_(hoodlefinanceExtractPseField_(html, "Volume")),
    shortName: hoodlefinanceExtractPseCompanyName_(html) || (listing && listing.name) || "",
    symbol: hoodlefinanceExtractPseSelectedSymbol_(html) || (listing && listing.symbol) || "",
  };
}

function hoodlefinanceExtractPseField_(html, label) {
  const pattern = new RegExp(
    "<th>\\s*" + hoodlefinanceEscapeRegex_(label) + "\\s*<\\/th>[\\s\\S]*?<td[^>]*>([\\s\\S]*?)<\\/td>",
    "i"
  );
  const match = String(html || "").match(pattern);
  return match ? hoodlefinanceCleanHtmlText_(match[1]) : "";
}

function hoodlefinanceExtractPseCompanyName_(html) {
  const match = String(html || "").match(/<div class="compInfo">[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i);
  return match ? hoodlefinanceCleanHtmlText_(match[1]) : "";
}

function hoodlefinanceExtractPseSelectedSymbol_(html) {
  const match = String(html || "").match(/<option value="[^"]+" selected>([\s\S]*?)<\/option>/i);
  return match ? hoodlefinanceCleanHtmlText_(match[1]).toUpperCase() : "";
}

function hoodlefinanceExtractPseAsOf_(html) {
  const match = String(html || "").match(/As of\s+([^<]+)/i);
  const value = match ? hoodlefinanceCleanHtmlText_(match[1]) : "";
  const parsed = value ? Date.parse(value + " GMT+0800") : NaN;

  return isNaN(parsed) ? null : new Date(parsed);
}

function hoodlefinanceExtractPseChange_(text, price, previousClose) {
  const value = hoodlefinanceParseNumber_(text);

  if (value != null) {
    return /down/i.test(String(text || "")) ? -value : value;
  }

  if (price != null && previousClose != null) {
    return price - previousClose;
  }

  return null;
}

function hoodlefinanceExtractPseChangePercent_(text, change, previousClose) {
  const match = String(text || "").match(/\(([-+]?\d[\d,]*(?:\.\d+)?)%\)/);

  if (match) {
    return Number(match[1].replace(/,/g, "")) / 100;
  }

  if (change != null && previousClose) {
    return change / previousClose;
  }

  return null;
}

function hoodlefinanceCleanHtmlText_(text) {
  return hoodlefinanceDecodeHtmlEntities_(String(text || ""))
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hoodlefinanceDecodeHtmlEntities_(text) {
  return String(text || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function hoodlefinanceParseNumber_(text) {
  const match = String(text || "").replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function hoodlefinanceEscapeRegex_(text) {
  return String(text || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hoodlefinanceResolveIbkrIsin_(quote, context) {
  const symbol = hoodlefinanceExtractQuoteSymbol_(quote);
  const preferredExchange = hoodlefinanceInferIbkrExchange_(context && context.tickerInput, symbol);
  const resolution = hoodlefinanceResolveIsinFromIbkrSymbol_(symbol, preferredExchange);
  const ibkrIsin = resolution && resolution.isin ? resolution.isin : "";

  if (ibkrIsin) {
    return ibkrIsin;
  }

  if (resolution && resolution.error) {
    throw new Error(resolution.error);
  }

  throw new Error("No IBKR ISIN is available for this ticker.");
}

function hoodlefinanceResolveDefaultIsin_(quote, context) {
  const directIsinInput = hoodlefinanceExtractDirectIsinInput_(context);
  const sourceOverride = context && context.tickerInput ? hoodlefinanceExtractTickerSourceOverride_(context.tickerInput) : "";
  const exchange = hoodlefinanceInferIsinExchange_(quote, context);
  const source = sourceOverride || (exchange ? HOODLEFINANCE_ISIN_SOURCE_BY_EXCHANGE_[exchange] || "" : "");

  if (directIsinInput) {
    return directIsinInput;
  }

  if (hoodlefinanceIsFxContext_(quote, context)) {
    throw new Error("ISIN is not available for currency pairs.");
  }

  if (source) {
    return hoodlefinanceResolveIsinBySource_(source, quote, context || {});
  }

  if (!exchange) {
    throw new Error("Could not deduce an exchange for isin lookup. Use an identifier source override such as \"@TRADINGVIEW\", \"@LON\", \"@PSE\", \"@ARIVA\", or \"@IBKR\".");
  }

  throw new Error("No isin source is implemented for exchange \"" + exchange + "\". Use an identifier source override such as \"@TRADINGVIEW\", \"@LON\", \"@PSE\", \"@ARIVA\", or \"@IBKR\".");
}

function hoodlefinanceResolveIsinBySource_(source, quote, context) {
  const normalizedSource = String(source || "").trim().toUpperCase();

  if (normalizedSource === "ARIVA") {
    return hoodlefinanceResolveArivaIsin_(quote, context);
  }

  if (normalizedSource === "IBKR") {
    return hoodlefinanceResolveIbkrIsin_(quote, context);
  }

  if (normalizedSource === "LON") {
    return hoodlefinanceResolveLonIsin_(quote, context);
  }

  if (normalizedSource === "PSE") {
    return hoodlefinanceResolvePseIsin_(quote, context);
  }

  if (normalizedSource === "TRADINGVIEW") {
    return hoodlefinanceResolveTradingviewIsin_(quote, context);
  }

  throw new Error('Source override "@' + normalizedSource + '" is not implemented for isin lookups.');
}

function hoodlefinanceExtractDirectIsinInput_(context) {
  const tickerInput = context && context.tickerInput
    ? String(hoodlefinanceStripTickerSourceOverride_(context.tickerInput) || "").trim().toUpperCase()
    : "";
  const isin = tickerInput.indexOf("ISIN:") === 0 ? tickerInput.slice(5).trim() : tickerInput;

  return hoodlefinanceLooksLikeIsin_(isin) ? isin : "";
}

function hoodlefinanceResolveArivaIsin_(quote, context) {
  const exchange = hoodlefinanceInferIsinExchange_(quote, context);
  const code = hoodlefinanceExtractArivaCode_(quote, context);
  const cacheKey = "hoodlefinance:ariva:isin:" + code;

  if (exchange !== "ETR") {
    throw new Error("ARIVA isin lookup is only implemented for ETR tickers.");
  }

  if (!code) {
    throw new Error("Could not determine the ARIVA search code for this ticker.");
  }

  return hoodlefinanceResolveCachedString_(cacheKey, 21600, function () {
    const listing = hoodlefinanceResolveArivaListing_(code);

    if (!listing.isin) {
      throw new Error('No ARIVA ISIN is available for "' + code + '".');
    }

    if (!listing.hasXetra) {
      throw new Error('ARIVA did not expose a Xetra listing for "' + code + '".');
    }

    return listing.isin;
  });
}

function hoodlefinanceResolvePseIsin_(quote, context) {
  const exchange = hoodlefinanceInferIsinExchange_(quote, context);

  if (exchange !== "PSE") {
    throw new Error("PSE isin lookup is only implemented for PSE tickers.");
  }

  if (quote && quote.isin) {
    return String(quote.isin).toUpperCase();
  }

  throw new Error("No PSE ISIN is available for this ticker.");
}

function hoodlefinanceResolveLonIsin_(quote, context) {
  const exchange = hoodlefinanceInferIsinExchange_(quote, context);
  const code = hoodlefinanceExtractLonCode_(quote, context);
  const cacheKey = "hoodlefinance:lon:isin:" + code;

  if (exchange !== "LON") {
    throw new Error("LON isin lookup is only implemented for LON tickers.");
  }

  if (!code) {
    throw new Error("Could not determine the LON code for this ticker.");
  }

  return hoodlefinanceResolveCachedString_(cacheKey, 21600, function () {
    const listing = hoodlefinanceResolveLonListing_(code);

    if (!listing.isin) {
      throw new Error('No LON ISIN is available for "' + code + '".');
    }

    return listing.isin;
  });
}

function hoodlefinanceResolveTradingviewIsin_(quote, context) {
  const yahooExchange = hoodlefinanceInferIsinExchange_(quote, context);
  const tradingviewExchange = hoodlefinanceInferTradingviewExchange_(quote, context);
  const code = hoodlefinanceExtractTradingviewCode_(quote, context);
  const cacheKey = "hoodlefinance:tradingview:isin:" + tradingviewExchange + ":" + code;
  const expectedSymbol = tradingviewExchange && code ? tradingviewExchange + ":" + code : "";

  if (!tradingviewExchange) {
    if (yahooExchange) {
      throw new Error('TradingView isin lookup is not implemented for exchange "' + yahooExchange + '".');
    }
    throw new Error("Could not determine the TradingView exchange for this ticker.");
  }

  if (!code) {
    throw new Error("Could not determine the TradingView symbol code for this ticker.");
  }

  return hoodlefinanceResolveCachedString_(cacheKey, 21600, function () {
    const html = hoodlefinanceFetchText_(HOODLEFINANCE_TRADINGVIEW_SYMBOL_URL_ + tradingviewExchange + "-" + code + "/");
    const resolvedSymbol = hoodlefinanceExtractTradingviewResolvedSymbol_(html);
    const isin = hoodlefinanceExtractTradingviewIsin_(html);

    if (resolvedSymbol && resolvedSymbol !== expectedSymbol) {
      throw new Error(
        'TradingView resolved "' + expectedSymbol + '" to "' + resolvedSymbol + '" instead of an exact symbol match.'
      );
    }

    if (!isin) {
      throw new Error('No TradingView ISIN is available for "' + expectedSymbol + '".');
    }

    return isin;
  });
}

function hoodlefinanceExtractQuoteSymbol_(quote) {
  return quote && quote.symbol ? String(quote.symbol).trim().toUpperCase() : "";
}

function hoodlefinanceExtractRawYahooExchangeFromQuote_(quote) {
  const exchangeName = String(
    (quote && (quote.exchangeName || quote.fullExchangeName || quote.quoteSourceName)) || ""
  ).trim().toUpperCase();

  return exchangeName || "";
}

function hoodlefinanceIsFxContext_(quote, context) {
  const tickerInput = context && context.tickerInput
    ? String(hoodlefinanceStripTickerSourceOverride_(context.tickerInput) || "").trim()
    : "";
  const resolvedSymbol = hoodlefinanceExtractQuoteSymbol_(quote);

  return !!(quote && (quote.hoodlefinanceFxDisplayCurrency != null || quote.hoodlefinanceFxGoogleSymbol)) ||
    tickerInput.toUpperCase().indexOf("CURRENCY:") === 0 ||
    /^[A-Z]{6}(=X)?$/.test(resolvedSymbol);
}

function hoodlefinanceIsPseContext_(quote, context) {
  const plan = context && context.plan;
  const tickerInput = context && context.tickerInput
    ? String(hoodlefinanceStripTickerSourceOverride_(context.tickerInput) || "").trim()
    : "";

  return (
    hoodlefinanceIsPseTicker_(tickerInput) ||
    (plan && (plan.source === "pse" || hoodlefinanceIsPseTicker_(plan.yahooSymbol || "")))
  );
}

function hoodlefinanceInferYahooExchangeIdentity_(quote, context) {
  const tickerInput = context && context.tickerInput
    ? String(hoodlefinanceStripTickerSourceOverride_(context.tickerInput) || "").trim().toUpperCase()
    : "";
  const explicitExchange = hoodlefinanceExtractTickerExchange_(tickerInput);
  const resolvedSymbol = hoodlefinanceExtractQuoteSymbol_(quote);
  const rawMetaExchange = hoodlefinanceExtractRawYahooExchangeFromQuote_(quote);
  const suffixExchange = hoodlefinanceExtractYahooExchangeFromSymbol_(resolvedSymbol || tickerInput);
  const mappedMetaExchange = hoodlefinanceExtractYahooExchangeFromQuote_(quote);

  if (hoodlefinanceIsFxContext_(quote, context)) {
    return "CURRENCY";
  }

  if (hoodlefinanceIsPseContext_(quote, context)) {
    return "PSE";
  }

  if (rawMetaExchange && HOODLEFINANCE_GOOGLE_EXCHANGE_BY_YAHOO_IDENTITY_[rawMetaExchange]) {
    return rawMetaExchange;
  }

  if (suffixExchange) {
    return suffixExchange;
  }

  if (explicitExchange) {
    return explicitExchange;
  }

  if (mappedMetaExchange) {
    return mappedMetaExchange;
  }

  return rawMetaExchange;
}

function hoodlefinanceResolveGoogleExchange_(quote, context) {
  const yahooExchange = hoodlefinanceInferYahooExchangeIdentity_(quote, context);

  if (!yahooExchange) {
    return "";
  }

  if (HOODLEFINANCE_GOOGLE_EXCHANGE_BY_YAHOO_IDENTITY_[yahooExchange]) {
    return HOODLEFINANCE_GOOGLE_EXCHANGE_BY_YAHOO_IDENTITY_[yahooExchange];
  }

  return yahooExchange === "TASE"
    ? "TLV"
    : (HOODLEFINANCE_PREFIXLESS_EXCHANGES_[yahooExchange] || HOODLEFINANCE_EXCHANGE_SUFFIXES_[yahooExchange])
      ? yahooExchange
      : "";
}

function hoodlefinanceRenderGoogleSymbol_(quote, context) {
  const resolvedSymbol = hoodlefinanceExtractQuoteSymbol_(quote);
  const googleExchange = hoodlefinanceResolveGoogleExchange_(quote, context);
  const suffix = googleExchange && HOODLEFINANCE_EXCHANGE_SUFFIXES_[googleExchange];

  if (hoodlefinanceIsFxContext_(quote, context)) {
    if (quote && quote.hoodlefinanceFxGoogleSymbol) {
      return String(quote.hoodlefinanceFxGoogleSymbol);
    }

    if (!resolvedSymbol) {
      throw new Error("No Google-style symbol is available for this instrument.");
    }

    return "CURRENCY:" + resolvedSymbol.replace(/=X$/i, "");
  }

  if (hoodlefinanceIsPseContext_(quote, context)) {
    if (!resolvedSymbol) {
      throw new Error("No Google-style symbol is available for this instrument.");
    }

    return "PSE:" + resolvedSymbol;
  }

  if (!googleExchange || !resolvedSymbol) {
    throw new Error("No Google-style symbol is available for this instrument.");
  }

  if (HOODLEFINANCE_PREFIXLESS_EXCHANGES_[googleExchange]) {
    return googleExchange + ":" + resolvedSymbol;
  }

  if (!suffix || resolvedSymbol.slice(-suffix.length).toUpperCase() !== suffix.toUpperCase()) {
    throw new Error("No Google-style symbol is available for this instrument.");
  }

  return googleExchange + ":" + resolvedSymbol.slice(0, -suffix.length);
}

function hoodlefinanceResolveSymbolAttribute_(quote, context, style) {
  const resolvedSymbol = hoodlefinanceExtractQuoteSymbol_(quote);

  if (!resolvedSymbol) {
    throw new Error("No resolved symbol is available for this instrument.");
  }

  if (style === "yahoo") {
    if (hoodlefinanceIsFxContext_(quote, context)) {
      return resolvedSymbol.replace(/=X$/i, "") + "=X";
    }

    return hoodlefinanceIsPseContext_(quote, context) ? resolvedSymbol + ".PS" : resolvedSymbol;
  }

  return hoodlefinanceRenderGoogleSymbol_(quote, context);
}

function hoodlefinanceResolveExchangeAttribute_(quote, context, style) {
  const exchange = style === "yahoo"
    ? hoodlefinanceInferYahooExchangeIdentity_(quote, context)
    : hoodlefinanceResolveGoogleExchange_(quote, context);

  if (!exchange) {
    throw new Error("No " + (style === "yahoo" ? "Yahoo-style" : "Google-style") + " exchange is available for this instrument.");
  }

  return exchange;
}

function hoodlefinanceExtractTradingviewCode_(quote, context) {
  const tickerInput = context && context.tickerInput
    ? String(hoodlefinanceStripTickerSourceOverride_(context.tickerInput) || "").trim().toUpperCase()
    : "";
  const resolvedSymbol = hoodlefinanceExtractQuoteSymbol_(quote);
  const candidates = [
    tickerInput,
    resolvedSymbol,
  ];
  let i;
  let candidate;
  let parts;
  let match;

  for (i = 0; i < candidates.length; i += 1) {
    candidate = candidates[i];
    if (!candidate) {
      continue;
    }

    if (candidate.indexOf(":") >= 0) {
      parts = candidate.split(":");
      if (parts.length > 1) {
        return hoodlefinanceNormalizeTradingviewCodeForExchange_(parts[0], parts.slice(1).join(":"));
      }
    }

    match = candidate.match(/^(.+)\.[A-Z0-9]+$/);
    if (match) {
      return hoodlefinanceNormalizeTradingviewCodeForExchange_("", match[1]);
    }

    return candidate;
  }

  return "";
}

function hoodlefinanceNormalizeTradingviewCodeForExchange_(exchange, code) {
  const normalizedExchange = String(exchange || "").trim().toUpperCase();
  const normalizedCode = String(code || "").trim().toUpperCase();

  if (normalizedExchange === "TLV" || normalizedExchange === "TASE" || /\.TA$/i.test(normalizedCode)) {
    return hoodlefinanceNormalizeIsraeliFundCode_(normalizedCode.replace(/\.TA$/i, ""));
  }

  return normalizedCode;
}

function hoodlefinanceExtractLonCode_(quote, context) {
  const tickerInput = context && context.tickerInput
    ? String(hoodlefinanceStripTickerSourceOverride_(context.tickerInput) || "").trim().toUpperCase()
    : "";
  const resolvedSymbol = hoodlefinanceExtractQuoteSymbol_(quote);
  const candidates = [
    tickerInput,
    resolvedSymbol,
  ];
  let i;
  let candidate;
  let parts;
  let match;

  for (i = 0; i < candidates.length; i += 1) {
    candidate = candidates[i];
    if (!candidate) {
      continue;
    }

    if (candidate.indexOf("LON:") === 0) {
      parts = candidate.split(":");
      return parts.slice(1).join(":").trim().toUpperCase();
    }

    match = candidate.match(/^([A-Z0-9]+)\.L$/);
    if (match) {
      return match[1];
    }
  }

  return "";
}

function hoodlefinanceInferTradingviewExchange_(quote, context) {
  const yahooExchange = hoodlefinanceInferIsinExchange_(quote, context);
  return yahooExchange ? HOODLEFINANCE_TRADINGVIEW_EXCHANGE_BY_YAHOO_EXCHANGE_[yahooExchange] || "" : "";
}

function hoodlefinanceExtractArivaCode_(quote, context) {
  const tickerInput = context && context.tickerInput
    ? String(hoodlefinanceStripTickerSourceOverride_(context.tickerInput) || "").trim().toUpperCase()
    : "";
  const resolvedSymbol = hoodlefinanceExtractQuoteSymbol_(quote);
  const candidates = [
    tickerInput,
    resolvedSymbol,
  ];
  let i;
  let candidate;
  let parts;
  let match;

  for (i = 0; i < candidates.length; i += 1) {
    candidate = candidates[i];
    if (!candidate) {
      continue;
    }

    if (candidate.indexOf("ETR:") === 0) {
      parts = candidate.split(":");
      return parts.slice(1).join(":").trim().toUpperCase();
    }

    match = candidate.match(/^([A-Z0-9]+)\.DE$/);
    if (match) {
      return match[1];
    }
  }

  return "";
}

function hoodlefinanceInferIsinExchange_(quote, context) {
  const tickerInput = context && context.tickerInput
    ? String(hoodlefinanceStripTickerSourceOverride_(context.tickerInput) || "").trim().toUpperCase()
    : "";
  const explicitExchange = hoodlefinanceExtractTickerExchange_(tickerInput);
  const resolvedSymbol = hoodlefinanceExtractQuoteSymbol_(quote);
  const suffixExchange = hoodlefinanceExtractYahooExchangeFromSymbol_(resolvedSymbol || tickerInput);
  const metaExchange = hoodlefinanceExtractYahooExchangeFromQuote_(quote);

  if (hoodlefinanceIsPseTicker_(tickerInput)) {
    return "PSE";
  }

  if (explicitExchange) {
    return explicitExchange;
  }

  if (suffixExchange) {
    return suffixExchange;
  }

  if (metaExchange) {
    return metaExchange;
  }

  return "";
}

function hoodlefinanceExtractTickerExchange_(ticker) {
  const value = String(hoodlefinanceStripTickerSourceOverride_(ticker) || "").trim().toUpperCase();
  const parts = value.split(":");
  const exchange = parts.length > 1 ? parts[0] : "";

  if (!exchange || exchange === "CURRENCY" || exchange === "ISIN") {
    return "";
  }

  if (exchange === "PSE") {
    return "PSE";
  }

  if (HOODLEFINANCE_PREFIXLESS_EXCHANGES_[exchange] || HOODLEFINANCE_EXCHANGE_SUFFIXES_[exchange] || hoodlefinanceNormalizeExplicitIbkrExchange_(exchange)) {
    return exchange;
  }

  return "";
}

function hoodlefinanceExtractYahooExchangeFromSymbol_(symbol) {
  const match = String(symbol || "").trim().toUpperCase().match(/\.([A-Z0-9]+)$/);
  const suffix = match ? match[1] : "";

  return suffix ? HOODLEFINANCE_YAHOO_EXCHANGE_BY_SUFFIX_[suffix] || "" : "";
}

function hoodlefinanceExtractYahooExchangeFromQuote_(quote) {
  const exchangeName = String(
    (quote && (quote.exchangeName || quote.fullExchangeName || quote.quoteSourceName)) || ""
  ).trim().toUpperCase();

  return exchangeName ? HOODLEFINANCE_YAHOO_EXCHANGE_BY_META_NAME_[exchangeName] || "" : "";
}

function hoodlefinanceResolveArivaListing_(code) {
  const normalizedCode = String(code || "").trim().toUpperCase();
  const html = hoodlefinanceFetchText_(HOODLEFINANCE_ARIVA_LIVESEARCH_URL_ + encodeURIComponent(normalizedCode));
  const listings = hoodlefinanceExtractArivaListings_(html);
  let i;
  let detailHtml;

  for (i = 0; i < listings.length; i += 1) {
    if (listings[i].code !== normalizedCode) {
      continue;
    }

    detailHtml = hoodlefinanceFetchText_(HOODLEFINANCE_ARIVA_BASE_URL_ + listings[i].href);
    return {
      code: normalizedCode,
      hasXetra: hoodlefinanceArivaHasXetra_(detailHtml),
      href: listings[i].href,
      isin: hoodlefinanceExtractArivaIsin_(detailHtml),
      type: listings[i].type,
    };
  }

  throw new Error('No ARIVA listing was found for "' + normalizedCode + '".');
}

function hoodlefinanceExtractArivaListings_(html) {
  const text = String(html || "");
  const pattern = /<tr\b[^>]*>[\s\S]*?<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<td>([\s\S]*?)<\/td>[\s\S]*?<\/tr>/gi;
  const listings = [];
  let match;
  let codeMatch;

  while ((match = pattern.exec(text))) {
    codeMatch = String(match[2] || "").match(/liveSearchMark">([\s\S]*?)<\/span>/i);
    if (!codeMatch) {
      continue;
    }

    listings.push({
      code: hoodlefinanceCleanHtmlText_(codeMatch[1]).toUpperCase(),
      href: String(match[1] || "").trim(),
      type: hoodlefinanceCleanHtmlText_(match[3]),
    });
  }

  return listings;
}

function hoodlefinanceExtractArivaIsin_(html) {
  const titleMatch = String(html || "").match(/<title>[\s\S]*?\bISIN\s+([A-Z]{2}[A-Z0-9]{9}[0-9])\b[\s\S]*?<\/title>/i);
  const fieldMatch = String(html || "").match(/ISIN:&nbsp;<\/span>\s*<span class="value">([A-Z]{2}[A-Z0-9]{9}[0-9])<\/span>/i);
  const rawIsin = fieldMatch ? fieldMatch[1] : titleMatch ? titleMatch[1] : "";

  return rawIsin ? rawIsin.toUpperCase() : "";
}

function hoodlefinanceArivaHasXetra_(html) {
  return /\bXetra\b/i.test(String(html || ""));
}

function hoodlefinanceExtractTradingviewResolvedSymbol_(html) {
  const match = String(html || "").match(/"resolved_symbol":"([^"]+)"/i);
  return match ? match[1].toUpperCase() : "";
}

function hoodlefinanceExtractTradingviewIsin_(html) {
  const match = String(html || "").match(/"isin_displayed":"([A-Z]{2}[A-Z0-9]{9}[0-9])"/i);
  return match ? match[1].toUpperCase() : "";
}

function hoodlefinanceExtractTradingviewSymbolInfo_(html) {
  const match = String(html || "").match(/window\.initData\.symbolInfo\s*=\s*(\{[\s\S]*?\});/i);

  if (!match) {
    return null;
  }

  try {
    return JSON.parse(match[1]);
  } catch (error) {
    return null;
  }
}

function hoodlefinanceExtractTradingviewQuotePrice_(html) {
  const match = String(html || "").match(/\btrades at\s+([0-9.,\u00A0\u202F ]+)\s*([A-Z]{3})\s+today\b/i);
  return match ? hoodlefinanceParseNumber_(match[1]) : null;
}

function hoodlefinanceExtractTradingviewFundQuoteFromResponse_(response, yahooSymbol, expectedSymbol) {
  if (response.getResponseCode() !== 200) {
    throw new Error('TradingView quote lookup failed for "' + expectedSymbol + '" (' + response.getResponseCode() + ").");
  }

  return hoodlefinanceExtractTradingviewFundQuote_(response.getContentText(), yahooSymbol, expectedSymbol);
}

function hoodlefinanceExtractTradingviewFundQuote_(html, yahooSymbol, expectedSymbol) {
  const symbolInfo = hoodlefinanceExtractTradingviewSymbolInfo_(html);
  const resolvedSymbol = symbolInfo && symbolInfo.resolved_symbol
    ? String(symbolInfo.resolved_symbol).toUpperCase()
    : hoodlefinanceExtractTradingviewResolvedSymbol_(html);
  const price = hoodlefinanceExtractTradingviewQuotePrice_(html);
  const currency = symbolInfo && (symbolInfo.currency || symbolInfo.currency_code)
    ? String(symbolInfo.currency || symbolInfo.currency_code).toUpperCase()
    : "";
  const name = symbolInfo
    ? symbolInfo.description || symbolInfo.short_description || symbolInfo.local_description || symbolInfo.short_name || ""
    : "";
  const isin = symbolInfo && symbolInfo.isin_displayed ? String(symbolInfo.isin_displayed).toUpperCase() : hoodlefinanceExtractTradingviewIsin_(html);

  if (resolvedSymbol && expectedSymbol && resolvedSymbol !== expectedSymbol) {
    throw new Error(
      'TradingView resolved "' + expectedSymbol + '" to "' + resolvedSymbol + '" instead of an exact symbol match.'
    );
  }

  if (!name) {
    throw new Error('No TradingView quote name is available for "' + expectedSymbol + '".');
  }

  if (price == null) {
    throw new Error('No TradingView quote price is available for "' + expectedSymbol + '".');
  }

  return {
    currency: currency,
    exchangeName: "TASE",
    financialCurrency: currency,
    isin: isin,
    longName: String(name),
    regularMarketPrice: price,
    shortName: symbolInfo && symbolInfo.short_name ? String(symbolInfo.short_name) : "",
    symbol: String(yahooSymbol || "").trim().toUpperCase(),
  };
}

function hoodlefinanceResolveIsinFromIbkrSymbol_(symbol, preferredExchange) {
  const normalizedSymbol = String(symbol || "").trim().toUpperCase();
  const baseSymbol = normalizedSymbol.replace(/\.[A-Z0-9]+$/, "");
  const lookupSymbol = baseSymbol || normalizedSymbol;
  const cacheKey = "hoodlefinance:ibkr:isin:" + lookupSymbol + ":" + (preferredExchange || "");
  let searchUrls;
  let detailEntries;
  let searchHtml;
  let searchError;
  let i;
  let isin;

  if (!lookupSymbol) {
    return {
      error: "",
      isin: "",
    };
  }

  isin = hoodlefinanceGetCachedString_(cacheKey);

  if (isin) {
    return {
      error: "",
      isin: isin,
    };
  }

  searchUrls = hoodlefinanceBuildIbkrSearchUrls_(lookupSymbol, preferredExchange);

  for (i = 0; i < searchUrls.length; i += 1) {
    searchHtml = hoodlefinanceFetchText_(searchUrls[i]);
    searchError = hoodlefinanceExtractIbkrSearchError_(searchHtml, lookupSymbol, searchUrls[i]);

    if (searchError) {
      return {
        error: searchError,
        isin: "",
      };
    }

    detailEntries = hoodlefinanceExtractIbkrDetailUrls_(searchHtml);
    hoodlefinanceSortIbkrDetailEntries_(detailEntries, preferredExchange);

    isin = hoodlefinanceResolveIbkrIsinFromDetailEntries_(detailEntries);
    if (isin) {
      hoodlefinancePutCachedString_(cacheKey, isin, 21600);
      return {
        error: "",
        isin: isin,
      };
    }
  }

  return {
    error: "",
    isin: "",
  };
}

function hoodlefinanceBuildIbkrSearchUrls_(symbol, preferredExchange) {
  const urls = [];
  const encodedSymbol = encodeURIComponent(String(symbol || "").trim().toUpperCase());
  const encodedExchange = encodeURIComponent(String(preferredExchange || "").trim().toUpperCase());

  if (preferredExchange) {
    urls.push(HOODLEFINANCE_IBKR_SEARCH_URL_ + encodedSymbol + "&exchange=" + encodedExchange);
  }

  urls.push(HOODLEFINANCE_IBKR_SEARCH_URL_ + encodedSymbol);

  return urls;
}

function hoodlefinanceResolveIbkrIsinFromDetailEntries_(detailEntries) {
  let i;
  let detailHtml;
  let isin;

  for (i = 0; i < detailEntries.length && i < 8; i += 1) {
    detailHtml = hoodlefinanceFetchText_(detailEntries[i].url);
    isin = hoodlefinanceExtractIsin_(detailHtml);
    if (isin) {
      return isin;
    }
  }

  return "";
}

function hoodlefinanceExtractIbkrDetailUrls_(text) {
  const legacyMatches = String(text || "").match(/(?:https:\/\/misc\.interactivebrokers\.com)?\/cstools\/contract_info\/(?:v3\.10\/)?index2?\.php\?action=Details(?:&amp;|&)conid=\d+(?:&amp;|&)site=\w+/gi);
  const modernPattern = /<tr[^>]*>[\s\S]*?<a href="javascript:showDetails\('(\d+)'\)">Details<\/a>[\s\S]*?<\/tr>/gi;
  const urls = [];
  const seen = {};
  let i;
  let match;
  let row;
  let normalizedUrl;
  let exchangeHint;

  if (legacyMatches) {
    for (i = 0; i < legacyMatches.length; i += 1) {
      normalizedUrl = hoodlefinanceNormalizeIbkrUrl_(legacyMatches[i]);
      exchangeHint = hoodlefinanceExtractIbkrExchangeHint_(legacyMatches[i]);
      if (!seen[normalizedUrl]) {
        seen[normalizedUrl] = true;
        urls.push({
          exchangeHint: exchangeHint,
          url: normalizedUrl,
        });
      }
    }
  }

  while ((match = modernPattern.exec(String(text || "")))) {
    row = match[0];
    normalizedUrl = HOODLEFINANCE_IBKR_DETAIL_URL_ + match[1];
    exchangeHint = hoodlefinanceExtractIbkrModernExchangeHint_(row);
    if (!seen[normalizedUrl]) {
      seen[normalizedUrl] = true;
      urls.push({
        exchangeHint: exchangeHint,
        url: normalizedUrl,
      });
    }
  }

  return urls;
}

function hoodlefinanceExtractIbkrSearchError_(text, symbol, url) {
  const html = String(text || "");
  const normalizedSymbol = String(symbol || "").trim().toUpperCase();
  const lookupUrl = String(url || "");

  if (!html) {
    return "";
  }

  if (
    /To continue please enter the text from the image below/i.test(html) ||
    /<img[^>]+image\.php\?str=/i.test(html) ||
    /name=["']filter["']/i.test(html)
  ) {
    return (
      'IBKR ISIN lookup is currently blocked by a captcha challenge for "' +
      normalizedSymbol +
      '". URL: ' +
      lookupUrl
    );
  }

  return "";
}

function hoodlefinanceExtractIbkrModernExchangeHint_(rowHtml) {
  const match = String(rowHtml || "").match(
    /<td\b[\s\S]*?<\/td>\s*<td\b[\s\S]*?<\/td>\s*<td\b[\s\S]*?<\/td>\s*<td\b[\s\S]*?<\/td>\s*<td\b[\s\S]*?>([\s\S]*?)<\/td>/i
  );
  const rawValue = match ? String(match[1]).replace(/^.*">/s, "") : "";

  return rawValue ? hoodlefinanceCleanHtmlText_(rawValue).toUpperCase() : "";
}

function hoodlefinanceExtractIbkrExchangeHint_(text) {
  const match = String(text || "").match(/[$]exchange([A-Z0-9.]+)/i);
  return match ? match[1].toUpperCase() : "";
}

function hoodlefinanceSortIbkrDetailEntries_(entries, preferredExchange) {
  const preferred = String(preferredExchange || "").trim().toUpperCase();

  if (!preferred || !entries || entries.length < 2) {
    return entries;
  }

  entries.sort(function (left, right) {
    const leftScore = left.exchangeHint === preferred ? 1 : 0;
    const rightScore = right.exchangeHint === preferred ? 1 : 0;
    return rightScore - leftScore;
  });

  return entries;
}

function hoodlefinanceInferIbkrExchange_(tickerInput, resolvedSymbol) {
  const rawTicker = String(hoodlefinanceStripTickerSourceOverride_(tickerInput || resolvedSymbol || "") || "").trim().toUpperCase();
  const explicitParts = rawTicker.split(":");
  const explicitExchange = explicitParts.length > 1 ? explicitParts[0] : "";
  const yahooSymbol = String(resolvedSymbol || "").trim().toUpperCase();
  const suffixSource = rawTicker.indexOf(":") >= 0 ? explicitParts.slice(1).join(":") : rawTicker || yahooSymbol;
  const suffixMatch = String(suffixSource || yahooSymbol).match(/\.([A-Z0-9]+)$/);
  const suffix = suffixMatch ? suffixMatch[1] : "";
  const explicitIbkrExchange = hoodlefinanceNormalizeExplicitIbkrExchange_(explicitExchange);
  const explicitYahooExchange = HOODLEFINANCE_IBKR_EXCHANGE_BY_YAHOO_EXCHANGE_[explicitExchange] || "";
  const suffixIbkrExchange = HOODLEFINANCE_IBKR_EXCHANGE_BY_YAHOO_SUFFIX_[suffix] || "";

  if (explicitIbkrExchange) {
    return explicitIbkrExchange;
  }

  if (explicitYahooExchange) {
    return explicitYahooExchange;
  }

  if (suffixIbkrExchange) {
    return suffixIbkrExchange;
  }

  return "";
}

function hoodlefinanceNormalizeExplicitIbkrExchange_(exchange) {
  const normalizedExchange = String(exchange || "").trim().toUpperCase();
  const knownIbkrExchanges = {
    AEB: true,
    AMEX: true,
    ARCA: true,
    ASX: true,
    BATS: true,
    BM: true,
    BOVESPA: true,
    BSE: true,
    BVME: true,
    CSE: true,
    EBS: true,
    "ENEXT.BE": true,
    FWB: true,
    HEX: true,
    IBIS: true,
    ICEX: true,
    INDEX: true,
    ISE: true,
    JSE: true,
    KOSDAQ: true,
    KSE: true,
    LSEETF: true,
    MEXI: true,
    NASDAQ: true,
    NSE: true,
    NYSE: true,
    NZSE: true,
    OSE: true,
    PINK: true,
    SBF: true,
    SEHK: true,
    SFB: true,
    TSE: true,
    TSEJ: true,
    VENTURE: true,
    VSE: true,
    WSE: true,
  };

  return knownIbkrExchanges[normalizedExchange] ? normalizedExchange : "";
}

function hoodlefinanceNormalizeIbkrUrl_(url) {
  const normalizedUrl = String(url || "").replace(/&amp;/g, "&");

  if (normalizedUrl.indexOf("http") === 0) {
    return normalizedUrl;
  }

  return "https://misc.interactivebrokers.com" + normalizedUrl;
}

function hoodlefinanceBuildFetchOptions_() {
  return {
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Accept-Language": "en-US,en;q=0.9"
    },
    muteHttpExceptions: true,
  };
}

function hoodlefinanceBuildFetchRequest_(url) {
  const request = hoodlefinanceBuildFetchOptions_();

  request.url = url;
  return request;
}

function hoodlefinanceFetchAllInChunks_(source, requests) {
  const responses = [];
  let i;
  let chunk;
  let chunkResponses;
  let chunkIndex;

  if (!requests.length) {
    return responses;
  }

  for (i = 0; i < requests.length; i += HOODLEFINANCE_FETCHALL_BATCH_SIZE_) {
    chunk = requests.slice(i, i + HOODLEFINANCE_FETCHALL_BATCH_SIZE_);
    chunkResponses = hoodlefinanceFetchChunk_(chunk);

    for (chunkIndex = 0; chunkIndex < chunk.length; chunkIndex += 1) {
      responses.push({
        error: chunkResponses[chunkIndex].error || null,
        request: chunk[chunkIndex],
        response: chunkResponses[chunkIndex].response || null,
        source: source,
      });
    }
  }

  return responses;
}

function hoodlefinanceFetchChunk_(requests) {
  let responses;
  let i;

  if (!UrlFetchApp.fetchAll) {
    return requests.map(function (request) {
      try {
        return {
          error: null,
          response: UrlFetchApp.fetch(request.url, hoodlefinanceBuildFetchOptions_()),
        };
      } catch (error) {
        return {
          error: error,
          response: null,
        };
      }
    });
  }

  try {
    responses = UrlFetchApp.fetchAll(requests.map(function (request) {
      return hoodlefinanceBuildFetchRequest_(request.url);
    }));

    return responses.map(function (response) {
      return {
        error: null,
        response: response,
      };
    });
  } catch (error) {
    responses = [];

    for (i = 0; i < requests.length; i += 1) {
      try {
        responses.push({
          error: null,
          response: UrlFetchApp.fetch(requests[i].url, hoodlefinanceBuildFetchOptions_()),
        });
      } catch (requestError) {
        responses.push({
          error: requestError,
          response: null,
        });
      }
    }

    return responses;
  }
}

function hoodlefinanceFetchText_(url) {
  const response = UrlFetchApp.fetch(url, hoodlefinanceBuildFetchOptions_());

  if (response.getResponseCode() !== 200) {
    return "";
  }

  return response.getContentText();
}

function hoodlefinanceBuildGoogleFinanceQuoteUrl_(pairSlug) {
  return "https://www.google.com/finance/quote/" + encodeURIComponent(pairSlug);
}

function hoodlefinanceExtractGoogleFinanceFxPairQuote_(html, fxPair) {
  const tuple = hoodlefinanceExtractGoogleFinancePairTuple_(html, fxPair.googlePairSlug);
  const marketData = Array.isArray(tuple[5]) ? tuple[5] : [];
  const pairDetail = Array.isArray(tuple[15]) ? tuple[15] : [];
  const currentPrice = Number(marketData[0]);
  const changeAmount = Number(marketData[1]);
  const previousClose = Number(tuple[7]);
  const timestampList = Array.isArray(tuple[11]) ? tuple[11] : [];
  const regularMarketTime = Number(timestampList[0]);
  const baseCode = String(pairDetail[0] || fxPair.baseCanonicalCode).trim().toUpperCase();
  const quoteCode = String(pairDetail[1] || fxPair.quoteCanonicalCode).trim().toUpperCase();
  const baseName = String(pairDetail[2] || baseCode).trim();
  const quoteName = String(pairDetail[3] || quoteCode).trim();

  if (!isFinite(currentPrice)) {
    throw new Error('Google Finance did not expose a price for "' + fxPair.googlePairSlug + '".');
  }

  return {
    currency: quoteCode,
    exchangeDataDelayedBy: 0,
    financialCurrency: quoteCode,
    previousClose: isFinite(previousClose) ? previousClose : currentPrice - (isFinite(changeAmount) ? changeAmount : 0),
    regularMarketPreviousClose: isFinite(previousClose) ? previousClose : currentPrice - (isFinite(changeAmount) ? changeAmount : 0),
    regularMarketPrice: currentPrice,
    regularMarketTime: isFinite(regularMarketTime) ? regularMarketTime : Math.floor(new Date().getTime() / 1000),
    shortName: baseName + " (" + fxPair.baseDisplayCode + " / " + fxPair.displayQuoteCode + ")",
    symbol: baseCode + quoteCode,
  };
}

function hoodlefinanceExtractGoogleFinancePairTuple_(html, pairSlug) {
  const callbacks = String(html || "").match(/AF_initDataCallback\(([\s\S]*?)\);\s*<\/script>/gi) || [];
  let i;
  let dataMatch;
  let data;
  let tuple;

  for (i = 0; i < callbacks.length; i += 1) {
    dataMatch = callbacks[i].match(/data:(\[[\s\S]*?\]),\s*sideChannel:/i);
    if (!dataMatch) {
      continue;
    }

    data = JSON.parse(dataMatch[1]);
    tuple = hoodlefinanceFindGoogleFinancePairTuple_(data, pairSlug);

    if (tuple) {
      return tuple;
    }
  }

  throw new Error('Google Finance did not expose a quote tuple for "' + pairSlug + '".');
}

function hoodlefinanceFindGoogleFinancePairTuple_(value, pairSlug) {
  let i;
  let nested;

  if (!Array.isArray(value)) {
    return null;
  }

  if (value.indexOf(pairSlug) >= 0) {
    return value;
  }

  for (i = 0; i < value.length; i += 1) {
    nested = hoodlefinanceFindGoogleFinancePairTuple_(value[i], pairSlug);
    if (nested) {
      return nested;
    }
  }

  return null;
}

function hoodlefinanceExtractIsin_(text) {
  const match = String(text || "").match(/ISIN[\s\S]{0,200}?([A-Z]{2}[A-Z0-9]{9}[0-9])/i);
  return match ? match[1].toUpperCase() : "";
}

function hoodlefinanceBuildYahooChartUrl_(yahooSymbol) {
  return "https://query1.finance.yahoo.com/v8/finance/chart/" +
    encodeURIComponent(yahooSymbol) +
    "?interval=1d&range=1d";
}

function hoodlefinanceBuildYahooIsinSearchUrl_(isin) {
  return "https://query2.finance.yahoo.com/v1/finance/search?q=" + encodeURIComponent(isin) + "&quotesCount=10&newsCount=0";
}

function hoodlefinanceExtractYahooQuoteMetaFromResponse_(response, ticker) {
  if (response.getResponseCode() !== 200) {
    throw new Error(hoodlefinanceBuildYahooQuoteLookupErrorMessage_(ticker, response.getResponseCode()));
  }

  return hoodlefinanceExtractYahooQuoteMetaFromPayload_(JSON.parse(response.getContentText()), ticker);
}

function hoodlefinanceBuildYahooQuoteLookupErrorMessage_(ticker, statusCode) {
  const normalizedTicker = String(ticker || "").trim();
  const upperTicker = normalizedTicker.toUpperCase();

  if (Number(statusCode) === 404 && upperTicker.indexOf("OTCMKTS:") === 0) {
    return "No current quote data was found for " + normalizedTicker + ". The symbol may be delisted or cancelled.";
  }

  return "Quote lookup failed for " + normalizedTicker + " (" + statusCode + ").";
}

function hoodlefinanceExtractYahooQuoteMetaFromPayload_(payload, ticker) {
  const chart = payload && payload.chart;
  const results = chart && chart.result;
  const firstResult = results && results[0];
  const meta = firstResult && firstResult.meta;

  if (!meta) {
    throw new Error("No quote data was found for " + ticker + ".");
  }

  return meta;
}

function hoodlefinanceExtractYahooSymbolFromSearchResponse_(response, isin) {
  if (response.getResponseCode() !== 200) {
    throw new Error('ISIN lookup failed for "' + isin + '" (' + response.getResponseCode() + ").");
  }

  return hoodlefinanceExtractYahooSymbolFromSearchPayload_(JSON.parse(response.getContentText()), isin);
}

function hoodlefinanceExtractYahooSymbolFromSearchPayload_(payload, isin) {
  const quotes = payload && payload.quotes;
  let symbol = "";
  let i;

  if (quotes && quotes.length) {
    for (i = 0; i < quotes.length; i += 1) {
      if (quotes[i] && quotes[i].symbol && quotes[i].isYahooFinance !== false) {
        symbol = quotes[i].symbol;
        break;
      }
    }
  }

  if (!symbol) {
    throw new Error('No Yahoo Finance symbol was found for ISIN "' + isin + '".');
  }

  return symbol;
}

function hoodlefinanceResolvePseListingFromHtml_(html, symbol) {
  const listings = hoodlefinanceExtractPseListings_(html);
  const normalizedSymbol = String(symbol || "").trim().toUpperCase();
  let i;

  for (i = 0; i < listings.length; i += 1) {
    if (listings[i].symbol === normalizedSymbol) {
      return listings[i];
    }
  }

  throw new Error('No PSE listing was found for "' + normalizedSymbol + '".');
}

function hoodlefinanceResolvePseTickerFromIsinMap_(isin) {
  const normalizedIsin = String(isin || "").trim().toUpperCase();

  if (normalizedIsin.indexOf("PH") !== 0) {
    return "";
  }

  return hoodlefinanceGetPseIsinMap_()[normalizedIsin] || "";
}

function hoodlefinanceResolveIsinFromSearchResponse_(response, isin) {
  try {
    return hoodlefinanceExtractYahooSymbolFromSearchResponse_(response, isin);
  } catch (error) {
    const pseTicker = hoodlefinanceResolvePseTickerFromIsinMap_(isin);

    if (pseTicker) {
      return pseTicker;
    }

    throw error;
  }
}

function hoodlefinanceResolveIsin_(isin) {
  if (!hoodlefinanceLooksLikeIsin_(isin)) {
    throw new Error('ISIN "' + isin + '" is invalid.');
  }

  const cacheKey = "hoodlefinance:isin:" + isin;
  const pseTicker = hoodlefinanceResolvePseTickerFromIsinMap_(isin);

  return hoodlefinanceResolveCachedString_(cacheKey, 21600, function () {
    if (pseTicker) {
      return pseTicker;
    }

    return hoodlefinanceResolveIsinFromSearchResponse_(
      UrlFetchApp.fetch(hoodlefinanceBuildYahooIsinSearchUrl_(isin), hoodlefinanceBuildFetchOptions_()),
      isin
    );
  });
}

function hoodlefinanceErrorMessage_(error) {
  return String(error && error.message ? error.message : error);
}

function hoodlefinanceLooksLikeIsin_(value) {
  return /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/i.test(String(value).trim());
}
