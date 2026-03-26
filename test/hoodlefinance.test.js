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
  cryptoCodes: ["ADA", "BCH", "BNB", "BTC", "DOGE", "ETH", "LTC", "SOL", "TUSD", "USDC", "USDT", "XRP"],
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

function createTradingviewSymbolHtml(symbolInfo, trailingHtml) {
  return [
    "<script>",
    "window.initData = {};",
    "window.initData.symbolInfo = " + JSON.stringify(symbolInfo) + ";",
    "</script>",
    trailingHtml || "",
  ].join("\n");
}

const TRADINGVIEW_XETR_ZPRX_HTML = createTradingviewSymbolHtml({
  resolved_symbol: "XETR:ZPRX",
  isin_displayed: "IE00BSPLC298",
  exchange: "XETR",
  short_name: "ZPRX",
});

const TRADINGVIEW_LSE_SJPA_HTML = createTradingviewSymbolHtml({
  resolved_symbol: "LSE:SJPA",
  isin_displayed: "IE00B4L5YX21",
  exchange: "LSE",
  short_name: "SJPA",
});

const TRADINGVIEW_NASDAQ_GOOG_HTML = createTradingviewSymbolHtml({
  resolved_symbol: "NASDAQ:GOOG",
  isin_displayed: "US02079K1079",
  exchange: "NASDAQ",
  short_name: "GOOG",
});

const TRADINGVIEW_NYSE_IBM_HTML = createTradingviewSymbolHtml({
  resolved_symbol: "NYSE:IBM",
  isin_displayed: "US4592001014",
  exchange: "NYSE",
  short_name: "IBM",
});

const TRADINGVIEW_AMEX_AVLV_HTML = createTradingviewSymbolHtml({
  resolved_symbol: "AMEX:AVLV",
  isin_displayed: "US05351W1036",
  exchange: "AMEX",
  short_name: "AVLV",
});

const TRADINGVIEW_EURONEXT_SEMI_HTML = createTradingviewSymbolHtml({
  resolved_symbol: "EURONEXT:SEMI",
  isin_displayed: "IE000I8KRLL9",
  exchange: "EURONEXT",
  short_name: "SEMI",
});

const TRADINGVIEW_EURONEXT_ABI_HTML = createTradingviewSymbolHtml({
  resolved_symbol: "EURONEXT:ABI",
  isin_displayed: "BE0974293251",
  exchange: "EURONEXT",
  short_name: "ABI",
});

const TRADINGVIEW_EURONEXT_MC_HTML = createTradingviewSymbolHtml({
  resolved_symbol: "EURONEXT:MC",
  isin_displayed: "FR0000121014",
  exchange: "EURONEXT",
  short_name: "MC",
});

const TRADINGVIEW_EURONEXT_OR_HTML = createTradingviewSymbolHtml({
  resolved_symbol: "EURONEXT:OR",
  isin_displayed: "FR0000120321",
  exchange: "EURONEXT",
  short_name: "OR",
});

const TRADINGVIEW_ASX_BHP_HTML = createTradingviewSymbolHtml({
  resolved_symbol: "ASX:BHP",
  isin_displayed: "AU000000BHP4",
  exchange: "ASX",
  short_name: "BHP",
});

const TRADINGVIEW_MIL_ENEL_HTML = createTradingviewSymbolHtml({
  resolved_symbol: "MIL:ENEL",
  isin_displayed: "IT0003128367",
  exchange: "MIL",
  short_name: "ENEL",
});

const TRADINGVIEW_OMXCOP_GN_HTML = createTradingviewSymbolHtml({
  resolved_symbol: "OMXCOP:GN",
  isin_displayed: "DK0010272632",
  exchange: "OMXCOP",
  short_name: "GN",
});

const TRADINGVIEW_FWB_BMW_HTML = createTradingviewSymbolHtml({
  resolved_symbol: "FWB:BMW",
  isin_displayed: "DE0005190003",
  exchange: "FWB",
  short_name: "BMW",
});

const TRADINGVIEW_BME_SAN_HTML = createTradingviewSymbolHtml({
  resolved_symbol: "BME:SAN",
  isin_displayed: "ES0113900J37",
  exchange: "BME",
  short_name: "SAN",
});

const TRADINGVIEW_OMXHEX_NOKIA_HTML = createTradingviewSymbolHtml({
  resolved_symbol: "OMXHEX:NOKIA",
  isin_displayed: "FI0009000681",
  exchange: "OMXHEX",
  short_name: "NOKIA",
});

const TRADINGVIEW_JSE_SOL_HTML = createTradingviewSymbolHtml({
  resolved_symbol: "JSE:SOL",
  isin_displayed: "ZAE000006896",
  exchange: "JSE",
  short_name: "SOL",
});

const TRADINGVIEW_OSL_EQNR_HTML = createTradingviewSymbolHtml({
  resolved_symbol: "OSL:EQNR",
  isin_displayed: "NO0010096985",
  exchange: "OSL",
  short_name: "EQNR",
});

const TRADINGVIEW_NSE_RELIANCE_HTML = createTradingviewSymbolHtml({
  resolved_symbol: "NSE:RELIANCE",
  isin_displayed: "INE002A01018",
  exchange: "NSE",
  short_name: "RELIANCE",
});

const TRADINGVIEW_NZX_SPK_HTML = createTradingviewSymbolHtml({
  resolved_symbol: "NZX:SPK",
  isin_displayed: "NZTELE0001S4",
  exchange: "NZX",
  short_name: "SPK",
});

const TRADINGVIEW_BSE_RELIANCE_HTML = createTradingviewSymbolHtml({
  resolved_symbol: "BSE:RELIANCE",
  isin_displayed: "INE002A01018",
  exchange: "BSE",
  short_name: "RELIANCE",
});

const TRADINGVIEW_BMV_WALMEX_HTML = createTradingviewSymbolHtml({
  resolved_symbol: "BMV:WALMEX",
  isin_displayed: "MX01WA000038",
  exchange: "BMV",
  short_name: "WALMEX",
});

const TRADINGVIEW_BMFBOVESPA_PETR4_HTML = createTradingviewSymbolHtml({
  resolved_symbol: "BMFBOVESPA:PETR4",
  isin_displayed: "BRPETRACNPR6",
  exchange: "BMFBOVESPA",
  short_name: "PETR4",
});

const TRADINGVIEW_TSX_BCE_HTML = createTradingviewSymbolHtml({
  resolved_symbol: "TSX:BCE",
  isin_displayed: "CA05534B7604",
  exchange: "TSX",
  short_name: "BCE",
});

const TRADINGVIEW_SIX_NESN_HTML = createTradingviewSymbolHtml({
  resolved_symbol: "SIX:NESN",
  isin_displayed: "CH0038863350",
  exchange: "SIX",
  short_name: "NESN",
});

const TRADINGVIEW_OMXSTO_AZA_HTML = createTradingviewSymbolHtml({
  resolved_symbol: "OMXSTO:AZA",
  isin_displayed: "SE0012454072",
  exchange: "OMXSTO",
  short_name: "AZA",
});

const TRADINGVIEW_TWSE_2330_HTML = createTradingviewSymbolHtml({
  resolved_symbol: "TWSE:2330",
  isin_displayed: "TW0002330008",
  exchange: "TWSE",
  short_name: "2330",
});

const TRADINGVIEW_BIST_THYAO_HTML = createTradingviewSymbolHtml({
  resolved_symbol: "BIST:THYAO",
  isin_displayed: "TRATHYAO91M5",
  exchange: "BIST",
  short_name: "THYAO",
});

const TRADINGVIEW_KRX_005930_HTML = createTradingviewSymbolHtml({
  resolved_symbol: "KRX:005930",
  isin_displayed: "KR7005930003",
  exchange: "KRX",
  short_name: "005930",
});

const TRADINGVIEW_SSE_600519_HTML = createTradingviewSymbolHtml({
  resolved_symbol: "SSE:600519",
  isin_displayed: "CNE0000018R8",
  exchange: "SSE",
  short_name: "600519",
});

const TRADINGVIEW_SZSE_000001_HTML = createTradingviewSymbolHtml({
  resolved_symbol: "SZSE:000001",
  isin_displayed: "CNE000000040",
  exchange: "SZSE",
  short_name: "000001",
});

const TRADINGVIEW_TSE_7203_HTML = createTradingviewSymbolHtml({
  resolved_symbol: "TSE:7203",
  isin_displayed: "JP3633400001",
  exchange: "TSE",
  short_name: "7203",
});

const TRADINGVIEW_OTC_RYCEY_HTML = createTradingviewSymbolHtml({
  resolved_symbol: "OTC:RYCEY",
  isin_displayed: "US7757812067",
  exchange: "OTC",
  short_name: "RYCEY",
});

const TRADINGVIEW_TASE_POLI_HTML = createTradingviewSymbolHtml({
  resolved_symbol: "TASE:POLI",
  isin_displayed: "IL0006625771",
  exchange: "TASE",
  short_name: "POLI",
});

const TRADINGVIEW_TASE_KSM_F59_HTML = `
<script>
window.initData = {};
window.initData.symbolInfo = {"resolved_symbol":"TASE:KSM.F59","isin_displayed":"IL0011465700","exchange":"TASE","short_name":"KSM.F59","description":"KSM ETF (4A) TA-35 Units","currency":"ILA","currency_code":"ILA"};
</script>
<script type="application/ld+json">
{"mainEntity":[{"name":"What is KSM.F59 price?","acceptedAnswer":{"text":"KSM.F59 trades at 40,560 ILA today, its price has fallen -1.43% in the past 24 hours."}}]}
</script>
`;

const TRADINGVIEW_SGX_D05_HTML = createTradingviewSymbolHtml({
  resolved_symbol: "SGX:D05",
  isin_displayed: "SG1L01001701",
  exchange: "SGX",
  short_name: "D05",
});

const TRADINGVIEW_GPW_PKN_HTML = createTradingviewSymbolHtml({
  resolved_symbol: "GPW:PKN",
  isin_displayed: "PLPKN0000018",
  exchange: "GPW",
  short_name: "PKN",
});

const TRADINGVIEW_NEO_ZTL_HTML = createTradingviewSymbolHtml({
  resolved_symbol: "NEO:ZTL",
  isin_displayed: "CA05582Y1007",
  exchange: "NEO",
  short_name: "ZTL",
});

