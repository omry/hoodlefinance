const HOODLEFINANCE_VERSION_ = "0.1.1";

const HOODLEFINANCE_SUPPORTED_ATTRIBUTES_ = {
  "ariva:isin": function (quote, context) {
    return hoodlefinanceResolveArivaIsin_(quote, context);
  },
  "ibkr:isin": function (quote, context) {
    return hoodlefinanceResolveIbkrIsin_(quote, context);
  },
  currency: function (quote) {
    return hoodlefinanceNormalizeCurrency_(quote.currency || quote.financialCurrency || "");
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
  "lon:isin": function (quote, context) {
    return hoodlefinanceResolveLonIsin_(quote, context);
  },
  name: function (quote) {
    return quote.longName || quote.shortName || quote.displayName || quote.symbol || "";
  },
  price: function (quote) {
    return hoodlefinanceNormalizeMoney_(quote, hoodlefinancePickPrice_(quote));
  },
  "pse:isin": function (quote, context) {
    return hoodlefinanceResolvePseIsin_(quote, context);
  },
  "tradingview:isin": function (quote, context) {
    return hoodlefinanceResolveTradingviewIsin_(quote, context);
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

const HOODLEFINANCE_GITHUB_REPO_URL_ = "https://github.com/omry/hoodlefinance";
const HOODLEFINANCE_GITHUB_RAW_URL_ = "https://raw.githubusercontent.com/omry/hoodlefinance/main/hoodlefinance.js";
const HOODLEFINANCE_GITHUB_RAW_FALLBACK_URL_ = "https://github.com/omry/hoodlefinance/raw/main/hoodlefinance.js";
const HOODLEFINANCE_GITHUB_README_URL_ = "https://github.com/omry/hoodlefinance/blob/main/README.md";
const HOODLEFINANCE_LAST_UPDATE_CHECK_PROPERTY_ = "hoodlefinance.lastUpdateCheckMs";
const HOODLEFINANCE_SUPPRESS_UPDATE_CHECKS_PROPERTY_ = "hoodlefinance.suppressUpdateChecks";
const HOODLEFINANCE_UPDATE_CHECK_INTERVAL_MS_ = 24 * 60 * 60 * 1000;
const HOODLEFINANCE_UPDATE_CACHE_KEY_ = "hoodlefinance:update:latestVersion";
const HOODLEFINANCE_UPDATE_CACHE_TTL_SECONDS_ = 6 * 60 * 60;
const HOODLEFINANCE_MENU_TITLE_ = "Hoodlefinance";

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
  ASE: "AMEX",
  BATS: "BATS",
  NASDAQ: "NASDAQ",
  NMS: "NASDAQ",
  NYQ: "NYSE",
  NYSE: "NYSE",
  OQX: "OTCMKTS",
  OTO: "OTCMKTS",
  PNK: "OTCMKTS",
};

const HOODLEFINANCE_TRADINGVIEW_EXCHANGE_BY_YAHOO_EXCHANGE_ = {
  AMEX: "AMEX",
  ETR: "XETR",
  HKG: "HKEX",
  LON: "LSE",
  NASDAQ: "NASDAQ",
  NYSE: "NYSE",
  NYSEAMERICAN: "AMEX",
  NYSEARCA: "AMEX",
  OTCMKTS: "OTC",
  SGX: "SGX",
  TLV: "TASE",
};

const HOODLEFINANCE_ISIN_ATTRIBUTE_BY_EXCHANGE_ = {
  ETR: "tradingview:isin",
  HKG: "tradingview:isin",
  LON: "lon:isin",
  NASDAQ: "tradingview:isin",
  NYSE: "tradingview:isin",
  OTCMKTS: "tradingview:isin",
  PSE: "pse:isin",
  SGX: "tradingview:isin",
  TLV: "tradingview:isin",
};

/**
 * Drop-in replacement for GOOGLEFINANCE for single-result quote fields.
 *
 * Supported attributes in this version:
 * - "price" (default)
 * - "name"
 * - "currency"
 * - "tradetime"
 * - "datadelay"
 * - "volume"
 * - "high"
 * - "low"
 * - "ariva:isin"
 * - "ibkr:isin"
 * - "isin"
 * - "lon:isin"
 * - "pse:isin"
 * - "tradingview:isin"
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
 * @return {string|number} The requested scalar quote field.
 * @customfunction
 */
function HOODLEFINANCE(ticker, attribute, startDate, endDateOrNumDays, interval) {
  const rawTicker = hoodlefinanceCoerceScalar_(ticker, "ticker");
  const rawAttribute = attribute == null ? "price" : hoodlefinanceCoerceScalar_(attribute, "attribute");

  if (!rawTicker) {
    throw new Error("Ticker is required.");
  }

  if (
    hoodlefinanceHasValue_(startDate) ||
    hoodlefinanceHasValue_(endDateOrNumDays) ||
    hoodlefinanceHasValue_(interval)
  ) {
    throw new Error("Historical data arguments are not supported yet.");
  }

  const normalizedTicker = String(rawTicker).trim();
  const quote = hoodlefinanceFetchQuote_(String(rawTicker).trim());
  return hoodlefinanceExtractAttribute_(quote, rawAttribute, {
    tickerInput: normalizedTicker,
  });
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

  latestInfo = hoodlefinanceFetchLatestVersionInfo_();
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

function hoodlefinanceFetchLatestVersionInfo_() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get(HOODLEFINANCE_UPDATE_CACHE_KEY_);
  const urls = [
    HOODLEFINANCE_GITHUB_RAW_URL_,
    HOODLEFINANCE_GITHUB_RAW_FALLBACK_URL_,
  ];
  const errors = [];
  let response;
  let version;
  let i;
  let url;

  if (cached) {
    return JSON.parse(cached);
  }

  for (i = 0; i < urls.length; i += 1) {
    url = urls[i];

    try {
      response = UrlFetchApp.fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Accept-Language": "en-US,en;q=0.9"
        },
        muteHttpExceptions: true,
      });
    } catch (error) {
      errors.push(url + " -> " + String(error && error.message ? error.message : error));
      continue;
    }

    if (response.getResponseCode() !== 200) {
      errors.push(url + " -> HTTP " + response.getResponseCode());
      continue;
    }

    version = hoodlefinanceExtractVersionFromSource_(response.getContentText());

    if (!version) {
      errors.push(url + " -> version string not found");
      continue;
    }

    cache.put(
      HOODLEFINANCE_UPDATE_CACHE_KEY_,
      JSON.stringify({ version: version }),
      HOODLEFINANCE_UPDATE_CACHE_TTL_SECONDS_
    );

    return { version: version };
  }

  return {
    error: errors.join("\n"),
    version: "",
  };
}

