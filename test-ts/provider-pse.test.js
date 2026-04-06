const assert = require("node:assert/strict");
const test = require("node:test");

const {
  extractPseFrameQuote,
  extractPseQuote,
} = require("../dist/ts/core/pse-quotes.js");

test("extractPseFrameQuote falls back to previous close for suspended stocks (Parity)", () => {
  const html = `
    <h3 class="last-price"> </h3>
    <table>
      <tr><td>Prev Close</td><td>123.45</td></tr>
      <tr><td>ISIN</td><td>PHY077751022</td></tr>
    </table>
    <input id="symbol-json" value="BDO">
    <input id="stock-json" value="{&quot;name&quot;:&quot;BDO&quot;,&quot;full_name&quot;:&quot;BDO Unibank, Inc.&quot;}">
    <a href="companyDisclosures/form.do?cmpy_id=123">link</a>
  `;
  
  const quote = extractPseFrameQuote(html, "BDO");
  assert.equal(quote.regularMarketPrice, 123.45);
});

test("extractPseFrameQuote extracts company name from header if metadata is blank (Parity)", () => {
  const html = `
    <h3 class="last-price">100.00</h3>
    <h3>BDO</h3>
    <div>BDO Unibank, Inc.</div>
    <table>
      <tr><td>Prev Close</td><td>99.00</td></tr>
      <tr><td>ISIN</td><td>PHY077751022</td></tr>
    </table>
    <input id="symbol-json" value="BDO">
    <input id="stock-json" value="">
    <a href="companyDisclosures/form.do?cmpy_id=123">link</a>
  `;
  
  const quote = extractPseFrameQuote(html, "BDO");
  assert.equal(quote.longName, "BDO Unibank, Inc.");
});

// --- RECORDED GAPS (EXPECTED TO FAIL) ---

test("GAP: PSE ISIN map caching and freshness logic", { skip: "not yet implemented" }, () => {
  // This is hard to test as a pure scraper unit test, but we record the intent.
  // We expect the system to skip the GitHub fetch if a local cache is fresh.
  // Since this logic is typically in the resolver/service layer, we denote it here.
  assert.ok(false, "Caching/Freshness logic for PSE ISIN map is likely missing in TS core");
});

test("GAP: Handling of missing ISIN in PSE frames (Strict Parity)", () => {
  const html = `
    <h3 class="last-price">100.00</h3>
    <input id="symbol-json" value="BDO">
    <input id="stock-json" value="{&quot;name&quot;:&quot;BDO&quot;,&quot;full_name&quot;:&quot;BDO Unibank, Inc.&quot;}">
    <a href="companyDisclosures/form.do?cmpy_id=123">link</a>
    <table>
      <tr><td>Prev Close</td><td>99.00</td></tr>
      <!-- Missing ISIN row -->
    </table>
  `;

  // Legacy line 6698: if (!isin) throw new Error(...)
  assert.throws(() => extractPseFrameQuote(html, "BDO"), /No PSE listing was found/);
});
