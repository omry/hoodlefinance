const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");

const PSE_SEARCH_AAA_HTML = `
<tbody>
  <tr>
      <td><a href="#company" onclick="cmDetail('55','347');return false;">Asia Amalgamated Holdings Corporation</a></td>
      <td class="alignC"><a href="#company" onclick="cmDetail('55','347');return false;">AAA</a></td>
      <td>Holding Firms</td>
      <td>Holding Firms</td>
      <td class="alignC">Mar 22, 1973</td>
    </tr>
  </tbody>
`;

const PSE_SEARCH_AC_HTML = `
<tbody>
  <tr>
      <td><a href="#company" onclick="cmDetail('174','173');return false;">AbaCore Capital Holdings, Inc.</a></td>
      <td class="alignC"><a href="#company" onclick="cmDetail('174','173');return false;">ABA</a></td>
  </tr>
  <tr>
      <td><a href="#company" onclick="cmDetail('57','180');return false;">Ayala Corporation</a></td>
      <td class="alignC"><a href="#company" onclick="cmDetail('57','180');return false;">AC</a></td>
  </tr>
  <tr>
      <td><a href="#company" onclick="cmDetail('233','140');return false;">ACEN CORPORATION</a></td>
      <td class="alignC"><a href="#company" onclick="cmDetail('233','140');return false;">ACEN</a></td>
  </tr>
  </tbody>
`;

const PSE_SEARCH_BDO_HTML = `
<tbody>
  <tr>
      <td><a href="#company" onclick="cmDetail('260','468');return false;">BDO Unibank, Inc.</a></td>
      <td class="alignC"><a href="#company" onclick="cmDetail('260','468');return false;">BDO</a></td>
      <td>Banking</td>
      <td>Universal Banks</td>
      <td class="alignC">Dec 19, 1969</td>
    </tr>
  </tbody>
`;

const PSE_STOCK_AAA_HTML = `
<div class="compInfo">
  <p style="">Asia Amalgamated Holdings Corporation</p>
</div>
<form name="form1" action="/companyPage/stockData.do">
  <input type="hidden" name="cmpy_id" value="55"/>
  <select name="security_id" onchange="document.form1.submit();">
<option value="347" selected>AAA</option>
</select>
  <span style="margin-left:1em;">As of Mar 10, 2026 02:50 PM</span>
</form>
<table class="view">
<tr><th>ISIN</th><td>PHY030431175</td></tr>
</table>
<table class="view">
<tr>
  <th>Last Traded Price</th>
  <td style="text-align:right;padding-right:1.2em;"></td>
  <th>Open</th>
  <td style="text-align:right;padding-right:1.2em;"></td>
  <th>Previous Close and Date</th>
  <td style="text-align:right;padding-right:1.2em;">1.63 (May 15, 2015)</td>
</tr>
<tr>
  <th>Change(% Change)</th>
  <td style="text-align:right;padding-right:1.2em;">down&nbsp; (%)</td>
  <th>High</th>
  <td style="text-align:right;padding-right:1.2em;"></td>
</tr>
<tr>
  <th>Value</th>
  <td style="text-align:right;padding-right:1.2em;"></td>
  <th>Low</th>
  <td style="text-align:right;padding-right:1.2em;"></td>
</tr>
<tr>
  <th>Volume</th>
  <td style="text-align:right;padding-right:1.2em;"></td>
  <th>Average Price</th>
  <td style="text-align:right;padding-right:1.2em;"></td>
</tr>
</table>
`;

const PSE_STOCK_BDO_HTML = `
<div class="compInfo">
  <p style="">BDO Unibank, Inc.</p>
</div>
<form name="form1" action="/companyPage/stockData.do">
  <input type="hidden" name="cmpy_id" value="260"/>
  <select name="security_id" onchange="document.form1.submit();">
<option value="468" selected>BDO</option>
</select>
  <span style="margin-left:1em;">As of Mar 10, 2026 02:50 PM</span>
</form>
<table class="view">
<tr><th>ISIN</th><td>PHY077751022</td></tr>
</table>
<table class="view">
<tr>
  <th>Last Traded Price</th>
  <td style="text-align:right;padding-right:1.2em;">123.80</td>
  <th>Open</th>
  <td style="text-align:right;padding-right:1.2em;">122.20</td>
  <th>Previous Close and Date</th>
  <td style="text-align:right;padding-right:1.2em;">120.20 (Mar 09, 2026)</td>
</tr>
<tr>
  <th>Change(% Change)</th>
  <td style="text-align:right;padding-right:1.2em;">up&nbsp; 3.60 (3.00%)</td>
  <th>High</th>
  <td style="text-align:right;padding-right:1.2em;">124.20</td>
</tr>
<tr>
  <th>Value</th>
  <td style="text-align:right;padding-right:1.2em;">423,192,092.00</td>
  <th>Low</th>
  <td style="text-align:right;padding-right:1.2em;">122.20</td>
</tr>
<tr>
  <th>Volume</th>
  <td style="text-align:right;padding-right:1.2em;">3,435,630</td>
  <th>Average Price</th>
  <td style="text-align:right;padding-right:1.2em;">123.18</td>
</tr>
</table>
`;

const PSE_HTTP_520_TEXT = "error code: 520";

const PSE_ISIN_MAP_PROPERTIES = `
# PSE ISIN to ticker map
# updated_at=2026-03-13T18:34:56.295Z
PHY077751022=PSE:BDO
`;

const CURRENCY_CODES_JSON = JSON.stringify({
  source: {
    name: "ISO 4217 List One",
    publisher: "SIX Group",
    published: "2026-01-01",
  },
  cryptoCodes: ["ADA", "BCH", "BNB", "BTC", "ETH", "LTC", "SOL", "XRP"],
  canonicalCodes: ["CHF", "EUR", "GBP", "ILS", "PHP", "USD"],
  aliases: {
    GBX: {
      canonicalCode: "GBP",
      factor: 0.01,
    },
    GBp: {
      canonicalCode: "GBP",
      factor: 0.01,
    },
    ILA: {
      canonicalCode: "ILS",
      factor: 0.01,
    },
  },
}, null, 2);

const LON_SEARCH_SJPA_HTML = `
<tbody>
  <tr class="medium-font-weight slide-panel">
    <td>SJPA</td>
    <td class="clickable td-with-link"><a class="dash-link blue-text bold-font-weight" href="javascript: UpdateOpener('ISHARES III PLC ISHRS CORE MSCI JAPAN IMI ETF USD (ACC)', '						IE00B4L5YX21|ZZ|GBX|EUE2|B4L61L2|SJPA
');" title="Select">ISHARES III PLC ISHRS CORE MSCI JAPAN IMI ETF USD (ACC)</a></td>
  </tr>
</tbody>
`;

const LON_SEARCH_CPXJ_HTML = `
<tbody>
  <tr class="medium-font-weight slide-panel">
    <td>CPJ1</td>
    <td class="clickable td-with-link"><a class="dash-link blue-text bold-font-weight" href="javascript: UpdateOpener('ISHARES VII PLC MSCI PACIFIC EX-JAPAN ETF GBP ACC', '						IE00B52MJY50|ZZ|GBX|EUE2|B580X30|CPJ1
');" title="Select">ISHARES VII PLC MSCI PACIFIC EX-JAPAN ETF GBP ACC</a></td>
  </tr>
  <tr class="medium-font-weight slide-panel">
    <td>CPXJ</td>
    <td class="clickable td-with-link"><a class="dash-link blue-text bold-font-weight" href="javascript: UpdateOpener('ISHARES VII PLC MSCI PACIFIC EX-JAPAN ETF USD ACC', '						IE00B52MJY50|IE|USD|EUET|B4ZYLW3|CPXJ
');" title="Select">ISHARES VII PLC MSCI PACIFIC EX-JAPAN ETF USD ACC</a></td>
  </tr>
</tbody>
`;

const ARIVA_SEARCH_ZPRV_HTML = `
<div class="LSResultOut" onmouseout="checkLiveSearchMouseOut(event)">
<table class="line" id="overDivLive">
  <tr id="liveSearchRow1" class="liveSearchRow" onmouseover="liveSearchSelectRow(1)" onclick="liveSearchSubmit(1)">
    <td class="liveSearchLinkText ellipsis">
      <a href="/fonds/spdr-msci-usa-small-cap-value-weighted-ucits-etf" onclick="return false;" id="liveSearchLink1"><span class="liveSearchMark">ZPRV</span>F (SPDR MSCI USA Small Cap Valu.)</a>
    </td>
    <td>Fonds</td>
    <td class="right searches_num">6</td>
  </tr>
</table>
</div>
`;

const ARIVA_DETAIL_ZPRV_HTML = `
<!DOCTYPE html>
<html lang="de">
<head>
  <title>SPDR MSCI USA Small Cap Value Weighted UCITS ETF Kurs - WKN A12HU5, ISIN IE00BSPLC413 - ARIVA.DE</title>
  <link rel="canonical" href="https://www.ariva.de/etf/spdr-msci-usa-small-cap-value-weighted-ucits-etf">
</head>
<body>
  <span class="key">ISIN:&nbsp;</span> <span class="value">IE00BSPLC413</span>
  <span class="app-dropdown--state IE00BSPLC413">Xetra</span>
</body>
</html>
`;

const TRADINGVIEW_XETR_ZPRX_HTML = `
<script>
window.initData = {};
window.initData.symbolInfo = {"resolved_symbol":"XETR:ZPRX","isin_displayed":"IE00BSPLC298","exchange":"XETR","short_name":"ZPRX"};
</script>
`;

const TRADINGVIEW_LSE_SJPA_HTML = `
<script>
window.initData = {};
window.initData.symbolInfo = {"resolved_symbol":"LSE:SJPA","isin_displayed":"IE00B4L5YX21","exchange":"LSE","short_name":"SJPA"};
</script>
`;

const TRADINGVIEW_NASDAQ_GOOG_HTML = `
<script>
window.initData = {};
window.initData.symbolInfo = {"resolved_symbol":"NASDAQ:GOOG","isin_displayed":"US02079K1079","exchange":"NASDAQ","short_name":"GOOG"};
</script>
`;

const TRADINGVIEW_AMEX_AVLV_HTML = `
<script>
window.initData = {};
window.initData.symbolInfo = {"resolved_symbol":"AMEX:AVLV","isin_displayed":"US05351W1036","exchange":"AMEX","short_name":"AVLV"};
</script>
`;

const TRADINGVIEW_OTC_RYCEY_HTML = `
<script>
window.initData = {};
window.initData.symbolInfo = {"resolved_symbol":"OTC:RYCEY","isin_displayed":"US7757812067","exchange":"OTC","short_name":"RYCEY"};
</script>
`;

const TRADINGVIEW_TASE_POLI_HTML = `
<script>
window.initData = {};
window.initData.symbolInfo = {"resolved_symbol":"TASE:POLI","isin_displayed":"IL0006625771","exchange":"TASE","short_name":"POLI"};
</script>
`;

const TRADINGVIEW_TASE_KSM_F59_HTML = `
<script>
window.initData = {};
window.initData.symbolInfo = {"resolved_symbol":"TASE:KSM.F59","isin_displayed":"IL0011465700","exchange":"TASE","short_name":"KSM.F59","description":"KSM ETF (4A) TA-35 Units","currency":"ILA","currency_code":"ILA"};
</script>
<script type="application/ld+json">
{"mainEntity":[{"name":"What is KSM.F59 price?","acceptedAnswer":{"text":"KSM.F59 trades at 40,560 ILA today, its price has fallen -1.43% in the past 24 hours."}}]}
</script>
`;

const TRADINGVIEW_SGX_D05_HTML = `
<script>
window.initData = {};
window.initData.symbolInfo = {"resolved_symbol":"SGX:D05","isin_displayed":"SG1L01001701","exchange":"SGX","short_name":"D05"};
</script>
`;

const TRADINGVIEW_NEO_ZTL_HTML = `
<script>
window.initData = {};
window.initData.symbolInfo = {"resolved_symbol":"NEO:ZTL","isin_displayed":"CA05582Y1007","exchange":"NEO","short_name":"ZTL"};
</script>
`;

const IBKR_MODERN_SEARCH_HTML = `
<tr class="odd">
<td><a href="javascript:showDetails('90581046')">Details</a></td>
<td><div style="padding-left:10px;"><b>ISHARES MSCI JAPAN SMALL CAP</b></div></td>
<td>Stock</td>
<td onmouseover="Tip('Conid: 90581046')" onmouseout="UnTip()">ISJP</td>
<td onmouseover="Tip('<b>EBS</b>, BATECH', TITLE, 'All Available Exchanges')" onmouseout="UnTip()">EBS</td>
<td>Exchange-Traded Fund (ETF)</th>
<td align="right">8,677.0</td>
<td>JPY</td>
</tr>
<tr class="even">
<td><a href="javascript:showDetails('208813720')">Details</a></td>
<td><div style="padding-left:10px;"><b>Google Inc.</b></div></td>
<td>Stock</td>
<td onmouseover="Tip('Conid: 208813720')" onmouseout="UnTip()">GOOG</td>
<td onmouseover="Tip('<b>NASDAQ</b>, AMEX', TITLE, 'All Available Exchanges')" onmouseout="UnTip()">NASDAQ</td>
<td>Common</th>
<td align="right">306.01</td>
<td>USD</td>
</tr>
`;

const IBKR_CAPTCHA_HTML = `
</form>

<br>
<form type="post">
To continue please enter the text from the image below
<br>
<img src="image.php?str=79BQ2A">
<br>
Text: <input type="text" name="filter">
</form>
`;

