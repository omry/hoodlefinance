
const HOODLEFINANCE_SUPPORTED_ATTRIBUTES_ = {
  currency: function (quote) {
    return hoodlefinanceNormalizeCurrency_(quote.currency || quote.financialCurrency || "");
  },
  datadelay: function (quote) {
    return quote.exchangeDataDelayedBy != null ? quote.exchangeDataDelayedBy : 0;
  },
  close: function (quote) {
    return hoodlefinanceNormalizeMoney_(quote, hoodlefinancePreviousClose_(quote));
  },
  closeyest: function (quote) {
    return hoodlefinanceNormalizeMoney_(quote, hoodlefinancePreviousClose_(quote));
  },
  high: function (quote) {
    return hoodlefinanceNormalizeMoney_(quote, quote.regularMarketDayHigh);
  },
  low: function (quote) {
    return hoodlefinanceNormalizeMoney_(quote, quote.regularMarketDayLow);
  },
  isin: function (quote, context) {
    if (quote && quote.isin) {
      return String(quote.isin).toUpperCase();
    }
    return hoodlefinanceResolveIbkrIsin_(quote, context);
  },
  name: function (quote) {
    return quote.longName || quote.shortName || quote.displayName || quote.symbol || "";
  },
  open: function (quote) {
    return hoodlefinanceNormalizeMoney_(quote, quote.regularMarketOpen);
  },
  price: function (quote) {
    return hoodlefinanceNormalizeMoney_(quote, hoodlefinancePickPrice_(quote));
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
  SHA: ".SS",
  SHE: ".SZ",
  SIX: ".SW",
  STO: ".ST",
  SWX: ".SW",
  TPE: ".TW",
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
  SHA: "",
  SHE: "",
  SIX: "EBS",
  STO: "SFB",
  SWX: "EBS",
  TPE: "TSE",
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
  SA: "BOVESPA",
  SS: "",
  ST: "SFB",
  SW: "EBS",
  SZ: "",
  T: "TSEJ",
  TO: "TSE",
  TW: "TSE",
  V: "VENTURE",
  VI: "VSE",
  WA: "WSE",
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
 * - "isin"
 * - "open"
 * - "close"
 * - "closeyest"
 * - "changepct"
 * - "change"
 *
 * Examples:
 *   =HOODLEFINANCE("NASDAQ:GOOG")
 *   =HOODLEFINANCE("NASDAQ:GOOG", "price")
 *   =HOODLEFINANCE("NYSE:IBM", "name")
 *   =HOODLEFINANCE("CURRENCY:USDEUR", "price")
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

function hoodlefinanceFetchQuote_(ticker) {
  const normalizedTicker = String(ticker).trim();

  if (hoodlefinanceIsPseTicker_(normalizedTicker)) {
    return hoodlefinanceFetchPseQuote_(normalizedTicker);
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
  const ibkrIsin = hoodlefinanceResolveIsinFromIbkrSymbol_(symbol, preferredExchange);

  if (ibkrIsin) {
    return ibkrIsin;
  }

  throw new Error("No IBKR ISIN is available for this ticker.");
}

function hoodlefinanceExtractQuoteSymbol_(quote) {
  return quote && quote.symbol ? String(quote.symbol).trim().toUpperCase() : "";
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
  let i;
  let isin;

  if (!lookupSymbol) {
    return "";
  }

  if (cached) {
    return cached;
  }

  searchUrls = hoodlefinanceBuildIbkrSearchUrls_(lookupSymbol, preferredExchange);

  for (i = 0; i < searchUrls.length; i += 1) {
    detailEntries = hoodlefinanceExtractIbkrDetailUrls_(hoodlefinanceFetchText_(searchUrls[i]));
    hoodlefinanceSortIbkrDetailEntries_(detailEntries, preferredExchange);

    isin = hoodlefinanceResolveIbkrIsinFromDetailEntries_(detailEntries);
    if (isin) {
      cache.put(cacheKey, isin, 21600);
      return isin;
    }
  }

  return "";
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