function hoodlefinanceExtractVersionFromSource_(sourceText) {
  const match = String(sourceText || "").match(/const HOODLEFINANCE_VERSION_ = "([^"]+)"/);
  return match ? match[1] : "";
}

function hoodlefinanceShowUpdateDialog_(latestVersion) {
  const ui = hoodlefinanceGetUi_();
  let output;

  if (!ui) {
    return;
  }

  if (typeof HtmlService === "undefined" || !HtmlService || !HtmlService.createHtmlOutput) {
    ui.alert(
      "HOODLEFINANCE updates",
      "A newer version is available (" + latestVersion + ").\n\nUpdate link: " + HOODLEFINANCE_GITHUB_RAW_URL_,
      ui.ButtonSet.OK
    );
    return;
  }

  output = HtmlService.createHtmlOutput(hoodlefinanceBuildUpdateDialogHtml_(latestVersion))
    .setWidth(520)
    .setHeight(280);

  ui.showModalDialog(output, "HOODLEFINANCE update available");
}

function hoodlefinanceBuildUpdateDialogHtml_(latestVersion) {
  return (
    '<div style="font-family:Arial,sans-serif;padding:16px;line-height:1.5;">' +
      "<h2 style=\"margin:0 0 12px 0;font-size:18px;\">HOODLEFINANCE update available</h2>" +
      "<p style=\"margin:0 0 12px 0;\">Installed version: <code>" + hoodlefinanceEscapeHtml_(HOODLEFINANCE_VERSION_) + "</code><br>" +
      "Latest version: <code>" + hoodlefinanceEscapeHtml_(latestVersion) + "</code></p>" +
      "<p style=\"margin:0 0 16px 0;\">Open the latest script and paste it into <code>Code.gs</code> to update.</p>" +
      "<p style=\"margin:0 0 16px 0;\">" +
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
  const sameCurrencyPair = hoodlefinanceExtractSameCurrencyPair_(normalizedTicker);

  if (hoodlefinanceIsPseTicker_(normalizedTicker)) {
    return hoodlefinanceFetchPseQuote_(normalizedTicker);
  }

  if (sameCurrencyPair) {
    return hoodlefinanceBuildSameCurrencyQuote_(sameCurrencyPair);
  }

  const yahooSymbol = hoodlefinanceNormalizeTicker_(normalizedTicker);
  const cache = CacheService.getScriptCache();
  const cacheKey = "hoodlefinance:" + yahooSymbol;
  const cached = cache.get(cacheKey);

  if (cached) {
    return JSON.parse(cached);
  }

  const response = UrlFetchApp.fetch(
    "https://query1.finance.yahoo.com/v8/finance/chart/" +
      encodeURIComponent(yahooSymbol) +
      "?interval=1d&range=1d",
    {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept-Language": "en-US,en;q=0.9"
      },
      muteHttpExceptions: true,
    }
  );

  if (response.getResponseCode() !== 200) {
    throw new Error("Quote lookup failed for " + ticker + " (" + response.getResponseCode() + ").");
  }

  const payload = JSON.parse(response.getContentText());
  const chart = payload && payload.chart;
  const results = chart && chart.result;
  const firstResult = results && results[0];
  const meta = firstResult && firstResult.meta;

  if (!meta) {
    throw new Error("No quote data was found for " + ticker + ".");
  }

  cache.put(cacheKey, JSON.stringify(meta), 60);
  return meta;
}

