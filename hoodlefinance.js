const HOODLEFINANCE_VERSION_ = "0.9.5";

const HOODLEFINANCE_SUPPORTED_ATTRIBUTES_ = {
  exchange: function (quote, context) {
    return hf_resolveExchangeAttribute_(quote, context, "google");
  },
  "exchange:google": function (quote, context) {
    return hf_resolveExchangeAttribute_(quote, context, "google");
  },
  "exchange:yahoo": function (quote, context) {
    return hf_resolveExchangeAttribute_(quote, context, "yahoo");
  },
  currency: function (quote) {
    return hf_extractCurrencyValue_(quote);
  },
  datadelay: function (quote) {
    return quote.exchangeDataDelayedBy != null ? quote.exchangeDataDelayedBy : 0;
  },
  close: function (quote) {
    return hf_normalizeMoney_(quote, hf_previousClose_(quote));
  },
  high: function (quote) {
    return hf_normalizeMoney_(quote, quote.regularMarketDayHigh);
  },
  low: function (quote) {
    return hf_normalizeMoney_(quote, quote.regularMarketDayLow);
  },
  isin: function (quote, context) {
    return hf_resolveDefaultIsin_(quote, context);
  },
  name: function (quote) {
    return quote.longName || quote.shortName || quote.displayName || quote.symbol || "";
  },
  price: function (quote) {
    return hf_normalizeMoney_(quote, hf_pickPrice_(quote));
  },
  symbol: function (quote, context) {
    return hf_resolveSymbolAttribute_(quote, context, "google");
  },
  "symbol:google": function (quote, context) {
    return hf_resolveSymbolAttribute_(quote, context, "google");
  },
  "symbol:yahoo": function (quote, context) {
    return hf_resolveSymbolAttribute_(quote, context, "yahoo");
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
    return hf_change_(quote) / hf_previousClose_(quote);
  },
  change: function (quote) {
    return hf_normalizeMoney_(quote, hf_change_(quote));
  },
};

const HOODLEFINANCE_PUBLIC_ATTRIBUTE_GROUPS_ = [
  {
    label: "quote fields",
    attributes: [
      "price[@currency]",
      "name",
      "currency",
      "high",
      "low",
      "close",
      "change",
      "changepct",
      "volume",
      "tradetime",
      "datadelay",
    ],
  },
  {
    label: "identifier fields",
    attributes: [
      "symbol[:google|yahoo]",
      "exchange[:google|yahoo]",
      "isin",
    ],
  },
];

const HOODLEFINANCE_OUTPUT_CONVERTIBLE_ATTRIBUTES_ = hf_buildSet_([
  "price",
]);

const HOODLEFINANCE_UNSUPPORTED_FX_ATTRIBUTES_ = hf_buildSet_([
  "high",
  "low",
  "volume",
]);

const HOODLEFINANCE_SOURCE_OVERRIDES_ = hf_buildSet_([
  "ARIVA",
  "GOOGLE",
  "IBKR",
  "LON",
  "PSE",
  "TRADINGVIEW",
  "YAHOO",
]);

function hf_formatPublicAttributes_() {
  return HOODLEFINANCE_PUBLIC_ATTRIBUTE_GROUPS_
    .map(function (group) {
      return group.label + ": " + group.attributes.join(", ");
    })
    .join("; ");
}

const HOODLEFINANCE_GITHUB_REPO_URL_ = "https://github.com/omry/hoodlefinance";
const HOODLEFINANCE_GITHUB_RAW_URL_ = "https://raw.githubusercontent.com/omry/hoodlefinance/main/hoodlefinance.js";
const HOODLEFINANCE_GITHUB_README_URL_ = "https://github.com/omry/hoodlefinance/blob/main/README.md";
const HOODLEFINANCE_GITHUB_RELEASE_NOTES_HISTORY_URL_ = "https://github.com/omry/hoodlefinance/blob/main/docs/release-notes/RELEASE_NOTES.md";
const HOODLEFINANCE_GITHUB_RELEASE_NOTES_BASE_URL_ = "https://github.com/omry/hoodlefinance/blob/main/docs/release-notes/";
const HOODLEFINANCE_GITHUB_CURRENCY_CODES_URL_ = "https://raw.githubusercontent.com/omry/hoodlefinance/main/data/currency-codes.json";
const HOODLEFINANCE_GITHUB_PSE_ISIN_MAP_URL_ = "https://raw.githubusercontent.com/omry/hoodlefinance/main/data/pse-isin-map.properties";
const HOODLEFINANCE_WEBSITE_URL_ = "https://hoodlefinance.com";
const HOODLEFINANCE_SUPPORT_URL_ = "https://hoodlefinance.com/support";
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

function hf_buildGroupedMap_(groupedEntries, overrides) {
  const map = {};
  const groups = groupedEntries || {};
  const extraEntries = overrides || {};
  let keys;
  let key;
  let i;

  Object.keys(groups).forEach(function (value) {
    keys = Array.isArray(groups[value]) ? groups[value] : [];

    for (i = 0; i < keys.length; i += 1) {
      map[keys[i]] = value;
    }
  });

  Object.keys(extraEntries).forEach(function (name) {
    map[name] = extraEntries[name];
  });

  return map;
}

function hf_buildSet_(names) {
  return hf_buildGroupedMap_({
    true: Array.isArray(names) ? names : [],
  });
}

const HOODLEFINANCE_EXCHANGE_SUFFIXES_ = hf_buildGroupedMap_({
  ".AS": ["AMS"],
  ".AX": ["ASX"],
  ".BO": ["BOM", "BSE"],
  ".BR": ["BRU"],
  ".CO": ["CPH"],
  ".DE": ["ETR"],
  ".F": ["FRA"],
  ".HE": ["HEL"],
  ".HK": ["HKG"],
  ".IC": ["ICE"],
  ".IS": ["IST"],
  ".JO": ["JSE"],
  ".KQ": ["KOSDAQ"],
  ".KS": ["KRX"],
  ".L": ["LON"],
  ".MC": ["MAD"],
  ".MI": ["BIT"],
  ".MX": ["BMV"],
  ".NE": ["NEO"],
  ".NS": ["NSE"],
  ".NZ": ["NZE"],
  ".OL": ["OSL"],
  ".PA": ["EPA", "PAR"],
  ".PS": ["PSE"],
  ".SA": ["BVMF"],
  ".SI": ["SGX"],
  ".SS": ["SHA"],
  ".ST": ["STO"],
  ".SW": ["SIX", "SWX"],
  ".SZ": ["SHE"],
  ".T": ["TYO"],
  ".TA": ["TLV", "TASE"],
  ".TO": ["TSX", "TSE"],
  ".TW": ["TPE"],
  ".V": ["CVE"],
  ".VI": ["VIE"],
  ".WA": ["WSE"],
});

const HOODLEFINANCE_PREFIXLESS_EXCHANGES_ = hf_buildSet_([
  "AMEX",
  "ARCA",
  "BATS",
  "INDEXDJX",
  "INDEXNASDAQ",
  "INDEXRUSSELL",
  "INDEXSP",
  "NASDAQ",
  "NYSE",
  "NYSEAMERICAN",
  "NYSEARCA",
  "OTCMKTS",
]);

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

const HOODLEFINANCE_IBKR_EXCHANGE_BY_YAHOO_EXCHANGE_ = hf_buildGroupedMap_({
  "": ["NEO", "SGX", "SHA", "SHE", "TLV", "TASE"],
  AEB: ["AMS"],
  AMEX: ["AMEX", "NYSEAMERICAN"],
  ARCA: ["ARCA", "NYSEARCA"],
  ASX: ["ASX"],
  BATS: ["BATS"],
  BM: ["MAD"],
  BOVESPA: ["BVMF"],
  BSE: ["BOM", "BSE"],
  BVME: ["BIT"],
  CSE: ["CPH"],
  EBS: ["SIX", "SWX"],
  "ENEXT.BE": ["BRU"],
  FWB: ["FRA"],
  HEX: ["HEL"],
  IBIS: ["ETR"],
  ICEX: ["ICE"],
  INDEX: ["INDEXDJX", "INDEXNASDAQ", "INDEXRUSSELL", "INDEXSP"],
  ISE: ["IST"],
  JSE: ["JSE"],
  KOSDAQ: ["KOSDAQ"],
  KSE: ["KRX"],
  LSEETF: ["LON"],
  MEXI: ["BMV"],
  NASDAQ: ["NASDAQ"],
  NSE: ["NSE"],
  NYSE: ["NYSE"],
  NZSE: ["NZE"],
  OSE: ["OSL"],
  PINK: ["OTCMKTS"],
  SBF: ["EPA", "PAR"],
  SEHK: ["HKG"],
  TSE: ["TPE", "TSX", "TSE"],
  TSEJ: ["TYO"],
  VENTURE: ["CVE"],
  VSE: ["VIE"],
  WSE: ["WSE"],
});

const HOODLEFINANCE_IBKR_EXCHANGE_BY_YAHOO_SUFFIX_ = hf_buildGroupedMap_({
  "": ["NE", "SI", "SS", "SZ", "TA"],
  AEB: ["AS"],
  ASX: ["AX"],
  BM: ["MC"],
  BOVESPA: ["SA"],
  BSE: ["BO"],
  BVME: ["MI"],
  CSE: ["CO"],
  EBS: ["SW"],
  "ENEXT.BE": ["BR"],
  FWB: ["F"],
  HEX: ["HE"],
  IBIS: ["DE"],
  ICEX: ["IC"],
  ISE: ["IS"],
  JSE: ["JO"],
  KOSDAQ: ["KQ"],
  KSE: ["KS"],
  LSEETF: ["L"],
  MEXI: ["MX"],
  NSE: ["NS"],
  NZSE: ["NZ"],
  OSE: ["OL"],
  SBF: ["PA"],
  SEHK: ["HK"],
  SFB: ["ST"],
  TSE: ["TO", "TW"],
  TSEJ: ["T"],
  VENTURE: ["V"],
  VSE: ["VI"],
  WSE: ["WA"],
});

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
  PS: "PSE",
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

const HOODLEFINANCE_YAHOO_EXCHANGE_BY_META_NAME_ = hf_buildGroupedMap_({
  AMEX: ["AMEX", "ASE"],
  BATS: ["BATS"],
  NASDAQ: ["NASDAQ", "NMS"],
  NEO: ["NEO"],
  NYSE: ["NYQ", "NYSE"],
  NYSEARCA: ["ARCA", "ARCX", "PCX", "NYSE ARCA", "NYSEARCA"],
  OTCMKTS: ["OQX", "OTO", "PNK"],
});

const HOODLEFINANCE_GOOGLE_EXCHANGE_BY_YAHOO_IDENTITY_ = hf_buildGroupedMap_({
  AMEX: ["AMEX", "ASE"],
  BATS: ["BATS"],
  CURRENCY: ["CURRENCY"],
  NASDAQ: ["NASDAQ", "NMS"],
  NEO: ["NEO"],
  NYSE: ["NYQ", "NYSE"],
  NYSEARCA: ["ARCA", "ARCX", "PCX", "NYSE ARCA"],
  OTCMKTS: ["OQX", "OTO", "PNK"],
  PSE: ["PSE"],
});

const HOODLEFINANCE_TRADINGVIEW_EXCHANGE_BY_YAHOO_EXCHANGE_ = hf_buildGroupedMap_({
  AMEX: ["AMEX", "NYSEAMERICAN", "NYSEARCA"],
  ASX: ["ASX"],
  BIST: ["IST"],
  BME: ["MAD"],
  BMV: ["BMV"],
  BMFBOVESPA: ["BVMF"],
  BSE: ["BOM", "BSE"],
  EURONEXT: ["AMS", "BRU", "EPA", "PAR"],
  FWB: ["FRA"],
  GPW: ["WSE"],
  HKEX: ["HKG"],
  JSE: ["JSE"],
  KRX: ["KRX"],
  LSE: ["LON"],
  MIL: ["BIT"],
  NASDAQ: ["NASDAQ"],
  NYSE: ["NYSE"],
  NEO: ["NEO"],
  NSE: ["NSE"],
  NZX: ["NZE"],
  OMXCOP: ["CPH"],
  OMXHEX: ["HEL"],
  OMXSTO: ["STO"],
  OSL: ["OSL"],
  OTC: ["OTCMKTS"],
  SGX: ["SGX"],
  SIX: ["SIX", "SWX"],
  SSE: ["SHA"],
  SZSE: ["SHE"],
  TASE: ["TASE", "TLV"],
  TSE: ["TYO"],
  TSX: ["TSE", "TSX"],
  TWSE: ["TPE"],
  XETR: ["ETR"],
});

const HOODLEFINANCE_ISIN_SOURCE_BY_EXCHANGE_ = hf_buildGroupedMap_({
  TRADINGVIEW: [
    "AMEX", "AMS", "ASX", "BIT", "BMV", "BOM", "BSE", "BVMF",
    "BRU", "CPH", "EPA", "ETR", "FRA", "HEL", "HKG", "IST",
    "JSE", "KRX", "MAD", "NASDAQ", "NEO", "NSE", "NZE", "NYSE",
    "NYSEAMERICAN", "NYSEARCA", "OSL", "OTCMKTS", "PAR", "SGX",
    "SHA", "SHE", "SIX", "STO", "SWX", "TASE", "TPE", "TSE",
    "TSX", "TLV", "TYO", "WSE",
  ],
}, {
  LON: "LON",
  PSE: "PSE",
});

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
 * - price variants such as "price@USD"
 *
 * Examples:
 *   =HOODLEFINANCE("NASDAQ:GOOG")
 *   =HOODLEFINANCE("NASDAQ:GOOG", "price")
 *   =HOODLEFINANCE("SJPA.L", "price@USD")
 *   =HOODLEFINANCE("NYSE:IBM", "name")
 *   =HOODLEFINANCE("CURRENCY:USDEUR", "price")
 *   =HOODLEFINANCE("LON:SJPA", "isin")
 *   =HOODLEFINANCE("ISIN:IE00B3XXRP09", "price")
 *   =HOODLEFINANCE("PSE:AAA", "price")
 *
 * @param {string|Array<Array<string>>} ticker Ticker symbol, optionally in GOOGLEFINANCE format.
 * @param {string|Array<Array<string>>} attribute Optional attribute name. Defaults to "price".
 * @return {string|number|Array<Array<string|number>>} The requested quote field or a spilled result grid.
 * @customfunction
 */