const TRADINGVIEW_SYMBOL_HTML_CASES = [
  { exchange: "XETR", html: TRADINGVIEW_XETR_ZPRX_HTML, isin: "IE00BSPLC298", resolvedSymbol: "XETR:ZPRX" },
  { exchange: "LSE", html: TRADINGVIEW_LSE_SJPA_HTML, isin: "IE00B4L5YX21", resolvedSymbol: "LSE:SJPA" },
  { exchange: "NASDAQ", html: TRADINGVIEW_NASDAQ_GOOG_HTML, isin: "US02079K1079", resolvedSymbol: "NASDAQ:GOOG" },
  { exchange: "AMEX", html: TRADINGVIEW_AMEX_AVLV_HTML, isin: "US05351W1036", resolvedSymbol: "AMEX:AVLV" },
  { exchange: "EURONEXT", html: TRADINGVIEW_EURONEXT_SEMI_HTML, isin: "IE000I8KRLL9", resolvedSymbol: "EURONEXT:SEMI" },
  { exchange: "EURONEXT", html: TRADINGVIEW_EURONEXT_ABI_HTML, isin: "BE0974293251", resolvedSymbol: "EURONEXT:ABI" },
  { exchange: "EURONEXT", html: TRADINGVIEW_EURONEXT_MC_HTML, isin: "FR0000121014", resolvedSymbol: "EURONEXT:MC" },
  { exchange: "EURONEXT", html: TRADINGVIEW_EURONEXT_OR_HTML, isin: "FR0000120321", resolvedSymbol: "EURONEXT:OR" },
  { exchange: "ASX", html: TRADINGVIEW_ASX_BHP_HTML, isin: "AU000000BHP4", resolvedSymbol: "ASX:BHP" },
  { exchange: "MIL", html: TRADINGVIEW_MIL_ENEL_HTML, isin: "IT0003128367", resolvedSymbol: "MIL:ENEL" },
  { exchange: "OMXCOP", html: TRADINGVIEW_OMXCOP_GN_HTML, isin: "DK0010272632", resolvedSymbol: "OMXCOP:GN" },
  { exchange: "FWB", html: TRADINGVIEW_FWB_BMW_HTML, isin: "DE0005190003", resolvedSymbol: "FWB:BMW" },
  { exchange: "BME", html: TRADINGVIEW_BME_SAN_HTML, isin: "ES0113900J37", resolvedSymbol: "BME:SAN" },
  { exchange: "OMXHEX", html: TRADINGVIEW_OMXHEX_NOKIA_HTML, isin: "FI0009000681", resolvedSymbol: "OMXHEX:NOKIA" },
  { exchange: "JSE", html: TRADINGVIEW_JSE_SOL_HTML, isin: "ZAE000006896", resolvedSymbol: "JSE:SOL" },
  { exchange: "OSL", html: TRADINGVIEW_OSL_EQNR_HTML, isin: "NO0010096985", resolvedSymbol: "OSL:EQNR" },
  { exchange: "NSE", html: TRADINGVIEW_NSE_RELIANCE_HTML, isin: "INE002A01018", resolvedSymbol: "NSE:RELIANCE" },
  { exchange: "NZX", html: TRADINGVIEW_NZX_SPK_HTML, isin: "NZTELE0001S4", resolvedSymbol: "NZX:SPK" },
  { exchange: "BSE", html: TRADINGVIEW_BSE_RELIANCE_HTML, isin: "INE002A01018", resolvedSymbol: "BSE:RELIANCE" },
  { exchange: "BMV", html: TRADINGVIEW_BMV_WALMEX_HTML, isin: "MX01WA000038", resolvedSymbol: "BMV:WALMEX" },
  { exchange: "BMFBOVESPA", html: TRADINGVIEW_BMFBOVESPA_PETR4_HTML, isin: "BRPETRACNPR6", resolvedSymbol: "BMFBOVESPA:PETR4" },
  { exchange: "TSX", html: TRADINGVIEW_TSX_BCE_HTML, isin: "CA05534B7604", resolvedSymbol: "TSX:BCE" },
  { exchange: "SIX", html: TRADINGVIEW_SIX_NESN_HTML, isin: "CH0038863350", resolvedSymbol: "SIX:NESN" },
  { exchange: "OMXSTO", html: TRADINGVIEW_OMXSTO_AZA_HTML, isin: "SE0012454072", resolvedSymbol: "OMXSTO:AZA" },
  { exchange: "TWSE", html: TRADINGVIEW_TWSE_2330_HTML, isin: "TW0002330008", resolvedSymbol: "TWSE:2330" },
  { exchange: "BIST", html: TRADINGVIEW_BIST_THYAO_HTML, isin: "TRATHYAO91M5", resolvedSymbol: "BIST:THYAO" },
  { exchange: "KRX", html: TRADINGVIEW_KRX_005930_HTML, isin: "KR7005930003", resolvedSymbol: "KRX:005930" },
  { exchange: "SSE", html: TRADINGVIEW_SSE_600519_HTML, isin: "CNE0000018R8", resolvedSymbol: "SSE:600519" },
  { exchange: "SZSE", html: TRADINGVIEW_SZSE_000001_HTML, isin: "CNE000000040", resolvedSymbol: "SZSE:000001" },
  { exchange: "TSE", html: TRADINGVIEW_TSE_7203_HTML, isin: "JP3633400001", resolvedSymbol: "TSE:7203" },
  { exchange: "OTC", html: TRADINGVIEW_OTC_RYCEY_HTML, isin: "US7757812067", resolvedSymbol: "OTC:RYCEY" },
  { exchange: "TASE", html: TRADINGVIEW_TASE_POLI_HTML, isin: "IL0006625771", resolvedSymbol: "TASE:POLI" },
  { exchange: "SGX", html: TRADINGVIEW_SGX_D05_HTML, isin: "SG1L01001701", resolvedSymbol: "SGX:D05" },
  { exchange: "GPW", html: TRADINGVIEW_GPW_PKN_HTML, isin: "PLPKN0000018", resolvedSymbol: "GPW:PKN" },
  { exchange: "NEO", html: TRADINGVIEW_NEO_ZTL_HTML, isin: "CA05582Y1007", resolvedSymbol: "NEO:ZTL" },
];

const TRADINGVIEW_DEFAULT_ISIN_DISPATCH_CASES = [
  { exchange: "ETR", quote: { symbol: "ZPRX.DE" }, tickerInput: "ZPRX.DE", isin: "IE00BSPLC298" },
  { exchange: "AMS", quote: { symbol: "SEMI.AS" }, tickerInput: "AMS:SEMI", isin: "IE000I8KRLL9" },
  { exchange: "ASX", quote: { symbol: "BHP.AX" }, tickerInput: "ASX:BHP", isin: "AU000000BHP4" },
  { exchange: "BIT", quote: { symbol: "ENEL.MI" }, tickerInput: "BIT:ENEL", isin: "IT0003128367" },
  { exchange: "BMV", quote: { symbol: "WALMEX.MX" }, tickerInput: "BMV:WALMEX", isin: "MX01WA000038" },
  { exchange: "BOM", quote: { symbol: "RELIANCE.BO" }, tickerInput: "BOM:RELIANCE", isin: "INE002A01018" },
  { exchange: "BSE", quote: { symbol: "RELIANCE.BO" }, tickerInput: "BSE:RELIANCE", isin: "INE002A01018" },
  { exchange: "BVMF", quote: { symbol: "PETR4.SA" }, tickerInput: "BVMF:PETR4", isin: "BRPETRACNPR6" },
  { exchange: "BRU", quote: { symbol: "ABI.BR" }, tickerInput: "BRU:ABI", isin: "BE0974293251" },
  { exchange: "CPH", quote: { symbol: "GN.CO" }, tickerInput: "CPH:GN", isin: "DK0010272632" },
  { exchange: "EPA", quote: { symbol: "OR.PA" }, tickerInput: "EPA:OR", isin: "FR0000120321" },
  { exchange: "FRA", quote: { symbol: "BMW.F" }, tickerInput: "FRA:BMW", isin: "DE0005190003" },
  { exchange: "HEL", quote: { symbol: "NOKIA.HE" }, tickerInput: "HEL:NOKIA", isin: "FI0009000681" },
  { exchange: "IST", quote: { symbol: "THYAO.IS" }, tickerInput: "IST:THYAO", isin: "TRATHYAO91M5" },
  { exchange: "JSE", quote: { symbol: "SOL.JO" }, tickerInput: "JSE:SOL", isin: "ZAE000006896" },
  { exchange: "KRX", quote: { symbol: "005930.KS" }, tickerInput: "KRX:005930", isin: "KR7005930003" },
  { exchange: "MAD", quote: { symbol: "SAN.MC" }, tickerInput: "MAD:SAN", isin: "ES0113900J37" },
  { exchange: "NASDAQ", quote: { symbol: "GOOG", exchangeName: "NMS" }, tickerInput: "GOOG", isin: "US02079K1079" },
  { exchange: "NYSE", quote: { symbol: "IBM", exchangeName: "NYSE" }, tickerInput: "NYSE:IBM", isin: "US4592001014" },
  { exchange: "NSE", quote: { symbol: "RELIANCE.NS" }, tickerInput: "NSE:RELIANCE", isin: "INE002A01018" },
  { exchange: "NZE", quote: { symbol: "SPK.NZ" }, tickerInput: "NZE:SPK", isin: "NZTELE0001S4" },
  { exchange: "OSL", quote: { symbol: "EQNR.OL" }, tickerInput: "OSL:EQNR", isin: "NO0010096985" },
  { exchange: "PAR", quote: { symbol: "MC.PA" }, tickerInput: "PAR:MC", isin: "FR0000121014" },
  { exchange: "SHA", quote: { symbol: "600519.SS" }, tickerInput: "SHA:600519", isin: "CNE0000018R8" },
  { exchange: "SHE", quote: { symbol: "000001.SZ" }, tickerInput: "SHE:000001", isin: "CNE000000040" },
  { exchange: "SIX", quote: { symbol: "NESN.SW" }, tickerInput: "SIX:NESN", isin: "CH0038863350" },
  { exchange: "STO", quote: { symbol: "AZA.ST" }, tickerInput: "STO:AZA", isin: "SE0012454072" },
  { exchange: "SWX", quote: { symbol: "NESN.SW" }, tickerInput: "SWX:NESN", isin: "CH0038863350" },
  { exchange: "TASE", quote: { symbol: "POLI.TA" }, tickerInput: "TASE:POLI", isin: "IL0006625771" },
  { exchange: "TPE", quote: { symbol: "2330.TW" }, tickerInput: "TPE:2330", isin: "TW0002330008" },
  { exchange: "TSE", quote: { symbol: "BCE.TO" }, tickerInput: "TSE:BCE", isin: "CA05534B7604" },
  { exchange: "TSX", quote: { symbol: "BCE.TO" }, tickerInput: "TSX:BCE", isin: "CA05534B7604" },
  { exchange: "NEO", quote: { symbol: "ZTL.NE" }, tickerInput: "ZTL.NE", isin: "CA05582Y1007" },
  { exchange: "NYSEARCA", quote: { symbol: "AVLV", exchangeName: "PCX" }, tickerInput: "AVLV", isin: "US05351W1036" },
  { exchange: "OTCMKTS", quote: { symbol: "RYCEY", exchangeName: "PNK" }, tickerInput: "OTCMKTS:RYCEY", isin: "US7757812067" },
  { exchange: "TYO", quote: { symbol: "7203.T" }, tickerInput: "TYO:7203", isin: "JP3633400001" },
  { exchange: "TLV", quote: { symbol: "POLI.TA" }, tickerInput: "POLI.TA", isin: "IL0006625771" },
  { exchange: "SGX", quote: { symbol: "D05.SI" }, tickerInput: "SGX:D05", isin: "SG1L01001701" },
  { exchange: "WSE", quote: { symbol: "PKN.WA" }, tickerInput: "WSE:PKN", isin: "PLPKN0000018" },
];