function loadHoodlefinance() {
const source = fs.readFileSync(path.join(__dirname, "..", "hoodlefinance.js"), "utf8");
  const cacheStore = new Map();
  const scriptPropertiesStore = new Map();
  const userPropertiesStore = new Map();
  const uiState = {
    alerts: [],
    dialogs: [],
    menus: [],
  };
  const ui = {
    ButtonSet: {
      OK: "OK",
    },
    alert() {
      uiState.alerts.push(Array.from(arguments));
      return "OK";
    },
    createMenu(name) {
      const items = [];
      return {
        addItem(label, functionName) {
          items.push({ functionName, label, type: "item" });
          return this;
        },
        addSeparator() {
          items.push({ type: "separator" });
          return this;
        },
        addToUi() {
          uiState.menus.push({ items: items.slice(), name });
        },
      };
    },
    showModalDialog(output, title) {
      uiState.dialogs.push({ output, title });
    },
  };
  const urlFetchApp = {
    fetch() {
      throw new Error("Unexpected fetch in test");
    },
    fetchAll(requests) {
      return requests.map((request) => this.fetch(typeof request === "string" ? request : request.url, request));
    },
  };
  const sandbox = {
    console,
    Date,
    JSON,
    encodeURIComponent,
    decodeURIComponent,
    Array,
    String,
    Object,
    RegExp,
    Error,
    Map,
    __uiState: uiState,
    __scriptCacheStore: cacheStore,
    __scriptPropertiesStore: scriptPropertiesStore,
    __userPropertiesStore: userPropertiesStore,
    CacheService: {
      getScriptCache() {
        return {
          get(key) {
            return cacheStore.has(key) ? cacheStore.get(key) : null;
          },
          put(key, value) {
            cacheStore.set(key, value);
          },
        };
      },
    },
    PropertiesService: {
      getScriptProperties() {
        return {
          deleteProperty(key) {
            scriptPropertiesStore.delete(key);
          },
          getProperty(key) {
            return scriptPropertiesStore.has(key) ? scriptPropertiesStore.get(key) : null;
          },
          setProperty(key, value) {
            scriptPropertiesStore.set(key, String(value));
          },
        };
      },
      getUserProperties() {
        return {
          deleteProperty(key) {
            userPropertiesStore.delete(key);
          },
          getProperty(key) {
            return userPropertiesStore.has(key) ? userPropertiesStore.get(key) : null;
          },
          setProperty(key, value) {
            userPropertiesStore.set(key, String(value));
          },
        };
      },
    },
    SpreadsheetApp: {
      getUi() {
        return ui;
      },
    },
    HtmlService: {
      createHtmlOutput(content) {
        return {
          content,
          height: null,
          width: null,
          setHeight(value) {
            this.height = value;
            return this;
          },
          setWidth(value) {
            this.width = value;
            return this;
          },
        };
      },
    },
    UrlFetchApp: urlFetchApp,
  };

  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: "hoodlefinance.js" });
  return sandbox;
}

function createHttpResponse(statusCode, content) {
  return {
    getResponseCode() {
      return statusCode;
    },
    getContentText() {
      return typeof content === "string" ? content : JSON.stringify(content);
    },
  };
}

function createYahooChartResponse(symbol, meta) {
  return createHttpResponse(200, {
    chart: {
      result: [
        {
          meta: Object.assign({ symbol }, meta || {}),
        },
      ],
    },
  });
}

function createGoogleFinancePairHtml(pairSlug, title, marketData, previousClose, timestamp, pairDetail) {
  return [
    "<html><body>",
    "<script>",
    "AF_initDataCallback({key: 'ds:17', hash: '3', data:[[[[",
    JSON.stringify([
      "/g/test-pair",
      null,
      title,
      3,
      null,
      marketData,
      null,
      previousClose,
      null,
      null,
      null,
      [timestamp],
      null,
      0,
      "/g/test-pair",
      pairDetail,
      null,
      [timestamp],
      null,
      null,
      null,
      pairSlug,
      null,
      null,
      2,
    ]),
    "]]]], sideChannel: {}});",
    "</script>",
    "</body></html>",
  ].join("");
}

function createYahooIsinSearchResponse(symbol) {
  return createHttpResponse(200, {
    quotes: [
      {
        isYahooFinance: true,
        symbol,
      },
    ],
  });
}

function primeCurrencyCodeData(ctx, fetchedAtMs) {
  ctx.__scriptPropertiesStore.set("hoodlefinance.currencyCodes", CURRENCY_CODES_JSON);
  ctx.__scriptPropertiesStore.set(
    "hoodlefinance.currencyCodesFetchedAtMs",
    String(fetchedAtMs == null ? new Date().getTime() : fetchedAtMs)
  );
}

test("normalizes GOOGLEFINANCE-style tickers to Yahoo symbols", () => {
  const ctx = loadHoodlefinance();
  primeCurrencyCodeData(ctx);

  assert.equal(ctx.hoodlefinanceNormalizeTicker_("LON:ISJP"), "ISJP.L");
  assert.equal(ctx.hoodlefinanceNormalizeTicker_("ETR:ZPRX"), "ZPRX.DE");
  assert.equal(ctx.hoodlefinanceNormalizeTicker_("NEO:ZTL"), "ZTL.NE");
  assert.equal(ctx.hoodlefinanceNormalizeTicker_("SGX:D05"), "D05.SI");
  assert.equal(ctx.hoodlefinanceNormalizeTicker_("TLV:POLI"), "POLI.TA");
  assert.equal(ctx.hoodlefinanceNormalizeTicker_("TLV:KSM.F59"), "KSM.F59.TA");
  assert.equal(ctx.hoodlefinanceNormalizeTicker_("TLV:KSMF59"), "KSM.F59.TA");
  assert.equal(ctx.hoodlefinanceNormalizeTicker_("TASE:KSMF59"), "KSM.F59.TA");
  assert.equal(ctx.hoodlefinanceNormalizeTicker_("NASDAQ:GOOG"), "GOOG");
  assert.equal(ctx.hoodlefinanceNormalizeTicker_("USDPHP"), "USDPHP=X");
  assert.equal(ctx.hoodlefinanceNormalizeTicker_("BTCUSD"), "BTCUSD=X");
  assert.equal(ctx.hoodlefinanceNormalizeTicker_("CURRENCY:ETHUSD"), "ETHUSD=X");
  assert.equal(ctx.hoodlefinanceNormalizeTicker_("GBpUSD"), "GBPUSD=X");
  assert.equal(ctx.hoodlefinanceNormalizeTicker_("USDILA"), "USDILS=X");
  assert.equal(ctx.hoodlefinanceNormalizeTicker_("CURRENCY:EURUSD"), "EURUSD=X");
  assert.equal(ctx.hoodlefinanceNormalizeTicker_("CURRENCY:USDUSD"), "USDUSD=X");
  assert.equal(ctx.hoodlefinanceNormalizeTicker_("FOOUSD"), "FOOUSD");
});

test("4-character crypto tickers do not parse as currency pairs", () => {
  const ctx = loadHoodlefinance();
  primeCurrencyCodeData(ctx);

  assert.equal(ctx.hoodlefinanceNormalizeTicker_("DOGEUSD"), "DOGEUSD");
  assert.equal(ctx.hoodlefinanceNormalizeTicker_("USDTUSD"), "USDTUSD");
});

test("source overrides are parsed separately from ticker normalization", () => {
  const ctx = loadHoodlefinance();
  primeCurrencyCodeData(ctx);

  assert.equal(ctx.hoodlefinanceExtractTickerSourceOverride_("BTCUSD@YAHOO"), "YAHOO");
  assert.equal(ctx.hoodlefinanceExtractTickerSourceOverride_("GOOG@IBKR"), "IBKR");
  assert.equal(ctx.hoodlefinanceExtractTickerSourceOverride_("BTCUSD@MYSTERY"), "");
  assert.equal(ctx.hoodlefinanceExtractTickerInfoMode_("BTCUSD@?"), "source-name");
  assert.equal(ctx.hoodlefinanceExtractTickerInfoMode_("BTCUSD@"), "source-list");
  assert.equal(ctx.hoodlefinanceExtractTickerInfoMode_("BTCUSD@MYSTERY"), "source-list");
  assert.equal(ctx.hoodlefinanceNormalizeTicker_("BTCUSD@YAHOO"), "BTCUSD=X");
  assert.equal(ctx.hoodlefinanceStripTickerSourceOverride_("ISIN:US02079K1079@YAHOO"), "ISIN:US02079K1079");
});

test("source introspection suffixes return the deduced source or the supported source list", () => {
  const ctx = loadHoodlefinance();
  primeCurrencyCodeData(ctx);

  assert.equal(ctx.HOODLEFINANCE("BTCUSD@?"), "GOOGLE");
  assert.equal(ctx.HOODLEFINANCE("EURUSD@?"), "GOOGLE");
  assert.equal(ctx.HOODLEFINANCE("PSE:AAA@?"), "PSE");
  assert.equal(ctx.HOODLEFINANCE("USDUSD@?"), "LOCAL");
  assert.equal(ctx.HOODLEFINANCE("BTCUSD@"), "ARIVA, GOOGLE, IBKR, LON, PSE, TRADINGVIEW, YAHOO");
  assert.equal(ctx.HOODLEFINANCE("BTCUSD@MYSTERY"), "ARIVA, GOOGLE, IBKR, LON, PSE, TRADINGVIEW, YAHOO");
});

test("normalizes Yahoo-style Israeli fund tickers to canonical dotted forms", () => {
  const ctx = loadHoodlefinance();

  assert.equal(ctx.hoodlefinanceNormalizeTicker_("KSMF59.TA"), "KSM.F59.TA");
  assert.equal(ctx.hoodlefinanceNormalizeTicker_("KSM.F59.TA"), "KSM.F59.TA");
});

test("resolves Philippine ISIN input directly to a mapped PSE ticker without Yahoo search", () => {
  const ctx = loadHoodlefinance();
  const seenUrls = [];

  ctx.UrlFetchApp.fetch = function (url) {
    seenUrls.push(url);

    if (url === "https://raw.githubusercontent.com/omry/hoodlefinance/main/data/pse-isin-map.properties") {
      return createHttpResponse(200, PSE_ISIN_MAP_PROPERTIES);
    }

    throw new Error("Unexpected URL " + url);
  };

  assert.equal(ctx.hoodlefinanceResolveIsin_("PHY077751022"), "PSE:BDO");
  assert.deepEqual(seenUrls, ["https://raw.githubusercontent.com/omry/hoodlefinance/main/data/pse-isin-map.properties"]);
  assert.equal(
    ctx.__scriptPropertiesStore.get("hoodlefinance.pseIsinMap") != null,
    true
  );
});

test("reuses the cached GitHub PSE ISIN map without downloading it again while fresh", () => {
  const ctx = loadHoodlefinance();

  ctx.__scriptPropertiesStore.set(
    "hoodlefinance.pseIsinMap",
    JSON.stringify({
      fetchedAtMs: new Date().getTime(),
      text: PSE_ISIN_MAP_PROPERTIES,
    })
  );

  ctx.UrlFetchApp.fetch = function (url) {
    throw new Error("Unexpected URL " + url);
  };

  assert.equal(ctx.hoodlefinanceResolveIsin_("PHY077751022"), "PSE:BDO");
});

test("redownloads the GitHub PSE ISIN map after the 24-hour refresh window expires", () => {
  const ctx = loadHoodlefinance();
  const seenUrls = [];

  ctx.__scriptPropertiesStore.set(
    "hoodlefinance.pseIsinMap",
    JSON.stringify({
      fetchedAtMs: new Date().getTime() - (25 * 60 * 60 * 1000),
      text: "# old\nPHY077751022=PSE:OLD\n",
    })
  );

  ctx.UrlFetchApp.fetch = function (url) {
    seenUrls.push(url);

    if (url === "https://raw.githubusercontent.com/omry/hoodlefinance/main/data/pse-isin-map.properties") {
      return createHttpResponse(200, PSE_ISIN_MAP_PROPERTIES);
    }

    throw new Error("Unexpected URL " + url);
  };

  assert.equal(ctx.hoodlefinanceResolveIsin_("PHY077751022"), "PSE:BDO");
  assert.deepEqual(seenUrls, ["https://raw.githubusercontent.com/omry/hoodlefinance/main/data/pse-isin-map.properties"]);
});

test("downloads and caches currency code data from GitHub", () => {
  const ctx = loadHoodlefinance();
  const seenUrls = [];

  ctx.UrlFetchApp.fetch = function (url) {
    seenUrls.push(url);

    if (url === "https://raw.githubusercontent.com/omry/hoodlefinance/main/data/currency-codes.json") {
      return createHttpResponse(200, CURRENCY_CODES_JSON);
    }

    throw new Error("Unexpected URL " + url);
  };

  assert.equal(ctx.hoodlefinanceResolveCurrencyUnit_("USD").canonicalCode, "USD");
  assert.equal(ctx.hoodlefinanceResolveCurrencyUnit_("GBp").canonicalCode, "GBP");
  assert.deepEqual(
    seenUrls,
    ["https://raw.githubusercontent.com/omry/hoodlefinance/main/data/currency-codes.json"]
  );
  assert.equal(
    ctx.__scriptPropertiesStore.get("hoodlefinance.currencyCodes") != null,
    true
  );
  assert.equal(
    ctx.__scriptPropertiesStore.get("hoodlefinance.currencyCodesFetchedAtMs") != null,
    true
  );
  assert.equal(
    ctx.__scriptCacheStore.has("hoodlefinance:v" + ctx.HOODLEFINANCE_VERSION() + ":currencyCodes"),
    true
  );
});

test("reuses the cached GitHub currency code data without downloading it again while fresh", () => {
  const ctx = loadHoodlefinance();
  primeCurrencyCodeData(ctx);

  ctx.UrlFetchApp.fetch = function (url) {
    throw new Error("Unexpected URL " + url);
  };

  assert.equal(ctx.hoodlefinanceResolveCurrencyUnit_("USD").canonicalCode, "USD");
  assert.equal(ctx.hoodlefinanceResolveCurrencyUnit_("ILA").canonicalCode, "ILS");
});

test("same-currency FX pairs short-circuit to 1 without a fetch", () => {
  const ctx = loadHoodlefinance();
  primeCurrencyCodeData(ctx);

  ctx.UrlFetchApp.fetch = function () {
    throw new Error("Fetch should not run for same-currency FX pairs");
  };

  assert.equal(ctx.HOODLEFINANCE("USDUSD", "price"), 1);
  assert.equal(ctx.HOODLEFINANCE("CURRENCY:USDUSD", "price"), 1);
  assert.equal(ctx.HOODLEFINANCE("CURRENCY:USDUSD", "currency"), "USD");
  assert.equal(ctx.HOODLEFINANCE("GBPGBp", "price"), 100);
  assert.equal(ctx.HOODLEFINANCE("GBPGBp", "currency"), "GBp");
  assert.equal(ctx.HOODLEFINANCE("GBpGBP", "price"), 0.01);
  assert.equal(ctx.HOODLEFINANCE("GBpGBP", "currency"), "GBP");
});

