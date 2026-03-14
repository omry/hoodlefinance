# Support Matrix

This matrix is sample-based, not exhaustive. It is intended to show current practical coverage of the public interface, not a formal guarantee for every symbol on an exchange.

Use it as a quick reference for current live probe results by exchange and feature group. In the current sampled probes, direct `ISIN` query support is green everywhere except `PSE`.

<!-- SUPPORT_MATRIX:START -->
<table>
  <thead>
    <tr>
      <th rowspan="2" style="vertical-align:top;"><span title="Code and full venue name.">Exchange</span></th>
      <th rowspan="2" style="text-align:center;vertical-align:top;"><span title="Hover the info icon to see the sample tickers used for the feature columns.">Samples</span></th>
      <th colspan="3" style="text-align:center;">Query</th>
      <th colspan="5" style="text-align:center;border-left:3px solid #6b7280;">Attributes</th>
    </tr>
    <tr>
      <th style="text-align:center;vertical-align:top;"><span title="Representative exchange-prefixed inputs such as `LON:SJPA`, `TLV:POLI`, or `NASDAQ:GOOG`.">Google Finance query<br><sub><code>LON:SJPA</code></sub></span></th>
      <th style="text-align:center;vertical-align:top;"><span title="Representative Yahoo-style inputs such as `SJPA.L`, `POLI.TA`, or `GOOG`.">Yahoo style<br><sub><code>SJPA.L</code></sub></span></th>
      <th style="text-align:center;vertical-align:top;"><span title="Direct ISIN input such as `IE00...`, `IL00...`, or `US...`.">ISIN<br><sub><code>IE00B4L5YX21</code></sub></span></th>
      <th style="text-align:center;border-left:3px solid #6b7280;vertical-align:top;"><span title="Grouped attributes: price, name, currency">Basic quote<br><sub><code>price</code><br><code>name</code><br><code>currency</code></sub></span></th>
      <th style="text-align:center;vertical-align:top;"><span title="Grouped attributes: high, low, close">Session stats<br><sub><code>high</code><br><code>low</code><br><code>close</code></sub></span></th>
      <th style="text-align:center;vertical-align:top;"><span title="Grouped attributes: volume, tradetime, datadelay">Activity/time<br><sub><code>volume</code><br><code>tradetime</code><br><code>datadelay</code></sub></span></th>
      <th style="text-align:center;vertical-align:top;"><span title="Grouped attributes: change, changepct">Change<br><sub><code>change</code><br><code>changepct</code></sub></span></th>
      <th style="text-align:center;vertical-align:top;"><span title="Grouped attributes: isin">ISIN<br><sub><code>isin</code></sub></span></th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="vertical-align:top;"><code>HKG</code><br><sub>Hong Kong Stock Exchange</sub></td>
      <td style="text-align:center;vertical-align:top;"><span title="9988.HK (Alibaba / BABA), 1299.HK, 1810.HK">ⓘ</span></td>
      <td style="text-align:center;"><span title="All probes passed. Attributes: name. Samples: HKG:9988, HKG:1299, HKG:1810">✅</span></td>
      <td style="text-align:center;"><span title="All probes passed. Attributes: name. Samples: 9988.HK (Alibaba / BABA), 1299.HK, 1810.HK">✅</span></td>
      <td style="text-align:center;"><span title="All probes passed. Attributes: name. Samples: KYG017191142 (9988.HK / Alibaba)">✅</span></td>
      <td style="text-align:center;border-left:3px solid #6b7280;"><span title="All probes passed. Attributes: price, name, currency. Samples: 9988.HK (Alibaba / BABA), 1299.HK, 1810.HK">✅</span></td>
      <td style="text-align:center;"><span title="All probes passed. Attributes: high, low, close. Samples: 9988.HK (Alibaba / BABA), 1299.HK, 1810.HK">✅</span></td>
      <td style="text-align:center;"><span title="All probes passed. Attributes: volume, tradetime, datadelay. Samples: 9988.HK (Alibaba / BABA), 1299.HK, 1810.HK">✅</span></td>
      <td style="text-align:center;"><span title="All probes passed. Attributes: change, changepct. Samples: 9988.HK (Alibaba / BABA), 1299.HK, 1810.HK">✅</span></td>
      <td style="text-align:center;"><span title="All probes passed. Attributes: isin. Samples: 9988.HK (Alibaba / BABA), 1299.HK, 1810.HK">✅</span></td>
    </tr>
    <tr>
      <td style="vertical-align:top;"><code>LON</code><br><sub>London Stock Exchange</sub></td>
      <td style="text-align:center;vertical-align:top;"><span title="SJPA.L, CPXJ.L, VUAG.L">ⓘ</span></td>
      <td style="text-align:center;"><span title="All probes passed. Attributes: name. Samples: LON:SJPA, LON:CPXJ, LON:VUAG">✅</span></td>
      <td style="text-align:center;"><span title="All probes passed. Attributes: name. Samples: SJPA.L, CPXJ.L, VUAG.L">✅</span></td>
      <td style="text-align:center;"><span title="All probes passed. Attributes: name. Samples: IE00B4L5YX21 (SJPA)">✅</span></td>
      <td style="text-align:center;border-left:3px solid #6b7280;"><span title="All probes passed. Attributes: price, name, currency. Samples: SJPA.L, CPXJ.L, VUAG.L">✅</span></td>
      <td style="text-align:center;"><span title="All probes passed. Attributes: high, low, close. Samples: SJPA.L, CPXJ.L, VUAG.L">✅</span></td>
      <td style="text-align:center;"><span title="All probes passed. Attributes: volume, tradetime, datadelay. Samples: SJPA.L, CPXJ.L, VUAG.L">✅</span></td>
      <td style="text-align:center;"><span title="All probes passed. Attributes: change, changepct. Samples: SJPA.L, CPXJ.L, VUAG.L">✅</span></td>
      <td style="text-align:center;"><span title="All probes passed. Attributes: isin. Samples: SJPA.L, CPXJ.L, VUAG.L">✅</span></td>
    </tr>
    <tr>
      <td style="vertical-align:top;"><code>NASDAQ</code><br><sub>Nasdaq</sub></td>
      <td style="text-align:center;vertical-align:top;"><span title="GOOG, AAPL, MSFT">ⓘ</span></td>
      <td style="text-align:center;"><span title="All probes passed. Attributes: name. Samples: NASDAQ:GOOG, NASDAQ:AAPL, NASDAQ:MSFT">✅</span></td>
      <td style="text-align:center;"><span title="All probes passed. Attributes: name. Samples: GOOG, AAPL, MSFT">✅</span></td>
      <td style="text-align:center;"><span title="All probes passed. Attributes: name. Samples: US02079K1079 (GOOG)">✅</span></td>
      <td style="text-align:center;border-left:3px solid #6b7280;"><span title="All probes passed. Attributes: price, name, currency. Samples: GOOG, AAPL, MSFT">✅</span></td>
      <td style="text-align:center;"><span title="All probes passed. Attributes: high, low, close. Samples: GOOG, AAPL, MSFT">✅</span></td>
      <td style="text-align:center;"><span title="All probes passed. Attributes: volume, tradetime, datadelay. Samples: GOOG, AAPL, MSFT">✅</span></td>
      <td style="text-align:center;"><span title="All probes passed. Attributes: change, changepct. Samples: GOOG, AAPL, MSFT">✅</span></td>
      <td style="text-align:center;"><span title="All probes passed. Attributes: isin. Samples: GOOG, AAPL, MSFT">✅</span></td>
    </tr>
    <tr>
      <td style="vertical-align:top;"><code>NYSE</code><br><sub>New York Stock Exchange</sub></td>
      <td style="text-align:center;vertical-align:top;"><span title="NYSE:IBM, NYSE:KO, NYSE:DIS">ⓘ</span></td>
      <td style="text-align:center;"><span title="All probes passed. Attributes: name. Samples: NYSE:IBM, NYSE:KO, NYSE:DIS">✅</span></td>
      <td style="text-align:center;"><span title="All probes passed. Attributes: name. Samples: IBM, KO, DIS">✅</span></td>
      <td style="text-align:center;"><span title="All probes passed. Attributes: name. Samples: US4592001014 (IBM)">✅</span></td>
      <td style="text-align:center;border-left:3px solid #6b7280;"><span title="All probes passed. Attributes: price, name, currency. Samples: NYSE:IBM, NYSE:KO, NYSE:DIS">✅</span></td>
      <td style="text-align:center;"><span title="All probes passed. Attributes: high, low, close. Samples: NYSE:IBM, NYSE:KO, NYSE:DIS">✅</span></td>
      <td style="text-align:center;"><span title="All probes passed. Attributes: volume, tradetime, datadelay. Samples: NYSE:IBM, NYSE:KO, NYSE:DIS">✅</span></td>
      <td style="text-align:center;"><span title="All probes passed. Attributes: change, changepct. Samples: NYSE:IBM, NYSE:KO, NYSE:DIS">✅</span></td>
      <td style="text-align:center;"><span title="All probes passed. Attributes: isin. Samples: NYSE:IBM, NYSE:KO, NYSE:DIS">✅</span></td>
    </tr>
    <tr>
      <td style="vertical-align:top;"><code>OTCMKTS</code><br><sub>OTC Markets</sub></td>
      <td style="text-align:center;vertical-align:top;"><span title="OTCMKTS:RYCEY, OTCMKTS:NSRGY, OTCMKTS:TCEHY">ⓘ</span></td>
      <td style="text-align:center;"><span title="All probes passed. Attributes: name. Samples: OTCMKTS:RYCEY, OTCMKTS:NSRGY, OTCMKTS:TCEHY">✅</span></td>
      <td style="text-align:center;"><span title="All probes passed. Attributes: name. Samples: RYCEY, NSRGY, TCEHY">✅</span></td>
      <td style="text-align:center;"><span title="All probes passed. Attributes: name. Samples: US7757812067 (OTCMKTS:RYCEY)">✅</span></td>
      <td style="text-align:center;border-left:3px solid #6b7280;"><span title="All probes passed. Attributes: price, name, currency. Samples: OTCMKTS:RYCEY, OTCMKTS:NSRGY, OTCMKTS:TCEHY">✅</span></td>
      <td style="text-align:center;"><span title="All probes passed. Attributes: high, low, close. Samples: OTCMKTS:RYCEY, OTCMKTS:NSRGY, OTCMKTS:TCEHY">✅</span></td>
      <td style="text-align:center;"><span title="All probes passed. Attributes: volume, tradetime, datadelay. Samples: OTCMKTS:RYCEY, OTCMKTS:NSRGY, OTCMKTS:TCEHY">✅</span></td>
      <td style="text-align:center;"><span title="All probes passed. Attributes: change, changepct. Samples: OTCMKTS:RYCEY, OTCMKTS:NSRGY, OTCMKTS:TCEHY">✅</span></td>
      <td style="text-align:center;"><span title="All probes passed. Attributes: isin. Samples: OTCMKTS:RYCEY, OTCMKTS:NSRGY, OTCMKTS:TCEHY">✅</span></td>
    </tr>
    <tr>
      <td style="vertical-align:top;"><code>PSE</code><br><sub>Philippine Stock Exchange</sub></td>
      <td style="text-align:center;vertical-align:top;"><span title="PSE:BDO, PSE:AAA, PSE:JFC">ⓘ</span></td>
      <td style="text-align:center;"><span title="All probes passed. Attributes: name. Samples: PSE:BDO, PSE:AAA, PSE:JFC">✅</span></td>
      <td style="text-align:center;"><span title="All probes passed. Attributes: name. Samples: BDO.PS, AAA.PS, JFC.PS">✅</span></td>
      <td style="text-align:center;"><span title="All probes passed. Attributes: name. Samples: PHY077751022 (PSE:BDO)">✅</span></td>
      <td style="text-align:center;border-left:3px solid #6b7280;"><span title="All probes passed. Attributes: price, name, currency. Samples: PSE:BDO, PSE:AAA, PSE:JFC">✅</span></td>
      <td style="text-align:center;"><span title="Failing probes: high (PSE:AAA); low (PSE:AAA). Samples: PSE:BDO, PSE:AAA, PSE:JFC">⚠️</span></td>
      <td style="text-align:center;"><span title="Failing probes: volume (PSE:AAA). Samples: PSE:BDO, PSE:AAA, PSE:JFC">⚠️</span></td>
      <td style="text-align:center;"><span title="All probes passed. Attributes: change, changepct. Samples: PSE:BDO, PSE:AAA, PSE:JFC">✅</span></td>
      <td style="text-align:center;"><span title="All probes passed. Attributes: isin. Samples: PSE:BDO, PSE:AAA, PSE:JFC">✅</span></td>
    </tr>
    <tr>
      <td style="vertical-align:top;"><code>SGX</code><br><sub>Singapore Exchange</sub></td>
      <td style="text-align:center;vertical-align:top;"><span title="SGX:D05, SGX:U11, SGX:O39">ⓘ</span></td>
      <td style="text-align:center;"><span title="All probes passed. Attributes: name. Samples: SGX:D05, SGX:U11, SGX:O39">✅</span></td>
      <td style="text-align:center;"><span title="All probes passed. Attributes: name. Samples: D05.SI, U11.SI, O39.SI">✅</span></td>
      <td style="text-align:center;"><span title="All probes passed. Attributes: name. Samples: SG1L01001701 (SGX:D05)">✅</span></td>
      <td style="text-align:center;border-left:3px solid #6b7280;"><span title="All probes passed. Attributes: price, name, currency. Samples: SGX:D05, SGX:U11, SGX:O39">✅</span></td>
      <td style="text-align:center;"><span title="All probes passed. Attributes: high, low, close. Samples: SGX:D05, SGX:U11, SGX:O39">✅</span></td>
      <td style="text-align:center;"><span title="All probes passed. Attributes: volume, tradetime, datadelay. Samples: SGX:D05, SGX:U11, SGX:O39">✅</span></td>
      <td style="text-align:center;"><span title="All probes passed. Attributes: change, changepct. Samples: SGX:D05, SGX:U11, SGX:O39">✅</span></td>
      <td style="text-align:center;"><span title="All probes passed. Attributes: isin. Samples: SGX:D05, SGX:U11, SGX:O39">✅</span></td>
    </tr>
    <tr>
      <td style="vertical-align:top;"><code>TLV</code><br><sub>Tel Aviv Stock Exchange</sub></td>
      <td style="text-align:center;vertical-align:top;"><span title="TASE.TA, POLI.TA, NICE.TA">ⓘ</span></td>
      <td style="text-align:center;"><span title="All probes passed. Attributes: name. Samples: TLV:POLI, TLV:NICE, TLV:TEVA">✅</span></td>
      <td style="text-align:center;"><span title="All probes passed. Attributes: name. Samples: POLI.TA, NICE.TA, TEVA.TA">✅</span></td>
      <td style="text-align:center;"><span title="All probes passed. Attributes: name. Samples: IL0006625771 (POLI), IL0011465700 (KSM.F59 ETF)">✅</span></td>
      <td style="text-align:center;border-left:3px solid #6b7280;"><span title="All probes passed. Attributes: price, name, currency. Samples: TASE.TA, POLI.TA, NICE.TA">✅</span></td>
      <td style="text-align:center;"><span title="All probes passed. Attributes: high, low, close. Samples: TASE.TA, POLI.TA, NICE.TA">✅</span></td>
      <td style="text-align:center;"><span title="All probes passed. Attributes: volume, tradetime, datadelay. Samples: TASE.TA, POLI.TA, NICE.TA">✅</span></td>
      <td style="text-align:center;"><span title="All probes passed. Attributes: change, changepct. Samples: TASE.TA, POLI.TA, NICE.TA">✅</span></td>
      <td style="text-align:center;"><span title="All probes passed. Attributes: isin. Samples: TASE.TA, POLI.TA, NICE.TA">✅</span></td>
    </tr>
    <tr>
      <td style="vertical-align:top;"><code>TYO</code><br><sub>Tokyo Stock Exchange</sub></td>
      <td style="text-align:center;vertical-align:top;"><span title="7203.T, 6758.T, 9984.T">ⓘ</span></td>
      <td style="text-align:center;"><span title="All probes passed. Attributes: name. Samples: TYO:7203, TYO:6758, TYO:9984">✅</span></td>
      <td style="text-align:center;"><span title="All probes passed. Attributes: name. Samples: 7203.T, 6758.T, 9984.T">✅</span></td>
      <td style="text-align:center;"><span title="All probes passed. Attributes: name. Samples: JP3633400001 (7203.T / Toyota)">✅</span></td>
      <td style="text-align:center;border-left:3px solid #6b7280;"><span title="All probes passed. Attributes: price, name, currency. Samples: 7203.T, 6758.T, 9984.T">✅</span></td>
      <td style="text-align:center;"><span title="All probes passed. Attributes: high, low, close. Samples: 7203.T, 6758.T, 9984.T">✅</span></td>
      <td style="text-align:center;"><span title="All probes passed. Attributes: volume, tradetime, datadelay. Samples: 7203.T, 6758.T, 9984.T">✅</span></td>
      <td style="text-align:center;"><span title="All probes passed. Attributes: change, changepct. Samples: 7203.T, 6758.T, 9984.T">✅</span></td>
      <td style="text-align:center;"><span title="Failing probes: isin (7203.T, 6758.T, 9984.T). Samples: 7203.T, 6758.T, 9984.T">❌</span></td>
    </tr>
    <tr>
      <td style="vertical-align:top;"><code>ETR</code><br><sub>Xetra</sub></td>
      <td style="text-align:center;vertical-align:top;"><span title="ZPRV.DE, ZPRX.DE, 5MVL.DE">ⓘ</span></td>
      <td style="text-align:center;"><span title="All probes passed. Attributes: name. Samples: ETR:ZPRV, ETR:ZPRX, ETR:5MVL">✅</span></td>
      <td style="text-align:center;"><span title="All probes passed. Attributes: name. Samples: ZPRV.DE, ZPRX.DE, 5MVL.DE">✅</span></td>
      <td style="text-align:center;"><span title="All probes passed. Attributes: name. Samples: IE00BSPLC298 (ZPRX)">✅</span></td>
      <td style="text-align:center;border-left:3px solid #6b7280;"><span title="All probes passed. Attributes: price, name, currency. Samples: ZPRV.DE, ZPRX.DE, 5MVL.DE">✅</span></td>
      <td style="text-align:center;"><span title="All probes passed. Attributes: high, low, close. Samples: ZPRV.DE, ZPRX.DE, 5MVL.DE">✅</span></td>
      <td style="text-align:center;"><span title="All probes passed. Attributes: volume, tradetime, datadelay. Samples: ZPRV.DE, ZPRX.DE, 5MVL.DE">✅</span></td>
      <td style="text-align:center;"><span title="All probes passed. Attributes: change, changepct. Samples: ZPRV.DE, ZPRX.DE, 5MVL.DE">✅</span></td>
      <td style="text-align:center;"><span title="All probes passed. Attributes: isin. Samples: ZPRV.DE, ZPRX.DE, 5MVL.DE">✅</span></td>
    </tr>
  </tbody>
</table>

Legend: `✅` all probes passed, `⚠️` mixed results, `❌` no probes passed or no implementation is configured.
<!-- SUPPORT_MATRIX:END -->