const TRADINGVIEW_EXPLICIT_ISIN_CASES = [
  { exchange: "XETR", quote: { symbol: "ZPRX.DE" }, tickerInput: "ZPRX.DE@TRADINGVIEW", isin: "IE00BSPLC298", url: "https://www.tradingview.com/symbols/XETR-ZPRX/", html: TRADINGVIEW_XETR_ZPRX_HTML },
  { exchange: "AMS", quote: { symbol: "SEMI.AS" }, tickerInput: "AMS:SEMI@TRADINGVIEW", isin: "IE000I8KRLL9", url: "https://www.tradingview.com/symbols/EURONEXT-SEMI/", html: TRADINGVIEW_EURONEXT_SEMI_HTML },
  { exchange: "ASX", quote: { symbol: "BHP.AX" }, tickerInput: "ASX:BHP@TRADINGVIEW", isin: "AU000000BHP4", url: "https://www.tradingview.com/symbols/ASX-BHP/", html: TRADINGVIEW_ASX_BHP_HTML },
  { exchange: "BIT", quote: { symbol: "ENEL.MI" }, tickerInput: "BIT:ENEL@TRADINGVIEW", isin: "IT0003128367", url: "https://www.tradingview.com/symbols/MIL-ENEL/", html: TRADINGVIEW_MIL_ENEL_HTML },
  { exchange: "BMV", quote: { symbol: "WALMEX.MX" }, tickerInput: "BMV:WALMEX@TRADINGVIEW", isin: "MX01WA000038", url: "https://www.tradingview.com/symbols/BMV-WALMEX/", html: TRADINGVIEW_BMV_WALMEX_HTML },
  { exchange: "BOM", quote: { symbol: "RELIANCE.BO" }, tickerInput: "BOM:RELIANCE@TRADINGVIEW", isin: "INE002A01018", url: "https://www.tradingview.com/symbols/BSE-RELIANCE/", html: TRADINGVIEW_BSE_RELIANCE_HTML },
  { exchange: "BSE", quote: { symbol: "RELIANCE.BO" }, tickerInput: "BSE:RELIANCE@TRADINGVIEW", isin: "INE002A01018", url: "https://www.tradingview.com/symbols/BSE-RELIANCE/", html: TRADINGVIEW_BSE_RELIANCE_HTML },
  { exchange: "BVMF", quote: { symbol: "PETR4.SA" }, tickerInput: "BVMF:PETR4@TRADINGVIEW", isin: "BRPETRACNPR6", url: "https://www.tradingview.com/symbols/BMFBOVESPA-PETR4/", html: TRADINGVIEW_BMFBOVESPA_PETR4_HTML },
  { exchange: "BRU", quote: { symbol: "ABI.BR" }, tickerInput: "BRU:ABI@TRADINGVIEW", isin: "BE0974293251", url: "https://www.tradingview.com/symbols/EURONEXT-ABI/", html: TRADINGVIEW_EURONEXT_ABI_HTML },
  { exchange: "CPH", quote: { symbol: "GN.CO" }, tickerInput: "CPH:GN@TRADINGVIEW", isin: "DK0010272632", url: "https://www.tradingview.com/symbols/OMXCOP-GN/", html: TRADINGVIEW_OMXCOP_GN_HTML },
  { exchange: "EPA", quote: { symbol: "OR.PA" }, tickerInput: "EPA:OR@TRADINGVIEW", isin: "FR0000120321", url: "https://www.tradingview.com/symbols/EURONEXT-OR/", html: TRADINGVIEW_EURONEXT_OR_HTML },
  { exchange: "FRA", quote: { symbol: "BMW.F" }, tickerInput: "FRA:BMW@TRADINGVIEW", isin: "DE0005190003", url: "https://www.tradingview.com/symbols/FWB-BMW/", html: TRADINGVIEW_FWB_BMW_HTML },
  { exchange: "HEL", quote: { symbol: "NOKIA.HE" }, tickerInput: "HEL:NOKIA@TRADINGVIEW", isin: "FI0009000681", url: "https://www.tradingview.com/symbols/OMXHEX-NOKIA/", html: TRADINGVIEW_OMXHEX_NOKIA_HTML },
  { exchange: "IST", quote: { symbol: "THYAO.IS" }, tickerInput: "IST:THYAO@TRADINGVIEW", isin: "TRATHYAO91M5", url: "https://www.tradingview.com/symbols/BIST-THYAO/", html: TRADINGVIEW_BIST_THYAO_HTML },
  { exchange: "JSE", quote: { symbol: "SOL.JO" }, tickerInput: "JSE:SOL@TRADINGVIEW", isin: "ZAE000006896", url: "https://www.tradingview.com/symbols/JSE-SOL/", html: TRADINGVIEW_JSE_SOL_HTML },
  { exchange: "KRX", quote: { symbol: "005930.KS" }, tickerInput: "KRX:005930@TRADINGVIEW", isin: "KR7005930003", url: "https://www.tradingview.com/symbols/KRX-005930/", html: TRADINGVIEW_KRX_005930_HTML },
  { exchange: "LON", quote: { symbol: "SJPA.L" }, tickerInput: "SJPA.L@TRADINGVIEW", isin: "IE00B4L5YX21", url: "https://www.tradingview.com/symbols/LSE-SJPA/", html: TRADINGVIEW_LSE_SJPA_HTML },
  { exchange: "MAD", quote: { symbol: "SAN.MC" }, tickerInput: "MAD:SAN@TRADINGVIEW", isin: "ES0113900J37", url: "https://www.tradingview.com/symbols/BME-SAN/", html: TRADINGVIEW_BME_SAN_HTML },
  { exchange: "NASDAQ", quote: { symbol: "GOOG", exchangeName: "NMS" }, tickerInput: "GOOG@TRADINGVIEW", isin: "US02079K1079", url: "https://www.tradingview.com/symbols/NASDAQ-GOOG/", html: TRADINGVIEW_NASDAQ_GOOG_HTML },
  { exchange: "NYSE", quote: { symbol: "IBM", exchangeName: "NYSE" }, tickerInput: "NYSE:IBM@TRADINGVIEW", isin: "US4592001014", url: "https://www.tradingview.com/symbols/NYSE-IBM/", html: TRADINGVIEW_NYSE_IBM_HTML },
  { exchange: "NSE", quote: { symbol: "RELIANCE.NS" }, tickerInput: "NSE:RELIANCE@TRADINGVIEW", isin: "INE002A01018", url: "https://www.tradingview.com/symbols/NSE-RELIANCE/", html: TRADINGVIEW_NSE_RELIANCE_HTML },
  { exchange: "NZE", quote: { symbol: "SPK.NZ" }, tickerInput: "NZE:SPK@TRADINGVIEW", isin: "NZTELE0001S4", url: "https://www.tradingview.com/symbols/NZX-SPK/", html: TRADINGVIEW_NZX_SPK_HTML },
  { exchange: "OSL", quote: { symbol: "EQNR.OL" }, tickerInput: "OSL:EQNR@TRADINGVIEW", isin: "NO0010096985", url: "https://www.tradingview.com/symbols/OSL-EQNR/", html: TRADINGVIEW_OSL_EQNR_HTML },
  { exchange: "PAR", quote: { symbol: "MC.PA" }, tickerInput: "PAR:MC@TRADINGVIEW", isin: "FR0000121014", url: "https://www.tradingview.com/symbols/EURONEXT-MC/", html: TRADINGVIEW_EURONEXT_MC_HTML },
  { exchange: "SHA", quote: { symbol: "600519.SS" }, tickerInput: "SHA:600519@TRADINGVIEW", isin: "CNE0000018R8", url: "https://www.tradingview.com/symbols/SSE-600519/", html: TRADINGVIEW_SSE_600519_HTML },
  { exchange: "SHE", quote: { symbol: "000001.SZ" }, tickerInput: "SHE:000001@TRADINGVIEW", isin: "CNE000000040", url: "https://www.tradingview.com/symbols/SZSE-000001/", html: TRADINGVIEW_SZSE_000001_HTML },
  { exchange: "SIX", quote: { symbol: "NESN.SW" }, tickerInput: "SIX:NESN@TRADINGVIEW", isin: "CH0038863350", url: "https://www.tradingview.com/symbols/SIX-NESN/", html: TRADINGVIEW_SIX_NESN_HTML },
  { exchange: "STO", quote: { symbol: "AZA.ST" }, tickerInput: "STO:AZA@TRADINGVIEW", isin: "SE0012454072", url: "https://www.tradingview.com/symbols/OMXSTO-AZA/", html: TRADINGVIEW_OMXSTO_AZA_HTML },
  { exchange: "SWX", quote: { symbol: "NESN.SW" }, tickerInput: "SWX:NESN@TRADINGVIEW", isin: "CH0038863350", url: "https://www.tradingview.com/symbols/SIX-NESN/", html: TRADINGVIEW_SIX_NESN_HTML },
  { exchange: "TASE", quote: { symbol: "POLI.TA" }, tickerInput: "TASE:POLI@TRADINGVIEW", isin: "IL0006625771", url: "https://www.tradingview.com/symbols/TASE-POLI/", html: TRADINGVIEW_TASE_POLI_HTML },
  { exchange: "TPE", quote: { symbol: "2330.TW" }, tickerInput: "TPE:2330@TRADINGVIEW", isin: "TW0002330008", url: "https://www.tradingview.com/symbols/TWSE-2330/", html: TRADINGVIEW_TWSE_2330_HTML },
  { exchange: "TSE", quote: { symbol: "BCE.TO" }, tickerInput: "TSE:BCE@TRADINGVIEW", isin: "CA05534B7604", url: "https://www.tradingview.com/symbols/TSX-BCE/", html: TRADINGVIEW_TSX_BCE_HTML },
  { exchange: "TSX", quote: { symbol: "BCE.TO" }, tickerInput: "TSX:BCE@TRADINGVIEW", isin: "CA05534B7604", url: "https://www.tradingview.com/symbols/TSX-BCE/", html: TRADINGVIEW_TSX_BCE_HTML },
  { exchange: "NYSEARCA", quote: { symbol: "AVLV", exchangeName: "PCX" }, tickerInput: "AVLV@TRADINGVIEW", isin: "US05351W1036", url: "https://www.tradingview.com/symbols/AMEX-AVLV/", html: TRADINGVIEW_AMEX_AVLV_HTML },
  { exchange: "OTCMKTS", quote: { symbol: "RYCEY", exchangeName: "PNK" }, tickerInput: "OTCMKTS:RYCEY@TRADINGVIEW", isin: "US7757812067", url: "https://www.tradingview.com/symbols/OTC-RYCEY/", html: TRADINGVIEW_OTC_RYCEY_HTML },
  { exchange: "TYO", quote: { symbol: "7203.T" }, tickerInput: "TYO:7203@TRADINGVIEW", isin: "JP3633400001", url: "https://www.tradingview.com/symbols/TSE-7203/", html: TRADINGVIEW_TSE_7203_HTML },
  { exchange: "SGX", quote: { symbol: "D05.SI" }, tickerInput: "SGX:D05@TRADINGVIEW", isin: "SG1L01001701", url: "https://www.tradingview.com/symbols/SGX-D05/", html: TRADINGVIEW_SGX_D05_HTML },
  { exchange: "NEO", quote: { symbol: "ZTL.NE" }, tickerInput: "ZTL.NE@TRADINGVIEW", isin: "CA05582Y1007", url: "https://www.tradingview.com/symbols/NEO-ZTL/", html: TRADINGVIEW_NEO_ZTL_HTML },
  { exchange: "TLV", quote: { symbol: "POLI.TA" }, tickerInput: "POLI.TA@TRADINGVIEW", isin: "IL0006625771", url: "https://www.tradingview.com/symbols/TASE-POLI/", html: TRADINGVIEW_TASE_POLI_HTML },
  { exchange: "WSE", quote: { symbol: "PKN.WA" }, tickerInput: "WSE:PKN@TRADINGVIEW", isin: "PLPKN0000018", url: "https://www.tradingview.com/symbols/GPW-PKN/", html: TRADINGVIEW_GPW_PKN_HTML },
];

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