test("currency pairs fetch rates from Google Finance quote pages", () => {
  const ctx = loadHoodlefinance();
  primeCurrencyCodeData(ctx);
  const seenUrls = [];

  ctx.UrlFetchApp.fetchAll = function () {
    throw new Error("Unexpected batch fetch");
  };
  ctx.UrlFetchApp.fetch = function (url) {
    seenUrls.push(url);

    if (url === "https://www.google.com/finance/quote/BTC-USD") {
      return createHttpResponse(
        200,
        createGoogleFinancePairHtml(
          "BTC-USD",
          "Bitcoin (BTC / USD)",
          [71785.7177, 572.0383, 0.8032702, 2, 2, 2],
          71213.67940000001,
          1773599520,
          ["BTC", "USD", "Bitcoin", "United States Dollar", "/m/05p0rrx", "/m/09nqf", 2]
        )
      );
    }

    if (url === "https://www.google.com/finance/quote/ETH-USD") {
      return createHttpResponse(
        200,
        createGoogleFinancePairHtml(
          "ETH-USD",
          "Ether (ETH / USD)",
          [2110.6139, 13.0525, 0.6222702, 2, 2, 2],
          2097.5614,
          1773599460,
          ["ETH", "USD", "Ether", "United States Dollar", "/g/11ggdwqycn", "/m/09nqf", 2]
        )
      );
    }

    if (url === "https://www.google.com/finance/quote/SOL-USD") {
      return createHttpResponse(
        200,
        createGoogleFinancePairHtml(
          "SOL-USD",
          "Solana (SOL / USD)",
          [88.589, 0.5186, 0.5888471, 4, 4, 2],
          88.0704,
          1773599460,
          ["SOL", "USD", "Solana", "United States Dollar", "/g/11t6zrj6w7", "/m/09nqf", 2]
        )
      );
    }

    if (url === "https://www.google.com/finance/quote/XRP-USD") {
      return createHttpResponse(
        200,
        createGoogleFinancePairHtml(
          "XRP-USD",
          "XRP (XRP / USD)",
          [1.42, 0.03, 2.15, 2, 2, 2],
          1.39,
          1773599400,
          ["XRP", "USD", "XRP", "United States Dollar", "/g/11f3vb3vts", "/m/09nqf", 2]
        )
      );
    }

    if (url === "https://www.google.com/finance/quote/PHP-ILS") {
      return createHttpResponse(
        200,
        createGoogleFinancePairHtml(
          "PHP-ILS",
          "Philippine Peso (PHP / ILS)",
          [0.0522947672, -0.0005022859, -0.95135215, 4, 4, 2],
          0.0527970531,
          1773656600,
          ["PHP", "ILS", "Philippine Peso", "Israeli New Shekel", "/m/05sry", "/m/03qgx5", 2]
        )
      );
    }

    throw new Error("Unexpected URL " + url);
  };

  assert.equal(ctx.HOODLEFINANCE("BTCUSD", "price"), 71785.7177);
  assert.equal(ctx.HOODLEFINANCE("BTCUSD", "currency"), "USD");
  assert.equal(ctx.HOODLEFINANCE("BTCUSD", "name"), "BTCUSD");
  assert.equal(ctx.HOODLEFINANCE("BTCUSD", "symbol"), "CURRENCY:BTCUSD");
  assert.equal(ctx.HOODLEFINANCE("BTCUSD", "symbol:yahoo"), "BTCUSD=X");
  assert.equal(ctx.HOODLEFINANCE("BTCUSD", "close"), 71213.67940000001);
  assert.equal(ctx.HOODLEFINANCE("CURRENCY:ETHUSD", "price"), 2110.6139);
  assert.equal(ctx.HOODLEFINANCE("SOLUSD", "price"), 88.589);
  assert.equal(ctx.HOODLEFINANCE("XRPUSD", "price"), 1.42);
  assert.equal(ctx.HOODLEFINANCE("PHPILS", "price"), 0.0522947672);
  assert.equal(ctx.HOODLEFINANCE("PHPILS", "currency"), "ILS");
  assert.equal(ctx.HOODLEFINANCE("PHPILS", "close"), 0.0527970531);
  assert.ok(Math.abs(ctx.HOODLEFINANCE("PHPILS", "change") - (-0.0005022859)) < 1e-15);
  assert.ok(Math.abs(ctx.HOODLEFINANCE("PHPILS", "changepct") - (-0.009513521503722018)) < 1e-15);
  assert.deepEqual(seenUrls, [
    "https://www.google.com/finance/quote/BTC-USD",
    "https://www.google.com/finance/quote/ETH-USD",
    "https://www.google.com/finance/quote/SOL-USD",
    "https://www.google.com/finance/quote/XRP-USD",
    "https://www.google.com/finance/quote/PHP-ILS",
  ]);
});

test("Google-quoted FX pairs fail clearly for attributes the page does not expose", () => {
  const ctx = loadHoodlefinance();
  primeCurrencyCodeData(ctx);

  ctx.UrlFetchApp.fetchAll = function () {
    throw new Error("Unexpected batch fetch");
  };
  ctx.UrlFetchApp.fetch = function (url) {
    assert.equal(url, "https://www.google.com/finance/quote/PHP-ILS");
    return createHttpResponse(
      200,
      createGoogleFinancePairHtml(
        "PHP-ILS",
        "Philippine Peso (PHP / ILS)",
        [0.0522947672, -0.0005022859, -0.95135215, 4, 4, 2],
        0.0527970531,
        1773656600,
        ["PHP", "ILS", "Philippine Peso", "Israeli New Shekel", "/m/05sry", "/m/03qgx5", 2]
      )
    );
  };

  assert.throws(
    () => ctx.HOODLEFINANCE("PHPILS", "high"),
    /No value is available for this ticker\./
  );
  assert.throws(
    () => ctx.HOODLEFINANCE("PHPILS", "low"),
    /No value is available for this ticker\./
  );
  assert.throws(
    () => ctx.HOODLEFINANCE("PHPILS", "volume"),
    /No volume is available for this ticker\./
  );
});

test("forced Yahoo source routes crypto FX pairs through Yahoo chart lookups", () => {
  const ctx = loadHoodlefinance();
  primeCurrencyCodeData(ctx);
  const seenBatches = [];

  ctx.UrlFetchApp.fetch = function () {
    throw new Error("Unexpected direct fetch");
  };
  ctx.UrlFetchApp.fetchAll = function (requests) {
    seenBatches.push(requests.map((request) => request.url));
    return requests.map((request) => {
      assert.equal(
        request.url,
        "https://query1.finance.yahoo.com/v8/finance/chart/BTC-USD?interval=1d&range=1d"
      );
      return createYahooChartResponse("BTC-USD", {
        currency: "USD",
        regularMarketPrice: 71801.25,
      });
    });
  };

  assert.equal(ctx.HOODLEFINANCE("BTCUSD@YAHOO", "price"), 71801.25);
  assert.equal(
    JSON.stringify(seenBatches),
    JSON.stringify([[
      "https://query1.finance.yahoo.com/v8/finance/chart/BTC-USD?interval=1d&range=1d",
    ]])
  );
});

test("forced Google source routes fiat FX pairs through Google Finance quote pages", () => {
  const ctx = loadHoodlefinance();
  primeCurrencyCodeData(ctx);
  const seenUrls = [];

  ctx.UrlFetchApp.fetchAll = function () {
    throw new Error("Unexpected batch fetch");
  };
  ctx.UrlFetchApp.fetch = function (url) {
    seenUrls.push(url);

    if (url === "https://www.google.com/finance/quote/EUR-USD") {
      return createHttpResponse(
        200,
        createGoogleFinancePairHtml(
          "EUR-USD",
          "Euro (EUR / USD)",
          [1.0812, 0.0017, 0.1575, 4, 4, 2],
          1.0795,
          1773599520,
          ["EUR", "USD", "Euro", "United States Dollar", "/m/01l6dm", "/m/09nqf", 2]
        )
      );
    }

    throw new Error("Unexpected URL " + url);
  };

  assert.equal(ctx.HOODLEFINANCE("EURUSD@GOOGLE", "price"), 1.0812);
  assert.equal(ctx.HOODLEFINANCE("EURUSD@GOOGLE", "currency"), "USD");
  assert.deepEqual(seenUrls, ["https://www.google.com/finance/quote/EUR-USD"]);
});

test("unsupported quote-source overrides fail clearly", () => {
  const ctx = loadHoodlefinance();

  assert.throws(
    function () {
      ctx.HOODLEFINANCE("GOOG@IBKR", "price");
    },
    /Source override "@IBKR" is only implemented for isin lookups\./
  );
});

test("scalar calls use the shared batch fetch pipeline", () => {
  const ctx = loadHoodlefinance();
  const seenBatches = [];

  ctx.UrlFetchApp.fetch = function () {
    throw new Error("Unexpected direct fetch");
  };
  ctx.UrlFetchApp.fetchAll = function (requests) {
    seenBatches.push(requests.map((request) => request.url));
    return requests.map((request) => {
      assert.equal(
        request.url,
        "https://query1.finance.yahoo.com/v8/finance/chart/GOOG?interval=1d&range=1d"
      );
      return createYahooChartResponse("GOOG", {
        currency: "USD",
        regularMarketPrice: 306.93,
      });
    });
  };

  assert.equal(ctx.HOODLEFINANCE("NASDAQ:GOOG", "price"), 306.93);
  assert.equal(
    JSON.stringify(seenBatches),
    JSON.stringify([[
      "https://query1.finance.yahoo.com/v8/finance/chart/GOOG?interval=1d&range=1d",
    ]])
  );
});

test("direct Yahoo quote fetches reuse the cached JSON meta payload", () => {
  const ctx = loadHoodlefinance();
  const seenUrls = [];

  ctx.UrlFetchApp.fetch = function (url) {
    seenUrls.push(url);
    assert.equal(
      url,
      "https://query1.finance.yahoo.com/v8/finance/chart/GOOG?interval=1d&range=1d"
    );
    return createYahooChartResponse("GOOG", {
      currency: "USD",
      regularMarketPrice: 306.93,
    });
  };

  assert.equal(ctx.hoodlefinanceFetchQuote_("NASDAQ:GOOG").regularMarketPrice, 306.93);
  assert.equal(ctx.hoodlefinanceFetchQuote_("NASDAQ:GOOG").regularMarketPrice, 306.93);
  assert.deepEqual(seenUrls, [
    "https://query1.finance.yahoo.com/v8/finance/chart/GOOG?interval=1d&range=1d",
  ]);
  assert.equal(
    ctx.__scriptCacheStore.has("hoodlefinance:v" + ctx.HOODLEFINANCE_VERSION() + ":GOOG"),
    true
  );
});

test("symbol and exchange attributes resolve U.S. quotes in yahoo and google styles", () => {
  const ctx = loadHoodlefinance();

  ctx.UrlFetchApp.fetch = function (url) {
    assert.equal(
      url,
      "https://query1.finance.yahoo.com/v8/finance/chart/GOOG?interval=1d&range=1d"
    );
    return createYahooChartResponse("GOOG", {
      exchangeName: "NMS",
      regularMarketPrice: 306.93,
    });
  };

  assert.equal(ctx.HOODLEFINANCE("GOOG", "symbol:yahoo"), "GOOG");
  assert.equal(ctx.HOODLEFINANCE("GOOG", "symbol"), "NASDAQ:GOOG");
  assert.equal(ctx.HOODLEFINANCE("GOOG", "exchange:yahoo"), "NMS");
  assert.equal(ctx.HOODLEFINANCE("GOOG", "exchange"), "NASDAQ");
});

test("symbol and exchange attributes resolve non-U.S. quotes in yahoo and google styles", () => {
  const ctx = loadHoodlefinance();

  ctx.UrlFetchApp.fetch = function (url) {
    assert.equal(
      url,
      "https://query1.finance.yahoo.com/v8/finance/chart/SJPA.L?interval=1d&range=1d"
    );
    return createYahooChartResponse("SJPA.L", {
      regularMarketPrice: 45.67,
    });
  };

  assert.equal(ctx.HOODLEFINANCE("LON:SJPA", "symbol:yahoo"), "SJPA.L");
  assert.equal(ctx.HOODLEFINANCE("SJPA.L", "symbol"), "LON:SJPA");
  assert.equal(ctx.HOODLEFINANCE("SJPA.L", "exchange:yahoo"), "LON");
  assert.equal(ctx.HOODLEFINANCE("SJPA.L", "exchange"), "LON");
});

test("symbol and exchange attributes preserve normalized TLV fund forms", () => {
  const ctx = loadHoodlefinance();

  ctx.UrlFetchApp.fetch = function () {
    throw new Error("Unexpected direct fetch");
  };
  ctx.UrlFetchApp.fetchAll = function (requests) {
    return requests.map((request) => {
      assert.equal(
        request.url,
        "https://query1.finance.yahoo.com/v8/finance/chart/KSM.F59.TA?interval=1d&range=1d"
      );
      return createYahooChartResponse("KSM.F59.TA", {
        regularMarketPrice: 405.6,
      });
    });
  };

  assert.equal(ctx.HOODLEFINANCE("TLV:KSMF59", "symbol:yahoo"), "KSM.F59.TA");
  assert.equal(ctx.HOODLEFINANCE("TLV:KSMF59", "symbol"), "TLV:KSM.F59");
  assert.equal(ctx.HOODLEFINANCE("TLV:KSMF59", "exchange:yahoo"), "TLV");
  assert.equal(ctx.HOODLEFINANCE("TLV:KSMF59", "exchange"), "TLV");
});

test("symbol and exchange attributes resolve direct PSE quotes in yahoo and google styles", () => {
  const ctx = loadHoodlefinance();

  ctx.UrlFetchApp.fetch = function (url) {
    if (url === "https://edge.pse.com.ph/companyDirectory/search.ax?keyword=BDO") {
      return createHttpResponse(200, PSE_SEARCH_BDO_HTML);
    }

    if (url === "https://edge.pse.com.ph/companyPage/stockData.do?cmpy_id=260&security_id=468") {
      return createHttpResponse(200, PSE_STOCK_BDO_HTML);
    }

    throw new Error("Unexpected URL " + url);
  };

  assert.equal(ctx.HOODLEFINANCE("PSE:BDO", "symbol:yahoo"), "BDO.PS");
  assert.equal(ctx.HOODLEFINANCE("PSE:BDO", "symbol"), "PSE:BDO");
  assert.equal(ctx.HOODLEFINANCE("PSE:BDO", "exchange:yahoo"), "PSE");
  assert.equal(ctx.HOODLEFINANCE("PSE:BDO", "exchange"), "PSE");
});

test("symbol and exchange attributes resolve PSE ISIN input in yahoo and google styles", () => {
  const ctx = loadHoodlefinance();

  ctx.UrlFetchApp.fetch = function (url) {
    if (url === "https://raw.githubusercontent.com/omry/hoodlefinance/main/data/pse-isin-map.properties") {
      return createHttpResponse(200, PSE_ISIN_MAP_PROPERTIES);
    }

    if (url === "https://edge.pse.com.ph/companyDirectory/search.ax?keyword=BDO") {
      return createHttpResponse(200, PSE_SEARCH_BDO_HTML);
    }

    if (url === "https://edge.pse.com.ph/companyPage/stockData.do?cmpy_id=260&security_id=468") {
      return createHttpResponse(200, PSE_STOCK_BDO_HTML);
    }

    throw new Error("Unexpected URL " + url);
  };

  assert.equal(ctx.HOODLEFINANCE("PHY077751022", "symbol:yahoo"), "BDO.PS");
  assert.equal(ctx.HOODLEFINANCE("PHY077751022", "symbol"), "PSE:BDO");
  assert.equal(ctx.HOODLEFINANCE("PHY077751022", "exchange:yahoo"), "PSE");
  assert.equal(ctx.HOODLEFINANCE("PHY077751022", "exchange"), "PSE");
});