function hoodlefinanceFetchPseQuote_(ticker) {
  const symbol = hoodlefinanceParsePseSymbol_(ticker);
  const cache = CacheService.getScriptCache();
  const cacheKey = "hoodlefinance:pse:" + symbol;
  const cached = cache.get(cacheKey);
  let listing;
  let html;
  let quote;

  if (cached) {
    return JSON.parse(cached);
  }

  listing = hoodlefinanceResolvePseListing_(symbol);
  html = hoodlefinanceFetchText_(
    HOODLEFINANCE_PSE_STOCK_DATA_URL_ +
      "?cmpy_id=" +
      encodeURIComponent(listing.companyId) +
      "&security_id=" +
      encodeURIComponent(listing.securityId)
  );

  quote = hoodlefinanceExtractPseQuote_(html, listing);

  if (!quote || !quote.symbol) {
    throw new Error("No PSE quote data was found for " + ticker + ".");
  }

  cache.put(cacheKey, JSON.stringify(quote), 300);
  return quote;
}

function hoodlefinanceNormalizeTicker_(ticker) {
  const value = String(ticker).trim();
  const upperValue = value.toUpperCase();

  if (hoodlefinanceLooksLikeIsin_(value)) {
    return hoodlefinanceResolveIsin_(upperValue);
  }

  if (upperValue.indexOf("ISIN:") === 0) {
    return hoodlefinanceResolveIsin_(upperValue.slice(5).trim());
  }

  const parts = value.split(":");

  if (parts.length < 2) {
    return value;
  }

  const exchange = parts[0].trim().toUpperCase();
  const symbol = parts.slice(1).join(":").trim();

  if (!symbol) {
    throw new Error('Ticker "' + ticker + '" is invalid.');
  }

  if (exchange === "CURRENCY") {
    const currencyPair = symbol.replace(/[^A-Za-z]/g, "").toUpperCase();
    if (currencyPair.length !== 6) {
      throw new Error('Currency ticker "' + ticker + '" must look like CURRENCY:USDEUR.');
    }
    return currencyPair + "=X";
  }

  if (HOODLEFINANCE_PREFIXLESS_EXCHANGES_[exchange]) {
    return symbol;
  }

  if (HOODLEFINANCE_EXCHANGE_SUFFIXES_[exchange]) {
    return symbol + HOODLEFINANCE_EXCHANGE_SUFFIXES_[exchange];
  }

  if (hoodlefinanceNormalizeExplicitIbkrExchange_(exchange)) {
    return symbol;
  }

  throw new Error('Unsupported exchange prefix "' + exchange + '" in ticker "' + ticker + '".');
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

function hoodlefinanceIsPseTicker_(ticker) {
  return String(ticker || "").trim().toUpperCase().indexOf("PSE:") === 0;
}

function hoodlefinanceParsePseSymbol_(ticker) {
  const value = String(ticker || "").trim();
  const parts = value.split(":");
  const symbol = parts.length > 1 ? parts.slice(1).join(":").trim().toUpperCase() : "";

  if (!symbol) {
    throw new Error('PSE ticker "' + ticker + '" is invalid.');
  }

  return symbol;
}

function hoodlefinanceExtractSameCurrencyPair_(ticker) {
  const value = String(ticker || "").trim().toUpperCase();
  const parts = value.split(":");
  const exchange = parts.length > 1 ? parts[0] : "";
  const symbol = parts.length > 1 ? parts.slice(1).join(":").trim() : "";
  const currencyPair = exchange === "CURRENCY" ? symbol.replace(/[^A-Z]/g, "") : "";
  const baseCurrency = currencyPair.slice(0, 3);
  const quoteCurrency = currencyPair.slice(3, 6);

  if (currencyPair.length !== 6) {
    return "";
  }

  return baseCurrency === quoteCurrency ? currencyPair : "";
}

function hoodlefinanceBuildSameCurrencyQuote_(currencyPair) {
  const normalizedPair = String(currencyPair || "").trim().toUpperCase();
  const quoteCurrency = normalizedPair.slice(3, 6);
  const nowSeconds = Math.floor(new Date().getTime() / 1000);

  return {
    currency: quoteCurrency,
    exchangeDataDelayedBy: 0,
    financialCurrency: quoteCurrency,
    previousClose: 1,
    regularMarketDayHigh: 1,
    regularMarketDayLow: 1,
    regularMarketPreviousClose: 1,
    regularMarketPrice: 1,
    regularMarketTime: nowSeconds,
    shortName: normalizedPair,
    symbol: normalizedPair + "=X",
  };
}

function hoodlefinanceExtractAttribute_(quote, attribute, context) {
  const normalizedAttribute = String(attribute).trim().toLowerCase();
  const extractor = HOODLEFINANCE_SUPPORTED_ATTRIBUTES_[normalizedAttribute];

  if (!extractor) {
    throw new Error(
      'Unsupported attribute "' +
        attribute +
        '". Supported attributes: ' +
        Object.keys(HOODLEFINANCE_SUPPORTED_ATTRIBUTES_).join(", ")
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

function hoodlefinanceNormalizeCurrency_(currency) {
  return currency === "GBp" ? "GBP" : currency;
}

function hoodlefinanceNormalizeMoney_(quote, value) {
  if (value == null) {
    throw new Error("No value is available for this ticker.");
  }

  return hoodlefinanceNormalizeCurrency_(quote.currency || quote.financialCurrency || "") === "GBP" &&
    (quote.currency === "GBp" || quote.financialCurrency === "GBp")
    ? value / 100
    : value;
}

function hoodlefinanceResolvePseListing_(symbol) {
  const normalizedSymbol = String(symbol || "").trim().toUpperCase();
  const html = hoodlefinanceFetchText_(HOODLEFINANCE_PSE_SEARCH_URL_ + encodeURIComponent(normalizedSymbol));
  const listings = hoodlefinanceExtractPseListings_(html);
  let i;

  for (i = 0; i < listings.length; i += 1) {
    if (listings[i].symbol === normalizedSymbol) {
      return listings[i];
    }
  }

  throw new Error('No PSE listing was found for "' + normalizedSymbol + '".');
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
  const exchange = hoodlefinanceInferIsinExchange_(quote, context);
  const attribute = exchange ? HOODLEFINANCE_ISIN_ATTRIBUTE_BY_EXCHANGE_[exchange] || "" : "";

  if (!exchange) {
    throw new Error("Could not deduce an exchange for isin lookup. Use an explicit source attribute such as \"ariva:isin\", \"lon:isin\", \"pse:isin\", \"tradingview:isin\", or \"ibkr:isin\".");
  }

  if (!attribute) {
    throw new Error("No isin source is implemented for exchange \"" + exchange + "\". Use an explicit source attribute such as \"ariva:isin\", \"lon:isin\", \"pse:isin\", \"tradingview:isin\", or \"ibkr:isin\".");
  }

  return hoodlefinanceExtractAttribute_(quote, attribute, context || {});
}

function hoodlefinanceResolveArivaIsin_(quote, context) {
  const exchange = hoodlefinanceInferIsinExchange_(quote, context);
  const code = hoodlefinanceExtractArivaCode_(quote, context);
  const cache = CacheService.getScriptCache();
  const cacheKey = "hoodlefinance:ariva:isin:" + code;
  const cached = code ? cache.get(cacheKey) : "";
  let listing;

  if (exchange !== "ETR") {
    throw new Error("ariva:isin is only implemented for ETR tickers.");
  }

  if (!code) {
    throw new Error("Could not determine the ARIVA search code for this ticker.");
  }

  if (cached) {
    return cached;
  }

  listing = hoodlefinanceResolveArivaListing_(code);

  if (!listing.isin) {
    throw new Error('No ARIVA ISIN is available for "' + code + '".');
  }

  if (!listing.hasXetra) {
    throw new Error('ARIVA did not expose a Xetra listing for "' + code + '".');
  }

  cache.put(cacheKey, listing.isin, 21600);
  return listing.isin;
}

function hoodlefinanceResolvePseIsin_(quote, context) {
  const exchange = hoodlefinanceInferIsinExchange_(quote, context);

  if (exchange !== "PSE") {
    throw new Error("pse:isin is only implemented for PSE tickers.");
  }

  if (quote && quote.isin) {
    return String(quote.isin).toUpperCase();
  }

  throw new Error("No PSE ISIN is available for this ticker.");
}

function hoodlefinanceResolveLonIsin_(quote, context) {
  const exchange = hoodlefinanceInferIsinExchange_(quote, context);
  const code = hoodlefinanceExtractLonCode_(quote, context);
  const cache = CacheService.getScriptCache();
  const cacheKey = "hoodlefinance:lon:isin:" + code;
  const cached = code ? cache.get(cacheKey) : "";
  let listing;

  if (exchange !== "LON") {
    throw new Error("lon:isin is only implemented for LON tickers.");
  }

  if (!code) {
    throw new Error("Could not determine the LON code for this ticker.");
  }

  if (cached) {
    return cached;
  }

  listing = hoodlefinanceResolveLonListing_(code);

  if (!listing.isin) {
    throw new Error('No LON ISIN is available for "' + code + '".');
  }

  cache.put(cacheKey, listing.isin, 21600);
  return listing.isin;
}

function hoodlefinanceResolveTradingviewIsin_(quote, context) {
  const yahooExchange = hoodlefinanceInferIsinExchange_(quote, context);
  const tradingviewExchange = hoodlefinanceInferTradingviewExchange_(quote, context);
  const code = hoodlefinanceExtractTradingviewCode_(quote, context);
  const cache = CacheService.getScriptCache();
  const cacheKey = "hoodlefinance:tradingview:isin:" + tradingviewExchange + ":" + code;
  const cached = tradingviewExchange && code ? cache.get(cacheKey) : "";
  const expectedSymbol = tradingviewExchange && code ? tradingviewExchange + ":" + code : "";
  let html;
  let resolvedSymbol;
  let isin;

  if (!tradingviewExchange) {
    if (yahooExchange) {
      throw new Error('tradingview:isin is not implemented for exchange "' + yahooExchange + '".');
    }
    throw new Error("Could not determine the TradingView exchange for this ticker.");
  }

  if (!code) {
    throw new Error("Could not determine the TradingView symbol code for this ticker.");
  }

  if (cached) {
    return cached;
  }

  html = hoodlefinanceFetchText_(HOODLEFINANCE_TRADINGVIEW_SYMBOL_URL_ + tradingviewExchange + "-" + code + "/");
  resolvedSymbol = hoodlefinanceExtractTradingviewResolvedSymbol_(html);
  isin = hoodlefinanceExtractTradingviewIsin_(html);

  if (resolvedSymbol && resolvedSymbol !== expectedSymbol) {
    throw new Error(
      'TradingView resolved "' + expectedSymbol + '" to "' + resolvedSymbol + '" instead of an exact symbol match.'
    );
  }

  if (!isin) {
    throw new Error('No TradingView ISIN is available for "' + expectedSymbol + '".');
  }

  cache.put(cacheKey, isin, 21600);
  return isin;
}

function hoodlefinanceExtractQuoteSymbol_(quote) {
  return quote && quote.symbol ? String(quote.symbol).trim().toUpperCase() : "";
}

function hoodlefinanceExtractTradingviewCode_(quote, context) {
  const tickerInput = context && context.tickerInput ? String(context.tickerInput).trim().toUpperCase() : "";
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
        return parts.slice(1).join(":").trim().toUpperCase();
      }
    }

    match = candidate.match(/^([A-Z0-9]+)\.[A-Z0-9]+$/);
    if (match) {
      return match[1];
    }

    return candidate;
  }

  return "";
}

function hoodlefinanceExtractLonCode_(quote, context) {
  const tickerInput = context && context.tickerInput ? String(context.tickerInput).trim().toUpperCase() : "";
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
  const tickerInput = context && context.tickerInput ? String(context.tickerInput).trim().toUpperCase() : "";
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
  const tickerInput = context && context.tickerInput ? String(context.tickerInput).trim().toUpperCase() : "";
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
  const value = String(ticker || "").trim().toUpperCase();
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

function hoodlefinanceResolveIsinFromIbkrSymbol_(symbol, preferredExchange) {
  const normalizedSymbol = String(symbol || "").trim().toUpperCase();
  const baseSymbol = normalizedSymbol.replace(/\.[A-Z0-9]+$/, "");
  const lookupSymbol = baseSymbol || normalizedSymbol;
  const cache = CacheService.getScriptCache();
  const cacheKey = "hoodlefinance:ibkr:isin:" + lookupSymbol + ":" + (preferredExchange || "");
  const cached = cache.get(cacheKey);
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

  if (cached) {
    return {
      error: "",
      isin: cached,
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
      cache.put(cacheKey, isin, 21600);
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
  const rawTicker = String(tickerInput || resolvedSymbol || "").trim().toUpperCase();
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

function hoodlefinanceFetchText_(url) {
  const response = UrlFetchApp.fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Accept-Language": "en-US,en;q=0.9"
    },
    muteHttpExceptions: true,
  });

  if (response.getResponseCode() !== 200) {
    return "";
  }

  return response.getContentText();
}

function hoodlefinanceExtractIsin_(text) {
  const match = String(text || "").match(/ISIN[\s\S]{0,200}?([A-Z]{2}[A-Z0-9]{9}[0-9])/i);
  return match ? match[1].toUpperCase() : "";
}

function hoodlefinanceResolveIsin_(isin) {
  if (!hoodlefinanceLooksLikeIsin_(isin)) {
    throw new Error('ISIN "' + isin + '" is invalid.');
  }

  const cache = CacheService.getScriptCache();
  const cacheKey = "hoodlefinance:isin:" + isin;
  const cached = cache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const response = UrlFetchApp.fetch(
    "https://query2.finance.yahoo.com/v1/finance/search?q=" + encodeURIComponent(isin) + "&quotesCount=10&newsCount=0",
    {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept-Language": "en-US,en;q=0.9"
      },
      muteHttpExceptions: true,
    }
  );

  if (response.getResponseCode() !== 200) {
    throw new Error('ISIN lookup failed for "' + isin + '" (' + response.getResponseCode() + ").");
  }

  const payload = JSON.parse(response.getContentText());
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

  cache.put(cacheKey, symbol, 21600);
  return symbol;
}

function hoodlefinanceLooksLikeIsin_(value) {
  return /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/i.test(String(value).trim());
}