function loadHoodlefinance(extraGlobals) {
const source = fs.readFileSync(path.join(__dirname, "..", "hoodlefinance.js"), "utf8");
  const cacheStore = new Map();
  const scriptPropertiesStore = new Map();
  const userPropertiesStore = new Map();
  let installationSource = "NONE";
  const uiState = {
    addonMenus: [],
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
    createAddonMenu() {
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
          uiState.addonMenus.push({ items: items.slice() });
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
  const cardService = {
    newButtonSet() {
      return {
        buttons: [],
        addButton(button) {
          this.buttons.push(button);
          return this;
        },
      };
    },
    newCardBuilder() {
      return {
        header: null,
        sections: [],
        setHeader(header) {
          this.header = header;
          return this;
        },
        addSection(section) {
          this.sections.push(section);
          return this;
        },
        build() {
          return {
            header: this.header,
            sections: this.sections.slice(),
          };
        },
      };
    },
    newCardHeader() {
      return {
        subtitle: "",
        title: "",
        setSubtitle(value) {
          this.subtitle = value;
          return this;
        },
        setTitle(value) {
          this.title = value;
          return this;
        },
      };
    },
    newCardSection() {
      return {
        widgets: [],
        addWidget(widget) {
          this.widgets.push(widget);
          return this;
        },
      };
    },
    newOpenLink() {
      return {
        url: "",
        setUrl(value) {
          this.url = value;
          return this;
        },
      };
    },
    newTextButton() {
      return {
        openLink: null,
        text: "",
        setOpenLink(value) {
          this.openLink = value;
          return this;
        },
        setText(value) {
          this.text = value;
          return this;
        },
      };
    },
    newTextParagraph() {
      return {
        text: "",
        setText(value) {
          this.text = value;
          return this;
        },
      };
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
    ScriptApp: {
      AuthMode: {
        FULL: "FULL",
        LIMITED: "LIMITED",
        NONE: "NONE",
      },
      InstallationSource: {
        APPS_MARKETPLACE_DOMAIN_ADD_ON: "APPS_MARKETPLACE_DOMAIN_ADD_ON",
        NONE: "NONE",
        WEB_STORE_ADD_ON: "WEB_STORE_ADD_ON",
      },
      getInstallationSource() {
        return installationSource;
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
    CardService: cardService,
    UrlFetchApp: urlFetchApp,
  };

  Object.assign(sandbox, extraGlobals || {});

  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: "hoodlefinance.js" });
  sandbox.__setInstallationSource = function (value) {
    installationSource = value;
  };
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

function createYahooIsinSearchResponse(symbolOrQuotes) {
  const quotes = Array.isArray(symbolOrQuotes)
    ? symbolOrQuotes
    : [
      {
        isYahooFinance: true,
        symbol: symbolOrQuotes,
      },
    ];

  return createHttpResponse(200, { quotes });
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

  assert.equal(ctx.hf_normalizeTicker_("LON:ISJP"), "ISJP.L");
  assert.equal(ctx.hf_normalizeTicker_("ETR:ZPRX"), "ZPRX.DE");
  assert.equal(ctx.hf_normalizeTicker_("NEO:ZTL"), "ZTL.NE");
  assert.equal(ctx.hf_normalizeTicker_("SGX:D05"), "D05.SI");
  assert.equal(ctx.hf_normalizeTicker_("TLV:POLI"), "POLI.TA");
  assert.equal(ctx.hf_normalizeTicker_("TLV:KSM.F59"), "KSM.F59.TA");
  assert.equal(ctx.hf_normalizeTicker_("TLV:KSMF59"), "KSM.F59.TA");
  assert.equal(ctx.hf_normalizeTicker_("TASE:KSMF59"), "KSM.F59.TA");
  assert.equal(ctx.hf_normalizeTicker_("NASDAQ:GOOG"), "GOOG");
  assert.equal(ctx.hf_normalizeTicker_("USDPHP"), "USDPHP=X");
  assert.equal(ctx.hf_normalizeTicker_("BTCUSD"), "BTCUSD=X");
  assert.equal(ctx.hf_normalizeTicker_("CURRENCY:ETHUSD"), "ETHUSD=X");
  assert.equal(ctx.hf_normalizeTicker_("GBpUSD"), "GBPUSD=X");
  assert.equal(ctx.hf_normalizeTicker_("USDILA"), "USDILS=X");
  assert.equal(ctx.hf_normalizeTicker_("CURRENCY:EURUSD"), "EURUSD=X");
  assert.equal(ctx.hf_normalizeTicker_("CURRENCY:USDUSD"), "USDUSD=X");
  assert.equal(ctx.hf_normalizeTicker_("DOGEUSD"), "DOGEUSD=X");
  assert.equal(ctx.hf_normalizeTicker_("USDUSDT"), "USDUSDT=X");
  assert.equal(ctx.hf_normalizeTicker_("USDCUSDT"), "USDCUSDT=X");
  assert.equal(ctx.hf_normalizeTicker_("CURRENCY:USDT.USD"), "USDTUSD=X");
  assert.equal(ctx.hf_normalizeTicker_("FOOUSD"), "FOOUSD");
});

test("ambiguous bare 4-character FX candidates do not auto-parse as currency pairs", () => {
  const ctx = loadHoodlefinance();
  primeCurrencyCodeData(ctx);

  assert.equal(ctx.hf_normalizeTicker_("USDTUSD"), "USDTUSD");
});

test("source overrides are parsed separately from ticker normalization", () => {
  const ctx = loadHoodlefinance();
  primeCurrencyCodeData(ctx);

  assert.equal(ctx.hf_extractTickerSourceOverride_("BTCUSD@YAHOO"), "YAHOO");
  assert.equal(ctx.hf_extractTickerSourceOverride_("GOOG@IBKR"), "IBKR");
  assert.equal(ctx.hf_extractTickerSourceOverride_("BTCUSD@MYSTERY"), "");
  assert.equal(ctx.hf_extractTickerInfoMode_("BTCUSD@?"), "source-name");
  assert.equal(ctx.hf_extractTickerInfoMode_("BTCUSD@"), "source-list");
  assert.equal(ctx.hf_extractTickerInfoMode_("BTCUSD@MYSTERY"), "source-list");
  assert.equal(ctx.hf_normalizeTicker_("BTCUSD@YAHOO"), "BTCUSD=X");
  assert.equal(ctx.hf_stripTickerSourceOverride_("ISIN:US02079K1079@YAHOO"), "ISIN:US02079K1079");
});

test("source introspection suffixes return the planned route or the supported source list", () => {
  const ctx = loadHoodlefinance();
  primeCurrencyCodeData(ctx);

  assert.equal(ctx.HOODLEFINANCE("BTCUSD@?"), "FX -> GOOGLE");
  assert.equal(ctx.HOODLEFINANCE("EURUSD@?"), "FX -> GOOGLE");
  assert.equal(ctx.HOODLEFINANCE("PSE:AAA@?"), "PSE-TICKER -> PSE");
  assert.equal(ctx.HOODLEFINANCE("AP.PS@?"), "PSE-TICKER -> PSE");
  assert.equal(ctx.HOODLEFINANCE("USDUSD@?"), "FX-SAME -> LOCAL");
  assert.equal(ctx.HOODLEFINANCE("GOOG@?"), "TICKER -> YAHOO");
  assert.equal(ctx.HOODLEFINANCE("TLV:KSMF59@?"), "TICKER-IL-FUND -> YAHOO -> TRADINGVIEW");
  assert.equal(
    ctx.HOODLEFINANCE("US02079K1079@?"),
    "ISIN -> PSE-MAP -> (PSE|YAHOO-ISIN -> (YAHOO|YAHOO -> TRADINGVIEW))"
  );
  assert.equal(ctx.HOODLEFINANCE("BTCUSD@"), "ARIVA, GOOGLE, IBKR, LON, PSE, TRADINGVIEW, YAHOO");
  assert.equal(ctx.HOODLEFINANCE("BTCUSD@MYSTERY"), "ARIVA, GOOGLE, IBKR, LON, PSE, TRADINGVIEW, YAHOO");
});

test("HOODLEFINANCE_ROUTES returns the routing table or a specific planned route", () => {
  const ctx = loadHoodlefinance();
  primeCurrencyCodeData(ctx);

  assert.equal(
    JSON.stringify(ctx.HOODLEFINANCE_ROUTES()),
    JSON.stringify([
      ["classification", "example", "planned route"],
      ["TICKER", "GOOG", "TICKER -> YAHOO"],
      ["TICKER-IL-FUND", "TLV:KSMF59", "TICKER-IL-FUND -> YAHOO -> TRADINGVIEW"],
      ["FX", "EURUSD", "FX -> GOOGLE"],
      ["FX-SAME", "USDUSD", "FX-SAME -> LOCAL"],
      ["PSE-TICKER", "PSE:BDO", "PSE-TICKER -> PSE"],
      ["ISIN", "US02079K1079", "ISIN -> PSE-MAP -> (PSE|YAHOO-ISIN -> (YAHOO|YAHOO -> TRADINGVIEW))"],
      ["FORCED:YAHOO", "GOOG@YAHOO", "FORCED:YAHOO -> YAHOO"],
      ["FORCED:YAHOO-ISIN", "US02079K1079@YAHOO", "FORCED:YAHOO-ISIN -> YAHOO-ISIN -> YAHOO"],
      ["FORCED:GOOGLE", "EURUSD@GOOGLE", "FORCED:GOOGLE -> GOOGLE"],
      ["FORCED:PSE", "PSE:BDO@PSE", "FORCED:PSE -> PSE"],
    ])
  );
  assert.equal(ctx.HOODLEFINANCE_ROUTES("GOOG"), "TICKER -> YAHOO");
  assert.equal(ctx.HOODLEFINANCE_ROUTES("TLV:KSMF59"), "TICKER-IL-FUND -> YAHOO -> TRADINGVIEW");
  assert.equal(ctx.HOODLEFINANCE_ROUTES("EURUSD"), "FX -> GOOGLE");
  assert.equal(JSON.stringify(ctx.HOODLEFINANCE_ROUTES("")), JSON.stringify(ctx.HOODLEFINANCE_ROUTES()));
});

test("normalizes Yahoo-style Israeli fund tickers to canonical dotted forms", () => {
  const ctx = loadHoodlefinance();

  assert.equal(ctx.hf_normalizeTicker_("KSMF59.TA"), "KSM.F59.TA");
  assert.equal(ctx.hf_normalizeTicker_("KSM.F59.TA"), "KSM.F59.TA");
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

  assert.equal(ctx.hf_resolveIsin_("PHY077751022"), "PSE:BDO");
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

  assert.equal(ctx.hf_resolveIsin_("PHY077751022"), "PSE:BDO");
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

  assert.equal(ctx.hf_resolveIsin_("PHY077751022"), "PSE:BDO");
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

  assert.equal(ctx.hf_resolveCurrencyUnit_("USD").canonicalCode, "USD");
  assert.equal(ctx.hf_resolveCurrencyUnit_("GBp").canonicalCode, "GBP");
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

  assert.equal(ctx.hf_resolveCurrencyUnit_("USD").canonicalCode, "USD");
  assert.equal(ctx.hf_resolveCurrencyUnit_("ILA").canonicalCode, "ILS");
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
  assert.equal(ctx.HOODLEFINANCE("CURRENCY:USDT.USDT", "price"), 1);
  assert.equal(ctx.HOODLEFINANCE("CURRENCY:USDT.USDT", "currency"), "USDT");
  assert.equal(ctx.HOODLEFINANCE("CURRENCY:USDT.USDT", "symbol"), "CURRENCY:USDT.USDT");
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

    if (url === "https://www.google.com/finance/quote/DOGE-USD") {
      return createHttpResponse(
        200,
        createGoogleFinancePairHtml(
          "DOGE-USD",
          "Dogecoin (DOGE / USD)",
          [0.1284, 0.0021, 1.6621, 4, 4, 2],
          0.1263,
          1773599440,
          ["DOGE", "USD", "Dogecoin", "United States Dollar", "/g/11bbrh8k5x", "/m/09nqf", 2]
        )
      );
    }

    if (url === "https://www.google.com/finance/quote/BTC-USDT") {
      return createHttpResponse(
        200,
        createGoogleFinancePairHtml(
          "BTC-USDT",
          "Bitcoin (BTC / USDT)",
          [73274.8, 488.2, 0.6710, 2, 2, 2],
          72786.6,
          1773599480,
          ["BTC", "USDT", "Bitcoin", "Tether", "/m/05p0rrx", "/g/11f64xwlh_", 2]
        )
      );
    }

    if (url === "https://www.google.com/finance/quote/USD-USDT") {
      return createHttpResponse(
        200,
        createGoogleFinancePairHtml(
          "USD-USDT",
          "United States Dollar (USD / USDT)",
          [1.0002, 0.0001, 0.0100, 4, 4, 2],
          1.0001,
          1773599490,
          ["USD", "USDT", "United States Dollar", "Tether", "/m/09nqf", "/g/11f64xwlh_", 2]
        )
      );
    }

    if (url === "https://www.google.com/finance/quote/USDC-USDT") {
      return createHttpResponse(
        200,
        createGoogleFinancePairHtml(
          "USDC-USDT",
          "USD Coin (USDC / USDT)",
          [1.0, 0.0002, 0.0200, 4, 4, 2],
          0.9998,
          1773599500,
          ["USDC", "USDT", "USD Coin", "Tether", "/g/11fmh5r8lc", "/g/11f64xwlh_", 2]
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
  assert.equal(ctx.HOODLEFINANCE("DOGEUSD", "price"), 0.1284);
  assert.equal(ctx.HOODLEFINANCE("DOGEUSD", "symbol"), "CURRENCY:DOGE.USD");
  assert.equal(ctx.HOODLEFINANCE("CURRENCY:BTC.USDT", "price"), 73274.8);
  assert.equal(ctx.HOODLEFINANCE("CURRENCY:BTC.USDT", "symbol"), "CURRENCY:BTC.USDT");
  assert.equal(ctx.HOODLEFINANCE("USDUSDT", "price"), 1.0002);
  assert.equal(ctx.HOODLEFINANCE("USDUSDT", "symbol"), "CURRENCY:USD.USDT");
  assert.equal(ctx.HOODLEFINANCE("USDCUSDT", "price"), 1);
  assert.equal(ctx.HOODLEFINANCE("USDCUSDT", "symbol"), "CURRENCY:USDC.USDT");
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
    "https://www.google.com/finance/quote/DOGE-USD",
    "https://www.google.com/finance/quote/BTC-USDT",
    "https://www.google.com/finance/quote/USD-USDT",
    "https://www.google.com/finance/quote/USDC-USDT",
    "https://www.google.com/finance/quote/PHP-ILS",
  ]);
});

test("currency pairs reject unsupported high, low, and volume attributes with a direct error", () => {
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
    /Attribute "high" is not available for currency-pair identifiers\./
  );
  assert.throws(
    () => ctx.HOODLEFINANCE("PHPILS", "low"),
    /Attribute "low" is not available for currency-pair identifiers\./
  );
  assert.throws(
    () => ctx.HOODLEFINANCE("PHPILS", "volume"),
    /Attribute "volume" is not available for currency-pair identifiers\./
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

test("forced Yahoo source routes 4-character crypto FX pairs through Yahoo chart lookups", () => {
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
        "https://query1.finance.yahoo.com/v8/finance/chart/DOGE-USD?interval=1d&range=1d"
      );
      return createYahooChartResponse("DOGE-USD", {
        currency: "USD",
        regularMarketPrice: 0.129,
      });
    });
  };

  assert.equal(ctx.HOODLEFINANCE("DOGEUSD@YAHOO", "price"), 0.129);
  assert.equal(
    JSON.stringify(seenBatches),
    JSON.stringify([[
      "https://query1.finance.yahoo.com/v8/finance/chart/DOGE-USD?interval=1d&range=1d",
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
    /"@IBKR" can only be used with the "isin" attribute\./
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

  assert.equal(ctx.hf_fetchQuote_("NASDAQ:GOOG").regularMarketPrice, 306.93);
  assert.equal(ctx.hf_fetchQuote_("NASDAQ:GOOG").regularMarketPrice, 306.93);
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

test("direct ISIN lookup prefers a Google-mappable Yahoo search candidate when multiple listings match", () => {
  const ctx = loadHoodlefinance();
  const fixtureIsin = "IE000I8KRLL9";

  ctx.UrlFetchApp.fetch = function (url) {
    if (url === "https://query2.finance.yahoo.com/v1/finance/search?q=" + fixtureIsin + "&quotesCount=10&newsCount=0") {
      return createYahooIsinSearchResponse([
        {
          exchange: "STU",
          isYahooFinance: true,
          quoteType: "MUTUALFUND",
          score: 20003,
          symbol: "IE000I8KRLL9.SG",
        },
        {
          exchange: "AMS",
          isYahooFinance: true,
          quoteType: "ETF",
          score: 20002,
          symbol: "SEMI.AS",
        },
      ]);
    }

    if (url === "https://query1.finance.yahoo.com/v8/finance/chart/SEMI.AS?interval=1d&range=1d") {
      return createYahooChartResponse("SEMI.AS", {
        exchangeName: "AMS",
        regularMarketPrice: 11.09,
      });
    }

    throw new Error("Unexpected URL " + url);
  };

  assert.equal(ctx.HOODLEFINANCE(fixtureIsin, "symbol:yahoo"), "SEMI.AS");
  assert.equal(ctx.HOODLEFINANCE(fixtureIsin, "symbol"), "AMS:SEMI");
  assert.equal(ctx.HOODLEFINANCE(fixtureIsin, "exchange:yahoo"), "AMS");
  assert.equal(ctx.HOODLEFINANCE(fixtureIsin, "exchange"), "AMS");
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
    () => ctx.hf_extractAttribute_({ symbol: "MYSTERY" }, "symbol", { tickerInput: "MYSTERY" }),
    /No Google-style symbol is available for this instrument\./
  );
  assert.throws(
    () => ctx.hf_extractAttribute_({ symbol: "MYSTERY" }, "exchange", { tickerInput: "MYSTERY" }),
    /No Google-style exchange is available for this instrument\./
  );
});

test("unsupported attribute errors list only public attributes", () => {
  const ctx = loadHoodlefinance();

  assert.throws(
    () => ctx.hf_extractAttribute_({ symbol: "GOOG" }, "yahoo:symbol", { tickerInput: "GOOG" }),
    (error) => {
      assert.match(
        error.message,
        /Unsupported attribute "yahoo:symbol"\. Supported attributes: quote fields: price\[@currency\], name, currency, high, low, close, change, changepct, volume, tradetime, datadelay; identifier fields: symbol\[:google\|yahoo\], exchange\[:google\|yahoo\], isin/
      );
      return true;
    }
  );
});

test("versioned cache keys are namespaced by the current script version", () => {
  const ctx = loadHoodlefinance();

  ctx.hf_putCachedString_("hoodlefinance:test:key", "value", 60);

  assert.equal(ctx.__scriptCacheStore.has("hoodlefinance:test:key"), false);
  assert.equal(
    ctx.__scriptCacheStore.get("hoodlefinance:v" + ctx.HOODLEFINANCE_VERSION() + ":test:key"),
    "value"
  );
  assert.equal(ctx.hf_getCachedString_("hoodlefinance:test:key"), "value");
});

test("versioned cache key helper rejects already-versioned cache keys", () => {
  const ctx = loadHoodlefinance();

  assert.throws(
    () => ctx.hf_versionCacheKey_("hoodlefinance:v" + ctx.HOODLEFINANCE_VERSION() + ":test:key"),
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
    /Currency ticker "CURRENCY:USD" must look like CURRENCY:USDEUR or CURRENCY:USDT\.USD\./
  );
  assert.throws(
    () => ctx.HOODLEFINANCE("CURRENCY:FOOUSD", "price"),
    /must use supported 3- or 4-character currency codes/
  );
});

test("ambiguous compact prefixed FX tickers require dotted CURRENCY syntax", () => {
  const ctx = loadHoodlefinance();
  primeCurrencyCodeData(ctx);

  assert.throws(
    () => ctx.HOODLEFINANCE("CURRENCY:USDTUSD", "price"),
    /Currency ticker "CURRENCY:USDTUSD" is ambiguous\. Use CURRENCY:USD\.TUSD or CURRENCY:USDT\.USD\./
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
  assert.throws(
    () => ctx.HOODLEFINANCE("GBpUSD", "high"),
    /Attribute "high" is not available for currency-pair identifiers\./
  );
  assert.throws(
    () => ctx.HOODLEFINANCE("GBpUSD", "low"),
    /Attribute "low" is not available for currency-pair identifiers\./
  );
  assert.throws(
    () => ctx.HOODLEFINANCE("GBpUSD", "volume"),
    /Attribute "volume" is not available for currency-pair identifiers\./
  );
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

  assert.equal(ctx.hf_compareVersions_("0.2.3", "0.2.2"), 1);
  assert.equal(ctx.hf_compareVersions_("0.2.2", "0.2.3"), -1);
  assert.equal(ctx.hf_compareVersions_("1.0.0", "1.0"), 0);
});

test("extracts the published version from raw source text", () => {
  const ctx = loadHoodlefinance();

  assert.equal(
    ctx.hf_extractVersionFromSource_('const HOODLEFINANCE_VERSION_ = "2.3.4";'),
    "2.3.4"
  );
});

test("runs automatic update checks at most once per day", () => {
  const ctx = loadHoodlefinance();

  assert.equal(ctx.hf_shouldRunVersionCheckNow_(0, 1000), true);
  assert.equal(ctx.hf_shouldRunVersionCheckNow_(1000, 1000 + 60 * 60 * 1000), false);
  assert.equal(
    ctx.hf_shouldRunVersionCheckNow_(1000, 1000 + 24 * 60 * 60 * 1000),
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
    JSON.stringify(ctx.hf_runVersionCheck_({ force: false, interactive: false })),
    JSON.stringify({ status: "suppressed" })
  );
});

test("bound-script onOpen keeps the normal custom menu path", () => {
  const ctx = loadHoodlefinance();

  ctx.__userPropertiesStore.set("hoodlefinance.suppressUpdateChecks", "true");
  ctx.UrlFetchApp.fetch = function () {
    throw new Error("Fetch should not run while suppressed");
  };

  // The bound script only gets the script menu when not installed as an add-on
  // and when the UI doesn't simulate add-on menu capability (which the mock does).
  // So we override the mock to pretend it's a bound script without add-on context.
  const originalUi = ctx.SpreadsheetApp.getUi();
  ctx.SpreadsheetApp.getUi = function() {
    return {
      alert: originalUi.alert,
      createMenu: originalUi.createMenu,
      showModalDialog: originalUi.showModalDialog,
      ButtonSet: originalUi.ButtonSet,
    };
  };

  ctx.onOpen({ authMode: ctx.ScriptApp.AuthMode.LIMITED });

  assert.equal(ctx.__uiState.menus.length, 1);
  assert.equal(ctx.__uiState.menus[0].name, "Hoodlefinance");
  assert.equal(ctx.__uiState.addonMenus.length, 0);
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
    JSON.stringify(ctx.hf_fetchLatestVersionInfo_()),
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

test("Editor add-on install builds the add-on menu without the bound-script update items", () => {
  const ctx = loadHoodlefinance();

  ctx.__setInstallationSource(ctx.ScriptApp.InstallationSource.WEB_STORE_ADD_ON);
  ctx.onInstall({ authMode: ctx.ScriptApp.AuthMode.NONE });

  assert.equal(ctx.__uiState.menus.length, 0);
  assert.equal(ctx.__uiState.addonMenus.length, 1);
  assert.deepEqual(ctx.__uiState.addonMenus[0].items, [
    { functionName: "enable_", label: "Enable", type: "item" },
  ]);
});

test("staging add-on install labels the enable menu item clearly", () => {
  const ctx = loadHoodlefinance({
    HF_IS_ADDON_STAGING: true,
  });

  ctx.__setInstallationSource(ctx.ScriptApp.InstallationSource.WEB_STORE_ADD_ON);
  ctx.onInstall({ authMode: ctx.ScriptApp.AuthMode.NONE });

  assert.deepEqual(ctx.__uiState.addonMenus[0].items, [
    { functionName: "enable_", label: "Enable Hoodlefinance [Staging]", type: "item" },
  ]);
});

test("Editor add-on onOpen in AuthMode.NONE avoids restricted update-check services", () => {
  const ctx = loadHoodlefinance();

  ctx.__setInstallationSource(ctx.ScriptApp.InstallationSource.WEB_STORE_ADD_ON);
  ctx.PropertiesService.getUserProperties = function () {
    throw new Error("User properties should not be touched in AuthMode.NONE");
  };
  ctx.UrlFetchApp.fetch = function () {
    throw new Error("Fetch should not run in AuthMode.NONE");
  };

  ctx.onOpen({ authMode: ctx.ScriptApp.AuthMode.NONE });

  assert.equal(ctx.__uiState.addonMenus.length, 1);
  assert.equal(ctx.__uiState.menus.length, 0);
});

test("the Sheets add-on homepage card summarizes the function and links to docs", () => {
  const ctx = loadHoodlefinance();
  const card = ctx.hoodlefinanceBuildSheetsAddOnHomepage({});
  const buttonSet = card.sections[1].widgets[0];

  assert.equal(card.header.title, "Hoodlefinance");
  assert.match(card.header.subtitle, /Google Sheets/);
  assert.match(card.sections[0].widgets[0].text, /Installed version/);
  assert.match(card.sections[0].widgets[1].text, /HOODLEFINANCE/);
  assert.deepEqual(
    buttonSet.buttons.map((button) => [button.text, button.openLink.url]),
    [
      ["Website", "https://hoodlefinance.com"],
      ["Support", "https://hoodlefinance.com/support"],
    ]
  );
});

test("the staging Sheets add-on homepage and version UI include the staging marker", () => {
  const ctx = loadHoodlefinance({
    HF_IS_ADDON_STAGING: true,
  });
  const card = ctx.hoodlefinanceBuildSheetsAddOnHomepage({});

  assert.equal(card.header.title, "Hoodlefinance [Staging]");
  assert.match(card.sections[0].widgets[0].text, /Installed version: <b>0\.9\.6 \(staging\)<\/b>/);
  assert.match(card.sections[0].widgets[2].text, /Hoodlefinance \[Staging\] menu/);

  ctx.hoodlefinanceShowInstalledVersion();
  assert.deepEqual(ctx.__uiState.alerts[0], [
    "HOODLEFINANCE version [Staging]",
    "Installed version: 0.9.6 (staging)",
    "OK",
  ]);
});

test("the staging enable toast includes the staging marker", () => {
  const ctx = loadHoodlefinance({
    HF_IS_ADDON_STAGING: true,
  });
  const seenToasts = [];

  ctx.SpreadsheetApp.getActive = function () {
    return {
      toast(message) {
        seenToasts.push(message);
      },
    };
  };

  ctx.enable_();

  assert.deepEqual(seenToasts, [
    "Hoodlefinance [Staging] 0.9.6 (staging) enabled for this spreadsheet",
  ]);
});

test("maps Yahoo exchange codes to IBKR exchange hints", () => {
  const ctx = loadHoodlefinance();

  assert.equal(ctx.hf_inferIbkrExchange_("LON:ISJP", "ISJP.L"), "LSEETF");
  assert.equal(ctx.hf_inferIbkrExchange_("ETR:ZPRX", "ZPRX.DE"), "IBIS");
  assert.equal(ctx.hf_inferIbkrExchange_("NASDAQ:GOOG", "GOOG"), "NASDAQ");
  assert.equal(ctx.hf_inferIbkrExchange_("NYSE:IBM", "IBM"), "NYSE");
});

test("maps Yahoo suffixes to IBKR exchange hints", () => {
  const ctx = loadHoodlefinance();

  assert.equal(ctx.hf_inferIbkrExchange_("ISJP.L", "ISJP.L"), "LSEETF");
  assert.equal(ctx.hf_inferIbkrExchange_("ZPRV.DE", "ZPRV.DE"), "IBIS");
  assert.equal(ctx.hf_inferIbkrExchange_("IUVL.L", "IUVL.L"), "LSEETF");
});

test("deduces isin exchange from ticker, suffix, and quote metadata", () => {
  const ctx = loadHoodlefinance();

  assert.equal(ctx.hf_inferIsinExchange_({}, { tickerInput: "PSE:BDO" }), "PSE");
  assert.equal(ctx.hf_inferIsinExchange_({ symbol: "ISJP.L" }, { tickerInput: "ISJP.L" }), "LON");
  assert.equal(ctx.hf_inferIsinExchange_({ symbol: "ZTL.NE" }, { tickerInput: "ZTL.NE" }), "NEO");
  assert.equal(ctx.hf_inferIsinExchange_({ symbol: "D05.SI" }, { tickerInput: "SGX:D05" }), "SGX");
  assert.equal(ctx.hf_inferIsinExchange_({ symbol: "POLI.TA" }, { tickerInput: "POLI.TA" }), "TLV");
  assert.equal(
    ctx.hf_inferIsinExchange_({ symbol: "GOOG", exchangeName: "NMS" }, { tickerInput: "GOOG" }),
    "NASDAQ"
  );
  assert.equal(
    ctx.hf_inferIsinExchange_({ symbol: "RYCEY", exchangeName: "PNK" }, { tickerInput: "OTCMKTS:RYCEY" }),
    "OTCMKTS"
  );
  assert.equal(
    ctx.hf_inferIsinExchange_({ symbol: "AVLV", exchangeName: "PCX" }, { tickerInput: "AVLV" }),
    "NYSEARCA"
  );
});

test("explicit IBKR exchange codes override Yahoo-derived mapping", () => {
  const ctx = loadHoodlefinance();

  assert.equal(ctx.hf_inferIbkrExchange_("IBIS:ZPRX", "ZPRX.DE"), "IBIS");
  assert.equal(ctx.hf_inferIbkrExchange_("LSEETF:ISJP", "ISJP.L"), "LSEETF");
});

test("unsupported or unmapped exchanges fall back to blank hint", () => {
  const ctx = loadHoodlefinance();

  assert.equal(ctx.hf_inferIbkrExchange_("SHA:600519", "600519.SS"), "");
  assert.equal(ctx.hf_inferIbkrExchange_("UNKNOWN:FOO", "FOO"), "");
});

test("unsupported exchange prefixes fail early during ticker normalization", () => {
  const ctx = loadHoodlefinance();

  assert.throws(
    function () {
      ctx.hf_normalizeTicker_("PDA:BDO");
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

  const entries = ctx.hf_extractIbkrDetailUrls_(html);

  assert.equal(entries.length, 2);
  assert.equal(entries[0].url, "https://misc.interactivebrokers.com/cstools/contract_info/index.php?action=Details&conid=123&site=GEN");
  assert.equal(entries[1].url, "https://misc.interactivebrokers.com/cstools/contract_info/index.php?action=Details&conid=456&site=GEN");
});

test("extracts IBKR detail URLs from the modern contract search results", () => {
  const ctx = loadHoodlefinance();
  const entries = ctx.hf_extractIbkrDetailUrls_(IBKR_MODERN_SEARCH_HTML);

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

  ctx.hf_sortIbkrDetailEntries_(entries, "LSEETF");

  assert.deepEqual(
    entries.map((entry) => entry.url),
    ["lse", "ibis", "other"]
  );
});

test("builds preferred and fallback IBKR search URLs", () => {
  const ctx = loadHoodlefinance();

  assert.equal(
    JSON.stringify(ctx.hf_buildIbkrSearchUrls_("ISJP", "EBS")),
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
    ctx.hf_extractIbkrSearchError_(IBKR_CAPTCHA_HTML, "GOOG", url),
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

  assert.equal(ctx.hf_normalizeMoney_(quote, 1234), 12.34);
  assert.equal(ctx.hf_normalizeCurrency_("GBp"), "GBP");
});

test("money normalization converts ILA prices to ILS", () => {
  const ctx = loadHoodlefinance();
  const quote = { currency: "ILA" };

  assert.equal(ctx.hf_normalizeMoney_(quote, 12345), 123.45);
  assert.equal(ctx.hf_normalizeCurrency_("ILA"), "ILS");
});

test("supported quote attributes support output-currency conversion", () => {
  const ctx = loadHoodlefinance();
  primeCurrencyCodeData(ctx);
  const quote = {
    currency: "USD",
    regularMarketDayHigh: 205,
    regularMarketDayLow: 190,
    regularMarketPreviousClose: 195,
    regularMarketPrice: 200,
  };
  const seenUrls = [];

  ctx.UrlFetchApp.fetchAll = function () {
    throw new Error("Unexpected batch fetch");
  };
  ctx.UrlFetchApp.fetch = function (url) {
    seenUrls.push(url);

    if (url === "https://www.google.com/finance/quote/USD-EUR") {
      return createHttpResponse(
        200,
        createGoogleFinancePairHtml(
          "USD-EUR",
          "United States Dollar (USD / EUR)",
          [0.91, 0.01, 1.11, 4, 4, 2],
          0.9,
          1773599520,
          ["USD", "EUR", "United States Dollar", "Euro", "/m/09nqf", "/m/01l6dm", 2]
        )
      );
    }

    throw new Error("Unexpected URL " + url);
  };

  assert.equal(ctx.hf_extractAttribute_(quote, "price@EUR", {}), 182);
  assert.deepEqual(seenUrls, ["https://www.google.com/finance/quote/USD-EUR"]);
});

test("output-currency conversion reuses money normalization and unit aliases", () => {
  const ctx = loadHoodlefinance();
  primeCurrencyCodeData(ctx);
  const quote = {
    currency: "GBp",
    regularMarketPreviousClose: 1200,
    regularMarketPrice: 1234,
  };

  assert.equal(ctx.hf_extractAttribute_(quote, "price@GBP", {}), 12.34);
  assert.equal(ctx.hf_extractAttribute_(quote, "price@GBp", {}), 1234);
});

test("output-currency conversion rejects non-money attributes and FX identifiers", () => {
  const ctx = loadHoodlefinance();
  primeCurrencyCodeData(ctx);

  assert.throws(
    () => ctx.hf_extractAttribute_({ currency: "USD" }, "currency@USD", {}),
    /Attribute "currency" does not support output-currency conversion\./
  );
  assert.throws(
    () => ctx.hf_extractAttribute_({ longName: "Alphabet" }, "name@USD", {}),
    /Attribute "name" does not support output-currency conversion\. Supported attribute is: price\./
  );
  assert.throws(
    () => ctx.hf_extractAttribute_(
      { currency: "USD", regularMarketPreviousClose: 9, regularMarketPrice: 10 },
      "close@USD",
      {}
    ),
    /Attribute "close" does not support output-currency conversion\. Supported attribute is: price\./
  );
  assert.throws(
    () => ctx.hf_extractAttribute_(
      { currency: "USD", regularMarketDayHigh: 11, regularMarketPrice: 10 },
      "high@USD",
      {}
    ),
    /Attribute "high" does not support output-currency conversion\. Supported attribute is: price\./
  );
  assert.throws(
    () => ctx.hf_extractAttribute_(
      { currency: "USD", regularMarketDayLow: 8, regularMarketPrice: 10 },
      "low@USD",
      {}
    ),
    /Attribute "low" does not support output-currency conversion\. Supported attribute is: price\./
  );
  assert.throws(
    () => ctx.hf_extractAttribute_(
      { currency: "USD", regularMarketPreviousClose: 9, regularMarketPrice: 10 },
      "change@USD",
      {}
    ),
    /Attribute "change" does not support output-currency conversion\. Supported attribute is: price\./
  );
  assert.throws(
    () => ctx.hf_extractAttribute_(
      {
        currency: "USD",
        regularMarketPrice: 1.0812,
      },
      "price@USD",
      {
        plan: { routeState: { fxPair: ctx.hf_parseFxTicker_("EURUSD") } },
        tickerInput: "EURUSD",
      }
    ),
    /Output-currency conversion is not supported for currency-pair identifiers\./
  );
});

test("output-currency conversion rejects malformed or unsupported converted attributes", () => {
  const ctx = loadHoodlefinance();
  primeCurrencyCodeData(ctx);

  assert.throws(
    () => ctx.hf_extractAttribute_({ currency: "USD", regularMarketPrice: 10 }, "price@", {}),
    /Converted attributes must look like price@USD\./
  );
  assert.throws(
    () => ctx.hf_extractAttribute_({ currency: "USD", regularMarketPrice: 10 }, "price@@USD", {}),
    /Converted attributes must look like price@USD\./
  );
  assert.throws(
    () => ctx.hf_extractAttribute_({ currency: "USD", regularMarketPrice: 10 }, "price@FOO", {}),
    /Output currency "FOO" is not supported\./
  );
});

test("output-currency conversion fails clearly when no quote currency is available", () => {
  const ctx = loadHoodlefinance();
  primeCurrencyCodeData(ctx);

  assert.throws(
    () => ctx.hf_extractAttribute_({ regularMarketPrice: 10 }, "price@USD", {}),
    /No quote currency is available for output-currency conversion on "price@USD"\./
  );
});

test("HOODLEFINANCE converts live quote attributes to the requested output currency", () => {
  const ctx = loadHoodlefinance();
  primeCurrencyCodeData(ctx);
  const seenBatches = [];
  const seenUrls = [];

  ctx.UrlFetchApp.fetchAll = function (requests) {
    seenBatches.push(requests.map((request) => request.url));
    return requests.map((request) => {
      if (request.url === "https://query1.finance.yahoo.com/v8/finance/chart/GOOG?interval=1d&range=1d") {
        return createYahooChartResponse("GOOG", {
          currency: "USD",
          regularMarketPreviousClose: 195,
          regularMarketPrice: 200,
        });
      }

      throw new Error("Unexpected URL " + request.url);
    });
  };
  ctx.UrlFetchApp.fetch = function (url) {
    seenUrls.push(url);

    if (url === "https://www.google.com/finance/quote/USD-EUR") {
      return createHttpResponse(
        200,
        createGoogleFinancePairHtml(
          "USD-EUR",
          "United States Dollar (USD / EUR)",
          [0.91, 0.01, 1.11, 4, 4, 2],
          0.9,
          1773599520,
          ["USD", "EUR", "United States Dollar", "Euro", "/m/09nqf", "/m/01l6dm", 2]
        )
      );
    }

    throw new Error("Unexpected URL " + url);
  };

  assert.equal(ctx.HOODLEFINANCE("NASDAQ:GOOG", "price@EUR"), 182);
  assert.equal(JSON.stringify(seenBatches), JSON.stringify([[
    "https://query1.finance.yahoo.com/v8/finance/chart/GOOG?interval=1d&range=1d",
  ]]));
  assert.deepEqual(seenUrls, ["https://www.google.com/finance/quote/USD-EUR"]);
});

test("HOODLEFINANCE converts array inputs to an output currency with deduped fetches", () => {
  const ctx = loadHoodlefinance();
  primeCurrencyCodeData(ctx);
  const seenBatches = [];
  const seenUrls = [];

  ctx.UrlFetchApp.fetchAll = function (requests) {
    seenBatches.push(requests.map((request) => request.url));
    return requests.map((request) => {
      if (request.url === "https://query1.finance.yahoo.com/v8/finance/chart/GOOG?interval=1d&range=1d") {
        return createYahooChartResponse("GOOG", {
          currency: "USD",
          regularMarketPrice: 200,
        });
      }

      if (request.url === "https://query1.finance.yahoo.com/v8/finance/chart/MSFT?interval=1d&range=1d") {
        return createYahooChartResponse("MSFT", {
          currency: "USD",
          regularMarketPrice: 300,
        });
      }

      throw new Error("Unexpected URL " + request.url);
    });
  };
  ctx.UrlFetchApp.fetch = function (url) {
    seenUrls.push(url);

    if (url === "https://www.google.com/finance/quote/USD-EUR") {
      return createHttpResponse(
        200,
        createGoogleFinancePairHtml(
          "USD-EUR",
          "United States Dollar (USD / EUR)",
          [0.91, 0.01, 1.11, 4, 4, 2],
          0.9,
          1773599520,
          ["USD", "EUR", "United States Dollar", "Euro", "/m/09nqf", "/m/01l6dm", 2]
        )
      );
    }

    throw new Error("Unexpected URL " + url);
  };

  assert.equal(
    JSON.stringify(ctx.HOODLEFINANCE([["NASDAQ:GOOG"], ["NASDAQ:GOOG"], ["NASDAQ:MSFT"]], "price@EUR")),
    JSON.stringify([[182], [182], [273]])
  );
  assert.equal(JSON.stringify(seenBatches), JSON.stringify([[
    "https://query1.finance.yahoo.com/v8/finance/chart/GOOG?interval=1d&range=1d",
    "https://query1.finance.yahoo.com/v8/finance/chart/MSFT?interval=1d&range=1d",
  ]]));
  assert.deepEqual(seenUrls, ["https://www.google.com/finance/quote/USD-EUR"]);
});

test("output-currency conversion caches repeated unit resolutions and FX rates within one recalculation pass", () => {
  const ctx = loadHoodlefinance();
  const seenCodes = [];
  const seenConversionTickers = [];
  const unitsByCode = {
    EUR: { assetClass: "currency", canonicalCode: "EUR", displayCode: "EUR", factor: 1 },
    USD: { assetClass: "currency", canonicalCode: "USD", displayCode: "USD", factor: 1 },
  };

  ctx.hf_resolveCurrencyUnit_ = function (code) {
    const key = String(code || "").trim();
    seenCodes.push(key);
    return unitsByCode[key] || null;
  };
  ctx.hf_fetchQuote_ = function (ticker) {
    seenConversionTickers.push(ticker);
    return {
      currency: "EUR",
      regularMarketPrice: 0.91,
    };
  };
  ctx.UrlFetchApp.fetch = function () {
    throw new Error("Unexpected direct fetch");
  };
  ctx.UrlFetchApp.fetchAll = function (requests) {
    return requests.map((request) => {
      if (request.url === "https://query1.finance.yahoo.com/v8/finance/chart/GOOG?interval=1d&range=1d") {
        return createYahooChartResponse("GOOG", {
          currency: "USD",
          regularMarketPrice: 200,
        });
      }

      if (request.url === "https://query1.finance.yahoo.com/v8/finance/chart/MSFT?interval=1d&range=1d") {
        return createYahooChartResponse("MSFT", {
          currency: "USD",
          regularMarketPrice: 300,
        });
      }

      throw new Error("Unexpected URL " + request.url);
    });
  };

  assert.equal(
    JSON.stringify(ctx.HOODLEFINANCE([["NASDAQ:GOOG"], ["NASDAQ:MSFT"]], "price@EUR")),
    JSON.stringify([[182], [273]])
  );
  assert.deepEqual(seenCodes, ["USD", "EUR"]);
  assert.deepEqual(seenConversionTickers, ["CURRENCY:USDEUR"]);
});

test("output-currency conversion still resolves distinct source currencies separately within one recalculation pass", () => {
  const ctx = loadHoodlefinance();
  const seenCodes = [];
  const seenConversionTickers = [];
  const unitsByCode = {
    EUR: { assetClass: "currency", canonicalCode: "EUR", displayCode: "EUR", factor: 1 },
    GBP: { assetClass: "currency", canonicalCode: "GBP", displayCode: "GBP", factor: 1 },
    USD: { assetClass: "currency", canonicalCode: "USD", displayCode: "USD", factor: 1 },
  };

  ctx.hf_resolveCurrencyUnit_ = function (code) {
    const key = String(code || "").trim();
    seenCodes.push(key);
    return unitsByCode[key] || null;
  };
  ctx.hf_fetchQuote_ = function (ticker) {
    seenConversionTickers.push(ticker);

    if (ticker === "CURRENCY:USDGBP") {
      return {
        currency: "GBP",
        regularMarketPrice: 0.8,
      };
    }

    if (ticker === "CURRENCY:EURGBP") {
      return {
        currency: "GBP",
        regularMarketPrice: 0.85,
      };
    }

    throw new Error("Unexpected conversion ticker " + ticker);
  };
  ctx.UrlFetchApp.fetch = function () {
    throw new Error("Unexpected direct fetch");
  };
  ctx.UrlFetchApp.fetchAll = function (requests) {
    return requests.map((request) => {
      if (request.url === "https://query1.finance.yahoo.com/v8/finance/chart/GOOG?interval=1d&range=1d") {
        return createYahooChartResponse("GOOG", {
          currency: "USD",
          regularMarketPrice: 200,
        });
      }

      if (request.url === "https://query1.finance.yahoo.com/v8/finance/chart/SIE.DE?interval=1d&range=1d") {
        return createYahooChartResponse("SIE.DE", {
          currency: "EUR",
          regularMarketPrice: 150,
        });
      }

      throw new Error("Unexpected URL " + request.url);
    });
  };

  assert.equal(
    JSON.stringify(ctx.HOODLEFINANCE([["NASDAQ:GOOG"], ["SIE.DE"]], "price@GBP")),
    JSON.stringify([[160], [127.5]])
  );
  assert.deepEqual(seenCodes, ["USD", "GBP", "EUR"]);
  assert.deepEqual(seenConversionTickers, ["CURRENCY:USDGBP", "CURRENCY:EURGBP"]);
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

  ctx.hf_resolveIbkrIsin_ = function (quote, context) {
    capturedArgs = { quote, context };
    return "TESTISIN123";
  };

  const result = ctx.hf_extractAttribute_(
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

  ctx.hf_resolvePseIsin_ = function (quote, context) {
    capturedArgs = { quote, context };
    return "PHY030431175";
  };

  assert.equal(
    ctx.hf_extractAttribute_({ symbol: "AAA", isin: "PHY030431175" }, "isin", { tickerInput: "PSE:AAA" }),
    "PHY030431175"
  );
  assert.deepEqual(capturedArgs, {
    quote: { symbol: "AAA", isin: "PHY030431175" },
    context: { tickerInput: "PSE:AAA" },
  });
});

test("isin returns the direct ISIN input without redispatching to a source-specific resolver", () => {
  const ctx = loadHoodlefinance();

  ctx.hf_resolveTradingviewIsin_ = function () {
    throw new Error("should not redispatch direct ISIN input");
  };

  assert.equal(
    ctx.hf_extractAttribute_({ symbol: "POLI.TA" }, "isin", { tickerInput: "IL0006625771" }),
    "IL0006625771"
  );
});

test("isin returns the direct ISIN input for ISIN:-prefixed identifiers", () => {
  const ctx = loadHoodlefinance();

  ctx.hf_resolveTradingviewIsin_ = function () {
    throw new Error("should not redispatch direct ISIN input");
  };

  assert.equal(
    ctx.hf_extractAttribute_({ symbol: "GOOG" }, "isin", { tickerInput: "ISIN:US02079K1079" }),
    "US02079K1079"
  );
});

test("isin source overrides dispatch through the requested resolver", () => {
  const ctx = loadHoodlefinance();
  let capturedArgs = null;

  ctx.hf_resolveIbkrIsin_ = function (quote, context) {
    capturedArgs = { quote, context };
    return "IBKRISIN123";
  };

  assert.equal(
    ctx.hf_extractAttribute_({ symbol: "GOOG" }, "isin", { tickerInput: "GOOG@IBKR" }),
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
    JSON.stringify(ctx.hf_extractLonListings_(LON_SEARCH_SJPA_HTML)),
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
    JSON.stringify(ctx.hf_resolveLonListing_("CPXJ")),
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
    ctx.hf_extractAttribute_({ symbol: "SJPA.L" }, "isin", { tickerInput: "SJPA.L@LON" }),
    "IE00B4L5YX21"
  );
});

test("extracts exact ARIVA listing matches from live search results", () => {
  const ctx = loadHoodlefinance();

  assert.equal(
    JSON.stringify(ctx.hf_extractArivaListings_(ARIVA_SEARCH_ZPRV_HTML)),
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
    ctx.hf_extractAttribute_({ symbol: "ZPRV.DE" }, "isin", { tickerInput: "ZPRV.DE@ARIVA" }),
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
    ctx.hf_extractAttribute_({ symbol: "ZPRV.DE" }, "isin", { tickerInput: "ZPRV.DE@ARIVA" }),
    "IE00BSPLC413"
  );
  assert.equal(
    ctx.hf_extractAttribute_({ symbol: "ZPRV.DE" }, "isin", { tickerInput: "ZPRV.DE@ARIVA" }),
    "IE00BSPLC413"
  );
  assert.deepEqual(seenUrls, [
    "https://www.ariva.de/search/livesearch.m?searchname=ZPRV",
    "https://www.ariva.de/fonds/spdr-msci-usa-small-cap-value-weighted-ucits-etf",
  ]);
});

TRADINGVIEW_DEFAULT_ISIN_DISPATCH_CASES.forEach(function (testCase) {
  test("isin dispatches to TradingView for " + testCase.exchange + " tickers", () => {
    const ctx = loadHoodlefinance();
    let capturedArgs = null;

    ctx.hf_resolveTradingviewIsin_ = function (quote, context) {
      capturedArgs = { quote, context };
      return testCase.isin;
    };

    assert.equal(
      ctx.hf_extractAttribute_(testCase.quote, "isin", { tickerInput: testCase.tickerInput }),
      testCase.isin
    );
    assert.deepEqual(capturedArgs, {
      quote: testCase.quote,
      context: { tickerInput: testCase.tickerInput },
    });
  });
});

test("isin dispatches to LON for London tickers", () => {
  const ctx = loadHoodlefinance();
  let capturedArgs = null;

  ctx.hf_resolveLonIsin_ = function (quote, context) {
    capturedArgs = { quote, context };
    return "IE00B4L5YX21";
  };

  assert.equal(
    ctx.hf_extractAttribute_({ symbol: "SJPA.L" }, "isin", { tickerInput: "SJPA.L" }),
    "IE00B4L5YX21"
  );
  assert.deepEqual(capturedArgs, {
    quote: { symbol: "SJPA.L" },
    context: { tickerInput: "SJPA.L" },
  });
});

test("isin fails clearly when no exchange-specific source is implemented", () => {
  const ctx = loadHoodlefinance();

  assert.throws(
    function () {
      ctx.hf_extractAttribute_({ symbol: "035720.KQ" }, "isin", { tickerInput: "KOSDAQ:035720" });
    },
    /ISIN lookup is not supported yet for exchange "KOSDAQ"\. Try an identifier source override such as "@TRADINGVIEW", "@LON", "@PSE", "@ARIVA", or "@IBKR"\./
  );
});

test("isin helper errors avoid source-internal lookup jargon", () => {
  const ctx = loadHoodlefinance();

  assert.throws(
    function () {
      ctx.hf_resolveArivaIsin_({ exchangeName: "GER" }, { tickerInput: "ETR:@ARIVA" });
    },
    /Could not determine the ticker code needed for ARIVA ISIN lookup\./
  );
  assert.throws(
    function () {
      ctx.hf_resolveLonIsin_({ exchangeName: "LSE" }, { tickerInput: "LON:@LON" });
    },
    /Could not determine the ticker code needed for LON ISIN lookup\./
  );
  assert.throws(
    function () {
      ctx.hf_resolveTradingviewIsin_({ symbol: "035720.KQ" }, { tickerInput: "KOSDAQ:035720@TRADINGVIEW" });
    },
    /TradingView cannot be used for ISIN lookup on exchange "KOSDAQ"\./
  );
  assert.throws(
    function () {
      ctx.hf_resolveTradingviewIsin_({ exchangeName: "NMS" }, {});
    },
    /Could not determine the ticker code needed for TradingView ISIN lookup\./
  );
});

test("extracts TradingView symbol metadata from the page bootstrap", () => {
  const ctx = loadHoodlefinance();

  TRADINGVIEW_SYMBOL_HTML_CASES.forEach(function (testCase) {
    assert.equal(ctx.hf_extractTradingviewResolvedSymbol_(testCase.html), testCase.resolvedSymbol);
    assert.equal(ctx.hf_extractTradingviewIsin_(testCase.html), testCase.isin);
  });
});

TRADINGVIEW_EXPLICIT_ISIN_CASES.forEach(function (testCase) {
  test("isin@TRADINGVIEW resolves for " + testCase.exchange + " tickers", () => {
    const ctx = loadHoodlefinance();

    ctx.UrlFetchApp.fetch = function (url) {
      if (url === testCase.url) {
        return createHttpResponse(200, testCase.html);
      }

      throw new Error("Unexpected URL " + url);
    };

    assert.equal(
      ctx.hf_extractAttribute_(testCase.quote, "isin", { tickerInput: testCase.tickerInput }),
      testCase.isin
    );
  });
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
    ctx.hf_extractAttribute_({ symbol: "ZTL.NE" }, "isin", { tickerInput: "ZTL.NE@TRADINGVIEW" }),
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
    ctx.hf_extractAttribute_({ symbol: "POLI.TA" }, "isin", { tickerInput: "POLI.TA@TRADINGVIEW" }),
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
    ctx.hf_extractAttribute_({ symbol: "KSM.F59.TA" }, "isin", { tickerInput: "TLV:KSMF59@TRADINGVIEW" }),
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
      ctx.hf_extractAttribute_({ symbol: "ZPRX.DE" }, "isin", { tickerInput: "ZPRX.DE@TRADINGVIEW" });
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
    JSON.stringify(ctx.hf_extractPseListings_(PSE_SEARCH_AAA_HTML)),
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
    JSON.stringify(ctx.hf_resolvePseListing_.call(null, "AC")),
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
    JSON.stringify(ctx.hf_resolvePseListing_("AC")),
    JSON.stringify({
      companyId: "57",
      name: "Ayala Corporation",
      securityId: "180",
      symbol: "AC",
    })
  );
  assert.equal(
    JSON.stringify(ctx.hf_resolvePseListing_("AC")),
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
  const quote = ctx.hf_extractPseQuote_(PSE_STOCK_BDO_HTML, {
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
  const quote = ctx.hf_extractPseQuote_(PSE_STOCK_AAA_HTML, {
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

  const quote = ctx.hf_fetchQuote_("PSE:AAA");

  assert.equal(quote.symbol, "AAA");
  assert.equal(quote.currency, "PHP");
  assert.equal(quote.isin, "PHY030431175");
  assert.equal(quote.regularMarketPrice, 1.63);
});

test("routes Yahoo-style .PS tickers through the dedicated PSE path", () => {
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

  assert.equal(ctx.HOODLEFINANCE("BDO.PS", "name"), "BDO Unibank, Inc.");
  assert.equal(ctx.HOODLEFINANCE("BDO.PS", "symbol"), "PSE:BDO");
  assert.equal(ctx.HOODLEFINANCE("BDO.PS", "symbol:yahoo"), "BDO.PS");
  assert.equal(ctx.HOODLEFINANCE("BDO.PS", "exchange"), "PSE");
  assert.equal(ctx.HOODLEFINANCE("BDO.PS", "exchange:yahoo"), "PSE");
});

test("reports a clearer outage error when the PSE search page is unavailable", () => {
  const ctx = loadHoodlefinance();

  ctx.UrlFetchApp.fetch = function (url) {
    assert.equal(url, "https://edge.pse.com.ph/companyDirectory/search.ax?keyword=BDO");
    return createHttpResponse(520, PSE_HTTP_520_TEXT);
  };

  assert.throws(
    function () {
      ctx.hf_fetchQuote_("PSE:BDO");
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
      ctx.hf_fetchQuote_("PSE:BDO");
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
      ctx.hf_fetchQuote_("PSE:BDO");
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

  ctx.hf_resolvePseListing_("BDO");
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
    ctx.hf_extractAttribute_({ symbol: "AAA", isin: "PHY030431175" }, "isin", { tickerInput: "PSE:AAA@PSE" }),
    "PHY030431175"
  );
});

test("isin@PSE rejects non-PSE tickers", () => {
  const ctx = loadHoodlefinance();

  assert.throws(
    function () {
      ctx.hf_extractAttribute_({ symbol: "GOOG", exchangeName: "NMS" }, "isin", { tickerInput: "GOOG@PSE" });
    },
    /PSE ISIN lookup only works for PSE tickers\./
  );
});

test("isin@LON rejects non-LON tickers", () => {
  const ctx = loadHoodlefinance();

  assert.throws(
    function () {
      ctx.hf_extractAttribute_({ symbol: "GOOG", exchangeName: "NMS" }, "isin", { tickerInput: "GOOG@LON" });
    },
    /LON ISIN lookup only works for LON tickers\./
  );
});

test("isin@ARIVA rejects non-ETR tickers", () => {
  const ctx = loadHoodlefinance();

  assert.throws(
    function () {
      ctx.hf_extractAttribute_({ symbol: "SJPA.L" }, "isin", { tickerInput: "SJPA.L@ARIVA" });
    },
    /ARIVA ISIN lookup only works for ETR tickers\./
  );
});

test("isin@IBKR does not short-circuit to direct quote isin", () => {
  const ctx = loadHoodlefinance();
  let capturedArgs = null;

  ctx.hf_resolveIbkrIsin_ = function (quote, context) {
    capturedArgs = { quote, context };
    return "IBKRISIN123";
  };

  assert.equal(
    ctx.hf_extractAttribute_({ symbol: "AAA", isin: "PHY030431175" }, "isin", { tickerInput: "PSE:AAA@IBKR" }),
    "IBKRISIN123"
  );
  assert.deepEqual(capturedArgs, {
    quote: { symbol: "AAA", isin: "PHY030431175" },
    context: { tickerInput: "PSE:AAA@IBKR" },
  });
});