test("symbol and exchange attributes format a resolved Yahoo ISIN lookup in yahoo and google styles", () => {
  const ctx = loadHoodlefinance();
  const fixtureIsin = "ZZ0000000001";

  ctx.UrlFetchApp.fetch = function (url) {
    if (url === "https://query2.finance.yahoo.com/v1/finance/search?q=" + fixtureIsin + "&quotesCount=10&newsCount=0") {
      return createYahooIsinSearchResponse("IJPA.L");
    }

    if (url === "https://query1.finance.yahoo.com/v8/finance/chart/IJPA.L?interval=1d&range=1d") {
      return createYahooChartResponse("IJPA.L", {
        regularMarketPrice: 45.67,
      });
    }

    throw new Error("Unexpected URL " + url);
  };

  assert.equal(ctx.HOODLEFINANCE(fixtureIsin, "symbol:yahoo"), "IJPA.L");
  assert.equal(ctx.HOODLEFINANCE(fixtureIsin, "symbol"), "LON:IJPA");
  assert.equal(ctx.HOODLEFINANCE(fixtureIsin, "exchange:yahoo"), "LON");
  assert.equal(ctx.HOODLEFINANCE(fixtureIsin, "exchange"), "LON");
});

test("symbol and exchange attributes resolve SGX quotes in yahoo and google styles", () => {
  const ctx = loadHoodlefinance();

  ctx.UrlFetchApp.fetch = function (url) {
    assert.equal(
      url,
      "https://query1.finance.yahoo.com/v8/finance/chart/D05.SI?interval=1d&range=1d"
    );
    return createYahooChartResponse("D05.SI", {
      regularMarketPrice: 35.12,
    });
  };

  assert.equal(ctx.HOODLEFINANCE("SGX:D05", "symbol:yahoo"), "D05.SI");
  assert.equal(ctx.HOODLEFINANCE("D05.SI", "symbol"), "SGX:D05");
  assert.equal(ctx.HOODLEFINANCE("D05.SI", "exchange:yahoo"), "SGX");
  assert.equal(ctx.HOODLEFINANCE("D05.SI", "exchange"), "SGX");
});

test("symbol and exchange attributes resolve FX pairs in yahoo and google styles", () => {
  const ctx = loadHoodlefinance();
  primeCurrencyCodeData(ctx);

  ctx.UrlFetchApp.fetchAll = function () {
    throw new Error("Unexpected batch fetch");
  };
  ctx.UrlFetchApp.fetch = function (url) {
    assert.equal(url, "https://www.google.com/finance/quote/EUR-USD");
    return createHttpResponse(
      200,
      createGoogleFinancePairHtml(
        "EUR-USD",
        "Euro (EUR / USD)",
        [1.0812, 0.0017, 0.1575, 4, 4, 2],
        1.0795,
        1773599520,
        ["EUR", "USD", "Euro", "United States Dollar", "/m/01l6dm", "/m/09nqf", 2]
      )
    );
  };

  assert.equal(ctx.HOODLEFINANCE("EURUSD", "symbol:yahoo"), "EURUSD=X");
  assert.equal(ctx.HOODLEFINANCE("EURUSD", "symbol"), "CURRENCY:EURUSD");
  assert.equal(ctx.HOODLEFINANCE("EURUSD", "exchange:yahoo"), "CURRENCY");
  assert.equal(ctx.HOODLEFINANCE("EURUSD", "exchange"), "CURRENCY");
});

test("symbol and exchange google-style outputs fail clearly when no mapping is available", () => {
  const ctx = loadHoodlefinance();

  assert.throws(
    () => ctx.hoodlefinanceExtractAttribute_({ symbol: "MYSTERY" }, "symbol", { tickerInput: "MYSTERY" }),
    /No Google-style symbol is available for this instrument\./
  );
  assert.throws(
    () => ctx.hoodlefinanceExtractAttribute_({ symbol: "MYSTERY" }, "exchange", { tickerInput: "MYSTERY" }),
    /No Google-style exchange is available for this instrument\./
  );
});

test("unsupported attribute errors list only public attributes", () => {
  const ctx = loadHoodlefinance();

  assert.throws(
    () => ctx.hoodlefinanceExtractAttribute_({ symbol: "GOOG" }, "yahoo:symbol", { tickerInput: "GOOG" }),
    (error) => {
      assert.match(
        error.message,
        /Unsupported attribute "yahoo:symbol"\. Supported attributes: exchange, exchange:google, exchange:yahoo, currency, datadelay, close, high, low, isin, name, price, symbol, symbol:google, symbol:yahoo, tradetime, volume, changepct, change/
      );
      return true;
    }
  );
});

test("versioned cache keys are namespaced by the current script version", () => {
  const ctx = loadHoodlefinance();

  ctx.hoodlefinancePutCachedString_("hoodlefinance:test:key", "value", 60);

  assert.equal(ctx.__scriptCacheStore.has("hoodlefinance:test:key"), false);
  assert.equal(
    ctx.__scriptCacheStore.get("hoodlefinance:v" + ctx.HOODLEFINANCE_VERSION() + ":test:key"),
    "value"
  );
  assert.equal(ctx.hoodlefinanceGetCachedString_("hoodlefinance:test:key"), "value");
});

test("versioned cache key helper rejects already-versioned cache keys", () => {
  const ctx = loadHoodlefinance();

  assert.throws(
    () => ctx.hoodlefinanceVersionCacheKey_("hoodlefinance:v" + ctx.HOODLEFINANCE_VERSION() + ":test:key"),
    /Cache key must be a normalized unversioned "hoodlefinance:" key\./
  );
});

test("TLV fund aliases normalize to dotted Yahoo symbols in quote lookups", () => {
  const ctx = loadHoodlefinance();
  const seenUrls = [];

  ctx.UrlFetchApp.fetch = function () {
    throw new Error("Unexpected direct fetch");
  };
  ctx.UrlFetchApp.fetchAll = function (requests) {
    seenUrls.push(requests[0].url);
    return [
      createYahooChartResponse("KSM.F59.TA", {
        currency: "ILA",
        regularMarketPrice: 12345,
      }),
    ];
  };

  assert.equal(ctx.HOODLEFINANCE("TLV:KSMF59", "price"), 123.45);
  assert.equal(ctx.HOODLEFINANCE("TLV:KSMF59", "currency"), "ILS");
  assert.equal(
    JSON.stringify(seenUrls),
    JSON.stringify([
      "https://query1.finance.yahoo.com/v8/finance/chart/KSM.F59.TA?interval=1d&range=1d",
    ])
  );
});

test("TLV fund quotes fall back to TradingView when Yahoo has no quote", () => {
  const ctx = loadHoodlefinance();
  const seenUrls = [];

  ctx.UrlFetchApp.fetch = function () {
    throw new Error("Unexpected direct fetch");
  };
  ctx.UrlFetchApp.fetchAll = function (requests) {
    seenUrls.push.apply(seenUrls, requests.map((request) => request.url));
    return requests.map((request) => {
      if (request.url === "https://query1.finance.yahoo.com/v8/finance/chart/KSM.F59.TA?interval=1d&range=1d") {
        return createHttpResponse(404, {});
      }

      if (request.url === "https://www.tradingview.com/symbols/TASE-KSM.F59/") {
        return createHttpResponse(200, TRADINGVIEW_TASE_KSM_F59_HTML);
      }

      throw new Error("Unexpected URL " + request.url);
    });
  };

  assert.equal(ctx.HOODLEFINANCE("TLV:KSMF59", "name"), "KSM ETF (4A) TA-35 Units");
  assert.equal(ctx.HOODLEFINANCE("TLV:KSMF59", "price"), 405.6);
  assert.equal(ctx.HOODLEFINANCE("TLV:KSMF59", "currency"), "ILS");
  assert.equal(
    JSON.stringify(seenUrls),
    JSON.stringify([
      "https://query1.finance.yahoo.com/v8/finance/chart/KSM.F59.TA?interval=1d&range=1d",
      "https://www.tradingview.com/symbols/TASE-KSM.F59/",
    ])
  );
});

test("blank scalar ticker input still throws", () => {
  const ctx = loadHoodlefinance();
  primeCurrencyCodeData(ctx);

  assert.throws(() => ctx.HOODLEFINANCE("", "price"), /Ticker is required\./);
  assert.throws(() => ctx.HOODLEFINANCE([["  "]], "price"), /Ticker is required\./);
  assert.throws(
    () => ctx.HOODLEFINANCE("CURRENCY:USD", "price"),
    /Currency ticker "CURRENCY:USD" must look like CURRENCY:USDEUR\./
  );
  assert.throws(
    () => ctx.HOODLEFINANCE("CURRENCY:FOOUSD", "price"),
    /must use supported 3-character currency codes/
  );
});

test("range-built currency tickers ignore trailing blank-built rows", () => {
  const ctx = loadHoodlefinance();
  const seenUrls = [];
  primeCurrencyCodeData(ctx);

  ctx.UrlFetchApp.fetchAll = function () {
    throw new Error("Unexpected batch fetch");
  };
  ctx.UrlFetchApp.fetch = function (url) {
    seenUrls.push(url);

    if (url === "https://www.google.com/finance/quote/EUR-USD") {
      return createHttpResponse(
        200,
        createGoogleFinancePairHtml(
          "EUR-USD",
          "Euro (EUR / USD)",
          [1.08, 0.002, 0.185, 4, 4, 2],
          1.078,
          1773599520,
          ["EUR", "USD", "Euro", "United States Dollar", "/m/01l6dm", "/m/09nqf", 2]
        )
      );
    }

    if (url === "https://www.google.com/finance/quote/CHF-USD") {
      return createHttpResponse(
        200,
        createGoogleFinancePairHtml(
          "CHF-USD",
          "Swiss Franc (CHF / USD)",
          [1.13, 0.004, 0.355, 4, 4, 2],
          1.126,
          1773599520,
          ["CHF", "USD", "Swiss Franc", "United States Dollar", "/m/01hy_q", "/m/09nqf", 2]
        )
      );
    }

    throw new Error("Unexpected URL " + url);
  };

  assert.equal(
    JSON.stringify(
      ctx.HOODLEFINANCE([["CURRENCY:USDUSD"], ["CURRENCY:EURUSD"], ["CURRENCY:CHFUSD"], ["CURRENCY:USD"]], "price")
    ),
    JSON.stringify([[1], [1.08], [1.13], [""]])
  );
  assert.equal(
    JSON.stringify(seenUrls),
    JSON.stringify([
      "https://www.google.com/finance/quote/EUR-USD",
      "https://www.google.com/finance/quote/CHF-USD",
    ])
  );
});

test("bare FX pairs use canonical Google quotes with alias-aware scaling", () => {
  const ctx = loadHoodlefinance();
  primeCurrencyCodeData(ctx);
  const seenUrls = [];

  ctx.UrlFetchApp.fetchAll = function () {
    throw new Error("Unexpected batch fetch");
  };
  ctx.UrlFetchApp.fetch = function (url) {
    seenUrls.push(url);

    if (url === "https://www.google.com/finance/quote/GBP-USD") {
      return createHttpResponse(
        200,
        createGoogleFinancePairHtml(
          "GBP-USD",
          "British Pound Sterling (GBP / USD)",
          [1.3223, 0.0223, 1.7153846153846187, 4, 4, 2],
          1.3,
          1773599520,
          ["GBP", "USD", "British Pound Sterling", "United States Dollar", "/m/05z1_", "/m/09nqf", 2]
        )
      );
    }

    if (url === "https://www.google.com/finance/quote/USD-GBP") {
      return createHttpResponse(
        200,
        createGoogleFinancePairHtml(
          "USD-GBP",
          "United States Dollar (USD / GBP)",
          [0.7563, 0.0063, 0.84, 4, 4, 2],
          0.75,
          1773599520,
          ["USD", "GBP", "United States Dollar", "British Pound Sterling", "/m/09nqf", "/m/05z1_", 2]
        )
      );
    }

    throw new Error("Unexpected URL " + url);
  };

  assert.equal(ctx.HOODLEFINANCE("GBpUSD", "price"), 0.013223);
  assert.equal(ctx.HOODLEFINANCE("GBpUSD", "close"), 0.013000000000000001);
  assert.ok(Math.abs(ctx.HOODLEFINANCE("GBpUSD", "change") - 0.000223) < 1e-12);
  assert.ok(Math.abs(ctx.HOODLEFINANCE("GBpUSD", "changepct") - 0.017153846153846186) < 1e-12);
  assert.equal(ctx.HOODLEFINANCE("GBpUSD", "currency"), "USD");
  assert.throws(() => ctx.HOODLEFINANCE("GBpUSD", "high"), /No value is available for this ticker\./);
  assert.throws(() => ctx.HOODLEFINANCE("GBpUSD", "low"), /No value is available for this ticker\./);
  assert.equal(ctx.HOODLEFINANCE("USDGBp", "price"), 75.63);
  assert.equal(ctx.HOODLEFINANCE("USDGBp", "currency"), "GBp");
  assert.equal(
    JSON.stringify(seenUrls),
    JSON.stringify([
      "https://www.google.com/finance/quote/GBP-USD",
      "https://www.google.com/finance/quote/USD-GBP",
    ])
  );
});

test("range calls preserve blanks and de-duplicate repeated quote lookups", () => {
  const ctx = loadHoodlefinance();
  const seenBatches = [];

  ctx.UrlFetchApp.fetch = function () {
    throw new Error("Unexpected direct fetch");
  };
  ctx.UrlFetchApp.fetchAll = function (requests) {
    seenBatches.push(requests.map((request) => request.url));
    return requests.map((request) => {
      if (request.url === "https://query1.finance.yahoo.com/v8/finance/chart/GOOG?interval=1d&range=1d") {
        return createYahooChartResponse("GOOG", {
          currency: "USD",
          regularMarketPrice: 306.93,
        });
      }

      if (request.url === "https://query1.finance.yahoo.com/v8/finance/chart/IBM?interval=1d&range=1d") {
        return createYahooChartResponse("IBM", {
          currency: "USD",
          regularMarketPrice: 250.2,
        });
      }

      throw new Error("Unexpected URL " + request.url);
    });
  };

  assert.equal(
    JSON.stringify(ctx.HOODLEFINANCE([["NASDAQ:GOOG"], [""], ["NASDAQ:GOOG"], ["NYSE:IBM"]], "price")),
    JSON.stringify([[306.93], [""], [306.93], [250.2]])
  );
  assert.equal(
    JSON.stringify(seenBatches),
    JSON.stringify([[
      "https://query1.finance.yahoo.com/v8/finance/chart/GOOG?interval=1d&range=1d",
      "https://query1.finance.yahoo.com/v8/finance/chart/IBM?interval=1d&range=1d",
    ]])
  );
});

