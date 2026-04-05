const assert = require("node:assert/strict");
const test = require("node:test");

const {
  extractIsinCountryCode,
  extractDirectIsinInput,
  inferIsinExchange,
  resolveIsinAttributeValue,
  resolveDirectIsinAttributeValue,
  RequestInput,
} = require("../dist/ts/core/index.js");

test("extractIsinCountryCode handles bare and prefixed ISIN requests", () => {
  const looksLikeIsin = (v) => /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/i.test(v);

  assert.equal(extractIsinCountryCode({ ticker: "PHY077751022" }, looksLikeIsin), "PH");
  assert.equal(extractIsinCountryCode({ ticker: "ISIN:PHY077751022" }, looksLikeIsin), "PH");
  assert.equal(extractIsinCountryCode({ ticker: "US0378331005" }, looksLikeIsin), "US");
  assert.equal(extractIsinCountryCode({ ticker: "AAPL" }, looksLikeIsin), "");
  assert.equal(extractIsinCountryCode({ ticker: "" }, looksLikeIsin), "");
});

test("extractDirectIsinInput validates and cleanses ISIN identifiers", () => {
  const looksLikeIsin = (v) => /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/i.test(v);

  assert.equal(extractDirectIsinInput("ISIN:PHY077751022", looksLikeIsin), "PHY077751022");
  assert.equal(extractDirectIsinInput("phy077751022", looksLikeIsin), "PHY077751022");
  assert.equal(extractDirectIsinInput("AAPL", looksLikeIsin), "");
  assert.equal(extractDirectIsinInput("ISIN:AAPL", looksLikeIsin), "");
});

test("inferIsinExchange deduces exchange from quote metadata and ticker suffixes", () => {
  assert.equal(inferIsinExchange({ symbol: "BDO.PS" }, "PSE:BDO"), "PSE");
  assert.equal(inferIsinExchange({ symbol: "AAPL", fullExchangeName: "NasdaqGS" }, "AAPL"), "NASDAQ");
  assert.equal(inferIsinExchange({ symbol: "VOD.L" }, "VOD.L"), "LON");
  assert.equal(inferIsinExchange({ symbol: "AMZN" }, "NASDAQ:AMZN"), "NASDAQ");
  assert.equal(inferIsinExchange({ symbol: "REIT.TA" }, "REIT"), "TLV");
});

test("resolveIsinAttributeValue preserves legacy error for currency pairs", () => {
  const deps = {
    looksLikeIsin: () => false,
    fetchText: () => "",
    getCachedString: () => "",
    putCachedString: () => "",
  };

  const fxQuote = {
    symbol: "EURUSD=X",
    hoodlefinanceFxDisplayCurrency: "USD",
  };

  assert.throws(
    () => resolveIsinAttributeValue(fxQuote, { tickerInput: "EURUSD" }, deps),
    /ISIN is not available for currency pairs\./
  );
});

test("resolveDirectIsinAttributeValue matches legacy direct resolution routes", () => {
  const deps = {
    looksLikeIsin: (v) => /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/i.test(v),
    fetchText: (url) => {
      if (url.includes("frames.pse.com.ph")) {
        return `
          <input id="symbol-json" value="BDO">
          <input id="stock-json" value="{&quot;name&quot;:&quot;BDO&quot;,&quot;full_name&quot;:&quot;BDO Unibank, Inc.&quot;}">
          <table>
            <tr><td>ISIN</td><td>PHY077751022</td></tr>
          </table>
          <a href="companyDisclosures/form.do?cmpy_id=123">link</a>
        `;
      }
      if (url.includes("londonstockexchange")) {
        return `UpdateOpener('','GB00B1YW4409|||||VOD')`;
      }
      return "";
    },
    getCachedString: () => "",
    putCachedString: () => "",
  };

  // Note: These mock deep dependencies of resolveDirectIsinAttributeValue may need more robust mocks
  // if the underlying functions (resolvePseIsinBySymbol, etc.) are called and expect specific HTML.
  // For now, testing the route matching.

  const isinRes = resolveDirectIsinAttributeValue({ tickerInput: "ISIN:PHY077751022" }, deps);
  assert.equal(isinRes.route, "ATTRIBUTE-IDENTITY");
  assert.equal(isinRes.value, "PHY077751022");

  const pseRes = resolveDirectIsinAttributeValue({ tickerInput: "PSE:BDO" }, deps);
  assert.equal(pseRes.route, "PSE");
  
  const lonRes = resolveDirectIsinAttributeValue({ tickerInput: "LON:VOD" }, deps);
  assert.equal(lonRes.route, "LON");
});