function HOODLEFINANCE(ticker, attribute) {
  const rawAttribute = attribute == null ? "price" : hf_coerceScalar_(attribute, "attribute");
  const normalizedAttribute = hf_normalizeAttribute_(rawAttribute);

  const tickerGrid = hf_normalizeTickerGrid_(ticker);

  if (hf_isSingleBlankTickerGrid_(tickerGrid)) {
    throw new Error("Ticker is required.");
  }

  const resultGrid = hf_resolveTickerGrid_(tickerGrid, normalizedAttribute);
  return hf_unwrapTickerGridResult_(resultGrid);
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

/**
 * Returns the current quote-routing table, or the planned quote route for one ticker.
 * TODO: expose runtime trace directly from HOODLEFINANCE, similar to the CLI trace output.
 *
 * Examples:
 *   =HOODLEFINANCE_ROUTES()
 *   =HOODLEFINANCE_ROUTES("GOOG")
 *
 * @param {string=} ticker Optional ticker identifier to introspect.
 * @return {string|Array<Array<string>>}
 * @customfunction
 */
function HOODLEFINANCE_ROUTES(ticker) {
  let normalizedTicker;
  let plan;

  if (!hf_hasValue_(ticker)) {
    return hf_buildRoutingTableGrid_();
  }

  normalizedTicker = hf_coerceScalar_(ticker, "ticker");

  if (!String(normalizedTicker).trim()) {
    return hf_buildRoutingTableGrid_();
  }

  plan = hf_classifyTickerJob_(String(normalizedTicker).trim(), "price");

  if (hf_isDebugRoutePlan_(plan)) {
    return String(plan.debugValue || "");
  }

  return hf_describePlanSource_(plan);
}

function onOpen(e) {
  if (hf_inferAddOnContext_(e)) {
    hf_onAddOnActivation_();
  } else {
    hf_onScriptActivation_(e);
  }
}

function onInstall(e) {
  onOpen(e);
}

function hf_onAddOnActivation_() {
  const ui = hf_getUi_();

  if (!ui || !ui.createAddonMenu) {
    return;
  }

  const menu = ui.createAddonMenu();
  menu.addItem("Enable", "enable_");
  menu.addToUi();
}

function hf_onScriptActivation_(e) {
  hf_buildScriptMenu_();

  if (
    !hf_isInstalledAsAddOn_() &&
    !hf_matchesScriptEnum_(e && e.authMode, "AuthMode", "NONE")
  ) {
    hf_runVersionCheck_({ force: false, interactive: false });
  }
}

function enable_() {
  SpreadsheetApp.getActive().toast('HoodleFinance ' + HOODLEFINANCE_VERSION_ + ' enabled for this spreadsheet');
}

function hoodlefinanceBuildSheetsAddOnHomepage() {
  const cardService = hf_getCardService_();

  if (!cardService) {
    return null;
  }

  return cardService
    .newCardBuilder()
    .setHeader(
      cardService
        .newCardHeader()
        .setTitle("Hoodlefinance")
        .setSubtitle("International quote and identifier functions for Google Sheets")
    )
    .addSection(
      cardService
        .newCardSection()
        .addWidget(
          cardService
            .newTextParagraph()
            .setText("Installed version: <b>" + HOODLEFINANCE_VERSION_ + "</b>")
        )
        .addWidget(
          cardService
            .newTextParagraph()
            .setText("Try formulas such as <b>=HOODLEFINANCE(\"NASDAQ:GOOG\")</b>, <b>=HOODLEFINANCE(\"SJPA.L\",\"price@USD\")</b>, and <b>=HOODLEFINANCE(\"IE000I8KRLL9\",\"symbol\")</b>.")
        )
        .addWidget(
          cardService
            .newTextParagraph()
            .setText("The add-on homepage is a lightweight guide. The custom functions and the Hoodlefinance menu remain the main entry points inside Sheets.")
        )
    )
    .addSection(
      cardService
        .newCardSection()
        .addWidget(
          hf_buildAddOnButtonSet_([
            hf_createAddOnLinkButtonSpec_("Website", HOODLEFINANCE_WEBSITE_URL_),
            hf_createAddOnLinkButtonSpec_("Support", HOODLEFINANCE_SUPPORT_URL_),
          ])
        )
    )
    .build();
}

function hoodlefinanceCheckForUpdates() {
  return hf_runVersionCheck_({
    force: true,
    interactive: true,
  });
}

function hoodlefinanceShowInstalledVersion() {
  const ui = hf_getUi_();

  if (!ui) {
    return HOODLEFINANCE_VERSION_;
  }

  ui.alert("HOODLEFINANCE version", "Installed version: " + HOODLEFINANCE_VERSION_, ui.ButtonSet.OK);
  return HOODLEFINANCE_VERSION_;
}

function hoodlefinanceSuppressUpdateChecks() {
  const userProperties = hf_getUserProperties_();
  const ui = hf_getUi_();

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

  hf_buildScriptMenu_();
}

function hoodlefinanceEnableUpdateChecks() {
  const userProperties = hf_getUserProperties_();
  const ui = hf_getUi_();

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

  hf_buildScriptMenu_();
}

function hoodlefinanceDismissUpdateNotice() {
  return true;
}


function hf_runVersionCheck_(options) {
  const normalizedOptions = options || {};
  const interactive = !!normalizedOptions.interactive;
  const force = !!normalizedOptions.force;
  const userProperties = hf_getUserProperties_();
  const now = new Date();
  let latestInfo;
  let comparison;

  if (!hf_getUi_()) {
    return { status: "no-ui" };
  }

  if (!force) {
    if (hf_isUpdateCheckSuppressed_(userProperties)) {
      return { status: "suppressed" };
    }

    if (!hf_shouldRunVersionCheckNow_(hf_getLastUpdateCheckMs_(userProperties), now.getTime())) {
      return { status: "skipped" };
    }
  }

  latestInfo = hf_fetchLatestVersionInfo_({
    useCache: !force,
  });
  hf_markUpdateCheckRun_(userProperties, now.getTime());

  if (!latestInfo.version) {
    if (interactive) {
      hf_getUi_().alert(
        "HOODLEFINANCE updates",
        "Unable to determine the latest published version right now." +
        (latestInfo.error ? "\n\nDetails:\n" + latestInfo.error : ""),
        hf_getUi_().ButtonSet.OK
      );
    }

    return { status: "error" };
  }

  comparison = hf_compareVersions_(latestInfo.version, HOODLEFINANCE_VERSION_);

  if (comparison > 0) {
    hf_showUpdateDialog_(latestInfo.version);
    return {
      latestVersion: latestInfo.version,
      status: "outdated",
    };
  }

  if (interactive) {
    hf_getUi_().alert(
      "HOODLEFINANCE updates",
      "You are up to date. Installed version: " + HOODLEFINANCE_VERSION_,
      hf_getUi_().ButtonSet.OK
    );
  }

  return {
    latestVersion: latestInfo.version,
    status: "current",
  };
}

function hf_buildScriptMenu_() {
  const ui = hf_getUi_();

  if (!ui || !ui.createMenu) {
    return;
  }

  const userProperties = hf_getUserProperties_();
  const isSuppressed = hf_isUpdateCheckSuppressed_(userProperties);
  const menu = ui.createMenu(HOODLEFINANCE_MENU_TITLE_);
  menu.addItem("Check for updates", "hoodlefinanceCheckForUpdates");
  menu.addItem("Show installed version", "hoodlefinanceShowInstalledVersion");
  menu.addSeparator();
  menu.addItem(
    isSuppressed ? "Enable automatic update checks" : "Suppress automatic update checks",
    isSuppressed ? "hoodlefinanceEnableUpdateChecks" : "hoodlefinanceSuppressUpdateChecks"
  );
  menu.addToUi();
}

function hf_getUi_() {
  if (typeof SpreadsheetApp === "undefined" || !SpreadsheetApp || !SpreadsheetApp.getUi) {
    return null;
  }

  return SpreadsheetApp.getUi();
}


function hf_getCardService_() {
  return typeof CardService === "undefined" || !CardService ? null : CardService;
}

function hf_getScriptEnumValue_(groupName, valueName) {
  if (typeof ScriptApp === "undefined" || !ScriptApp || !ScriptApp[groupName]) {
    return valueName;
  }

  return ScriptApp[groupName][valueName] || valueName;
}

function hf_matchesScriptEnum_(value, groupName, valueName) {
  const expected = hf_getScriptEnumValue_(groupName, valueName);
  const normalizedValue = value == null ? "" : String(value);
  const normalizedExpected = expected == null ? "" : String(expected);

  return value === expected || normalizedValue === normalizedExpected || normalizedValue === valueName;
}

function hf_getInstallationSource_() {
  if (typeof ScriptApp === "undefined" || !ScriptApp || !ScriptApp.getInstallationSource) {
    return hf_getScriptEnumValue_("InstallationSource", "NONE");
  }

  try {
    return ScriptApp.getInstallationSource();
  } catch (error) {
    return hf_getScriptEnumValue_("InstallationSource", "NONE");
  }
}

function hf_isInstalledAsAddOn_() {
  return !hf_matchesScriptEnum_(
    hf_getInstallationSource_(),
    "InstallationSource",
    "NONE"
  );
}

function hf_inferAddOnContext_(e) {
  if (hf_matchesScriptEnum_(e && e.authMode, "AuthMode", "NONE")) {
    return true;
  }

  return hf_isInstalledAsAddOn_();
}

function hf_createAddOnLinkButtonSpec_(text, url) {
  return {
    text: String(text || ""),
    url: String(url || ""),
  };
}

function hf_buildAddOnButtonSet_(buttonSpecs) {
  const cardService = hf_getCardService_();
  const specs = Array.isArray(buttonSpecs) ? buttonSpecs : [];
  let buttonSet;
  let i;

  if (!cardService) {
    return null;
  }

  buttonSet = cardService.newButtonSet();

  for (i = 0; i < specs.length; i += 1) {
    if (!specs[i] || !specs[i].text || !specs[i].url) {
      continue;
    }

    buttonSet.addButton(
      cardService
        .newTextButton()
        .setText(specs[i].text)
        .setOpenLink(cardService.newOpenLink().setUrl(specs[i].url))
    );
  }

  return buttonSet;
}

function hf_getUserProperties_() {
  if (typeof PropertiesService === "undefined" || !PropertiesService || !PropertiesService.getUserProperties) {
    return null;
  }

  try {
    return PropertiesService.getUserProperties();
  } catch (error) {
    return null;
  }
}

function hf_isUpdateCheckSuppressed_(userProperties) {
  return !!(
    userProperties &&
    String(userProperties.getProperty(HOODLEFINANCE_SUPPRESS_UPDATE_CHECKS_PROPERTY_) || "").toLowerCase() === "true"
  );
}

function hf_getLastUpdateCheckMs_(userProperties) {
  const rawValue = userProperties ? userProperties.getProperty(HOODLEFINANCE_LAST_UPDATE_CHECK_PROPERTY_) : "";
  const parsedValue = rawValue ? Number(rawValue) : NaN;

  return isNaN(parsedValue) ? 0 : parsedValue;
}

function hf_markUpdateCheckRun_(userProperties, nowMs) {
  if (userProperties) {
    userProperties.setProperty(HOODLEFINANCE_LAST_UPDATE_CHECK_PROPERTY_, String(nowMs));
  }
}

function hf_shouldRunVersionCheckNow_(lastCheckMs, nowMs) {
  const previousCheck = Number(lastCheckMs) || 0;
  const currentTime = Number(nowMs) || 0;

  return !previousCheck || currentTime - previousCheck >= HOODLEFINANCE_UPDATE_CHECK_INTERVAL_MS_;
}

function hf_compareVersions_(left, right) {
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

function hf_fetchLatestVersionInfo_(options) {
  const cache = CacheService.getScriptCache();
  const normalizedOptions = options || {};
  const cached = normalizedOptions.useCache === false
    ? null
    : cache.get(hf_versionCacheKey_(HOODLEFINANCE_UPDATE_CACHE_KEY_));
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

  version = hf_extractVersionFromSource_(response.getContentText());

  if (!version) {
    return {
      error: HOODLEFINANCE_GITHUB_RAW_URL_ + " -> version string not found",
      version: "",
    };
  }

  cache.put(
    hf_versionCacheKey_(HOODLEFINANCE_UPDATE_CACHE_KEY_),
    JSON.stringify({ version: version }),
    HOODLEFINANCE_UPDATE_CACHE_TTL_SECONDS_
  );

  return { version: version };
}

function hf_extractVersionFromSource_(sourceText) {
  const match = String(sourceText || "").match(/const HOODLEFINANCE_VERSION_ = "([^"]+)"/);
  return match ? match[1] : "";
}

function hf_getPersistentProperties_() {
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

function hf_downloadGitHubText_(url) {
  let response;
  let text;

  try {
    response = UrlFetchApp.fetch(url, hf_buildFetchOptions_());
  } catch (error) {
    return {
      error: url + " -> " + hf_errorMessage_(error),
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

function hf_downloadPseIsinMapText_() {
  return hf_downloadGitHubText_(HOODLEFINANCE_GITHUB_PSE_ISIN_MAP_URL_);
}

function hf_downloadCurrencyCodeDataText_() {
  return hf_downloadGitHubText_(HOODLEFINANCE_GITHUB_CURRENCY_CODES_URL_);
}

function hf_parsePseIsinMapProperties_(sourceText) {
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

function hf_parsePseIsinMapPayload_(payloadText) {
  const payload = JSON.parse(payloadText);

  if (!payload || typeof payload !== "object" || typeof payload.text !== "string") {
    throw new Error("Cached PSE ISIN map payload is invalid.");
  }

  return payload;
}

function hf_versionCacheKey_(cacheKey) {
  const key = String(cacheKey || "");

  if (!key) {
    return "";
  }

  if (key !== key.trim() || key.indexOf("hoodlefinance:") !== 0 || key.indexOf("hoodlefinance:v") === 0) {
    throw new Error('Cache key must be a normalized unversioned "hoodlefinance:" key.');
  }

  return "hoodlefinance:v" + HOODLEFINANCE_VERSION_ + key.slice("hoodlefinance".length);
}

function hf_getCachedString_(cacheKey) {
  const versionedCacheKey = hf_versionCacheKey_(cacheKey);
  return versionedCacheKey ? (CacheService.getScriptCache().get(versionedCacheKey) || "") : "";
}

function hf_putCachedString_(cacheKey, value, ttlSeconds) {
  const versionedCacheKey = hf_versionCacheKey_(cacheKey);

  if (!versionedCacheKey || !value) {
    return value;
  }

  CacheService.getScriptCache().put(versionedCacheKey, value, ttlSeconds);
  return value;
}

function hf_resolveCachedString_(cacheKey, ttlSeconds, resolveValue) {
  const cached = hf_getCachedString_(cacheKey);

  if (cached) {
    return cached;
  }

  return hf_putCachedString_(cacheKey, resolveValue(), ttlSeconds);
}

function hf_getCachedJson_(cacheKey, parseValue) {
  const cached = hf_getCachedString_(cacheKey);

  if (!cached) {
    return null;
  }

  return (typeof parseValue === "function" ? parseValue : JSON.parse)(cached);
}

function hf_putCachedJson_(cacheKey, value, ttlSeconds, serializeValue) {
  if (!cacheKey || !value) {
    return value;
  }

  hf_putCachedString_(
    cacheKey,
    typeof serializeValue === "function" ? serializeValue(value) : JSON.stringify(value),
    ttlSeconds
  );

  return value;
}

function hf_resolveCachedJson_(cacheKey, ttlSeconds, resolveValue, parseValue, serializeValue) {
  const cached = hf_getCachedJson_(cacheKey, parseValue);

  if (cached != null) {
    return cached;
  }

  return hf_putCachedJson_(cacheKey, resolveValue(), ttlSeconds, serializeValue);
}

function hf_buildPseListingCacheKey_(symbol) {
  return HOODLEFINANCE_PSE_LISTING_CACHE_KEY_PREFIX_ + String(symbol || "").trim().toUpperCase();
}

function hf_parsePseListingPayload_(payloadText) {
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

function hf_serializePseListingPayload_(listing) {
  return JSON.stringify({
    companyId: String(listing.companyId),
    name: String(listing.name || ""),
    securityId: String(listing.securityId),
    symbol: String(listing.symbol).trim().toUpperCase(),
  });
}

function hf_getCachedPseListing_(symbol) {
  return hf_getCachedJson_(hf_buildPseListingCacheKey_(symbol), hf_parsePseListingPayload_);
}

function hf_cachePseListing_(listing) {
  if (!listing || !listing.companyId || !listing.securityId || !listing.symbol) {
    return listing;
  }

  return hf_putCachedJson_(
    hf_buildPseListingCacheKey_(listing.symbol),
    listing,
    HOODLEFINANCE_PSE_LISTING_CACHE_TTL_SECONDS_,
    hf_serializePseListingPayload_
  );
}

function hf_parseCurrencyCodeDataResource_(sourceText) {
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

function hf_getPseIsinMap_() {
  const cache = CacheService.getScriptCache();
  const properties = hf_getPersistentProperties_();
  const cached = cache.get(hf_versionCacheKey_(HOODLEFINANCE_PSE_ISIN_MAP_CACHE_KEY_));
  const nowMs = new Date().getTime();
  let storedPayloadText;
  let storedPayload;
  let downloadResult;
  let nextPayloadText;

  if (HOODLEFINANCE_PSE_ISIN_TICKER_MAP_CACHE_) {
    return HOODLEFINANCE_PSE_ISIN_TICKER_MAP_CACHE_;
  }

  if (cached) {
    HOODLEFINANCE_PSE_ISIN_TICKER_MAP_CACHE_ = hf_parsePseIsinMapProperties_(cached);
    return HOODLEFINANCE_PSE_ISIN_TICKER_MAP_CACHE_;
  }

  storedPayloadText = properties ? properties.getProperty(HOODLEFINANCE_PSE_ISIN_MAP_PROPERTY_) : null;

  if (storedPayloadText) {
    try {
      storedPayload = hf_parsePseIsinMapPayload_(storedPayloadText);

      if (
        storedPayload.fetchedAtMs != null &&
        nowMs - Number(storedPayload.fetchedAtMs) <= HOODLEFINANCE_PSE_ISIN_MAP_REFRESH_INTERVAL_MS_
      ) {
        cache.put(
          hf_versionCacheKey_(HOODLEFINANCE_PSE_ISIN_MAP_CACHE_KEY_),
          storedPayload.text,
          HOODLEFINANCE_PSE_ISIN_MAP_CACHE_TTL_SECONDS_
        );
        HOODLEFINANCE_PSE_ISIN_TICKER_MAP_CACHE_ = hf_parsePseIsinMapProperties_(storedPayload.text);
        return HOODLEFINANCE_PSE_ISIN_TICKER_MAP_CACHE_;
      }
    } catch (error) {
      storedPayload = null;
    }
  }

  downloadResult = hf_downloadPseIsinMapText_();

  if (downloadResult.text) {
    nextPayloadText = JSON.stringify({
      fetchedAtMs: nowMs,
      text: downloadResult.text,
    });

    cache.put(
      hf_versionCacheKey_(HOODLEFINANCE_PSE_ISIN_MAP_CACHE_KEY_),
      downloadResult.text,
      HOODLEFINANCE_PSE_ISIN_MAP_CACHE_TTL_SECONDS_
    );

    if (properties) {
      properties.setProperty(HOODLEFINANCE_PSE_ISIN_MAP_PROPERTY_, nextPayloadText);
    }

    HOODLEFINANCE_PSE_ISIN_TICKER_MAP_CACHE_ = hf_parsePseIsinMapProperties_(downloadResult.text);
    return HOODLEFINANCE_PSE_ISIN_TICKER_MAP_CACHE_;
  }

  if (storedPayload && storedPayload.text) {
    cache.put(
      hf_versionCacheKey_(HOODLEFINANCE_PSE_ISIN_MAP_CACHE_KEY_),
      storedPayload.text,
      HOODLEFINANCE_PSE_ISIN_MAP_CACHE_TTL_SECONDS_
    );
    HOODLEFINANCE_PSE_ISIN_TICKER_MAP_CACHE_ = hf_parsePseIsinMapProperties_(storedPayload.text);
    return HOODLEFINANCE_PSE_ISIN_TICKER_MAP_CACHE_;
  }

  throw new Error("Failed to download the PSE ISIN map from GitHub.\n" + downloadResult.error);
}

function hf_getCurrencyCodeData_() {
  const cache = CacheService.getScriptCache();
  const properties = hf_getPersistentProperties_();
  const cached = cache.get(hf_versionCacheKey_(HOODLEFINANCE_CURRENCY_CODES_CACHE_KEY_));
  const nowMs = new Date().getTime();
  let storedPayloadText;
  let storedFetchedAtMs;
  let downloadResult;

  if (HOODLEFINANCE_CURRENCY_CODE_DATA_CACHE_) {
    return HOODLEFINANCE_CURRENCY_CODE_DATA_CACHE_;
  }

  if (cached) {
    HOODLEFINANCE_CURRENCY_CODE_DATA_CACHE_ = hf_parseCurrencyCodeDataResource_(cached);
    return HOODLEFINANCE_CURRENCY_CODE_DATA_CACHE_;
  }

  storedPayloadText = properties ? properties.getProperty(HOODLEFINANCE_CURRENCY_CODES_PROPERTY_) : null;
  storedFetchedAtMs = properties ? Number(properties.getProperty(HOODLEFINANCE_CURRENCY_CODES_FETCHED_AT_PROPERTY_)) : NaN;

  if (storedPayloadText) {
    try {
      if (isFinite(storedFetchedAtMs) && nowMs - storedFetchedAtMs <= HOODLEFINANCE_CURRENCY_CODES_REFRESH_INTERVAL_MS_) {
        cache.put(
          hf_versionCacheKey_(HOODLEFINANCE_CURRENCY_CODES_CACHE_KEY_),
          storedPayloadText,
          HOODLEFINANCE_CURRENCY_CODES_CACHE_TTL_SECONDS_
        );
        HOODLEFINANCE_CURRENCY_CODE_DATA_CACHE_ = hf_parseCurrencyCodeDataResource_(storedPayloadText);
        return HOODLEFINANCE_CURRENCY_CODE_DATA_CACHE_;
      }
    } catch (error) {
      storedPayloadText = "";
    }
  }

  downloadResult = hf_downloadCurrencyCodeDataText_();

  if (downloadResult.text) {
    cache.put(
      hf_versionCacheKey_(HOODLEFINANCE_CURRENCY_CODES_CACHE_KEY_),
      downloadResult.text,
      HOODLEFINANCE_CURRENCY_CODES_CACHE_TTL_SECONDS_
    );

    if (properties) {
      properties.setProperty(HOODLEFINANCE_CURRENCY_CODES_PROPERTY_, downloadResult.text);
      properties.setProperty(HOODLEFINANCE_CURRENCY_CODES_FETCHED_AT_PROPERTY_, String(nowMs));
    }

    HOODLEFINANCE_CURRENCY_CODE_DATA_CACHE_ = hf_parseCurrencyCodeDataResource_(downloadResult.text);
    return HOODLEFINANCE_CURRENCY_CODE_DATA_CACHE_;
  }

  if (storedPayloadText) {
    cache.put(
      hf_versionCacheKey_(HOODLEFINANCE_CURRENCY_CODES_CACHE_KEY_),
      storedPayloadText,
      HOODLEFINANCE_CURRENCY_CODES_CACHE_TTL_SECONDS_
    );
    HOODLEFINANCE_CURRENCY_CODE_DATA_CACHE_ = hf_parseCurrencyCodeDataResource_(storedPayloadText);
    return HOODLEFINANCE_CURRENCY_CODE_DATA_CACHE_;
  }

  throw new Error("Failed to download the currency code data from GitHub.\n" + downloadResult.error);
}

function hf_showUpdateDialog_(latestVersion) {
  const ui = hf_getUi_();
  const releaseNotesUrl = hf_buildGitHubReleaseNotesUrl_(latestVersion);
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

  output = HtmlService.createHtmlOutput(hf_buildUpdateDialogHtml_(latestVersion, releaseNotesUrl))
    .setWidth(520)
    .setHeight(280);

  ui.showModalDialog(output, "HOODLEFINANCE update available");
}

function hf_buildGitHubReleaseNotesUrl_(version) {
  if (/^\d+\.\d+\.\d+$/.test(String(version || ""))) {
    return HOODLEFINANCE_GITHUB_RELEASE_NOTES_BASE_URL_ + "v" + String(version) + ".md";
  }

  return HOODLEFINANCE_GITHUB_RELEASE_NOTES_HISTORY_URL_;
}

function hf_buildUpdateDialogHtml_(latestVersion, releaseNotesUrl) {
  return (
    '<div style="font-family:Arial,sans-serif;padding:16px;line-height:1.5;">' +
    "<h2 style=\"margin:0 0 12px 0;font-size:18px;\">HOODLEFINANCE update available</h2>" +
    "<p style=\"margin:0 0 12px 0;\">Installed version: <code>" + hf_escapeHtml_(HOODLEFINANCE_VERSION_) + "</code><br>" +
    "Latest version: <code>" + hf_escapeHtml_(latestVersion) + "</code></p>" +
    "<p style=\"margin:0 0 16px 0;\">Read the release notes first, then open the latest script and paste it into <code>Code.gs</code> to update.</p>" +
    "<p style=\"margin:0 0 16px 0;\">" +
    '<a href="' + hf_escapeHtml_(releaseNotesUrl) + '" target="_blank">What\'s new in ' + hf_escapeHtml_(latestVersion) + "</a>" +
    " | " +
    '<a href="' + hf_escapeHtml_(HOODLEFINANCE_GITHUB_RELEASE_NOTES_HISTORY_URL_) + '" target="_blank">Release history</a>' +
    " | " +
    '<a href="' + hf_escapeHtml_(HOODLEFINANCE_GITHUB_RAW_URL_) + '" target="_blank">Open raw source</a>' +
    " | " +
    '<a href="' + hf_escapeHtml_(HOODLEFINANCE_GITHUB_README_URL_) + '" target="_blank">Open README</a>' +
    " | " +
    '<a href="' + hf_escapeHtml_(HOODLEFINANCE_GITHUB_REPO_URL_) + '" target="_blank">Open repository</a>' +
    "</p>" +
    "<div>" +
    '<button onclick="google.script.run.withSuccessHandler(closeDialog).hoodlefinanceSuppressUpdateChecks()" style="margin-right:8px;">Suppress automatic checks</button>' +
    '<button onclick="closeDialog()">Later</button>' +
    "</div>" +
    "<script>function closeDialog(){google.script.host.close();}</script>" +
    "</div>"
  );
}

function hf_escapeHtml_(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function hf_fetchQuote_(ticker) {
  const job = hf_createQuoteRouteJob_(String(ticker).trim(), "price");

  job.plan = hf_classifyTickerJob_(job.tickerInput, "price");

  if (hf_isDebugRoutePlan_(job.plan)) {
    throw new Error("Debug-only ticker requests cannot be fetched as quotes.");
  }

  hf_prepareRouteJob_(job, job.plan);

  hf_executeRouteJobs_([job]);

  if (job.error) {
    throw new Error(job.error);
  }

  return job.quote;
}

function hf_fetchPseQuote_(ticker) {
  const symbol = hf_parsePseSymbol_(ticker);
  const cacheKey = "hoodlefinance:pse:" + symbol;
  let listing;
  let html;

  return hf_resolveCachedJson_(cacheKey, 300, function () {
    const quote = (function () {
      listing = hf_resolvePseListing_(symbol);
      html = hf_fetchPseText_(
        HOODLEFINANCE_PSE_STOCK_DATA_URL_ +
        "?cmpy_id=" +
        encodeURIComponent(listing.companyId) +
        "&security_id=" +
        encodeURIComponent(listing.securityId)
      );

      return hf_extractPseQuote_(html, listing);
    }());

    if (!quote || !quote.symbol) {
      throw new Error("No PSE quote data was found for " + ticker + ".");
    }

    return quote;
  });
}

function hf_normalizeTicker_(ticker) {
  const value = String(hf_stripTickerSourceOverride_(ticker) || "").trim();
  const upperValue = value.toUpperCase();

  if (hf_looksLikeIsin_(value)) {
    return hf_resolveIsin_(upperValue);
  }

  if (upperValue.indexOf("ISIN:") === 0) {
    return hf_resolveIsin_(upperValue.slice(5).trim());
  }

  return hf_normalizeTickerWithoutIsin_(value);
}

function hf_resolveCurrencyUnit_(code) {
  const value = String(code || "").trim();
  const unitsByCode = hf_getCurrencyCodeData_();

  return unitsByCode[value] || unitsByCode[value.toUpperCase()] || null;
}

function hf_buildFxPair_(baseUnit, quoteUnit) {
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

function hf_findCompactFxPairCandidates_(pairText) {
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

    baseUnit = hf_resolveCurrencyUnit_(pairText.slice(0, baseLength));
    quoteUnit = hf_resolveCurrencyUnit_(pairText.slice(baseLength));

    if (!baseUnit || !quoteUnit) {
      continue;
    }

    candidates.push(hf_buildFxPair_(baseUnit, quoteUnit));
  }

  return candidates;
}

function hf_buildAmbiguousFxTickerError_(ticker, candidates) {
  const suggestions = candidates
    .slice(0, 2)
    .map(function (candidate) {
      return "CURRENCY:" + candidate.baseDisplayCode + "." + candidate.quoteDisplayCode;
    })
    .join(" or ");

  return new Error('Currency ticker "' + ticker + '" is ambiguous. Use ' + suggestions + ".");
}

function hf_looksLikeIncompleteExplicitFxPair_(pairText) {
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

function hf_fetchGoogleFinanceFxPairQuote_(fxPair) {
  const cacheKey = "hoodlefinance:google-finance:" + fxPair.googlePairSlug;
  const cached = hf_getCachedJson_(cacheKey);
  let quote;

  if (cached) {
    return hf_decorateFxQuote_(cached, fxPair);
  }

  quote = hf_extractGoogleFinanceFxPairQuote_(
    hf_fetchText_(hf_buildGoogleFinanceQuoteUrl_(fxPair.googlePairSlug)),
    fxPair
  );

  hf_putCachedJson_(cacheKey, quote, 60);
  return hf_decorateFxQuote_(quote, fxPair);
}

function hf_parseFxTicker_(ticker) {
  const value = String(hf_stripTickerSourceOverride_(ticker) || "").trim();
  const explicitMatch = value.match(/^([^:]+):(.*)$/);
  const exchange = explicitMatch ? explicitMatch[1].trim().toUpperCase() : "";
  const pairText = explicitMatch ? explicitMatch[2].trim() : value;
  const dottedMatch = explicitMatch ? pairText.match(/^([A-Za-z]{3,4})\.([A-Za-z]{3,4})$/) : null;
  const looksLikeCompactPair = /^[A-Za-z]{6,8}$/.test(pairText);
  const compactCandidates = looksLikeCompactPair ? hf_findCompactFxPairCandidates_(pairText) : [];
  let baseUnit;
  let quoteUnit;

  if (explicitMatch && exchange !== "CURRENCY") {
    return null;
  }

  if (dottedMatch) {
    baseUnit = hf_resolveCurrencyUnit_(dottedMatch[1]);
    quoteUnit = hf_resolveCurrencyUnit_(dottedMatch[2]);

    if (!baseUnit || !quoteUnit) {
      throw new Error('Currency ticker "' + ticker + '" must use supported 3- or 4-character currency codes.');
    }

    return hf_buildFxPair_(baseUnit, quoteUnit);
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
      throw hf_buildAmbiguousFxTickerError_(ticker, compactCandidates);
    }

    return null;
  }

  return compactCandidates[0];
}

function hf_normalizeTickerWithoutIsin_(ticker) {
  const value = String(hf_stripTickerSourceOverride_(ticker) || "").trim();
  const fxPair = hf_parseFxTicker_(value);
  const parts = value.split(":");
  let normalizedSymbol;

  if (fxPair) {
    return fxPair.yahooSymbol;
  }

  if (parts.length < 2) {
    return hf_normalizeYahooStyleIsraeliFundTicker_(value);
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
    normalizedSymbol = hf_normalizeExchangeSymbol_(exchange, symbol);
    return normalizedSymbol + HOODLEFINANCE_EXCHANGE_SUFFIXES_[exchange];
  }

  if (hf_normalizeExplicitIbkrExchange_(exchange)) {
    return symbol;
  }

  throw new Error('Unsupported exchange prefix "' + exchange + '" in ticker "' + ticker + '".');
}

function hf_normalizeExchangeSymbol_(exchange, symbol) {
  if (exchange === "TLV" || exchange === "TASE") {
    return hf_normalizeIsraeliFundCode_(symbol);
  }

  return symbol;
}

function hf_normalizeYahooStyleIsraeliFundTicker_(ticker) {
  const match = String(ticker || "").trim().match(/^(.+)\.TA$/i);

  if (!match) {
    return ticker;
  }

  return hf_normalizeIsraeliFundCode_(match[1]) + ".TA";
}

function hf_isPseYahooSymbol_(ticker) {
  return hf_extractYahooExchangeFromSymbol_(ticker) === "PSE";
}

function hf_parsePseYahooSymbol_(ticker) {
  const match = String(hf_stripTickerSourceOverride_(ticker) || "").trim().match(/^(.+)\.PS$/i);
  const symbol = match ? String(match[1] || "").trim().toUpperCase() : "";

  if (!symbol) {
    throw new Error('PSE ticker "' + ticker + '" is invalid.');
  }

  return symbol;
}

function hf_normalizeIsraeliFundCode_(code) {
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

function hf_looksLikeIsraeliFundCode_(code) {
  return /^[A-Z]+(?:\.?F[0-9]+)$/i.test(String(code || "").trim());
}

function hf_looksLikeIsraeliFundYahooSymbol_(symbol) {
  return /^[A-Z]+\.F[0-9]+\.TA$/i.test(String(symbol || "").trim());
}

function hf_coerceScalar_(value, label) {
  if (Array.isArray(value)) {
    if (value.length !== 1 || !Array.isArray(value[0]) || value[0].length !== 1) {
      throw new Error("Only a single-cell " + label + " is supported.");
    }
    return value[0][0];
  }

  return value;
}

function hf_normalizeAttribute_(attribute) {
  const normalizedAttribute = String(attribute == null ? "price" : attribute).trim();
  return normalizedAttribute ? normalizedAttribute : "price";
}

function hf_parseAttributeRequest_(attribute) {
  const rawAttribute = hf_normalizeAttribute_(attribute);
  const firstAtIndex = rawAttribute.indexOf("@");
  const lastAtIndex = rawAttribute.lastIndexOf("@");
  let baseAttribute = rawAttribute;
  let outputCode = "";

  if (firstAtIndex >= 0) {
    if (firstAtIndex !== lastAtIndex || firstAtIndex === 0 || firstAtIndex === rawAttribute.length - 1) {
      throw new Error('Converted attributes must look like price@USD.');
    }

    baseAttribute = rawAttribute.slice(0, firstAtIndex).trim();
    outputCode = rawAttribute.slice(firstAtIndex + 1).trim();

    if (!baseAttribute || !outputCode) {
      throw new Error('Converted attributes must look like price@USD.');
    }
  }

  return {
    baseAttribute: String(baseAttribute).trim().toLowerCase(),
    outputCode: outputCode,
    rawAttribute: rawAttribute,
    wantsOutputCurrency: outputCode !== "",
  };
}

function hf_parseTickerRequest_(ticker) {
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

function hf_stripTickerSourceOverride_(ticker) {
  return hf_parseTickerRequest_(ticker).ticker;
}

function hf_extractTickerSourceOverride_(ticker) {
  return hf_parseTickerRequest_(ticker).sourceOverride;
}

function hf_extractTickerInfoMode_(ticker) {
  return hf_parseTickerRequest_(ticker).infoMode;
}

function hf_listSupportedSources_() {
  return Object.keys(HOODLEFINANCE_SOURCE_OVERRIDES_).sort().join(", ");
}

function hf_normalizeTickerGrid_(ticker) {
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

function hf_isSingleBlankTickerGrid_(tickerGrid) {
  return (
    tickerGrid.length === 1 &&
    tickerGrid[0] &&
    tickerGrid[0].length === 1 &&
    !String(tickerGrid[0][0] == null ? "" : tickerGrid[0][0]).trim()
  );
}

function hf_unwrapTickerGridResult_(grid) {
  if (grid.length === 1 && grid[0] && grid[0].length === 1) {
    return grid[0][0];
  }

  return grid;
}

function hf_resolveTickerGrid_(tickerGrid, attribute) {
  const allowImplicitBlankTickers = hf_isMultiCellTickerGrid_(tickerGrid);
  const jobs = hf_collectTickerJobs_(tickerGrid, attribute, allowImplicitBlankTickers);

  hf_prefetchTickerJobs_(jobs);
  hf_resolvePrefetchedTickerJobs_(jobs);

  return hf_buildTickerResultGrid_(tickerGrid, jobs.jobByKey, attribute, allowImplicitBlankTickers);
}

function hf_collectTickerJobs_(tickerGrid, attribute, allowImplicitBlankTickers) {
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
      normalizedTicker = hf_normalizeTickerGridCellValue_(value, allowImplicitBlankTickers);

      if (!normalizedTicker) {
        continue;
      }

      key = hf_buildTickerJobKey_(normalizedTicker, attribute);

      if (!jobByKey[key]) {
        jobByKey[key] = hf_createQuoteRouteJob_(normalizedTicker, attribute);
        orderedJobs.push(jobByKey[key]);
      }
    }
  }

  return {
    jobByKey: jobByKey,
    orderedJobs: orderedJobs,
  };
}

function hf_buildTickerJobKey_(ticker, attribute) {
  return String(ticker).trim() + "\n" + String(attribute).trim().toLowerCase();
}

function hf_createRouteJob_(options) {
  const extras = options || {};

  return {
    attribute: extras.attribute || "price",
    error: null,
    key: extras.key || "",
    plan: extras.plan || null,
    quote: extras.quote || null,
    routeContext: extras.routeContext || null,
    routeIndex: 0,
    routeKind: extras.routeKind || "quote",
    routeLastLookupFailure: "",
    routeRuntimeTrace: [],
    routeState: extras.routeState || {},
    sourceQuote: extras.sourceQuote || null,
    tickerInput: extras.tickerInput ? String(extras.tickerInput).trim() : "",
    value: extras.value || null,
    valueResolved: extras.valueResolved === true,
  };
}

function hf_createQuoteRouteJob_(ticker, attribute) {
  const normalizedTicker = String(ticker).trim();
  const normalizedAttribute = String(attribute == null ? "price" : attribute).trim();

  return hf_createRouteJob_({
    attribute: normalizedAttribute,
    key: hf_buildTickerJobKey_(normalizedTicker, normalizedAttribute),
    tickerInput: normalizedTicker,
  });
}

function hf_createAttributeRouteJob_(attribute, quote, context, routeKind) {
  const routeContext = context || {};

  return hf_createRouteJob_({
    attribute: String(attribute == null ? "" : attribute).trim(),
    routeContext: routeContext,
    routeKind: routeKind || "attribute",
    sourceQuote: quote,
    tickerInput: routeContext.tickerInput ? String(routeContext.tickerInput).trim() : "",
  });
}

function hf_prepareRouteJob_(job, plan) {
  const targetJob = job;
  const routePlan = plan || targetJob.plan || {};

  targetJob.plan = routePlan;
  targetJob.routeAttempts = hf_cloneRouteAttempts_(routePlan.routeAttempts || []);
  targetJob.routeIndex = 0;
  targetJob.routeState = hf_cloneRouteState_(routePlan.routeState || {});
  targetJob.routeRuntimeTrace = [];
  targetJob.routeLastLookupFailure = "";
}

function hf_isMultiCellTickerGrid_(tickerGrid) {
  return tickerGrid.length !== 1 || !tickerGrid[0] || tickerGrid[0].length !== 1;
}

function hf_normalizeTickerGridCellValue_(value, allowImplicitBlankTickers) {
  const normalizedTicker = String(value == null ? "" : value).trim();

  if (!normalizedTicker || !allowImplicitBlankTickers) {
    return normalizedTicker;
  }

  return hf_shouldTreatRangeTickerAsBlank_(normalizedTicker) ? "" : normalizedTicker;
}

function hf_shouldTreatRangeTickerAsBlank_(ticker) {
  const value = String(hf_stripTickerSourceOverride_(ticker) || "").trim();
  const parts = value.split(":");
  const exchange = parts.length > 1 ? parts[0].trim().toUpperCase() : "";
  const symbol = parts.length > 1 ? parts.slice(1).join(":").trim() : "";

  if (!exchange) {
    return false;
  }

  if (!symbol) {
    return true;
  }

  return exchange === "CURRENCY" && hf_looksLikeIncompleteExplicitFxPair_(symbol);
}

function hf_prefetchTickerJobs_(jobs) {
  const orderedJobs = jobs.orderedJobs;
  let i;
  let plan;

  for (i = 0; i < orderedJobs.length; i += 1) {
    try {
      plan = hf_classifyTickerJob_(orderedJobs[i].tickerInput, orderedJobs[i].attribute);
      orderedJobs[i].plan = plan;

      if (hf_isDebugRoutePlan_(plan)) {
        orderedJobs[i].value = plan.debugValue;
        orderedJobs[i].valueResolved = true;
        continue;
      }
      hf_prepareRouteJob_(orderedJobs[i], plan);
    } catch (error) {
      orderedJobs[i].error = hf_errorMessage_(error);
    }
  }

  hf_executeRouteJobs_(orderedJobs);
}

function hf_buildForcedSourcePlan_(normalizedTicker, normalizedAttribute, upperTicker, fxPair, sourceOverride) {
  let pseTicker;
  let isinValue;
  let symbol;

  if (sourceOverride === "YAHOO") {
    isinValue = hf_looksLikeIsin_(normalizedTicker)
      ? upperTicker
      : (upperTicker.indexOf("ISIN:") === 0 ? upperTicker.slice(5).trim() : "");

    if (isinValue) {
      return hf_createRoutePlan_({
        routeClass: "FORCED:YAHOO-ISIN",
        routeAttempts: [hf_createYahooIsinAttempt_("yahoo-only")],
        routeState: { isin: isinValue },
        routePath: "YAHOO-ISIN -> YAHOO",
      });
    }

    return hf_createSingleAttemptRoutePlan_("FORCED:YAHOO", "yahoo-chart", "YAHOO", {
      attemptOptions: { allowTradingviewFallback: false },
      routeState: {
        fxPair: fxPair,
        yahooSymbol: hf_buildForcedYahooSymbol_(normalizedTicker, fxPair),
      },
    });
  }

  if (sourceOverride === "GOOGLE") {
    if (!fxPair) {
      throw new Error('"@GOOGLE" can only be used with currency pairs.');
    }

    return hf_createSingleAttemptRoutePlan_("FORCED:GOOGLE", "google-finance-fx", "GOOGLE", {
      routeState: { fxPair: fxPair },
    });
  }

  if (sourceOverride === "PSE") {
    if (hf_isPseTicker_(normalizedTicker)) {
      symbol = hf_parsePseSymbol_(normalizedTicker);
      return hf_createSingleAttemptRoutePlan_("FORCED:PSE", "pse-quote", "PSE", {
        routeState: { symbol: symbol },
      });
    }

    isinValue = hf_looksLikeIsin_(normalizedTicker)
      ? upperTicker
      : (upperTicker.indexOf("ISIN:") === 0 ? upperTicker.slice(5).trim() : "");
    if (isinValue) {
      pseTicker = hf_resolvePseTickerFromIsinMap_(isinValue);
      if (!pseTicker) {
        throw new Error('No PSE ticker was found for ISIN "' + isinValue + '" when using "@PSE".');
      }

      symbol = hf_parsePseSymbol_(pseTicker);
      return hf_createSingleAttemptRoutePlan_("FORCED:PSE", "pse-quote", "PSE", {
        routeState: { symbol: symbol },
      });
    }

    throw new Error('"@PSE" can only be used with PSE tickers and PSE-mapped ISINs.');
  }

  if (normalizedAttribute === "isin") {
    return null;
  }

  throw new Error('"@' + sourceOverride + '" can only be used with the "isin" attribute.');
}

function hf_describePlanSource_(plan) {
  if (!plan) {
    return "";
  }

  return plan.routeTrace || "";
}

const HOODLEFINANCE_ROUTING_TABLE_EXAMPLES_ = [
  { classification: "TICKER", example: "GOOG", route: "TICKER -> YAHOO" },
  { classification: "TICKER-IL-FUND", example: "TLV:KSMF59", route: "TICKER-IL-FUND -> YAHOO -> TRADINGVIEW" },
  { classification: "FX", example: "EURUSD", route: "FX -> GOOGLE" },
  { classification: "FX-SAME", example: "USDUSD", route: "FX-SAME -> LOCAL" },
  { classification: "PSE-TICKER", example: "PSE:BDO", route: "PSE-TICKER -> PSE" },
  { classification: "ISIN", example: "US02079K1079", route: "ISIN -> PSE-MAP -> (PSE|YAHOO-ISIN -> (YAHOO|YAHOO -> TRADINGVIEW))" },
  { classification: "FORCED:YAHOO", example: "GOOG@YAHOO", route: "FORCED:YAHOO -> YAHOO" },
  { classification: "FORCED:YAHOO-ISIN", example: "US02079K1079@YAHOO", route: "FORCED:YAHOO-ISIN -> YAHOO-ISIN -> YAHOO" },
  { classification: "FORCED:GOOGLE", example: "EURUSD@GOOGLE", route: "FORCED:GOOGLE -> GOOGLE" },
  { classification: "FORCED:PSE", example: "PSE:BDO@PSE", route: "FORCED:PSE -> PSE" },
];

function hf_getRoutingTableRows_() {
  return HOODLEFINANCE_ROUTING_TABLE_EXAMPLES_.slice();
}

function hf_buildRoutingTableGrid_() {
  const rows = hf_getRoutingTableRows_();
  const grid = [["classification", "example", "planned route"]];
  let i;

  for (i = 0; i < rows.length; i += 1) {
    grid.push([rows[i].classification, rows[i].example, rows[i].route]);
  }

  return grid;
}

function hf_buildRouteTrace_(routeClass, routeTrace) {
  const normalizedClass = String(routeClass || "").trim();
  const normalizedTrace = String(routeTrace || "").trim();

  if (!normalizedClass) {
    return normalizedTrace;
  }

  if (!normalizedTrace) {
    return normalizedClass;
  }

  return normalizedClass + " -> " + normalizedTrace;
}

function hf_createRoutePlan_(options) {
  return {
    routeClass: options.routeClass || "",
    routeAttempts: options.routeAttempts || [],
    routeState: options.routeState || {},
    routeTrace: options.routeTrace != null
      ? String(options.routeTrace)
      : hf_buildRouteTrace_(options.routeClass, options.routePath || ""),
  };
}

function hf_createDebugRoutePlan_(value) {
  return { debugValue: value };
}

function hf_isDebugRoutePlan_(plan) {
  return !!plan && Object.prototype.hasOwnProperty.call(plan, "debugValue");
}

function hf_classifyTickerJob_(ticker, attribute) {
  const normalizedTicker = String(ticker).trim();
  const normalizedAttribute = String(attribute == null ? "price" : attribute).trim().toLowerCase();
  const request = hf_parseTickerRequest_(normalizedTicker);
  const infoMode = request.infoMode;
  const requestTicker = request.ticker;
  const sourceOverride = request.sourceOverride;
  const requestUpperTicker = requestTicker.toUpperCase();
  const fxPair = hf_parseFxTicker_(requestTicker);
  let plan;
  let normalizedYahooTicker;
  let isIsraeliFundTicker;

  if (infoMode === "source-list") {
    return hf_createDebugRoutePlan_(hf_listSupportedSources_());
  }

  if (infoMode === "source-name") {
    plan = hf_classifyTickerJob_(requestTicker, attribute);
    return hf_createDebugRoutePlan_(hf_describePlanSource_(plan));
  }

  if (sourceOverride) {
    plan = hf_buildForcedSourcePlan_(requestTicker, normalizedAttribute, requestUpperTicker, fxPair, sourceOverride);

    if (plan) {
      return plan;
    }
  }

  if (hf_isPseTicker_(requestTicker)) {
    return hf_createRoutePlan_({
      routeClass: "PSE-TICKER",
      routeAttempts: [hf_createRouteAttempt_("pse-quote", "PSE")],
      routeState: { symbol: hf_parsePseSymbol_(requestTicker) },
      routePath: "PSE",
    });
  }

  if (hf_isPseYahooSymbol_(requestTicker)) {
    return hf_createRoutePlan_({
      routeClass: "PSE-TICKER",
      routeAttempts: [hf_createRouteAttempt_("pse-quote", "PSE")],
      routeState: { symbol: hf_parsePseYahooSymbol_(requestTicker) },
      routePath: "PSE",
    });
  }

  if (fxPair && fxPair.isSameCurrency) {
    return hf_createRoutePlan_({
      routeClass: "FX-SAME",
      routeAttempts: [hf_createRouteAttempt_("local-fx", "LOCAL")],
      routeState: { fxPair: fxPair },
      routePath: "LOCAL",
    });
  }

  if (fxPair) {
    return hf_createRoutePlan_({
      routeClass: "FX",
      routeAttempts: [hf_createRouteAttempt_("google-finance-fx", "GOOGLE")],
      routeState: { fxPair: fxPair },
      routePath: "GOOGLE",
    });
  }

  if (hf_looksLikeIsin_(requestTicker)) {
    return hf_createRoutePlan_({
      routeClass: "ISIN",
      routeAttempts: [
        hf_createRouteAttempt_("pse-isin-map", "PSE-MAP"),
        hf_createYahooIsinAttempt_("default"),
      ],
      routeState: { isin: requestUpperTicker },
      routePath: "PSE-MAP -> (PSE|YAHOO-ISIN -> (YAHOO|YAHOO -> TRADINGVIEW))",
    });
  }

  if (requestUpperTicker.indexOf("ISIN:") === 0) {
    return hf_createRoutePlan_({
      routeClass: "ISIN",
      routeAttempts: [
        hf_createRouteAttempt_("pse-isin-map", "PSE-MAP"),
        hf_createYahooIsinAttempt_("default"),
      ],
      routeState: { isin: requestUpperTicker.slice(5).trim() },
      routePath: "PSE-MAP -> (PSE|YAHOO-ISIN -> (YAHOO|YAHOO -> TRADINGVIEW))",
    });
  }

  normalizedYahooTicker = fxPair ? fxPair.yahooSymbol : hf_normalizeTickerWithoutIsin_(requestTicker);
  isIsraeliFundTicker = hf_looksLikeIsraeliFundYahooSymbol_(normalizedYahooTicker);

  return hf_createRoutePlan_({
    routeClass: isIsraeliFundTicker ? "TICKER-IL-FUND" : "TICKER",
    routeAttempts: [hf_createYahooChartAttempt_(isIsraeliFundTicker)],
    routeState: {
      fxPair: fxPair,
      yahooSymbol: normalizedYahooTicker,
    },
    routePath: isIsraeliFundTicker ? "YAHOO -> TRADINGVIEW" : "YAHOO",
  });
}

function hf_createRouteAttempt_(adapterId, traceLabel, options) {
  const attempt = {
    adapterId: adapterId,
    traceLabel: traceLabel,
  };
  const extras = options || {};
  let key;

  for (key in extras) {
    if (Object.prototype.hasOwnProperty.call(extras, key)) {
      attempt[key] = extras[key];
    }
  }

  return attempt;
}

function hf_createYahooChartAttempt_(allowTradingviewFallback) {
  return hf_createRouteAttempt_("yahoo-chart", "YAHOO", {
    allowTradingviewFallback: allowTradingviewFallback === true,
  });
}

function hf_createYahooIsinAttempt_(resolvedSymbolMode) {
  return hf_createRouteAttempt_("yahoo-isin-search", "YAHOO-ISIN", {
    resolvedSymbolMode: resolvedSymbolMode || "default",
  });
}

function hf_cloneRouteAttempts_(attempts) {
  let i;
  const cloned = [];

  for (i = 0; i < attempts.length; i += 1) {
    cloned.push(hf_createRouteAttempt_(attempts[i].adapterId, attempts[i].traceLabel, attempts[i]));
  }

  return cloned;
}

function hf_cloneRouteState_(state) {
  const cloned = {};
  const source = state || {};
  let key;

  for (key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      cloned[key] = source[key];
    }
  }

  return cloned;
}

function hf_createRouteResult_(status, options) {
  const result = { status: status };
  const extras = options || {};
  let key;

  for (key in extras) {
    if (Object.prototype.hasOwnProperty.call(extras, key)) {
      result[key] = extras[key];
    }
  }

  return result;
}

function hf_createSingleAttemptRoutePlan_(routeClass, adapterId, traceLabel, options) {
  const config = options || {};

  return hf_createRoutePlan_({
    routeClass: routeClass,
    routeAttempts: [hf_createRouteAttempt_(adapterId, traceLabel, config.attemptOptions)],
    routeState: config.routeState || {},
    routePath: config.routePath != null ? config.routePath : traceLabel,
  });
}

function hf_buildForcedYahooSymbol_(normalizedTicker, fxPair) {
  if (hf_isPseTicker_(normalizedTicker)) {
    return hf_parsePseSymbol_(normalizedTicker) + ".PS";
  }

  return fxPair ? fxPair.yahooChartSymbol : hf_normalizeTickerWithoutIsin_(normalizedTicker);
}

function hf_buildQuoteAttemptsForResolvedIdentifier_(resolvedIdentifier, mode) {
  const normalizedMode = mode || "default";
  const normalizedIdentifier = hf_buildForcedYahooSymbol_(
    resolvedIdentifier,
    hf_parseFxTicker_(resolvedIdentifier)
  );
  const allowTradingviewFallback =
    normalizedMode !== "yahoo-only" && hf_looksLikeIsraeliFundYahooSymbol_(normalizedIdentifier);

  if (hf_isPseTicker_(resolvedIdentifier) && normalizedMode !== "yahoo-only") {
    return {
      nextAttempts: [hf_createRouteAttempt_("pse-quote", "PSE")],
      stateChanges: {
        resolvedIdentifier: resolvedIdentifier,
        symbol: hf_parsePseSymbol_(resolvedIdentifier),
      },
    };
  }

  return {
    nextAttempts: [hf_createYahooChartAttempt_(allowTradingviewFallback)],
    stateChanges: {
      resolvedIdentifier: resolvedIdentifier,
      yahooSymbol: normalizedIdentifier,
    },
  };
}

function hf_createRouteAdapter_(adapterId, executeBatch) {
  return {
    adapterId: adapterId,
    batchKey: function () { return ""; },
    executeBatch: executeBatch,
  };
}

function hf_createIsinResolverRouteAdapter_(adapterId, resolveIsin) {
  return hf_createRouteAdapter_(adapterId, function (jobs) {
    return hf_executeIsinResolverRouteBatch_(jobs, resolveIsin);
  });
}

const HOODLEFINANCE_ROUTE_ADAPTERS_ = {
  "google-finance-fx": hf_createRouteAdapter_("google-finance-fx", hf_executeGoogleFinanceFxRouteBatch_),
  "isin-ariva": hf_createIsinResolverRouteAdapter_("isin-ariva", function (quote, context) {
    return hf_resolveArivaIsin_(quote, context);
  }),
  "isin-direct": hf_createRouteAdapter_("isin-direct", hf_executeDirectIsinRouteBatch_),
  "isin-ibkr": hf_createIsinResolverRouteAdapter_("isin-ibkr", function (quote, context) {
    return hf_resolveIbkrIsin_(quote, context);
  }),
  "isin-lon": hf_createIsinResolverRouteAdapter_("isin-lon", function (quote, context) {
    return hf_resolveLonIsin_(quote, context);
  }),
  "isin-pse": hf_createIsinResolverRouteAdapter_("isin-pse", function (quote, context) {
    return hf_resolvePseIsin_(quote, context);
  }),
  "isin-tradingview": hf_createIsinResolverRouteAdapter_("isin-tradingview", function (quote, context) {
    return hf_resolveTradingviewIsin_(quote, context);
  }),
  "local-fx": hf_createRouteAdapter_("local-fx", hf_executeLocalFxRouteBatch_),
  "pse-isin-map": hf_createRouteAdapter_("pse-isin-map", hf_executePseIsinMapRouteBatch_),
  "pse-quote": hf_createRouteAdapter_("pse-quote", hf_executePseQuoteRouteBatch_),
  "tradingview-fund": hf_createRouteAdapter_("tradingview-fund", hf_executeTradingviewFundRouteBatch_),
  "yahoo-chart": hf_createRouteAdapter_("yahoo-chart", hf_executeYahooChartRouteBatch_),
  "yahoo-isin-search": hf_createRouteAdapter_("yahoo-isin-search", hf_executeYahooIsinRouteBatch_),
};

function hf_getCurrentRouteAttempt_(job) {
  if (!job || !job.routeAttempts || job.routeIndex == null || job.routeIndex < 0 || job.routeIndex >= job.routeAttempts.length) {
    return null;
  }

  return job.routeAttempts[job.routeIndex];
}

function hf_mergeRouteState_(job, stateChanges) {
  const changes = stateChanges || {};
  let key;

  if (!job.routeState) {
    job.routeState = {};
  }

  for (key in changes) {
    if (Object.prototype.hasOwnProperty.call(changes, key)) {
      job.routeState[key] = changes[key];
    }
  }

  if (job.plan) {
    job.plan.routeState = job.routeState;
  }
}

function hf_defaultRouteFailureMessage_(job) {
  return job && job.routeKind === "isin" ? "ISIN lookup failed." : "Quote lookup failed.";
}

function hf_applyRouteResult_(job, attempt, result) {
  const normalizedResult = result || hf_createRouteResult_("terminal_error", { error: "Route adapter returned no result." });
  const errorMessage = normalizedResult.error ? hf_errorMessage_(normalizedResult.error) : "";

  if (!job.routeRuntimeTrace) {
    job.routeRuntimeTrace = [];
  }

  job.routeRuntimeTrace.push({
    label: attempt && attempt.traceLabel ? attempt.traceLabel : "",
    status: normalizedResult.status,
  });

  hf_mergeRouteState_(job, normalizedResult.stateChanges);

  if (normalizedResult.status === "success") {
    if (Object.prototype.hasOwnProperty.call(normalizedResult, "quote")) {
      job.quote = normalizedResult.quote || null;
      return;
    }

    if (Object.prototype.hasOwnProperty.call(normalizedResult, "value")) {
      job.value = normalizedResult.value;
      job.valueResolved = true;
      return;
    }

    return;
  }

  if (normalizedResult.status === "pivot") {
    job.routeAttempts = hf_cloneRouteAttempts_(normalizedResult.nextAttempts || []);
    job.routeIndex = 0;
    return;
  }

  if (normalizedResult.status === "lookup_failure") {
    if (errorMessage) {
      job.routeLastLookupFailure = errorMessage;
    }

    if (normalizedResult.nextAttempts && normalizedResult.nextAttempts.length) {
      job.routeAttempts = hf_cloneRouteAttempts_(normalizedResult.nextAttempts);
      job.routeIndex = 0;
      return;
    }

    job.routeIndex += 1;

    if (job.routeIndex >= job.routeAttempts.length) {
      job.error = job.routeLastLookupFailure || errorMessage || hf_defaultRouteFailureMessage_(job);
    }

    return;
  }

  job.error = errorMessage || hf_defaultRouteFailureMessage_(job);
}

function hf_getRouteAdapter_(adapterId) {
  const adapter = HOODLEFINANCE_ROUTE_ADAPTERS_[adapterId];

  if (!adapter) {
    throw new Error('Unknown route adapter "' + adapterId + '".');
  }

  return adapter;
}

function hf_executeRouteJobs_(orderedJobs) {
  let pendingJobs;
  let groupsByKey;
  let groupOrder;
  let i;
  let job;
  let attempt;
  let adapter;
  let groupKey;
  let results;
  let resultIndex;

  while (true) {
    pendingJobs = [];
    groupsByKey = {};
    groupOrder = [];

    for (i = 0; i < orderedJobs.length; i += 1) {
      job = orderedJobs[i];

      if (job.error || job.quote || job.valueResolved) {
        continue;
      }

      attempt = hf_getCurrentRouteAttempt_(job);

      if (!attempt) {
        if (!job.error) {
          job.error = job.routeLastLookupFailure || hf_defaultRouteFailureMessage_(job);
        }
        continue;
      }

      adapter = hf_getRouteAdapter_(attempt.adapterId);
      groupKey = adapter.adapterId + "\n" + adapter.batchKey(job, attempt);

      if (!groupsByKey[groupKey]) {
        groupsByKey[groupKey] = {
          adapter: adapter,
          jobs: [],
        };
        groupOrder.push(groupKey);
      }

      groupsByKey[groupKey].jobs.push(job);
      pendingJobs.push(job);
    }

    if (!pendingJobs.length) {
      return;
    }

    for (i = 0; i < groupOrder.length; i += 1) {
      results = groupsByKey[groupOrder[i]].adapter.executeBatch(groupsByKey[groupOrder[i]].jobs);

      for (resultIndex = 0; resultIndex < groupsByKey[groupOrder[i]].jobs.length; resultIndex += 1) {
        hf_applyRouteResult_(
          groupsByKey[groupOrder[i]].jobs[resultIndex],
          hf_getCurrentRouteAttempt_(groupsByKey[groupOrder[i]].jobs[resultIndex]),
          results[resultIndex]
        );
      }
    }
  }
}

function hf_executeLocalFxRouteBatch_(jobs) {
  let i;
  const results = [];

  for (i = 0; i < jobs.length; i += 1) {
    try {
      results.push(hf_createRouteResult_("success", {
        quote: hf_buildSameCurrencyQuote_(jobs[i].routeState.fxPair),
      }));
    } catch (error) {
      results.push(hf_createRouteResult_("terminal_error", { error: error }));
    }
  }

  return results;
}

function hf_executeGoogleFinanceFxRouteBatch_(jobs) {
  let i;
  const results = [];

  for (i = 0; i < jobs.length; i += 1) {
    try {
      results.push(hf_createRouteResult_("success", {
        quote: hf_fetchGoogleFinanceFxPairQuote_(jobs[i].routeState.fxPair),
      }));
    } catch (error) {
      results.push(hf_createRouteResult_("terminal_error", { error: error }));
    }
  }

  return results;
}

function hf_executePseIsinMapRouteBatch_(jobs) {
  let i;
  let pseTicker;
  let nextRoute;
  const results = [];

  for (i = 0; i < jobs.length; i += 1) {
    try {
      pseTicker = hf_resolvePseTickerFromIsinMap_(jobs[i].routeState.isin);

      if (!pseTicker) {
        results.push(hf_createRouteResult_("lookup_failure"));
        continue;
      }

      nextRoute = hf_buildQuoteAttemptsForResolvedIdentifier_(pseTicker, "default");
      results.push(hf_createRouteResult_("pivot", {
        nextAttempts: nextRoute.nextAttempts,
        stateChanges: nextRoute.stateChanges,
      }));
    } catch (error) {
      results.push(hf_createRouteResult_("terminal_error", { error: error }));
    }
  }

  return results;
}

function hf_executeYahooIsinRouteBatch_(jobs) {
  const results = jobs.map(function () { return null; });
  const requests = [];
  let i;
  let cacheKey;
  let cached;
  let responses;
  let routeInfo;

  for (i = 0; i < jobs.length; i += 1) {
    cacheKey = "hoodlefinance:isin:" + jobs[i].routeState.isin;
    cached = hf_getCachedString_(cacheKey);

    if (cached) {
      routeInfo = hf_buildQuoteAttemptsForResolvedIdentifier_(
        cached,
        hf_getCurrentRouteAttempt_(jobs[i]).resolvedSymbolMode
      );
      results[i] = hf_createRouteResult_("pivot", {
        nextAttempts: routeInfo.nextAttempts,
        stateChanges: routeInfo.stateChanges,
      });
      continue;
    }

    requests.push({
      cacheKey: cacheKey,
      index: i,
      isin: jobs[i].routeState.isin,
      url: hf_buildYahooIsinSearchUrl_(jobs[i].routeState.isin),
    });
  }

  responses = hf_fetchAllInChunks_("yahoo-isin-search", requests);

  for (i = 0; i < responses.length; i += 1) {
    if (responses[i].error) {
      results[responses[i].request.index] = hf_createRouteResult_("lookup_failure", {
        error: responses[i].error,
      });
      continue;
    }

    try {
      cached = hf_extractYahooSymbolFromSearchResponse_(
        responses[i].response,
        responses[i].request.isin
      );
      hf_putCachedString_(responses[i].request.cacheKey, cached, 21600);
      routeInfo = hf_buildQuoteAttemptsForResolvedIdentifier_(
        cached,
        hf_getCurrentRouteAttempt_(jobs[responses[i].request.index]).resolvedSymbolMode
      );
      results[responses[i].request.index] = hf_createRouteResult_("pivot", {
        nextAttempts: routeInfo.nextAttempts,
        stateChanges: routeInfo.stateChanges,
      });
    } catch (error) {
      results[responses[i].request.index] = hf_createRouteResult_("lookup_failure", {
        error: error,
      });
    }
  }

  return results;
}

function hf_executeYahooChartRouteBatch_(jobs) {
  const results = jobs.map(function () { return null; });
  const requests = [];
  let i;
  let cacheKey;
  let cached;
  let responses;
  let quote;
  let error;
  let attempt;

  for (i = 0; i < jobs.length; i += 1) {
    cacheKey = "hoodlefinance:" + jobs[i].routeState.yahooSymbol;
    cached = hf_getCachedJson_(cacheKey);

    if (cached) {
      results[i] = hf_createRouteResult_("success", {
        quote: hf_decorateFxQuote_(cached, jobs[i].routeState.fxPair),
      });
      continue;
    }

    requests.push({
      cacheKey: cacheKey,
      index: i,
      url: hf_buildYahooChartUrl_(jobs[i].routeState.yahooSymbol),
    });
  }

  responses = hf_fetchAllInChunks_("yahoo-chart", requests);

  for (i = 0; i < responses.length; i += 1) {
    attempt = hf_getCurrentRouteAttempt_(jobs[responses[i].request.index]);
    error = responses[i].error || null;

    if (!error) {
      try {
        quote = hf_decorateFxQuote_(
          hf_extractYahooQuoteMetaFromResponse_(
            responses[i].response,
            jobs[responses[i].request.index].tickerInput
          ),
          jobs[responses[i].request.index].routeState.fxPair
        );
        hf_putCachedJson_(
          responses[i].request.cacheKey,
          hf_extractRawQuote_(quote),
          60
        );
        results[responses[i].request.index] = hf_createRouteResult_("success", {
          quote: quote,
        });
        continue;
      } catch (extractError) {
        error = extractError;
      }
    }

    if (attempt && attempt.allowTradingviewFallback &&
      hf_shouldUseIsraeliFundTradingviewFallback_(jobs[responses[i].request.index], error)) {
      results[responses[i].request.index] = hf_createRouteResult_("lookup_failure", {
        error: error,
        nextAttempts: [hf_createRouteAttempt_("tradingview-fund", "TRADINGVIEW")],
      });
    } else if (error && /No quote data was found|Quote lookup failed/i.test(hf_errorMessage_(error))) {
      results[responses[i].request.index] = hf_createRouteResult_("lookup_failure", {
        error: error,
      });
    } else {
      results[responses[i].request.index] = hf_createRouteResult_("terminal_error", {
        error: error,
      });
    }
  }

  return results;
}

function hf_executeTradingviewFundRouteBatch_(jobs) {
  const results = jobs.map(function () { return null; });
  const requests = [];
  let i;
  let fallbackInfo;
  let cacheKey;
  let primaryCacheKey;
  let cached;
  let responses;
  let quote;

  for (i = 0; i < jobs.length; i += 1) {
    fallbackInfo = hf_buildIsraeliFundTradingviewFallbackInfo_(jobs[i].tickerInput, jobs[i].routeState.yahooSymbol);
    cacheKey = "hoodlefinance:tradingview:quote:" + fallbackInfo.yahooSymbol;
    primaryCacheKey = "hoodlefinance:" + fallbackInfo.yahooSymbol;
    cached = hf_getCachedJson_(cacheKey);

    if (cached) {
      hf_putCachedJson_(primaryCacheKey, cached, 60);
      results[i] = hf_createRouteResult_("success", {
        quote: cached,
      });
      continue;
    }

    requests.push({
      cacheKey: cacheKey,
      expectedSymbol: fallbackInfo.expectedSymbol,
      index: i,
      primaryCacheKey: primaryCacheKey,
      url: fallbackInfo.url,
      yahooSymbol: fallbackInfo.yahooSymbol,
    });
  }

  responses = hf_fetchAllInChunks_("tradingview-quote", requests);

  for (i = 0; i < responses.length; i += 1) {
    if (responses[i].error) {
      results[responses[i].request.index] = hf_createRouteResult_("terminal_error", {
        error: responses[i].error,
      });
      continue;
    }

    try {
      quote = hf_extractTradingviewFundQuoteFromResponse_(
        responses[i].response,
        responses[i].request.yahooSymbol,
        responses[i].request.expectedSymbol
      );
      hf_putCachedJson_(responses[i].request.cacheKey, quote, 60);
      hf_putCachedJson_(responses[i].request.primaryCacheKey, quote, 60);
      results[responses[i].request.index] = hf_createRouteResult_("success", {
        quote: quote,
      });
    } catch (error) {
      results[responses[i].request.index] = hf_createRouteResult_("terminal_error", {
        error: error,
      });
    }
  }

  return results;
}

function hf_executePseQuoteRouteBatch_(jobs) {
  const results = jobs.map(function () { return null; });
  const searchRequests = [];
  const stockRequests = [];
  let i;
  let cacheKey;
  let cached;
  let listing;
  let responses;
  let quote;

  for (i = 0; i < jobs.length; i += 1) {
    cacheKey = "hoodlefinance:pse:" + jobs[i].routeState.symbol;
    cached = hf_getCachedJson_(cacheKey);

    if (cached) {
      results[i] = hf_createRouteResult_("success", {
        quote: cached,
      });
      continue;
    }

    listing = hf_getCachedPseListing_(jobs[i].routeState.symbol);

    if (listing) {
      jobs[i].routeState.listing = listing;
      stockRequests.push({
        cacheKey: cacheKey,
        index: i,
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
      index: i,
      url: HOODLEFINANCE_PSE_SEARCH_URL_ + encodeURIComponent(jobs[i].routeState.symbol),
    });
  }

  responses = hf_fetchAllInChunks_("pse", searchRequests);

  for (i = 0; i < responses.length; i += 1) {
    if (responses[i].error) {
      results[responses[i].request.index] = hf_createRouteResult_("terminal_error", {
        error: hf_buildPseUnavailableError_(
          responses[i].error && responses[i].error.message ? responses[i].error.message : responses[i].error
        ),
      });
      continue;
    }

    if (responses[i].response.getResponseCode() !== 200) {
      results[responses[i].request.index] = hf_createRouteResult_("terminal_error", {
        error: hf_buildPseUnavailableError_(
          hf_buildPseHttpErrorMessage_(responses[i].response.getResponseCode())
        ),
      });
      continue;
    }

    try {
      listing = hf_resolvePseListingFromHtml_(
        responses[i].response.getContentText(),
        jobs[responses[i].request.index].routeState.symbol
      );
      hf_cachePseListing_(listing);
      jobs[responses[i].request.index].routeState.listing = listing;
      stockRequests.push({
        cacheKey: "hoodlefinance:pse:" + jobs[responses[i].request.index].routeState.symbol,
        index: responses[i].request.index,
        url:
          HOODLEFINANCE_PSE_STOCK_DATA_URL_ +
          "?cmpy_id=" +
          encodeURIComponent(listing.companyId) +
          "&security_id=" +
          encodeURIComponent(listing.securityId),
      });
    } catch (error) {
      results[responses[i].request.index] = hf_createRouteResult_("terminal_error", {
        error: error,
      });
    }
  }

  responses = hf_fetchAllInChunks_("pse", stockRequests);

  for (i = 0; i < responses.length; i += 1) {
    if (responses[i].error) {
      results[responses[i].request.index] = hf_createRouteResult_("terminal_error", {
        error: hf_buildPseUnavailableError_(
          responses[i].error && responses[i].error.message ? responses[i].error.message : responses[i].error
        ),
      });
      continue;
    }

    if (responses[i].response.getResponseCode() !== 200) {
      results[responses[i].request.index] = hf_createRouteResult_("terminal_error", {
        error: hf_buildPseUnavailableError_(
          hf_buildPseHttpErrorMessage_(responses[i].response.getResponseCode())
        ),
      });
      continue;
    }

    try {
      quote = hf_extractPseQuote_(
        responses[i].response.getContentText(),
        jobs[responses[i].request.index].routeState.listing
      );

      if (!quote || !quote.symbol) {
        throw new Error("No PSE quote data was found for " + jobs[responses[i].request.index].tickerInput + ".");
      }

      hf_putCachedJson_(responses[i].request.cacheKey, quote, 300);
      results[responses[i].request.index] = hf_createRouteResult_("success", {
        quote: quote,
      });
    } catch (error) {
      results[responses[i].request.index] = hf_createRouteResult_("terminal_error", {
        error: error,
      });
    }
  }

  return results;
}

function hf_executeDirectIsinRouteBatch_(jobs) {
  let i;
  const results = [];

  for (i = 0; i < jobs.length; i += 1) {
    results.push(hf_createRouteResult_("success", {
      value: String(jobs[i].routeState.isin || "").trim().toUpperCase(),
    }));
  }

  return results;
}

function hf_executeIsinResolverRouteBatch_(jobs, resolver) {
  let i;
  const results = [];

  for (i = 0; i < jobs.length; i += 1) {
    try {
      results.push(hf_createRouteResult_("success", {
        value: resolver(jobs[i].sourceQuote, jobs[i].routeContext),
      }));
    } catch (error) {
      results.push(hf_createRouteResult_("terminal_error", { error: error }));
    }
  }

  return results;
}

function hf_resolvePrefetchedTickerJobs_(jobs) {
  const outputCurrencyCache = {
    conversionRateByPair: {},
    unitByCode: {},
  };
  let i;

  for (i = 0; i < jobs.orderedJobs.length; i += 1) {
    if (jobs.orderedJobs[i].error) {
      throw new Error(jobs.orderedJobs[i].error);
    }

    if (jobs.orderedJobs[i].valueResolved) {
      continue;
    }

    jobs.orderedJobs[i].value = hf_extractAttribute_(
      jobs.orderedJobs[i].quote,
      jobs.orderedJobs[i].attribute,
      {
        outputCurrencyCache: outputCurrencyCache,
        plan: jobs.orderedJobs[i].plan,
        tickerInput: jobs.orderedJobs[i].tickerInput,
      }
    );
    jobs.orderedJobs[i].valueResolved = true;
  }
}

function hf_buildTickerResultGrid_(tickerGrid, jobByKey, attribute, allowImplicitBlankTickers) {
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
      normalizedTicker = hf_normalizeTickerGridCellValue_(value, allowImplicitBlankTickers);

      if (!normalizedTicker) {
        row.push("");
        continue;
      }

      key = hf_buildTickerJobKey_(normalizedTicker, attribute);
      row.push(jobByKey[key].value);
    }

    resultGrid.push(row);
  }

  return resultGrid;
}

function hf_isPseTicker_(ticker) {
  return String(hf_stripTickerSourceOverride_(ticker) || "").trim().toUpperCase().indexOf("PSE:") === 0;
}

function hf_parsePseSymbol_(ticker) {
  const value = String(hf_stripTickerSourceOverride_(ticker) || "").trim();
  const parts = value.split(":");
  const symbol = parts.length > 1 ? parts.slice(1).join(":").trim().toUpperCase() : "";

  if (!symbol) {
    throw new Error('PSE ticker "' + ticker + '" is invalid.');
  }

  return symbol;
}

function hf_buildSameCurrencyQuote_(fxPair) {
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

function hf_decorateFxQuote_(quote, fxPair) {
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

function hf_extractRawQuote_(quote) {
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

function hf_extractAttribute_(quote, attribute, context) {
  const attributeRequest = hf_parseAttributeRequest_(attribute);
  const extractor = HOODLEFINANCE_SUPPORTED_ATTRIBUTES_[attributeRequest.baseAttribute];
  const normalizedContext = context || {};
  let value;

  if (!extractor) {
    throw new Error(
      'Unsupported attribute "' +
      attribute +
      '". Supported attributes: ' +
      hf_formatPublicAttributes_()
    );
  }

  if (attributeRequest.wantsOutputCurrency) {
    if (attributeRequest.baseAttribute === "currency") {
      throw new Error('Attribute "currency" does not support output-currency conversion.');
    }

    if (!HOODLEFINANCE_OUTPUT_CONVERTIBLE_ATTRIBUTES_[attributeRequest.baseAttribute]) {
      throw new Error(
        'Attribute "' +
        attributeRequest.baseAttribute +
        '" does not support output-currency conversion. Supported attribute is: price.'
      );
    }
  }

  if (HOODLEFINANCE_UNSUPPORTED_FX_ATTRIBUTES_[attributeRequest.baseAttribute] &&
    hf_isFxContext_(quote, normalizedContext)) {
    throw new Error(
      'Attribute "' + attributeRequest.baseAttribute + '" is not available for currency-pair identifiers.'
    );
  }

  value = extractor(quote, normalizedContext);

  if (!attributeRequest.wantsOutputCurrency) {
    return value;
  }

  return hf_convertAttributeValueToOutputCurrency_(quote, value, attributeRequest, normalizedContext);
}

function hf_hasValue_(value) {
  return value != null && value !== "";
}

function hf_pickPrice_(quote) {
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

function hf_previousClose_(quote) {
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

function hf_change_(quote) {
  return hf_pickPrice_(quote) - hf_previousClose_(quote);
}

function hf_extractCurrencyValue_(quote) {
  if (quote && quote.hoodlefinanceFxDisplayCurrency) {
    return String(quote.hoodlefinanceFxDisplayCurrency);
  }

  return hf_normalizeCurrency_(quote.currency || quote.financialCurrency || "");
}

function hf_normalizeCurrency_(currency) {
  return currency === "GBp" ? "GBP" : currency === "ILA" ? "ILS" : currency;
}

function hf_normalizeMoney_(quote, value) {
  const rawCurrency = quote.currency || quote.financialCurrency || "";
  const normalizedCurrency = hf_normalizeCurrency_(rawCurrency);
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

function hf_resolveOutputCurrencyUnit_(outputCurrencyCache, code) {
  const cacheKey = String(code || "").trim();
  let unit;

  if (!outputCurrencyCache || !cacheKey) {
    return hf_resolveCurrencyUnit_(code);
  }

  if (Object.prototype.hasOwnProperty.call(outputCurrencyCache.unitByCode, cacheKey)) {
    return outputCurrencyCache.unitByCode[cacheKey];
  }

  unit = hf_resolveCurrencyUnit_(cacheKey);
  outputCurrencyCache.unitByCode[cacheKey] = unit;
  return unit;
}

function hf_convertAttributeValueToOutputCurrency_(quote, value, attributeRequest, context) {
  const outputCurrencyCache = context && context.outputCurrencyCache ? context.outputCurrencyCache : null;
  const sourceCurrency = hf_extractCurrencyValue_(quote);
  const sourceUnit = hf_resolveOutputCurrencyUnit_(outputCurrencyCache, sourceCurrency);
  const targetUnit = hf_resolveOutputCurrencyUnit_(outputCurrencyCache, attributeRequest.outputCode);
  const plan = context && context.plan ? context.plan : null;
  let cacheKey;
  let fxPair;
  let conversionQuote;
  let conversionRate;

  if (plan && plan.routeState && plan.routeState.fxPair) {
    throw new Error("Output-currency conversion is not supported for currency-pair identifiers.");
  }

  if (!sourceCurrency) {
    throw new Error('No quote currency is available for output-currency conversion on "' + attributeRequest.rawAttribute + '".');
  }

  if (!sourceUnit) {
    throw new Error('Quote currency "' + sourceCurrency + '" is not supported for output-currency conversion.');
  }

  if (!targetUnit) {
    throw new Error('Output currency "' + attributeRequest.outputCode + '" is not supported.');
  }

  if (sourceUnit.displayCode === targetUnit.displayCode) {
    return value;
  }

  cacheKey = sourceUnit.displayCode + "->" + targetUnit.displayCode;

  if (outputCurrencyCache && Object.prototype.hasOwnProperty.call(outputCurrencyCache.conversionRateByPair, cacheKey)) {
    return value * outputCurrencyCache.conversionRateByPair[cacheKey];
  }

  fxPair = hf_buildFxPair_(sourceUnit, targetUnit);

  if (fxPair.isSameCurrency) {
    conversionRate = fxPair.scale;
  } else {
    try {
      conversionQuote = hf_fetchQuote_(fxPair.googleSymbol);
      conversionRate = hf_normalizeMoney_(conversionQuote, hf_pickPrice_(conversionQuote));
    } catch (error) {
      throw new Error(
        'Output-currency conversion from "' +
        sourceUnit.displayCode +
        '" to "' +
        targetUnit.displayCode +
        '" is unavailable. ' +
        hf_errorMessage_(error)
      );
    }
  }

  if (outputCurrencyCache) {
    outputCurrencyCache.conversionRateByPair[cacheKey] = conversionRate;
  }

  return value * conversionRate;
}

function hf_shouldUseIsraeliFundTradingviewFallback_(job, error) {
  const yahooSymbol = job && job.routeState && job.routeState.yahooSymbol
    ? String(job.routeState.yahooSymbol).trim().toUpperCase()
    : "";
  const message = hf_errorMessage_(error);

  if (!hf_looksLikeIsraeliFundYahooSymbol_(yahooSymbol)) {
    return false;
  }

  return /No quote data was found|Quote lookup failed/i.test(message);
}

function hf_buildIsraeliFundTradingviewFallbackInfo_(tickerInput, yahooSymbol) {
  const normalizedYahooSymbol = String(yahooSymbol || "").trim().toUpperCase();
  const code = normalizedYahooSymbol.replace(/\.TA$/i, "");

  return {
    expectedSymbol: "TASE:" + code,
    url: HOODLEFINANCE_TRADINGVIEW_SYMBOL_URL_ + "TASE-" + code + "/",
    yahooSymbol: normalizedYahooSymbol,
  };
}

function hf_resolvePseListing_(symbol) {
  const normalizedSymbol = String(symbol || "").trim().toUpperCase();

  return hf_resolveCachedJson_(
    hf_buildPseListingCacheKey_(normalizedSymbol),
    HOODLEFINANCE_PSE_LISTING_CACHE_TTL_SECONDS_,
    function () {
      const html = hf_fetchPseText_(HOODLEFINANCE_PSE_SEARCH_URL_ + encodeURIComponent(normalizedSymbol));

      return hf_resolvePseListingFromHtml_(html, normalizedSymbol);
    },
    hf_parsePseListingPayload_,
    hf_serializePseListingPayload_
  );
}

function hf_resolveLonListing_(code) {
  const normalizedCode = String(code || "").trim().toUpperCase();
  const html = hf_fetchText_(HOODLEFINANCE_LSE_SEARCH_URL_ + encodeURIComponent(normalizedCode));
  const listings = hf_extractLonListings_(html);
  let i;

  for (i = 0; i < listings.length; i += 1) {
    if (listings[i].code === normalizedCode) {
      return listings[i];
    }
  }

  throw new Error('No LON listing was found for "' + normalizedCode + '".');
}

function hf_extractPseListings_(html) {
  const text = String(html || "");
  const pattern = /<tr>[\s\S]*?cmDetail\('(\d+)','(\d+)'\);return false;">([\s\S]*?)<\/a>[\s\S]*?<td class="alignC"><a[\s\S]*?>([\s\S]*?)<\/a>[\s\S]*?<\/tr>/gi;
  const listings = [];
  let match;

  while ((match = pattern.exec(text))) {
    listings.push({
      companyId: match[1],
      name: hf_cleanHtmlText_(match[3]),
      securityId: match[2],
      symbol: hf_cleanHtmlText_(match[4]).toUpperCase(),
    });
  }

  return listings;
}

function hf_buildPseUnavailableError_(detail) {
  const normalizedDetail = detail == null ? "" : String(detail).trim();

  return new Error(
    "The PSE data source is currently unavailable" +
    (normalizedDetail ? " (" + normalizedDetail + ")" : "") +
    ". Please try again later."
  );
}

function hf_buildPseHttpErrorMessage_(statusCode) {
  const numericCode = Number(statusCode);

  if (numericCode >= 520 && numericCode < 530) {
    return "PSE upstream returned Cloudflare HTTP " + numericCode + ".";
  }

  return "PSE upstream returned HTTP " + statusCode + ".";
}

function hf_fetchPseText_(url) {
  let response;

  try {
    response = UrlFetchApp.fetch(url, hf_buildFetchOptions_());
  } catch (error) {
    throw hf_buildPseUnavailableError_(error && error.message ? error.message : error);
  }

  if (response.getResponseCode() !== 200) {
    throw hf_buildPseUnavailableError_(
      hf_buildPseHttpErrorMessage_(response.getResponseCode())
    );
  }

  return response.getContentText();
}

function hf_extractLonListings_(html) {
  const text = String(html || "");
  const pattern = /<tr[^>]*>[\s\S]*?<td>\s*([^<]+?)\s*<\/td>[\s\S]*?UpdateOpener\(\s*'(?:[^'\\]|\\.)*'\s*,\s*'([\s\S]*?)'\s*\)\s*;?[\s\S]*?>([\s\S]*?)<\/a>[\s\S]*?<\/tr>/gi;
  const listings = [];
  let match;

  while ((match = pattern.exec(text))) {
    const code = hf_cleanHtmlText_(match[1]).toUpperCase();
    const payload = hf_extractLonListingPayload_(match[2]);

    if (!code || !payload.isin) {
      continue;
    }

    listings.push({
      code: code,
      countryCode: payload.countryCode,
      currency: payload.currency,
      isin: payload.isin,
      marketCode: payload.marketCode,
      name: hf_cleanHtmlText_(match[3]),
      sedol: payload.sedol,
      symbol: payload.symbol || code,
    });
  }

  return listings;
}

function hf_extractLonListingPayload_(text) {
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

function hf_extractPseQuote_(html, listing) {
  const previousClose = hf_parseNumber_(hf_extractPseField_(html, "Previous Close and Date"));
  const lastPrice = hf_parseNumber_(hf_extractPseField_(html, "Last Traded Price"));
  const changeText = hf_extractPseField_(html, "Change(% Change)");
  const price = lastPrice != null ? lastPrice : previousClose;
  const asOf = hf_extractPseAsOf_(html);
  const change = hf_extractPseChange_(changeText, price, previousClose);
  const changePercent = hf_extractPseChangePercent_(changeText, change, previousClose);

  return {
    currency: "PHP",
    exchangeDataDelayedBy: 0,
    financialCurrency: "PHP",
    isin: hf_extractPseField_(html, "ISIN").toUpperCase(),
    longName: hf_extractPseCompanyName_(html) || (listing && listing.name) || "",
    regularMarketChange: change,
    regularMarketChangePercent: changePercent,
    regularMarketDayHigh: hf_parseNumber_(hf_extractPseField_(html, "High")),
    regularMarketDayLow: hf_parseNumber_(hf_extractPseField_(html, "Low")),
    regularMarketOpen: hf_parseNumber_(hf_extractPseField_(html, "Open")),
    regularMarketPreviousClose: previousClose,
    regularMarketPrice: price,
    regularMarketTime: asOf ? Math.floor(asOf.getTime() / 1000) : null,
    regularMarketVolume: hf_parseNumber_(hf_extractPseField_(html, "Volume")),
    shortName: hf_extractPseCompanyName_(html) || (listing && listing.name) || "",
    symbol: hf_extractPseSelectedSymbol_(html) || (listing && listing.symbol) || "",
  };
}

function hf_extractPseField_(html, label) {
  const pattern = new RegExp(
    "<th>\\s*" + hf_escapeRegex_(label) + "\\s*<\\/th>[\\s\\S]*?<td[^>]*>([\\s\\S]*?)<\\/td>",
    "i"
  );
  const match = String(html || "").match(pattern);
  return match ? hf_cleanHtmlText_(match[1]) : "";
}

function hf_extractPseCompanyName_(html) {
  const match = String(html || "").match(/<div class="compInfo">[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i);
  return match ? hf_cleanHtmlText_(match[1]) : "";
}

function hf_extractPseSelectedSymbol_(html) {
  const match = String(html || "").match(/<option value="[^"]+" selected>([\s\S]*?)<\/option>/i);
  return match ? hf_cleanHtmlText_(match[1]).toUpperCase() : "";
}

function hf_extractPseAsOf_(html) {
  const match = String(html || "").match(/As of\s+([^<]+)/i);
  const value = match ? hf_cleanHtmlText_(match[1]) : "";
  const parsed = value ? Date.parse(value + " GMT+0800") : NaN;

  return isNaN(parsed) ? null : new Date(parsed);
}

function hf_extractPseChange_(text, price, previousClose) {
  const value = hf_parseNumber_(text);

  if (value != null) {
    return /down/i.test(String(text || "")) ? -value : value;
  }

  if (price != null && previousClose != null) {
    return price - previousClose;
  }

  return null;
}

function hf_extractPseChangePercent_(text, change, previousClose) {
  const match = String(text || "").match(/\(([-+]?\d[\d,]*(?:\.\d+)?)%\)/);

  if (match) {
    return Number(match[1].replace(/,/g, "")) / 100;
  }

  if (change != null && previousClose) {
    return change / previousClose;
  }

  return null;
}

function hf_cleanHtmlText_(text) {
  return hf_decodeHtmlEntities_(String(text || ""))
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hf_decodeHtmlEntities_(text) {
  return String(text || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function hf_parseNumber_(text) {
  const match = String(text || "").replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function hf_escapeRegex_(text) {
  return String(text || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hf_resolveIbkrIsin_(quote, context) {
  const symbol = hf_extractQuoteSymbol_(quote);
  const preferredExchange = hf_inferIbkrExchange_(context && context.tickerInput, symbol);
  const resolution = hf_resolveIsinFromIbkrSymbol_(symbol, preferredExchange);
  const ibkrIsin = resolution && resolution.isin ? resolution.isin : "";

  if (ibkrIsin) {
    return ibkrIsin;
  }

  if (resolution && resolution.error) {
    throw new Error(resolution.error);
  }

  throw new Error("No IBKR ISIN is available for this ticker.");
}

const HOODLEFINANCE_ISIN_ROUTE_ADAPTER_BY_SOURCE_ = {
  ARIVA: "isin-ariva",
  IBKR: "isin-ibkr",
  LON: "isin-lon",
  PSE: "isin-pse",
  TRADINGVIEW: "isin-tradingview",
};

function hf_buildIsinRoutePlan_(quote, context) {
  const directIsinInput = hf_extractDirectIsinInput_(context);
  const sourceOverride = context && context.tickerInput ? hf_extractTickerSourceOverride_(context.tickerInput) : "";
  const exchange = hf_inferIsinExchange_(quote, context);
  const source = sourceOverride || (exchange ? HOODLEFINANCE_ISIN_SOURCE_BY_EXCHANGE_[exchange] || "" : "");

  if (directIsinInput) {
    return hf_createSingleAttemptRoutePlan_("DIRECT", "isin-direct", "DIRECT", {
      routeState: { isin: directIsinInput },
      routePath: "",
    });
  }

  if (hf_isFxContext_(quote, context)) {
    throw new Error("ISIN is not available for currency pairs.");
  }

  if (source) {
    return hf_buildIsinPlanForSource_(source);
  }

  if (!exchange) {
    throw new Error("Could not determine which market to use for ISIN lookup. Try an identifier source override such as \"@TRADINGVIEW\", \"@LON\", \"@PSE\", \"@ARIVA\", or \"@IBKR\".");
  }

  throw new Error("ISIN lookup is not supported yet for exchange \"" + exchange + "\". Try an identifier source override such as \"@TRADINGVIEW\", \"@LON\", \"@PSE\", \"@ARIVA\", or \"@IBKR\".");
}

function hf_buildIsinPlanForSource_(source) {
  const normalizedSource = String(source || "").trim().toUpperCase();
  const adapterId = HOODLEFINANCE_ISIN_ROUTE_ADAPTER_BY_SOURCE_[normalizedSource];

  if (adapterId) {
    return hf_createSingleAttemptRoutePlan_(normalizedSource, adapterId, normalizedSource, {
      routePath: "",
    });
  }

  throw new Error('"@' + normalizedSource + '" is not available for ISIN lookups.');
}

function hf_resolveDefaultIsin_(quote, context) {
  const routeContext = context || {};
  const job = hf_createAttributeRouteJob_("isin", quote, routeContext, "isin");

  job.plan = hf_buildIsinRoutePlan_(quote, routeContext);
  hf_prepareRouteJob_(job, job.plan);

  hf_executeRouteJobs_([job]);

  if (job.error) {
    throw new Error(job.error);
  }

  return job.value;
}

function hf_extractDirectIsinInput_(context) {
  const tickerInput = context && context.tickerInput
    ? String(hf_stripTickerSourceOverride_(context.tickerInput) || "").trim().toUpperCase()
    : "";
  const isin = tickerInput.indexOf("ISIN:") === 0 ? tickerInput.slice(5).trim() : tickerInput;

  return hf_looksLikeIsin_(isin) ? isin : "";
}

function hf_resolveArivaIsin_(quote, context) {
  const exchange = hf_inferIsinExchange_(quote, context);
  const code = hf_extractArivaCode_(quote, context);
  const cacheKey = "hoodlefinance:ariva:isin:" + code;

  if (exchange !== "ETR") {
    throw new Error("ARIVA ISIN lookup only works for ETR tickers.");
  }

  if (!code) {
    throw new Error("Could not determine the ticker code needed for ARIVA ISIN lookup.");
  }

  return hf_resolveCachedString_(cacheKey, 21600, function () {
    const listing = hf_resolveArivaListing_(code);

    if (!listing.isin) {
      throw new Error('No ARIVA ISIN is available for "' + code + '".');
    }

    if (!listing.hasXetra) {
      throw new Error('ARIVA did not expose a Xetra listing for "' + code + '".');
    }

    return listing.isin;
  });
}

function hf_resolvePseIsin_(quote, context) {
  const exchange = hf_inferIsinExchange_(quote, context);

  if (exchange !== "PSE") {
    throw new Error("PSE ISIN lookup only works for PSE tickers.");
  }

  if (quote && quote.isin) {
    return String(quote.isin).toUpperCase();
  }

  throw new Error("No PSE ISIN is available for this ticker.");
}

function hf_resolveLonIsin_(quote, context) {
  const exchange = hf_inferIsinExchange_(quote, context);
  const code = hf_extractLonCode_(quote, context);
  const cacheKey = "hoodlefinance:lon:isin:" + code;

  if (exchange !== "LON") {
    throw new Error("LON ISIN lookup only works for LON tickers.");
  }

  if (!code) {
    throw new Error("Could not determine the ticker code needed for LON ISIN lookup.");
  }

  return hf_resolveCachedString_(cacheKey, 21600, function () {
    const listing = hf_resolveLonListing_(code);

    if (!listing.isin) {
      throw new Error('No LON ISIN is available for "' + code + '".');
    }

    return listing.isin;
  });
}

function hf_resolveTradingviewIsin_(quote, context) {
  const yahooExchange = hf_inferIsinExchange_(quote, context);
  const tradingviewExchange = hf_inferTradingviewExchange_(quote, context);
  const code = hf_extractTradingviewCode_(quote, context);
  const cacheKey = "hoodlefinance:tradingview:isin:" + tradingviewExchange + ":" + code;
  const expectedSymbol = tradingviewExchange && code ? tradingviewExchange + ":" + code : "";

  if (!tradingviewExchange) {
    if (yahooExchange) {
      throw new Error('TradingView cannot be used for ISIN lookup on exchange "' + yahooExchange + '".');
    }
    throw new Error("Could not determine which market to use for TradingView ISIN lookup.");
  }

  if (!code) {
    throw new Error("Could not determine the ticker code needed for TradingView ISIN lookup.");
  }

  return hf_resolveCachedString_(cacheKey, 21600, function () {
    const html = hf_fetchText_(HOODLEFINANCE_TRADINGVIEW_SYMBOL_URL_ + tradingviewExchange + "-" + code + "/");
    const resolvedSymbol = hf_extractTradingviewResolvedSymbol_(html);
    const isin = hf_extractTradingviewIsin_(html);

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

function hf_extractQuoteSymbol_(quote) {
  return quote && quote.symbol ? String(quote.symbol).trim().toUpperCase() : "";
}

function hf_extractRawYahooExchangeFromQuote_(quote) {
  const exchangeName = String(
    (quote && (quote.exchangeName || quote.fullExchangeName || quote.quoteSourceName)) || ""
  ).trim().toUpperCase();

  return exchangeName || "";
}

function hf_isFxContext_(quote, context) {
  const tickerInput = context && context.tickerInput
    ? String(hf_stripTickerSourceOverride_(context.tickerInput) || "").trim()
    : "";
  const resolvedSymbol = hf_extractQuoteSymbol_(quote);

  return !!(quote && (quote.hoodlefinanceFxDisplayCurrency != null || quote.hoodlefinanceFxGoogleSymbol)) ||
    tickerInput.toUpperCase().indexOf("CURRENCY:") === 0 ||
    /^[A-Z]{6}(=X)?$/.test(resolvedSymbol);
}

function hf_isPseContext_(quote, context) {
  const plan = context && context.plan;
  const routeState = plan && plan.routeState ? plan.routeState : null;
  const tickerInput = context && context.tickerInput
    ? String(hf_stripTickerSourceOverride_(context.tickerInput) || "").trim()
    : "";

  return (
    hf_isPseTicker_(tickerInput) ||
    hf_isPseTicker_(routeState && routeState.yahooSymbol || "") ||
    !!(routeState && routeState.symbol) ||
    String(quote && quote.exchangeName || "").trim().toUpperCase() === "PSE"
  );
}

function hf_inferYahooExchangeIdentity_(quote, context) {
  const tickerInput = context && context.tickerInput
    ? String(hf_stripTickerSourceOverride_(context.tickerInput) || "").trim().toUpperCase()
    : "";
  const explicitExchange = hf_extractTickerExchange_(tickerInput);
  const resolvedSymbol = hf_extractQuoteSymbol_(quote);
  const rawMetaExchange = hf_extractRawYahooExchangeFromQuote_(quote);
  const suffixExchange = hf_extractYahooExchangeFromSymbol_(resolvedSymbol || tickerInput);
  const mappedMetaExchange = hf_extractYahooExchangeFromQuote_(quote);

  if (hf_isFxContext_(quote, context)) {
    return "CURRENCY";
  }

  if (hf_isPseContext_(quote, context)) {
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

function hf_resolveGoogleExchange_(quote, context) {
  const yahooExchange = hf_inferYahooExchangeIdentity_(quote, context);

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

function hf_renderGoogleSymbol_(quote, context) {
  const resolvedSymbol = hf_extractQuoteSymbol_(quote);
  const googleExchange = hf_resolveGoogleExchange_(quote, context);
  const suffix = googleExchange && HOODLEFINANCE_EXCHANGE_SUFFIXES_[googleExchange];

  if (hf_isFxContext_(quote, context)) {
    if (quote && quote.hoodlefinanceFxGoogleSymbol) {
      return String(quote.hoodlefinanceFxGoogleSymbol);
    }

    if (!resolvedSymbol) {
      throw new Error("No Google-style symbol is available for this instrument.");
    }

    return "CURRENCY:" + resolvedSymbol.replace(/=X$/i, "");
  }

  if (hf_isPseContext_(quote, context)) {
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

function hf_resolveSymbolAttribute_(quote, context, style) {
  const resolvedSymbol = hf_extractQuoteSymbol_(quote);

  if (!resolvedSymbol) {
    throw new Error("No resolved symbol is available for this instrument.");
  }

  if (style === "yahoo") {
    if (hf_isFxContext_(quote, context)) {
      return resolvedSymbol.replace(/=X$/i, "") + "=X";
    }

    return hf_isPseContext_(quote, context) ? resolvedSymbol + ".PS" : resolvedSymbol;
  }

  return hf_renderGoogleSymbol_(quote, context);
}

function hf_resolveExchangeAttribute_(quote, context, style) {
  const exchange = style === "yahoo"
    ? hf_inferYahooExchangeIdentity_(quote, context)
    : hf_resolveGoogleExchange_(quote, context);

  if (!exchange) {
    throw new Error("No " + (style === "yahoo" ? "Yahoo-style" : "Google-style") + " exchange is available for this instrument.");
  }

  return exchange;
}

function hf_extractTradingviewCode_(quote, context) {
  const tickerInput = context && context.tickerInput
    ? String(hf_stripTickerSourceOverride_(context.tickerInput) || "").trim().toUpperCase()
    : "";
  const resolvedSymbol = hf_extractQuoteSymbol_(quote);
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
        return hf_normalizeTradingviewCodeForExchange_(parts[0], parts.slice(1).join(":"));
      }
    }

    match = candidate.match(/^(.+)\.[A-Z0-9]+$/);
    if (match) {
      return hf_normalizeTradingviewCodeForExchange_("", match[1]);
    }

    return candidate;
  }

  return "";
}

function hf_normalizeTradingviewCodeForExchange_(exchange, code) {
  const normalizedExchange = String(exchange || "").trim().toUpperCase();
  const normalizedCode = String(code || "").trim().toUpperCase();

  if (normalizedExchange === "TLV" || normalizedExchange === "TASE" || /\.TA$/i.test(normalizedCode)) {
    return hf_normalizeIsraeliFundCode_(normalizedCode.replace(/\.TA$/i, ""));
  }

  return normalizedCode;
}

function hf_extractLonCode_(quote, context) {
  const tickerInput = context && context.tickerInput
    ? String(hf_stripTickerSourceOverride_(context.tickerInput) || "").trim().toUpperCase()
    : "";
  const resolvedSymbol = hf_extractQuoteSymbol_(quote);
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

function hf_inferTradingviewExchange_(quote, context) {
  const yahooExchange = hf_inferIsinExchange_(quote, context);
  return yahooExchange ? HOODLEFINANCE_TRADINGVIEW_EXCHANGE_BY_YAHOO_EXCHANGE_[yahooExchange] || "" : "";
}

function hf_extractArivaCode_(quote, context) {
  const tickerInput = context && context.tickerInput
    ? String(hf_stripTickerSourceOverride_(context.tickerInput) || "").trim().toUpperCase()
    : "";
  const resolvedSymbol = hf_extractQuoteSymbol_(quote);
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

function hf_inferIsinExchange_(quote, context) {
  const tickerInput = context && context.tickerInput
    ? String(hf_stripTickerSourceOverride_(context.tickerInput) || "").trim().toUpperCase()
    : "";
  const explicitExchange = hf_extractTickerExchange_(tickerInput);
  const resolvedSymbol = hf_extractQuoteSymbol_(quote);
  const suffixExchange = hf_extractYahooExchangeFromSymbol_(resolvedSymbol || tickerInput);
  const metaExchange = hf_extractYahooExchangeFromQuote_(quote);

  if (hf_isPseTicker_(tickerInput)) {
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

function hf_extractTickerExchange_(ticker) {
  const value = String(hf_stripTickerSourceOverride_(ticker) || "").trim().toUpperCase();
  const parts = value.split(":");
  const exchange = parts.length > 1 ? parts[0] : "";

  if (!exchange || exchange === "CURRENCY" || exchange === "ISIN") {
    return "";
  }

  if (exchange === "PSE") {
    return "PSE";
  }

  if (HOODLEFINANCE_PREFIXLESS_EXCHANGES_[exchange] || HOODLEFINANCE_EXCHANGE_SUFFIXES_[exchange] || hf_normalizeExplicitIbkrExchange_(exchange)) {
    return exchange;
  }

  return "";
}

function hf_extractYahooExchangeFromSymbol_(symbol) {
  const match = String(symbol || "").trim().toUpperCase().match(/\.([A-Z0-9]+)$/);
  const suffix = match ? match[1] : "";

  return suffix ? HOODLEFINANCE_YAHOO_EXCHANGE_BY_SUFFIX_[suffix] || "" : "";
}

function hf_extractYahooExchangeFromQuote_(quote) {
  const exchangeName = String(
    (quote && (quote.exchangeName || quote.fullExchangeName || quote.quoteSourceName)) || ""
  ).trim().toUpperCase();

  return exchangeName ? HOODLEFINANCE_YAHOO_EXCHANGE_BY_META_NAME_[exchangeName] || "" : "";
}

function hf_resolveArivaListing_(code) {
  const normalizedCode = String(code || "").trim().toUpperCase();
  const html = hf_fetchText_(HOODLEFINANCE_ARIVA_LIVESEARCH_URL_ + encodeURIComponent(normalizedCode));
  const listings = hf_extractArivaListings_(html);
  let i;
  let detailHtml;

  for (i = 0; i < listings.length; i += 1) {
    if (listings[i].code !== normalizedCode) {
      continue;
    }

    detailHtml = hf_fetchText_(HOODLEFINANCE_ARIVA_BASE_URL_ + listings[i].href);
    return {
      code: normalizedCode,
      hasXetra: hf_arivaHasXetra_(detailHtml),
      href: listings[i].href,
      isin: hf_extractArivaIsin_(detailHtml),
      type: listings[i].type,
    };
  }

  throw new Error('No ARIVA listing was found for "' + normalizedCode + '".');
}

function hf_extractArivaListings_(html) {
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
      code: hf_cleanHtmlText_(codeMatch[1]).toUpperCase(),
      href: String(match[1] || "").trim(),
      type: hf_cleanHtmlText_(match[3]),
    });
  }

  return listings;
}

function hf_extractArivaIsin_(html) {
  const titleMatch = String(html || "").match(/<title>[\s\S]*?\bISIN\s+([A-Z]{2}[A-Z0-9]{9}[0-9])\b[\s\S]*?<\/title>/i);
  const fieldMatch = String(html || "").match(/ISIN:&nbsp;<\/span>\s*<span class="value">([A-Z]{2}[A-Z0-9]{9}[0-9])<\/span>/i);
  const rawIsin = fieldMatch ? fieldMatch[1] : titleMatch ? titleMatch[1] : "";

  return rawIsin ? rawIsin.toUpperCase() : "";
}

function hf_arivaHasXetra_(html) {
  return /\bXetra\b/i.test(String(html || ""));
}

function hf_extractTradingviewResolvedSymbol_(html) {
  const match = String(html || "").match(/"resolved_symbol":"([^"]+)"/i);
  return match ? match[1].toUpperCase() : "";
}

function hf_extractTradingviewIsin_(html) {
  const match = String(html || "").match(/"isin_displayed":"([A-Z]{2}[A-Z0-9]{9}[0-9])"/i);
  return match ? match[1].toUpperCase() : "";
}

function hf_extractTradingviewSymbolInfo_(html) {
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

function hf_extractTradingviewQuotePrice_(html) {
  const match = String(html || "").match(/\btrades at\s+([0-9.,\u00A0\u202F ]+)\s*([A-Z]{3})\s+today\b/i);
  return match ? hf_parseNumber_(match[1]) : null;
}

function hf_extractTradingviewFundQuoteFromResponse_(response, yahooSymbol, expectedSymbol) {
  if (response.getResponseCode() !== 200) {
    throw new Error('TradingView quote lookup failed for "' + expectedSymbol + '" (' + response.getResponseCode() + ").");
  }

  return hf_extractTradingviewFundQuote_(response.getContentText(), yahooSymbol, expectedSymbol);
}

function hf_extractTradingviewFundQuote_(html, yahooSymbol, expectedSymbol) {
  const symbolInfo = hf_extractTradingviewSymbolInfo_(html);
  const resolvedSymbol = symbolInfo && symbolInfo.resolved_symbol
    ? String(symbolInfo.resolved_symbol).toUpperCase()
    : hf_extractTradingviewResolvedSymbol_(html);
  const price = hf_extractTradingviewQuotePrice_(html);
  const currency = symbolInfo && (symbolInfo.currency || symbolInfo.currency_code)
    ? String(symbolInfo.currency || symbolInfo.currency_code).toUpperCase()
    : "";
  const name = symbolInfo
    ? symbolInfo.description || symbolInfo.short_description || symbolInfo.local_description || symbolInfo.short_name || ""
    : "";
  const isin = symbolInfo && symbolInfo.isin_displayed ? String(symbolInfo.isin_displayed).toUpperCase() : hf_extractTradingviewIsin_(html);

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

function hf_resolveIsinFromIbkrSymbol_(symbol, preferredExchange) {
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

  isin = hf_getCachedString_(cacheKey);

  if (isin) {
    return {
      error: "",
      isin: isin,
    };
  }

  searchUrls = hf_buildIbkrSearchUrls_(lookupSymbol, preferredExchange);

  for (i = 0; i < searchUrls.length; i += 1) {
    searchHtml = hf_fetchText_(searchUrls[i]);
    searchError = hf_extractIbkrSearchError_(searchHtml, lookupSymbol, searchUrls[i]);

    if (searchError) {
      return {
        error: searchError,
        isin: "",
      };
    }

    detailEntries = hf_extractIbkrDetailUrls_(searchHtml);
    hf_sortIbkrDetailEntries_(detailEntries, preferredExchange);

    isin = hf_resolveIbkrIsinFromDetailEntries_(detailEntries);
    if (isin) {
      hf_putCachedString_(cacheKey, isin, 21600);
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

function hf_buildIbkrSearchUrls_(symbol, preferredExchange) {
  const urls = [];
  const encodedSymbol = encodeURIComponent(String(symbol || "").trim().toUpperCase());
  const encodedExchange = encodeURIComponent(String(preferredExchange || "").trim().toUpperCase());

  if (preferredExchange) {
    urls.push(HOODLEFINANCE_IBKR_SEARCH_URL_ + encodedSymbol + "&exchange=" + encodedExchange);
  }

  urls.push(HOODLEFINANCE_IBKR_SEARCH_URL_ + encodedSymbol);

  return urls;
}

function hf_resolveIbkrIsinFromDetailEntries_(detailEntries) {
  let i;
  let detailHtml;
  let isin;

  for (i = 0; i < detailEntries.length && i < 8; i += 1) {
    detailHtml = hf_fetchText_(detailEntries[i].url);
    isin = hf_extractIsin_(detailHtml);
    if (isin) {
      return isin;
    }
  }

  return "";
}

function hf_extractIbkrDetailUrls_(text) {
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
      normalizedUrl = hf_normalizeIbkrUrl_(legacyMatches[i]);
      exchangeHint = hf_extractIbkrExchangeHint_(legacyMatches[i]);
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
    exchangeHint = hf_extractIbkrModernExchangeHint_(row);
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

function hf_extractIbkrSearchError_(text, symbol, url) {
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

function hf_extractIbkrModernExchangeHint_(rowHtml) {
  const match = String(rowHtml || "").match(
    /<td\b[\s\S]*?<\/td>\s*<td\b[\s\S]*?<\/td>\s*<td\b[\s\S]*?<\/td>\s*<td\b[\s\S]*?<\/td>\s*<td\b[\s\S]*?>([\s\S]*?)<\/td>/i
  );
  const rawValue = match ? String(match[1]).replace(/^.*">/s, "") : "";

  return rawValue ? hf_cleanHtmlText_(rawValue).toUpperCase() : "";
}

function hf_extractIbkrExchangeHint_(text) {
  const match = String(text || "").match(/[$]exchange([A-Z0-9.]+)/i);
  return match ? match[1].toUpperCase() : "";
}

function hf_sortIbkrDetailEntries_(entries, preferredExchange) {
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

function hf_inferIbkrExchange_(tickerInput, resolvedSymbol) {
  const rawTicker = String(hf_stripTickerSourceOverride_(tickerInput || resolvedSymbol || "") || "").trim().toUpperCase();
  const explicitParts = rawTicker.split(":");
  const explicitExchange = explicitParts.length > 1 ? explicitParts[0] : "";
  const yahooSymbol = String(resolvedSymbol || "").trim().toUpperCase();
  const suffixSource = rawTicker.indexOf(":") >= 0 ? explicitParts.slice(1).join(":") : rawTicker || yahooSymbol;
  const suffixMatch = String(suffixSource || yahooSymbol).match(/\.([A-Z0-9]+)$/);
  const suffix = suffixMatch ? suffixMatch[1] : "";
  const explicitIbkrExchange = hf_normalizeExplicitIbkrExchange_(explicitExchange);
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

function hf_normalizeExplicitIbkrExchange_(exchange) {
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

function hf_normalizeIbkrUrl_(url) {
  const normalizedUrl = String(url || "").replace(/&amp;/g, "&");

  if (normalizedUrl.indexOf("http") === 0) {
    return normalizedUrl;
  }

  return "https://misc.interactivebrokers.com" + normalizedUrl;
}

function hf_buildFetchOptions_() {
  return {
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Accept-Language": "en-US,en;q=0.9"
    },
    muteHttpExceptions: true,
  };
}

function hf_buildFetchRequest_(url) {
  const request = hf_buildFetchOptions_();

  request.url = url;
  return request;
}

function hf_fetchAllInChunks_(source, requests) {
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
    chunkResponses = hf_fetchChunk_(chunk);

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

function hf_fetchChunk_(requests) {
  let responses;
  let i;

  if (!UrlFetchApp.fetchAll) {
    return requests.map(function (request) {
      try {
        return {
          error: null,
          response: UrlFetchApp.fetch(request.url, hf_buildFetchOptions_()),
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
      return hf_buildFetchRequest_(request.url);
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
          response: UrlFetchApp.fetch(requests[i].url, hf_buildFetchOptions_()),
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

function hf_fetchText_(url) {
  const response = UrlFetchApp.fetch(url, hf_buildFetchOptions_());

  if (response.getResponseCode() !== 200) {
    return "";
  }

  return response.getContentText();
}

function hf_buildGoogleFinanceQuoteUrl_(pairSlug) {
  return "https://www.google.com/finance/quote/" + encodeURIComponent(pairSlug);
}

function hf_extractGoogleFinanceFxPairQuote_(html, fxPair) {
  const tuple = hf_extractGoogleFinancePairTuple_(html, fxPair.googlePairSlug);
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

function hf_extractGoogleFinancePairTuple_(html, pairSlug) {
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
    tuple = hf_findGoogleFinancePairTuple_(data, pairSlug);

    if (tuple) {
      return tuple;
    }
  }

  throw new Error('Google Finance did not expose a quote tuple for "' + pairSlug + '".');
}

function hf_findGoogleFinancePairTuple_(value, pairSlug) {
  let i;
  let nested;

  if (!Array.isArray(value)) {
    return null;
  }

  if (value.indexOf(pairSlug) >= 0) {
    return value;
  }

  for (i = 0; i < value.length; i += 1) {
    nested = hf_findGoogleFinancePairTuple_(value[i], pairSlug);
    if (nested) {
      return nested;
    }
  }

  return null;
}

function hf_extractIsin_(text) {
  const match = String(text || "").match(/ISIN[\s\S]{0,200}?([A-Z]{2}[A-Z0-9]{9}[0-9])/i);
  return match ? match[1].toUpperCase() : "";
}

function hf_buildYahooChartUrl_(yahooSymbol) {
  return "https://query1.finance.yahoo.com/v8/finance/chart/" +
    encodeURIComponent(yahooSymbol) +
    "?interval=1d&range=1d";
}

function hf_buildYahooIsinSearchUrl_(isin) {
  return "https://query2.finance.yahoo.com/v1/finance/search?q=" + encodeURIComponent(isin) + "&quotesCount=10&newsCount=0";
}

function hf_extractYahooQuoteMetaFromResponse_(response, ticker) {
  if (response.getResponseCode() !== 200) {
    throw new Error(hf_buildYahooQuoteLookupErrorMessage_(ticker, response.getResponseCode()));
  }

  return hf_extractYahooQuoteMetaFromPayload_(JSON.parse(response.getContentText()), ticker);
}

function hf_buildYahooQuoteLookupErrorMessage_(ticker, statusCode) {
  const normalizedTicker = String(ticker || "").trim();
  const upperTicker = normalizedTicker.toUpperCase();

  if (Number(statusCode) === 404 && upperTicker.indexOf("OTCMKTS:") === 0) {
    return "No current quote data was found for " + normalizedTicker + ". The symbol may be delisted or cancelled.";
  }

  return "Quote lookup failed for " + normalizedTicker + " (" + statusCode + ").";
}

function hf_extractYahooQuoteMetaFromPayload_(payload, ticker) {
  const chart = payload && payload.chart;
  const results = chart && chart.result;
  const firstResult = results && results[0];
  const meta = firstResult && firstResult.meta;

  if (!meta) {
    throw new Error("No quote data was found for " + ticker + ".");
  }

  return meta;
}

function hf_extractYahooSymbolFromSearchResponse_(response, isin) {
  if (response.getResponseCode() !== 200) {
    throw new Error('ISIN lookup failed for "' + isin + '" (' + response.getResponseCode() + ").");
  }

  return hf_extractYahooSymbolFromSearchPayload_(JSON.parse(response.getContentText()), isin);
}

function hf_extractYahooSymbolFromSearchPayload_(payload, isin) {
  const quotes = payload && payload.quotes;
  const quote = hf_selectYahooIsinSearchQuote_(quotes);
  const symbol = quote && quote.symbol ? String(quote.symbol).trim().toUpperCase() : "";

  if (!symbol) {
    throw new Error('No Yahoo Finance symbol was found for ISIN "' + isin + '".');
  }

  return symbol;
}

function hf_selectYahooIsinSearchQuote_(quotes) {
  const candidates = Array.isArray(quotes) ? quotes : [];
  let bestQuote = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  let i;
  let candidateScore;

  for (i = 0; i < candidates.length; i += 1) {
    candidateScore = hf_scoreYahooIsinSearchQuote_(candidates[i]);

    if (candidateScore > bestScore) {
      bestQuote = candidates[i];
      bestScore = candidateScore;
    }
  }

  return bestQuote;
}

function hf_scoreYahooIsinSearchQuote_(quote) {
  const symbol = quote && quote.symbol ? String(quote.symbol).trim().toUpperCase() : "";
  const yahooExchange = hf_inferYahooExchangeFromSearchQuote_(quote);
  const quoteType = quote && quote.quoteType ? String(quote.quoteType).trim().toUpperCase() : "";
  const numericScore = Number(quote && quote.score);
  let score = 0;

  if (!symbol || (quote && quote.isYahooFinance === false)) {
    return Number.NEGATIVE_INFINITY;
  }

  if (yahooExchange && hf_canRenderGoogleExchangeFromYahooIdentity_(yahooExchange)) {
    score += 1000000;
  } else if (yahooExchange) {
    score += 100000;
  }

  if (quoteType === "ETF" || quoteType === "EQUITY") {
    score += 1000;
  } else if (quoteType === "MUTUALFUND") {
    score -= 1000;
  }

  if (!isNaN(numericScore)) {
    score += numericScore;
  }

  return score;
}

function hf_inferYahooExchangeFromSearchQuote_(quote) {
  const symbol = quote && quote.symbol ? String(quote.symbol).trim().toUpperCase() : "";
  const rawExchange = String((quote && quote.exchange) || "").trim().toUpperCase();
  const suffixExchange = hf_extractYahooExchangeFromSymbol_(symbol);
  const mappedMetaExchange = rawExchange ? HOODLEFINANCE_YAHOO_EXCHANGE_BY_META_NAME_[rawExchange] || "" : "";

  if (suffixExchange) {
    return suffixExchange;
  }

  if (mappedMetaExchange) {
    return mappedMetaExchange;
  }

  if (rawExchange && (
    HOODLEFINANCE_GOOGLE_EXCHANGE_BY_YAHOO_IDENTITY_[rawExchange] ||
    HOODLEFINANCE_PREFIXLESS_EXCHANGES_[rawExchange] ||
    HOODLEFINANCE_EXCHANGE_SUFFIXES_[rawExchange]
  )) {
    return rawExchange;
  }

  return "";
}

function hf_canRenderGoogleExchangeFromYahooIdentity_(yahooExchange) {
  const identity = String(yahooExchange || "").trim().toUpperCase();

  return Boolean(
    HOODLEFINANCE_GOOGLE_EXCHANGE_BY_YAHOO_IDENTITY_[identity] ||
    identity === "TASE" ||
    HOODLEFINANCE_PREFIXLESS_EXCHANGES_[identity] ||
    HOODLEFINANCE_EXCHANGE_SUFFIXES_[identity]
  );
}

function hf_resolvePseListingFromHtml_(html, symbol) {
  const listings = hf_extractPseListings_(html);
  const normalizedSymbol = String(symbol || "").trim().toUpperCase();
  let i;

  for (i = 0; i < listings.length; i += 1) {
    if (listings[i].symbol === normalizedSymbol) {
      return listings[i];
    }
  }

  throw new Error('No PSE listing was found for "' + normalizedSymbol + '".');
}

function hf_resolvePseTickerFromIsinMap_(isin) {
  const normalizedIsin = String(isin || "").trim().toUpperCase();

  if (normalizedIsin.indexOf("PH") !== 0) {
    return "";
  }

  return hf_getPseIsinMap_()[normalizedIsin] || "";
}

function hf_resolveIsinFromSearchResponse_(response, isin) {
  try {
    return hf_extractYahooSymbolFromSearchResponse_(response, isin);
  } catch (error) {
    const pseTicker = hf_resolvePseTickerFromIsinMap_(isin);

    if (pseTicker) {
      return pseTicker;
    }

    throw error;
  }
}

function hf_resolveIsin_(isin) {
  if (!hf_looksLikeIsin_(isin)) {
    throw new Error('ISIN "' + isin + '" is invalid.');
  }

  const cacheKey = "hoodlefinance:isin:" + isin;
  const pseTicker = hf_resolvePseTickerFromIsinMap_(isin);

  return hf_resolveCachedString_(cacheKey, 21600, function () {
    if (pseTicker) {
      return pseTicker;
    }

    return hf_resolveIsinFromSearchResponse_(
      UrlFetchApp.fetch(hf_buildYahooIsinSearchUrl_(isin), hf_buildFetchOptions_()),
      isin
    );
  });
}

function hf_errorMessage_(error) {
  return String(error && error.message ? error.message : error);
}

function hf_looksLikeIsin_(value) {
  return /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/i.test(String(value).trim());
}