test("range calls batch yahoo isin search before quote lookup", () => {
  const ctx = loadHoodlefinance();
  const seenBatches = [];

  ctx.UrlFetchApp.fetch = function () {
    throw new Error("Unexpected direct fetch");
  };
  ctx.UrlFetchApp.fetchAll = function (requests) {
    seenBatches.push(requests.map((request) => request.url));
    return requests.map((request) => {
      if (request.url === "https://query2.finance.yahoo.com/v1/finance/search?q=US02079K1079&quotesCount=10&newsCount=0") {
        return createYahooIsinSearchResponse("GOOG");
      }

      if (request.url === "https://query1.finance.yahoo.com/v8/finance/chart/GOOG?interval=1d&range=1d") {
        return createYahooChartResponse("GOOG", {
          currency: "USD",
          regularMarketPrice: 306.93,
        });
      }

      throw new Error("Unexpected URL " + request.url);
    });
  };

  assert.equal(
    JSON.stringify(ctx.HOODLEFINANCE([["ISIN:US02079K1079"], ["US02079K1079"]], "price")),
    JSON.stringify([[306.93], [306.93]])
  );
  assert.equal(
    JSON.stringify(seenBatches),
    JSON.stringify([
      [
        "https://query2.finance.yahoo.com/v1/finance/search?q=US02079K1079&quotesCount=10&newsCount=0",
        "https://query2.finance.yahoo.com/v1/finance/search?q=US02079K1079&quotesCount=10&newsCount=0",
      ],
      [
        "https://query1.finance.yahoo.com/v8/finance/chart/GOOG?interval=1d&range=1d",
        "https://query1.finance.yahoo.com/v8/finance/chart/GOOG?interval=1d&range=1d",
      ],
    ])
  );
});

test("direct Philippine ISIN input uses the mapped PSE ticker directly in the shared batch pipeline", () => {
  const ctx = loadHoodlefinance();
  const seenBatches = [];
  const seenUrls = [];

  function respond(url) {
    seenUrls.push(url);

    if (url === "https://raw.githubusercontent.com/omry/hoodlefinance/main/data/pse-isin-map.properties") {
      return createHttpResponse(200, PSE_ISIN_MAP_PROPERTIES);
    }

    if (url === "https://edge.pse.com.ph/companyDirectory/search.ax?keyword=BDO") {
      return createHttpResponse(200, PSE_SEARCH_BDO_HTML);
    }

    if (url === "https://edge.pse.com.ph/companyPage/stockData.do?cmpy_id=260&security_id=468") {
      return createHttpResponse(200, PSE_STOCK_BDO_HTML);
    }

    throw new Error("Unexpected URL " + url);
  }

  ctx.UrlFetchApp.fetch = function (url) {
    return respond(url);
  };
  ctx.UrlFetchApp.fetchAll = function (requests) {
    seenBatches.push(requests.map((request) => request.url));
    return requests.map((request) => respond(request.url));
  };

  assert.equal(
    JSON.stringify(ctx.HOODLEFINANCE([["PHY077751022"], ["PHY077751022"]], "price")),
    JSON.stringify([[123.8], [123.8]])
  );
  assert.equal(
    JSON.stringify(seenUrls),
    JSON.stringify([
      "https://raw.githubusercontent.com/omry/hoodlefinance/main/data/pse-isin-map.properties",
      "https://edge.pse.com.ph/companyDirectory/search.ax?keyword=BDO",
      "https://edge.pse.com.ph/companyPage/stockData.do?cmpy_id=260&security_id=468",
    ])
  );

  if (seenBatches.length) {
    assert.equal(
      JSON.stringify(seenBatches),
      JSON.stringify([
        [
          "https://edge.pse.com.ph/companyDirectory/search.ax?keyword=BDO",
        ],
        [
          "https://edge.pse.com.ph/companyPage/stockData.do?cmpy_id=260&security_id=468",
        ],
      ])
    );
  }
});

test("range calls abort with the first failing job in traversal order", () => {
  const ctx = loadHoodlefinance();

  ctx.UrlFetchApp.fetch = function () {
    throw new Error("Unexpected direct fetch");
  };
  ctx.UrlFetchApp.fetchAll = function (requests) {
    return requests.map((request) => {
      if (request.url === "https://query1.finance.yahoo.com/v8/finance/chart/GOOG?interval=1d&range=1d") {
        return createYahooChartResponse("GOOG", {
          currency: "USD",
          regularMarketPrice: 306.93,
        });
      }

      if (request.url === "https://query1.finance.yahoo.com/v8/finance/chart/HGEN?interval=1d&range=1d") {
        return createHttpResponse(404, "not found");
      }

      if (request.url === "https://query1.finance.yahoo.com/v8/finance/chart/IBM?interval=1d&range=1d") {
        return createYahooChartResponse("IBM", {
          currency: "USD",
          regularMarketPrice: 250.2,
        });
      }

      throw new Error("Unexpected URL " + request.url);
    });
  };

  assert.throws(
    () => ctx.HOODLEFINANCE([["NASDAQ:GOOG"], ["HGEN"], ["NYSE:IBM"]], "price"),
    /Quote lookup failed for HGEN \(404\)\./
  );
});

test("chunk-level fetchAll failures fall back to per-request errors", () => {
  const ctx = loadHoodlefinance();

  ctx.UrlFetchApp.fetchAll = function () {
    throw new Error("transport failed");
  };
  ctx.UrlFetchApp.fetch = function (url) {
    if (url === "https://query1.finance.yahoo.com/v8/finance/chart/GOOG?interval=1d&range=1d") {
      return createYahooChartResponse("GOOG", {
        currency: "USD",
        regularMarketPrice: 306.93,
      });
    }

    if (url === "https://query1.finance.yahoo.com/v8/finance/chart/HGEN?interval=1d&range=1d") {
      return createHttpResponse(404, "not found");
    }

    if (url === "https://query1.finance.yahoo.com/v8/finance/chart/IBM?interval=1d&range=1d") {
      return createYahooChartResponse("IBM", {
        currency: "USD",
        regularMarketPrice: 250.2,
      });
    }

    throw new Error("Unexpected URL " + url);
  };

  assert.throws(
    () => ctx.HOODLEFINANCE([["NASDAQ:GOOG"], ["HGEN"], ["NYSE:IBM"]], "price"),
    /Quote lookup failed for HGEN \(404\)\./
  );
});

test("dead OTC tickers report a delisted-style 404 message", () => {
  const ctx = loadHoodlefinance();

  ctx.UrlFetchApp.fetch = function () {
    throw new Error("Unexpected direct fetch");
  };
  ctx.UrlFetchApp.fetchAll = function (requests) {
    return requests.map((request) => {
      if (request.url === "https://query1.finance.yahoo.com/v8/finance/chart/RYCE?interval=1d&range=1d") {
        return createHttpResponse(404, "not found");
      }

      throw new Error("Unexpected URL " + request.url);
    });
  };

  assert.throws(
    () => ctx.HOODLEFINANCE([["OTCMKTS:RYCE"]], "price"),
    /No current quote data was found for OTCMKTS:RYCE\. The symbol may be delisted or cancelled\./
  );
});

test("shared batch fetches are chunked in groups of fifty", () => {
  const ctx = loadHoodlefinance();
  const batchSizes = [];
  const tickerRange = Array.from({ length: 51 }, (_, index) => ["T" + index]);

  ctx.UrlFetchApp.fetch = function () {
    throw new Error("Unexpected direct fetch");
  };
  ctx.UrlFetchApp.fetchAll = function (requests) {
    batchSizes.push(requests.length);
    return requests.map((request) => {
      const match = request.url.match(/chart\/([^?]+)\?/);
      const symbol = decodeURIComponent(match[1]);
      return createYahooChartResponse(symbol, {
        currency: "USD",
        regularMarketPrice: 1,
      });
    });
  };

  assert.equal(JSON.stringify(ctx.HOODLEFINANCE(tickerRange, "price")), JSON.stringify(tickerRange.map(() => [1])));
  assert.deepEqual(batchSizes, [50, 1]);
});

test("exposes a script version custom function", () => {
  const ctx = loadHoodlefinance();
  const sourceText = fs.readFileSync(path.join(__dirname, "..", "hoodlefinance.js"), "utf8");
  const versionMatch = sourceText.match(/const HOODLEFINANCE_VERSION_ = "([^"]+)"/);

  assert.ok(versionMatch);
  assert.equal(ctx.HOODLEFINANCE_VERSION(), versionMatch[1]);
});

test("compares semantic-style versions correctly", () => {
  const ctx = loadHoodlefinance();

  assert.equal(ctx.hoodlefinanceCompareVersions_("0.2.3", "0.2.2"), 1);
  assert.equal(ctx.hoodlefinanceCompareVersions_("0.2.2", "0.2.3"), -1);
  assert.equal(ctx.hoodlefinanceCompareVersions_("1.0.0", "1.0"), 0);
});

test("extracts the published version from raw source text", () => {
  const ctx = loadHoodlefinance();

  assert.equal(
    ctx.hoodlefinanceExtractVersionFromSource_('const HOODLEFINANCE_VERSION_ = "2.3.4";'),
    "2.3.4"
  );
});

test("runs automatic update checks at most once per day", () => {
  const ctx = loadHoodlefinance();

  assert.equal(ctx.hoodlefinanceShouldRunVersionCheckNow_(0, 1000), true);
  assert.equal(ctx.hoodlefinanceShouldRunVersionCheckNow_(1000, 1000 + 60 * 60 * 1000), false);
  assert.equal(
    ctx.hoodlefinanceShouldRunVersionCheckNow_(1000, 1000 + 24 * 60 * 60 * 1000),
    true
  );
});

test("suppressed automatic checks do not fetch remote versions", () => {
  const ctx = loadHoodlefinance();

  ctx.__userPropertiesStore.set("hoodlefinance.suppressUpdateChecks", "true");
  ctx.UrlFetchApp.fetch = function () {
    throw new Error("Fetch should not run while suppressed");
  };

  assert.equal(
    JSON.stringify(ctx.hoodlefinanceMaybeCheckForUpdates_()),
    JSON.stringify({ status: "suppressed" })
  );
});

test("manual update checks show a dialog when a newer version exists", () => {
  const ctx = loadHoodlefinance();
  const seenUrls = [];

  ctx.UrlFetchApp.fetch = function (url) {
    seenUrls.push(url);
    return {
      getResponseCode() {
        return 200;
      },
      getContentText() {
        return 'const HOODLEFINANCE_VERSION_ = "9.9.9";';
      },
    };
  };

  assert.equal(
    JSON.stringify(ctx.hoodlefinanceCheckForUpdates()),
    JSON.stringify({ latestVersion: "9.9.9", status: "outdated" })
  );
  assert.deepEqual(seenUrls, ["https://raw.githubusercontent.com/omry/hoodlefinance/main/hoodlefinance.js"]);
  assert.equal(ctx.__uiState.dialogs.length, 1);
  assert.match(ctx.__uiState.dialogs[0].output.content, /What's new in 9\.9\.9/);
  assert.match(ctx.__uiState.dialogs[0].output.content, /docs\/release-notes\/v9\.9\.9\.md/);
  assert.match(ctx.__uiState.dialogs[0].output.content, /Release history/);
  assert.match(ctx.__uiState.dialogs[0].output.content, /docs\/release-notes\/RELEASE_NOTES\.md/);
  assert.match(ctx.__uiState.dialogs[0].output.content, /Open raw source/);
  assert.match(ctx.__uiState.dialogs[0].output.content, /Read the release notes first/);
});

test("manual update checks bypass stale cached latest-version info", () => {
  const ctx = loadHoodlefinance();
  const seenUrls = [];

  ctx.UrlFetchApp.fetch = function (url) {
    seenUrls.push(url);
    return {
      getResponseCode() {
        return 200;
      },
      getContentText() {
        return 'const HOODLEFINANCE_VERSION_ = "' + (seenUrls.length === 1 ? "0.2.0" : "9.9.9") + '";';
      },
    };
  };

  assert.equal(
    JSON.stringify(ctx.hoodlefinanceFetchLatestVersionInfo_()),
    JSON.stringify({ version: "0.2.0" })
  );
  assert.equal(
    JSON.stringify(ctx.hoodlefinanceCheckForUpdates()),
    JSON.stringify({ latestVersion: "9.9.9", status: "outdated" })
  );
  assert.deepEqual(seenUrls, [
    "https://raw.githubusercontent.com/omry/hoodlefinance/main/hoodlefinance.js",
    "https://raw.githubusercontent.com/omry/hoodlefinance/main/hoodlefinance.js",
  ]);
});

test("manual update checks include fetch diagnostics when version lookup fails", () => {
  const ctx = loadHoodlefinance();
  const urls = [];

  ctx.UrlFetchApp.fetch = function (url) {
    urls.push(url);
    return {
      getResponseCode() {
        return 503;
      },
      getContentText() {
        return "Service unavailable";
      },
    };
  };

  assert.equal(
    JSON.stringify(ctx.hoodlefinanceCheckForUpdates()),
    JSON.stringify({ status: "error" })
  );
  assert.deepEqual(urls, [
    "https://raw.githubusercontent.com/omry/hoodlefinance/main/hoodlefinance.js",
  ]);
  assert.equal(ctx.__uiState.alerts.length, 1);
  assert.match(ctx.__uiState.alerts[0][1], /HTTP 503/);
});

test("suppression can be toggled from helper functions", () => {
  const ctx = loadHoodlefinance();

  ctx.hoodlefinanceSuppressUpdateChecks();
  assert.equal(ctx.__userPropertiesStore.get("hoodlefinance.suppressUpdateChecks"), "true");

  ctx.hoodlefinanceEnableUpdateChecks();
  assert.equal(ctx.__userPropertiesStore.has("hoodlefinance.suppressUpdateChecks"), false);
});

test("maps Yahoo exchange codes to IBKR exchange hints", () => {
  const ctx = loadHoodlefinance();

  assert.equal(ctx.hoodlefinanceInferIbkrExchange_("LON:ISJP", "ISJP.L"), "LSEETF");
  assert.equal(ctx.hoodlefinanceInferIbkrExchange_("ETR:ZPRX", "ZPRX.DE"), "IBIS");
  assert.equal(ctx.hoodlefinanceInferIbkrExchange_("NASDAQ:GOOG", "GOOG"), "NASDAQ");
  assert.equal(ctx.hoodlefinanceInferIbkrExchange_("NYSE:IBM", "IBM"), "NYSE");
});

test("maps Yahoo suffixes to IBKR exchange hints", () => {
  const ctx = loadHoodlefinance();

  assert.equal(ctx.hoodlefinanceInferIbkrExchange_("ISJP.L", "ISJP.L"), "LSEETF");
  assert.equal(ctx.hoodlefinanceInferIbkrExchange_("ZPRV.DE", "ZPRV.DE"), "IBIS");
  assert.equal(ctx.hoodlefinanceInferIbkrExchange_("IUVL.L", "IUVL.L"), "LSEETF");
});

test("deduces isin exchange from ticker, suffix, and quote metadata", () => {
  const ctx = loadHoodlefinance();

  assert.equal(ctx.hoodlefinanceInferIsinExchange_({}, { tickerInput: "PSE:BDO" }), "PSE");
  assert.equal(ctx.hoodlefinanceInferIsinExchange_({ symbol: "ISJP.L" }, { tickerInput: "ISJP.L" }), "LON");
  assert.equal(ctx.hoodlefinanceInferIsinExchange_({ symbol: "ZTL.NE" }, { tickerInput: "ZTL.NE" }), "NEO");
  assert.equal(ctx.hoodlefinanceInferIsinExchange_({ symbol: "D05.SI" }, { tickerInput: "SGX:D05" }), "SGX");
  assert.equal(ctx.hoodlefinanceInferIsinExchange_({ symbol: "POLI.TA" }, { tickerInput: "POLI.TA" }), "TLV");
  assert.equal(
    ctx.hoodlefinanceInferIsinExchange_({ symbol: "GOOG", exchangeName: "NMS" }, { tickerInput: "GOOG" }),
    "NASDAQ"
  );
  assert.equal(
    ctx.hoodlefinanceInferIsinExchange_({ symbol: "RYCEY", exchangeName: "PNK" }, { tickerInput: "OTCMKTS:RYCEY" }),
    "OTCMKTS"
  );
  assert.equal(
    ctx.hoodlefinanceInferIsinExchange_({ symbol: "AVLV", exchangeName: "PCX" }, { tickerInput: "AVLV" }),
    "NYSEARCA"
  );
});

test("explicit IBKR exchange codes override Yahoo-derived mapping", () => {
  const ctx = loadHoodlefinance();

  assert.equal(ctx.hoodlefinanceInferIbkrExchange_("IBIS:ZPRX", "ZPRX.DE"), "IBIS");
  assert.equal(ctx.hoodlefinanceInferIbkrExchange_("LSEETF:ISJP", "ISJP.L"), "LSEETF");
});

test("unsupported or unmapped exchanges fall back to blank hint", () => {
  const ctx = loadHoodlefinance();

  assert.equal(ctx.hoodlefinanceInferIbkrExchange_("SHA:600519", "600519.SS"), "");
  assert.equal(ctx.hoodlefinanceInferIbkrExchange_("UNKNOWN:FOO", "FOO"), "");
});

test("unsupported exchange prefixes fail early during ticker normalization", () => {
  const ctx = loadHoodlefinance();

  assert.throws(
    function () {
      ctx.hoodlefinanceNormalizeTicker_("PDA:BDO");
    },
    /Unsupported exchange prefix "PDA"/
  );
});

test("extracts IBKR detail URLs and de-duplicates matches", () => {
  const ctx = loadHoodlefinance();
  const html = [
    '<a href="/cstools/contract_info/index.php?action=Details&amp;conid=123&amp;site=GEN$exchangeLSEETF">',
    '<a href="/cstools/contract_info/index.php?action=Details&amp;conid=123&amp;site=GEN$exchangeLSEETF">',
    '<a href="/cstools/contract_info/index.php?action=Details&amp;conid=456&amp;site=GEN$exchangeIBIS">',
  ].join("\n");

  const entries = ctx.hoodlefinanceExtractIbkrDetailUrls_(html);

  assert.equal(entries.length, 2);
  assert.equal(entries[0].url, "https://misc.interactivebrokers.com/cstools/contract_info/index.php?action=Details&conid=123&site=GEN");
  assert.equal(entries[1].url, "https://misc.interactivebrokers.com/cstools/contract_info/index.php?action=Details&conid=456&site=GEN");
});

test("extracts IBKR detail URLs from the modern contract search results", () => {
  const ctx = loadHoodlefinance();
  const entries = ctx.hoodlefinanceExtractIbkrDetailUrls_(IBKR_MODERN_SEARCH_HTML);

  assert.equal(entries.length, 2);
  assert.equal(entries[0].url, "https://contract.ibkr.info/v3.10/index.php?action=Conid%20Info&wlId=IB&lang=en&conid=90581046");
  assert.equal(entries[0].exchangeHint, "EBS");
  assert.equal(entries[1].url, "https://contract.ibkr.info/v3.10/index.php?action=Conid%20Info&wlId=IB&lang=en&conid=208813720");
  assert.equal(entries[1].exchangeHint, "NASDAQ");
});

test("sorts IBKR detail entries to prefer the requested exchange", () => {
  const ctx = loadHoodlefinance();
  const entries = [
    { exchangeHint: "IBIS", url: "ibis" },
    { exchangeHint: "LSEETF", url: "lse" },
    { exchangeHint: "", url: "other" },
  ];

  ctx.hoodlefinanceSortIbkrDetailEntries_(entries, "LSEETF");

  assert.deepEqual(
    entries.map((entry) => entry.url),
    ["lse", "ibis", "other"]
  );
});

test("builds preferred and fallback IBKR search URLs", () => {
  const ctx = loadHoodlefinance();

  assert.equal(
    JSON.stringify(ctx.hoodlefinanceBuildIbkrSearchUrls_("ISJP", "EBS")),
    JSON.stringify([
      "https://contract.ibkr.info/v3.10/index.php?action=Stock%20Search&lang=en&wlId=IB&showEntities=Y&symbol=ISJP&exchange=EBS",
      "https://contract.ibkr.info/v3.10/index.php?action=Stock%20Search&lang=en&wlId=IB&showEntities=Y&symbol=ISJP",
    ])
  );
});

test("detects IBKR captcha challenges and reports them explicitly", () => {
  const ctx = loadHoodlefinance();
  const url = "https://contract.ibkr.info/v3.10/index.php?action=Stock%20Search&lang=en&wlId=IB&showEntities=Y&symbol=GOOG";

  assert.equal(
    ctx.hoodlefinanceExtractIbkrSearchError_(IBKR_CAPTCHA_HTML, "GOOG", url),
    'IBKR ISIN lookup is currently blocked by a captcha challenge for "GOOG". URL: ' + url
  );

  ctx.UrlFetchApp.fetch = function (url) {
    if (url.indexOf("query1.finance.yahoo.com") >= 0) {
      return {
        getResponseCode() {
          return 200;
        },
        getContentText() {
          return JSON.stringify({
            chart: {
              result: [
                {
                  meta: {
                    symbol: "GOOG",
                  },
                },
              ],
            },
          });
        },
      };
    }

    if (url.indexOf("contract.ibkr.info") >= 0) {
      return {
        getResponseCode() {
          return 200;
        },
        getContentText() {
          return IBKR_CAPTCHA_HTML;
        },
      };
    }

    throw new Error("Unexpected URL " + url);
  };

  assert.throws(
    function () {
      ctx.HOODLEFINANCE("GOOG@IBKR", "isin");
    },
    /IBKR ISIN lookup is currently blocked by a captcha challenge for "GOOG"\. URL: https:\/\/contract\.ibkr\.info\//
  );
});

test("money normalization converts GBp prices to GBP", () => {
  const ctx = loadHoodlefinance();
  const quote = { currency: "GBp" };

  assert.equal(ctx.hoodlefinanceNormalizeMoney_(quote, 1234), 12.34);
  assert.equal(ctx.hoodlefinanceNormalizeCurrency_("GBp"), "GBP");
});

test("money normalization converts ILA prices to ILS", () => {
  const ctx = loadHoodlefinance();
  const quote = { currency: "ILA" };

  assert.equal(ctx.hoodlefinanceNormalizeMoney_(quote, 12345), 123.45);
  assert.equal(ctx.hoodlefinanceNormalizeCurrency_("ILA"), "ILS");
});

test("isin rejects currency pairs with a direct user-facing error", () => {
  const ctx = loadHoodlefinance();
  primeCurrencyCodeData(ctx);

  ctx.UrlFetchApp.fetchAll = function () {
    throw new Error("Unexpected batch fetch");
  };
  ctx.UrlFetchApp.fetch = function (url) {
    if (url === "https://www.google.com/finance/quote/EUR-USD") {
      return createHttpResponse(
        200,
        createGoogleFinancePairHtml(
          "EUR-USD",
          "Euro (EUR / USD)",
          [1.0812, 0.0017, 0.1575, 4, 4, 2],
          1.0795,
          1773599520,
          ["EUR", "USD", "Euro", "United States Dollar", "/m/01l6dm", "/m/09nqf", 2]
        )
      );
    }

    throw new Error("Unexpected URL " + url);
  };

  assert.throws(
    () => ctx.HOODLEFINANCE("EURUSD", "isin"),
    /ISIN is not available for currency pairs\./
  );
  assert.throws(
    () => ctx.HOODLEFINANCE("CURRENCY:EURUSD", "isin"),
    /ISIN is not available for currency pairs\./
  );
  assert.throws(
    () => ctx.HOODLEFINANCE("EURUSD@IBKR", "isin"),
    /ISIN is not available for currency pairs\./
  );
  assert.throws(
    () => ctx.HOODLEFINANCE("EURUSD@GOOGLE", "isin"),
    /ISIN is not available for currency pairs\./
  );
});

test("attribute extraction uses context-aware IBKR source override for isin", () => {
  const ctx = loadHoodlefinance();
  let capturedArgs = null;

  ctx.hoodlefinanceResolveIbkrIsin_ = function (quote, context) {
    capturedArgs = { quote, context };
    return "TESTISIN123";
  };

  const result = ctx.hoodlefinanceExtractAttribute_(
    { symbol: "ISJP.L" },
    "isin",
    { tickerInput: "LON:ISJP@IBKR" }
  );

  assert.equal(result, "TESTISIN123");
  assert.deepEqual(capturedArgs, {
    quote: { symbol: "ISJP.L" },
    context: { tickerInput: "LON:ISJP@IBKR" },
  });
});

test("isin dispatches to the implemented exchange-specific source", () => {
  const ctx = loadHoodlefinance();
  let capturedArgs = null;

  ctx.hoodlefinanceResolvePseIsin_ = function (quote, context) {
    capturedArgs = { quote, context };
    return "PHY030431175";
  };

  assert.equal(
    ctx.hoodlefinanceExtractAttribute_({ symbol: "AAA", isin: "PHY030431175" }, "isin", { tickerInput: "PSE:AAA" }),
    "PHY030431175"
  );
  assert.deepEqual(capturedArgs, {
    quote: { symbol: "AAA", isin: "PHY030431175" },
    context: { tickerInput: "PSE:AAA" },
  });
});

test("isin returns the direct ISIN input without redispatching to a source-specific resolver", () => {
  const ctx = loadHoodlefinance();

  ctx.hoodlefinanceResolveTradingviewIsin_ = function () {
    throw new Error("should not redispatch direct ISIN input");
  };

  assert.equal(
    ctx.hoodlefinanceExtractAttribute_({ symbol: "POLI.TA" }, "isin", { tickerInput: "IL0006625771" }),
    "IL0006625771"
  );
});

test("isin returns the direct ISIN input for ISIN:-prefixed identifiers", () => {
  const ctx = loadHoodlefinance();

  ctx.hoodlefinanceResolveTradingviewIsin_ = function () {
    throw new Error("should not redispatch direct ISIN input");
  };

  assert.equal(
    ctx.hoodlefinanceExtractAttribute_({ symbol: "GOOG" }, "isin", { tickerInput: "ISIN:US02079K1079" }),
    "US02079K1079"
  );
});

test("isin source overrides dispatch through the requested resolver", () => {
  const ctx = loadHoodlefinance();
  let capturedArgs = null;

  ctx.hoodlefinanceResolveIbkrIsin_ = function (quote, context) {
    capturedArgs = { quote, context };
    return "IBKRISIN123";
  };

  assert.equal(
    ctx.hoodlefinanceExtractAttribute_({ symbol: "GOOG" }, "isin", { tickerInput: "GOOG@IBKR" }),
    "IBKRISIN123"
  );
  assert.deepEqual(capturedArgs, {
    quote: { symbol: "GOOG" },
    context: { tickerInput: "GOOG@IBKR" },
  });
});

test("extracts exact LON listings from search results", () => {
  const ctx = loadHoodlefinance();

  ctx.UrlFetchApp.fetch = function (url) {
    if (url === "https://www.londonstockexchange.com/exchange/instrument-result.html?codeName=CPXJ") {
      return {
        getResponseCode() {
          return 200;
        },
        getContentText() {
          return LON_SEARCH_CPXJ_HTML;
        },
      };
    }

    throw new Error("Unexpected URL " + url);
  };

  assert.equal(
    JSON.stringify(ctx.hoodlefinanceExtractLonListings_(LON_SEARCH_SJPA_HTML)),
    JSON.stringify([
      {
        code: "SJPA",
        countryCode: "ZZ",
        currency: "GBX",
        isin: "IE00B4L5YX21",
        marketCode: "EUE2",
        name: "ISHARES III PLC ISHRS CORE MSCI JAPAN IMI ETF USD (ACC)",
        sedol: "B4L61L2",
        symbol: "SJPA",
      },
    ])
  );

  assert.equal(
    JSON.stringify(ctx.hoodlefinanceResolveLonListing_("CPXJ")),
    JSON.stringify({
      code: "CPXJ",
      countryCode: "IE",
      currency: "USD",
      isin: "IE00B52MJY50",
      marketCode: "EUET",
      name: "ISHARES VII PLC MSCI PACIFIC EX-JAPAN ETF USD ACC",
      sedol: "B4ZYLW3",
      symbol: "CPXJ",
    })
  );
});

test("isin@LON resolves from the public LSE search results", () => {
  const ctx = loadHoodlefinance();

  ctx.UrlFetchApp.fetch = function (url) {
    if (url === "https://www.londonstockexchange.com/exchange/instrument-result.html?codeName=SJPA") {
      return {
        getResponseCode() {
          return 200;
        },
        getContentText() {
          return LON_SEARCH_SJPA_HTML;
        },
      };
    }

    throw new Error("Unexpected URL " + url);
  };

  assert.equal(
    ctx.hoodlefinanceExtractAttribute_({ symbol: "SJPA.L" }, "isin", { tickerInput: "SJPA.L@LON" }),
    "IE00B4L5YX21"
  );
});

test("extracts exact ARIVA listing matches from live search results", () => {
  const ctx = loadHoodlefinance();

  assert.equal(
    JSON.stringify(ctx.hoodlefinanceExtractArivaListings_(ARIVA_SEARCH_ZPRV_HTML)),
    JSON.stringify([
      {
        code: "ZPRV",
        href: "/fonds/spdr-msci-usa-small-cap-value-weighted-ucits-etf",
        type: "Fonds",
      },
    ])
  );
});

test("isin@ARIVA resolves from ARIVA search and detail pages", () => {
  const ctx = loadHoodlefinance();

  ctx.UrlFetchApp.fetch = function (url) {
    if (url === "https://www.ariva.de/search/livesearch.m?searchname=ZPRV") {
      return {
        getResponseCode() {
          return 200;
        },
        getContentText() {
          return ARIVA_SEARCH_ZPRV_HTML;
        },
      };
    }

    if (url === "https://www.ariva.de/fonds/spdr-msci-usa-small-cap-value-weighted-ucits-etf") {
      return {
        getResponseCode() {
          return 200;
        },
        getContentText() {
          return ARIVA_DETAIL_ZPRV_HTML;
        },
      };
    }

    throw new Error("Unexpected URL " + url);
  };

  assert.equal(
    ctx.hoodlefinanceExtractAttribute_({ symbol: "ZPRV.DE" }, "isin", { tickerInput: "ZPRV.DE@ARIVA" }),
    "IE00BSPLC413"
  );
});

test("isin@ARIVA reuses the cached string result without repeating the upstream fetches", () => {
  const ctx = loadHoodlefinance();
  const seenUrls = [];

  ctx.UrlFetchApp.fetch = function (url) {
    seenUrls.push(url);

    if (url === "https://www.ariva.de/search/livesearch.m?searchname=ZPRV") {
      return createHttpResponse(200, ARIVA_SEARCH_ZPRV_HTML);
    }

    if (url === "https://www.ariva.de/fonds/spdr-msci-usa-small-cap-value-weighted-ucits-etf") {
      return createHttpResponse(200, ARIVA_DETAIL_ZPRV_HTML);
    }

    throw new Error("Unexpected URL " + url);
  };

  assert.equal(
    ctx.hoodlefinanceExtractAttribute_({ symbol: "ZPRV.DE" }, "isin", { tickerInput: "ZPRV.DE@ARIVA" }),
    "IE00BSPLC413"
  );
  assert.equal(
    ctx.hoodlefinanceExtractAttribute_({ symbol: "ZPRV.DE" }, "isin", { tickerInput: "ZPRV.DE@ARIVA" }),
    "IE00BSPLC413"
  );
  assert.deepEqual(seenUrls, [
    "https://www.ariva.de/search/livesearch.m?searchname=ZPRV",
    "https://www.ariva.de/fonds/spdr-msci-usa-small-cap-value-weighted-ucits-etf",
  ]);
});

test("isin dispatches to TradingView for ETR tickers", () => {
  const ctx = loadHoodlefinance();
  let capturedArgs = null;

  ctx.hoodlefinanceResolveTradingviewIsin_ = function (quote, context) {
    capturedArgs = { quote, context };
    return "IE00BSPLC298";
  };

  assert.equal(
    ctx.hoodlefinanceExtractAttribute_({ symbol: "ZPRX.DE" }, "isin", { tickerInput: "ZPRX.DE" }),
    "IE00BSPLC298"
  );
  assert.deepEqual(capturedArgs, {
    quote: { symbol: "ZPRX.DE" },
    context: { tickerInput: "ZPRX.DE" },
  });
});

test("isin dispatches to LON for London tickers", () => {
  const ctx = loadHoodlefinance();
  let capturedArgs = null;

  ctx.hoodlefinanceResolveLonIsin_ = function (quote, context) {
    capturedArgs = { quote, context };
    return "IE00B4L5YX21";
  };

  assert.equal(
    ctx.hoodlefinanceExtractAttribute_({ symbol: "SJPA.L" }, "isin", { tickerInput: "SJPA.L" }),
    "IE00B4L5YX21"
  );
  assert.deepEqual(capturedArgs, {
    quote: { symbol: "SJPA.L" },
    context: { tickerInput: "SJPA.L" },
  });
});

test("isin dispatches to TradingView for NASDAQ tickers", () => {
  const ctx = loadHoodlefinance();
  let capturedArgs = null;

  ctx.hoodlefinanceResolveTradingviewIsin_ = function (quote, context) {
    capturedArgs = { quote, context };
    return "US02079K1079";
  };

  assert.equal(
    ctx.hoodlefinanceExtractAttribute_({ symbol: "GOOG", exchangeName: "NMS" }, "isin", { tickerInput: "GOOG" }),
    "US02079K1079"
  );
  assert.deepEqual(capturedArgs, {
    quote: { symbol: "GOOG", exchangeName: "NMS" },
    context: { tickerInput: "GOOG" },
  });
});

test("isin dispatches to TradingView for NEO tickers", () => {
  const ctx = loadHoodlefinance();
  let capturedArgs = null;

  ctx.hoodlefinanceResolveTradingviewIsin_ = function (quote, context) {
    capturedArgs = { quote, context };
    return "CA05582Y1007";
  };

  assert.equal(
    ctx.hoodlefinanceExtractAttribute_({ symbol: "ZTL.NE" }, "isin", { tickerInput: "ZTL.NE" }),
    "CA05582Y1007"
  );
  assert.deepEqual(capturedArgs, {
    quote: { symbol: "ZTL.NE" },
    context: { tickerInput: "ZTL.NE" },
  });
});

test("isin dispatches to TradingView for NYSEARCA tickers inferred from metadata", () => {
  const ctx = loadHoodlefinance();
  let capturedArgs = null;

  ctx.hoodlefinanceResolveTradingviewIsin_ = function (quote, context) {
    capturedArgs = { quote, context };
    return "US05351W1036";
  };

  assert.equal(
    ctx.hoodlefinanceExtractAttribute_({ symbol: "AVLV", exchangeName: "PCX" }, "isin", { tickerInput: "AVLV" }),
    "US05351W1036"
  );
  assert.deepEqual(capturedArgs, {
    quote: { symbol: "AVLV", exchangeName: "PCX" },
    context: { tickerInput: "AVLV" },
  });
});

test("isin dispatches to TradingView for OTCMKTS tickers", () => {
  const ctx = loadHoodlefinance();
  let capturedArgs = null;

  ctx.hoodlefinanceResolveTradingviewIsin_ = function (quote, context) {
    capturedArgs = { quote, context };
    return "US7757812067";
  };

  assert.equal(
    ctx.hoodlefinanceExtractAttribute_({ symbol: "RYCEY", exchangeName: "PNK" }, "isin", { tickerInput: "OTCMKTS:RYCEY" }),
    "US7757812067"
  );
  assert.deepEqual(capturedArgs, {
    quote: { symbol: "RYCEY", exchangeName: "PNK" },
    context: { tickerInput: "OTCMKTS:RYCEY" },
  });
});

test("isin dispatches to TradingView for TLV tickers", () => {
  const ctx = loadHoodlefinance();
  let capturedArgs = null;

  ctx.hoodlefinanceResolveTradingviewIsin_ = function (quote, context) {
    capturedArgs = { quote, context };
    return "IL0006625771";
  };

  assert.equal(
    ctx.hoodlefinanceExtractAttribute_({ symbol: "POLI.TA" }, "isin", { tickerInput: "POLI.TA" }),
    "IL0006625771"
  );
  assert.deepEqual(capturedArgs, {
    quote: { symbol: "POLI.TA" },
    context: { tickerInput: "POLI.TA" },
  });
});

test("isin dispatches to TradingView for SGX tickers", () => {
  const ctx = loadHoodlefinance();
  let capturedArgs = null;

  ctx.hoodlefinanceResolveTradingviewIsin_ = function (quote, context) {
    capturedArgs = { quote, context };
    return "SG1L01001701";
  };

  assert.equal(
    ctx.hoodlefinanceExtractAttribute_({ symbol: "D05.SI" }, "isin", { tickerInput: "SGX:D05" }),
    "SG1L01001701"
  );
  assert.deepEqual(capturedArgs, {
    quote: { symbol: "D05.SI" },
    context: { tickerInput: "SGX:D05" },
  });
});

test("isin fails clearly when no exchange-specific source is implemented", () => {
  const ctx = loadHoodlefinance();

  assert.throws(
    function () {
      ctx.hoodlefinanceExtractAttribute_({ symbol: "VWRP.SW" }, "isin", { tickerInput: "VWRP.SW" });
    },
    /No isin source is implemented for exchange "SIX"\. Use an identifier source override such as "@TRADINGVIEW", "@LON", "@PSE", "@ARIVA", or "@IBKR"\./
  );
});

test("extracts TradingView symbol metadata from the page bootstrap", () => {
  const ctx = loadHoodlefinance();

  assert.equal(ctx.hoodlefinanceExtractTradingviewResolvedSymbol_(TRADINGVIEW_XETR_ZPRX_HTML), "XETR:ZPRX");
  assert.equal(ctx.hoodlefinanceExtractTradingviewIsin_(TRADINGVIEW_XETR_ZPRX_HTML), "IE00BSPLC298");
  assert.equal(ctx.hoodlefinanceExtractTradingviewResolvedSymbol_(TRADINGVIEW_OTC_RYCEY_HTML), "OTC:RYCEY");
  assert.equal(ctx.hoodlefinanceExtractTradingviewIsin_(TRADINGVIEW_OTC_RYCEY_HTML), "US7757812067");
  assert.equal(ctx.hoodlefinanceExtractTradingviewResolvedSymbol_(TRADINGVIEW_SGX_D05_HTML), "SGX:D05");
  assert.equal(ctx.hoodlefinanceExtractTradingviewIsin_(TRADINGVIEW_SGX_D05_HTML), "SG1L01001701");
  assert.equal(ctx.hoodlefinanceExtractTradingviewResolvedSymbol_(TRADINGVIEW_TASE_POLI_HTML), "TASE:POLI");
  assert.equal(ctx.hoodlefinanceExtractTradingviewIsin_(TRADINGVIEW_TASE_POLI_HTML), "IL0006625771");
  assert.equal(ctx.hoodlefinanceExtractTradingviewResolvedSymbol_(TRADINGVIEW_NEO_ZTL_HTML), "NEO:ZTL");
  assert.equal(ctx.hoodlefinanceExtractTradingviewIsin_(TRADINGVIEW_NEO_ZTL_HTML), "CA05582Y1007");
});

test("isin@TRADINGVIEW resolves for XETR tickers", () => {
  const ctx = loadHoodlefinance();

  ctx.UrlFetchApp.fetch = function (url) {
    if (url === "https://www.tradingview.com/symbols/XETR-ZPRX/") {
      return {
        getResponseCode() {
          return 200;
        },
        getContentText() {
          return TRADINGVIEW_XETR_ZPRX_HTML;
        },
      };
    }

    throw new Error("Unexpected URL " + url);
  };

  assert.equal(
    ctx.hoodlefinanceExtractAttribute_({ symbol: "ZPRX.DE" }, "isin", { tickerInput: "ZPRX.DE@TRADINGVIEW" }),
    "IE00BSPLC298"
  );
});

test("isin@TRADINGVIEW resolves for LON tickers", () => {
  const ctx = loadHoodlefinance();

  ctx.UrlFetchApp.fetch = function (url) {
    if (url === "https://www.tradingview.com/symbols/LSE-SJPA/") {
      return {
        getResponseCode() {
          return 200;
        },
        getContentText() {
          return TRADINGVIEW_LSE_SJPA_HTML;
        },
      };
    }

    throw new Error("Unexpected URL " + url);
  };

  assert.equal(
    ctx.hoodlefinanceExtractAttribute_({ symbol: "SJPA.L" }, "isin", { tickerInput: "SJPA.L@TRADINGVIEW" }),
    "IE00B4L5YX21"
  );
});

test("isin@TRADINGVIEW resolves for NASDAQ tickers", () => {
  const ctx = loadHoodlefinance();

  ctx.UrlFetchApp.fetch = function (url) {
    if (url === "https://www.tradingview.com/symbols/NASDAQ-GOOG/") {
      return {
        getResponseCode() {
          return 200;
        },
        getContentText() {
          return TRADINGVIEW_NASDAQ_GOOG_HTML;
        },
      };
    }

    throw new Error("Unexpected URL " + url);
  };

  assert.equal(
    ctx.hoodlefinanceExtractAttribute_({ symbol: "GOOG", exchangeName: "NMS" }, "isin", { tickerInput: "GOOG@TRADINGVIEW" }),
    "US02079K1079"
  );
});

test("isin@TRADINGVIEW resolves for NYSEARCA tickers", () => {
  const ctx = loadHoodlefinance();

  ctx.UrlFetchApp.fetch = function (url) {
    if (url === "https://www.tradingview.com/symbols/AMEX-AVLV/") {
      return {
        getResponseCode() {
          return 200;
        },
        getContentText() {
          return TRADINGVIEW_AMEX_AVLV_HTML;
        },
      };
    }

    throw new Error("Unexpected URL " + url);
  };

  assert.equal(
    ctx.hoodlefinanceExtractAttribute_({ symbol: "AVLV", exchangeName: "PCX" }, "isin", { tickerInput: "AVLV@TRADINGVIEW" }),
    "US05351W1036"
  );
});

test("isin@TRADINGVIEW resolves for OTCMKTS tickers", () => {
  const ctx = loadHoodlefinance();

  ctx.UrlFetchApp.fetch = function (url) {
    if (url === "https://www.tradingview.com/symbols/OTC-RYCEY/") {
      return {
        getResponseCode() {
          return 200;
        },
        getContentText() {
          return TRADINGVIEW_OTC_RYCEY_HTML;
        },
      };
    }

    throw new Error("Unexpected URL " + url);
  };

  assert.equal(
    ctx.hoodlefinanceExtractAttribute_({ symbol: "RYCEY", exchangeName: "PNK" }, "isin", { tickerInput: "OTCMKTS:RYCEY@TRADINGVIEW" }),
    "US7757812067"
  );
});

test("isin@TRADINGVIEW resolves for SGX tickers", () => {
  const ctx = loadHoodlefinance();

  ctx.UrlFetchApp.fetch = function (url) {
    if (url === "https://www.tradingview.com/symbols/SGX-D05/") {
      return {
        getResponseCode() {
          return 200;
        },
        getContentText() {
          return TRADINGVIEW_SGX_D05_HTML;
        },
      };
    }

    throw new Error("Unexpected URL " + url);
  };

  assert.equal(
    ctx.hoodlefinanceExtractAttribute_({ symbol: "D05.SI" }, "isin", { tickerInput: "SGX:D05@TRADINGVIEW" }),
    "SG1L01001701"
  );
});

test("isin@TRADINGVIEW resolves for NEO tickers", () => {
  const ctx = loadHoodlefinance();

  ctx.UrlFetchApp.fetch = function (url) {
    if (url === "https://www.tradingview.com/symbols/NEO-ZTL/") {
      return {
        getResponseCode() {
          return 200;
        },
        getContentText() {
          return TRADINGVIEW_NEO_ZTL_HTML;
        },
      };
    }

    throw new Error("Unexpected URL " + url);
  };

  assert.equal(
    ctx.hoodlefinanceExtractAttribute_({ symbol: "ZTL.NE" }, "isin", { tickerInput: "ZTL.NE@TRADINGVIEW" }),
    "CA05582Y1007"
  );
});

test("isin@TRADINGVIEW resolves for TLV tickers", () => {
  const ctx = loadHoodlefinance();

  ctx.UrlFetchApp.fetch = function (url) {
    if (url === "https://www.tradingview.com/symbols/TASE-POLI/") {
      return {
        getResponseCode() {
          return 200;
        },
        getContentText() {
          return TRADINGVIEW_TASE_POLI_HTML;
        },
      };
    }

    throw new Error("Unexpected URL " + url);
  };

  assert.equal(
    ctx.hoodlefinanceExtractAttribute_({ symbol: "POLI.TA" }, "isin", { tickerInput: "POLI.TA@TRADINGVIEW" }),
    "IL0006625771"
  );
});

test("isin@TRADINGVIEW normalizes TLV fund aliases before TradingView lookup", () => {
  const ctx = loadHoodlefinance();

  ctx.UrlFetchApp.fetch = function (url) {
    if (url === "https://www.tradingview.com/symbols/TASE-KSM.F59/") {
      return {
        getResponseCode() {
          return 200;
        },
        getContentText() {
          return TRADINGVIEW_TASE_KSM_F59_HTML;
        },
      };
    }

    throw new Error("Unexpected URL " + url);
  };

  assert.equal(
    ctx.hoodlefinanceExtractAttribute_({ symbol: "KSM.F59.TA" }, "isin", { tickerInput: "TLV:KSMF59@TRADINGVIEW" }),
    "IL0011465700"
  );
});

test("isin@TRADINGVIEW rejects mismatched TradingView symbols", () => {
  const ctx = loadHoodlefinance();

  ctx.UrlFetchApp.fetch = function () {
    return {
      getResponseCode() {
        return 200;
      },
      getContentText() {
        return TRADINGVIEW_LSE_SJPA_HTML;
      },
    };
  };

  assert.throws(
    function () {
      ctx.hoodlefinanceExtractAttribute_({ symbol: "ZPRX.DE" }, "isin", { tickerInput: "ZPRX.DE@TRADINGVIEW" });
    },
    /TradingView resolved "XETR:ZPRX" to "LSE:SJPA" instead of an exact symbol match\./
  );
});

test("extracts exact PSE listing matches from search results", () => {
  const ctx = loadHoodlefinance();

  ctx.UrlFetchApp.fetch = function (url) {
    assert.equal(url, "https://edge.pse.com.ph/companyDirectory/search.ax?keyword=AC");
    return {
      getResponseCode() {
        return 200;
      },
      getContentText() {
        return PSE_SEARCH_AC_HTML;
      },
    };
  };

  assert.equal(
    JSON.stringify(ctx.hoodlefinanceExtractPseListings_(PSE_SEARCH_AAA_HTML)),
    JSON.stringify([
      {
        companyId: "55",
        name: "Asia Amalgamated Holdings Corporation",
        securityId: "347",
        symbol: "AAA",
      },
    ])
  );

  assert.equal(
    JSON.stringify(ctx.hoodlefinanceResolvePseListing_.call(null, "AC")),
    JSON.stringify({
      companyId: "57",
      name: "Ayala Corporation",
      securityId: "180",
      symbol: "AC",
    })
  );
});

test("reuses cached PSE listings without repeating the search fetch", () => {
  const ctx = loadHoodlefinance();
  const seenUrls = [];

  ctx.UrlFetchApp.fetch = function (url) {
    seenUrls.push(url);
    assert.equal(url, "https://edge.pse.com.ph/companyDirectory/search.ax?keyword=AC");
    return createHttpResponse(200, PSE_SEARCH_AC_HTML);
  };

  assert.equal(
    JSON.stringify(ctx.hoodlefinanceResolvePseListing_("AC")),
    JSON.stringify({
      companyId: "57",
      name: "Ayala Corporation",
      securityId: "180",
      symbol: "AC",
    })
  );
  assert.equal(
    JSON.stringify(ctx.hoodlefinanceResolvePseListing_("AC")),
    JSON.stringify({
      companyId: "57",
      name: "Ayala Corporation",
      securityId: "180",
      symbol: "AC",
    })
  );
  assert.deepEqual(seenUrls, ["https://edge.pse.com.ph/companyDirectory/search.ax?keyword=AC"]);
});

test("parses active PSE stock pages into the quote model", () => {
  const ctx = loadHoodlefinance();
  const quote = ctx.hoodlefinanceExtractPseQuote_(PSE_STOCK_BDO_HTML, {
    companyId: "260",
    name: "BDO Unibank, Inc.",
    securityId: "468",
    symbol: "BDO",
  });

  assert.equal(quote.symbol, "BDO");
  assert.equal(quote.longName, "BDO Unibank, Inc.");
  assert.equal(quote.currency, "PHP");
  assert.equal(quote.isin, "PHY077751022");
  assert.equal(quote.regularMarketPrice, 123.8);
  assert.equal(quote.regularMarketOpen, 122.2);
  assert.equal(quote.regularMarketDayHigh, 124.2);
  assert.equal(quote.regularMarketDayLow, 122.2);
  assert.equal(quote.regularMarketPreviousClose, 120.2);
  assert.equal(quote.regularMarketVolume, 3435630);
  assert.equal(quote.regularMarketChange, 3.6);
  assert.equal(quote.regularMarketChangePercent, 0.03);
});

test("parses suspended PSE stock pages and falls back to previous close for price", () => {
  const ctx = loadHoodlefinance();
  const quote = ctx.hoodlefinanceExtractPseQuote_(PSE_STOCK_AAA_HTML, {
    companyId: "55",
    name: "Asia Amalgamated Holdings Corporation",
    securityId: "347",
    symbol: "AAA",
  });

  assert.equal(quote.symbol, "AAA");
  assert.equal(quote.isin, "PHY030431175");
  assert.equal(quote.regularMarketPrice, 1.63);
  assert.equal(quote.regularMarketPreviousClose, 1.63);
  assert.equal(quote.regularMarketOpen, null);
  assert.equal(quote.regularMarketVolume, null);
  assert.equal(quote.regularMarketChange, 0);
  assert.equal(quote.regularMarketChangePercent, 0);
});

test("fetches PSE quotes through the direct PSE path", () => {
  const ctx = loadHoodlefinance();

  ctx.UrlFetchApp.fetch = function (url) {
    if (url === "https://edge.pse.com.ph/companyDirectory/search.ax?keyword=AAA") {
      return {
        getResponseCode() {
          return 200;
        },
        getContentText() {
          return PSE_SEARCH_AAA_HTML;
        },
      };
    }

    if (url === "https://edge.pse.com.ph/companyPage/stockData.do?cmpy_id=55&security_id=347") {
      return {
        getResponseCode() {
          return 200;
        },
        getContentText() {
          return PSE_STOCK_AAA_HTML;
        },
      };
    }

    throw new Error("Unexpected URL " + url);
  };

  const quote = ctx.hoodlefinanceFetchQuote_("PSE:AAA");

  assert.equal(quote.symbol, "AAA");
  assert.equal(quote.currency, "PHP");
  assert.equal(quote.isin, "PHY030431175");
  assert.equal(quote.regularMarketPrice, 1.63);
});

test("reports a clearer outage error when the PSE search page is unavailable", () => {
  const ctx = loadHoodlefinance();

  ctx.UrlFetchApp.fetch = function (url) {
    assert.equal(url, "https://edge.pse.com.ph/companyDirectory/search.ax?keyword=BDO");
    return createHttpResponse(520, PSE_HTTP_520_TEXT);
  };

  assert.throws(
    function () {
      ctx.hoodlefinanceFetchQuote_("PSE:BDO");
    },
    /The PSE data source is currently unavailable \(PSE upstream returned Cloudflare HTTP 520\.\)\. Please try again later\./
  );
});

test("reports a clearer outage error for lower-level PSE fetch failures", () => {
  const ctx = loadHoodlefinance();

  ctx.UrlFetchApp.fetch = function (url) {
    assert.equal(url, "https://edge.pse.com.ph/companyDirectory/search.ax?keyword=BDO");
    throw new Error("Could not resolve host: edge.pse.com.ph");
  };

  assert.throws(
    function () {
      ctx.hoodlefinanceFetchQuote_("PSE:BDO");
    },
    /The PSE data source is currently unavailable \(Could not resolve host: edge\.pse\.com\.ph\)\. Please try again later\./
  );
});

test("reports a clearer outage error when the PSE stock page is unavailable", () => {
  const ctx = loadHoodlefinance();

  ctx.UrlFetchApp.fetch = function (url) {
    if (url === "https://edge.pse.com.ph/companyDirectory/search.ax?keyword=BDO") {
      return createHttpResponse(200, PSE_SEARCH_BDO_HTML);
    }

    if (url === "https://edge.pse.com.ph/companyPage/stockData.do?cmpy_id=260&security_id=468") {
      return createHttpResponse(520, PSE_HTTP_520_TEXT);
    }

    throw new Error("Unexpected URL " + url);
  };

  assert.throws(
    function () {
      ctx.hoodlefinanceFetchQuote_("PSE:BDO");
    },
    /The PSE data source is currently unavailable \(PSE upstream returned Cloudflare HTTP 520\.\)\. Please try again later\./
  );
});

test("shared batch PSE fetches reuse a warmed listing cache", () => {
  const ctx = loadHoodlefinance();
  const seenUrls = [];
  const seenBatches = [];

  ctx.UrlFetchApp.fetch = function (url) {
    seenUrls.push(url);

    if (url === "https://edge.pse.com.ph/companyDirectory/search.ax?keyword=BDO") {
      return createHttpResponse(200, PSE_SEARCH_BDO_HTML);
    }

    if (url === "https://edge.pse.com.ph/companyPage/stockData.do?cmpy_id=260&security_id=468") {
      return createHttpResponse(200, PSE_STOCK_BDO_HTML);
    }

    throw new Error("Unexpected URL " + url);
  };

  ctx.hoodlefinanceResolvePseListing_("BDO");
  seenUrls.length = 0;
  ctx.UrlFetchApp.fetchAll = function (requests) {
    seenBatches.push(requests.map((request) => request.url));
    return requests.map((request) => ctx.UrlFetchApp.fetch(request.url));
  };

  assert.equal(
    JSON.stringify(ctx.HOODLEFINANCE([["PSE:BDO"], ["PSE:BDO"]], "price")),
    JSON.stringify([[123.8], [123.8]])
  );
  assert.deepEqual(seenUrls, ["https://edge.pse.com.ph/companyPage/stockData.do?cmpy_id=260&security_id=468"]);
  assert.equal(
    JSON.stringify(seenBatches),
    JSON.stringify([
      [
        "https://edge.pse.com.ph/companyPage/stockData.do?cmpy_id=260&security_id=468",
      ],
    ])
  );
});

test("shared batch PSE fetches surface a clearer outage error", () => {
  const ctx = loadHoodlefinance();

  ctx.UrlFetchApp.fetch = function (url) {
    if (url === "https://edge.pse.com.ph/companyDirectory/search.ax?keyword=BDO") {
      return createHttpResponse(520, PSE_HTTP_520_TEXT);
    }

    throw new Error("Unexpected URL " + url);
  };
  ctx.UrlFetchApp.fetchAll = function (requests) {
    return requests.map((request) => ctx.UrlFetchApp.fetch(request.url));
  };

  assert.throws(
    function () {
      ctx.HOODLEFINANCE("PSE:BDO", "price");
    },
    /The PSE data source is currently unavailable \(PSE upstream returned Cloudflare HTTP 520\.\)\. Please try again later\./
  );
});

test("isin@PSE returns direct quote isin", () => {
  const ctx = loadHoodlefinance();

  assert.equal(
    ctx.hoodlefinanceExtractAttribute_({ symbol: "AAA", isin: "PHY030431175" }, "isin", { tickerInput: "PSE:AAA@PSE" }),
    "PHY030431175"
  );
});

test("isin@PSE rejects non-PSE tickers", () => {
  const ctx = loadHoodlefinance();

  assert.throws(
    function () {
      ctx.hoodlefinanceExtractAttribute_({ symbol: "GOOG", exchangeName: "NMS" }, "isin", { tickerInput: "GOOG@PSE" });
    },
    /PSE isin lookup is only implemented for PSE tickers\./
  );
});

test("isin@LON rejects non-LON tickers", () => {
  const ctx = loadHoodlefinance();

  assert.throws(
    function () {
      ctx.hoodlefinanceExtractAttribute_({ symbol: "GOOG", exchangeName: "NMS" }, "isin", { tickerInput: "GOOG@LON" });
    },
    /LON isin lookup is only implemented for LON tickers\./
  );
});

test("isin@ARIVA rejects non-ETR tickers", () => {
  const ctx = loadHoodlefinance();

  assert.throws(
    function () {
      ctx.hoodlefinanceExtractAttribute_({ symbol: "SJPA.L" }, "isin", { tickerInput: "SJPA.L@ARIVA" });
    },
    /ARIVA isin lookup is only implemented for ETR tickers\./
  );
});

test("isin@IBKR does not short-circuit to direct quote isin", () => {
  const ctx = loadHoodlefinance();
  let capturedArgs = null;

  ctx.hoodlefinanceResolveIbkrIsin_ = function (quote, context) {
    capturedArgs = { quote, context };
    return "IBKRISIN123";
  };

  assert.equal(
    ctx.hoodlefinanceExtractAttribute_({ symbol: "AAA", isin: "PHY030431175" }, "isin", { tickerInput: "PSE:AAA@IBKR" }),
    "IBKRISIN123"
  );
  assert.deepEqual(capturedArgs, {
    quote: { symbol: "AAA", isin: "PHY030431175" },
    context: { tickerInput: "PSE:AAA@IBKR" },
  });
});
