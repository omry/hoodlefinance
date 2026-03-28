---
sidebar_position: 3
---

# Support Matrix

This matrix is sample-based, not exhaustive. It is intended to show current practical coverage of the public interface, not a formal guarantee for every symbol on an exchange.

Use it as a quick reference for current live probe results by exchange and feature group.

<table>
  <thead>
    <tr>
      <th rowspan="2"><span title="Code and full venue name.">Exchange</span></th>
      <th rowspan="2"><span title="Hover the info icon to see the sample tickers used for the feature columns.">Samples</span></th>
      <th colspan="3">Query</th>
      <th colspan="5">Attributes</th>
    </tr>
    <tr>
      <th><span title="Representative exchange-prefixed inputs such as `LON:SJPA`, `TLV:POLI`, or `NASDAQ:GOOG`.">Google Finance query<br /><sub><code>LON:SJPA</code></sub></span></th>
      <th><span title="Representative Yahoo-style inputs such as `SJPA.L`, `POLI.TA`, or `GOOG`.">Yahoo style<br /><sub><code>SJPA.L</code></sub></span></th>
      <th><span title="Direct ISIN input such as `IE00...`, `IL00...`, or `US...`.">ISIN<br /><sub><code>IE00B4L5YX21</code></sub></span></th>
      <th><span title="Grouped attributes: price, name, currency">Basic quote<br /><sub><code>price</code><br /><code>name</code><br /><code>currency</code></sub></span></th>
      <th><span title="Grouped attributes: high, low, close">Session stats<br /><sub><code>high</code><br /><code>low</code><br /><code>close</code></sub></span></th>
      <th><span title="Grouped attributes: volume, tradetime, datadelay">Activity/time<br /><sub><code>volume</code><br /><code>tradetime</code><br /><code>datadelay</code></sub></span></th>
      <th><span title="Grouped attributes: change, changepct">Change<br /><sub><code>change</code><br /><code>changepct</code></sub></span></th>
      <th><span title="Grouped attributes: isin">ISIN<br /><sub><code>isin</code></sub></span></th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><code>HKG</code><br /><sub>Hong Kong Stock Exchange</sub></td>
      <td><span title="9988.HK (Alibaba / BABA), 1299.HK, 1810.HK">ⓘ</span></td>
      <td><span title="All probes passed. Attributes: name. Samples: HKG:9988, HKG:1299, HKG:1810">✅</span></td>
      <td><span title="All probes passed. Attributes: name. Samples: 9988.HK (Alibaba / BABA), 1299.HK, 1810.HK">✅</span></td>
      <td><span title="All probes passed. Attributes: name. Samples: KYG017191142 (9988.HK / Alibaba)">✅</span></td>
      <td><span title="All probes passed. Attributes: price, name, currency. Samples: 9988.HK (Alibaba / BABA), 1299.HK, 1810.HK">✅</span></td>
      <td><span title="All probes passed. Attributes: high, low, close. Samples: 9988.HK (Alibaba / BABA), 1299.HK, 1810.HK">✅</span></td>
      <td><span title="All probes passed. Attributes: volume, tradetime, datadelay. Samples: 9988.HK (Alibaba / BABA), 1299.HK, 1810.HK">✅</span></td>
      <td><span title="All probes passed. Attributes: change, changepct. Samples: 9988.HK (Alibaba / BABA), 1299.HK, 1810.HK">✅</span></td>
      <td><span title="All probes passed. Attributes: isin. Samples: 9988.HK (Alibaba / BABA), 1299.HK, 1810.HK">✅</span></td>
    </tr>
    <tr>
      <td><code>LON</code><br /><sub>London Stock Exchange</sub></td>
      <td><span title="SJPA.L, CPXJ.L, VUAG.L">ⓘ</span></td>
      <td><span title="All probes passed. Attributes: name. Samples: LON:SJPA, LON:CPXJ, LON:VUAG">✅</span></td>
      <td><span title="All probes passed. Attributes: name. Samples: SJPA.L, CPXJ.L, VUAG.L">✅</span></td>
      <td><span title="All probes passed. Attributes: name. Samples: IE00B4L5YX21 (SJPA)">✅</span></td>
      <td><span title="All probes passed. Attributes: price, name, currency. Samples: SJPA.L, CPXJ.L, VUAG.L">✅</span></td>
      <td><span title="All probes passed. Attributes: high, low, close. Samples: SJPA.L, CPXJ.L, VUAG.L">✅</span></td>
      <td><span title="All probes passed. Attributes: volume, tradetime, datadelay. Samples: SJPA.L, CPXJ.L, VUAG.L">✅</span></td>
      <td><span title="All probes passed. Attributes: change, changepct. Samples: SJPA.L, CPXJ.L, VUAG.L">✅</span></td>
      <td><span title="All probes passed. Attributes: isin. Samples: SJPA.L, CPXJ.L, VUAG.L">✅</span></td>
    </tr>
    <tr>
      <td><code>NASDAQ</code><br /><sub>Nasdaq</sub></td>
      <td><span title="GOOG, AAPL, MSFT">ⓘ</span></td>
      <td><span title="All probes passed. Attributes: name. Samples: NASDAQ:GOOG, NASDAQ:AAPL, NASDAQ:MSFT">✅</span></td>
      <td><span title="All probes passed. Attributes: name. Samples: GOOG, AAPL, MSFT">✅</span></td>
      <td><span title="All probes passed. Attributes: name. Samples: US02079K1079 (GOOG)">✅</span></td>
      <td><span title="All probes passed. Attributes: price, name, currency. Samples: GOOG, AAPL, MSFT">✅</span></td>
      <td><span title="All probes passed. Attributes: high, low, close. Samples: GOOG, AAPL, MSFT">✅</span></td>
      <td><span title="All probes passed. Attributes: volume, tradetime, datadelay. Samples: GOOG, AAPL, MSFT">✅</span></td>
      <td><span title="All probes passed. Attributes: change, changepct. Samples: GOOG, AAPL, MSFT">✅</span></td>
      <td><span title="All probes passed. Attributes: isin. Samples: GOOG, AAPL, MSFT">✅</span></td>
    </tr>
    <tr>
      <td><code>NYSE</code><br /><sub>New York Stock Exchange</sub></td>
      <td><span title="NYSE:IBM, NYSE:KO, NYSE:DIS">ⓘ</span></td>
      <td><span title="All probes passed. Attributes: name. Samples: NYSE:IBM, NYSE:KO, NYSE:DIS">✅</span></td>
      <td><span title="All probes passed. Attributes: name. Samples: IBM, KO, DIS">✅</span></td>
      <td><span title="All probes passed. Attributes: name. Samples: US4592001014 (IBM)">✅</span></td>
      <td><span title="All probes passed. Attributes: price, name, currency. Samples: NYSE:IBM, NYSE:KO, NYSE:DIS">✅</span></td>
      <td><span title="All probes passed. Attributes: high, low, close. Samples: NYSE:IBM, NYSE:KO, NYSE:DIS">✅</span></td>
      <td><span title="All probes passed. Attributes: volume, tradetime, datadelay. Samples: NYSE:IBM, NYSE:KO, NYSE:DIS">✅</span></td>
      <td><span title="All probes passed. Attributes: change, changepct. Samples: NYSE:IBM, NYSE:KO, NYSE:DIS">✅</span></td>
      <td><span title="All probes passed. Attributes: isin. Samples: NYSE:IBM, NYSE:KO, NYSE:DIS">✅</span></td>
    </tr>
    <tr>
      <td><code>OTCMKTS</code><br /><sub>OTC Markets</sub></td>
      <td><span title="OTCMKTS:RYCEY, OTCMKTS:NSRGY, OTCMKTS:TCEHY">ⓘ</span></td>
      <td><span title="All probes passed. Attributes: name. Samples: OTCMKTS:RYCEY, OTCMKTS:NSRGY, OTCMKTS:TCEHY">✅</span></td>
      <td><span title="All probes passed. Attributes: name. Samples: RYCEY, NSRGY, TCEHY">✅</span></td>
      <td><span title="All probes passed. Attributes: name. Samples: US7757812067 (OTCMKTS:RYCEY)">✅</span></td>
      <td><span title="All probes passed. Attributes: price, name, currency. Samples: OTCMKTS:RYCEY, OTCMKTS:NSRGY, OTCMKTS:TCEHY">✅</span></td>
      <td><span title="All probes passed. Attributes: high, low, close. Samples: OTCMKTS:RYCEY, OTCMKTS:NSRGY, OTCMKTS:TCEHY">✅</span></td>
      <td><span title="All probes passed. Attributes: volume, tradetime, datadelay. Samples: OTCMKTS:RYCEY, OTCMKTS:NSRGY, OTCMKTS:TCEHY">✅</span></td>
      <td><span title="All probes passed. Attributes: change, changepct. Samples: OTCMKTS:RYCEY, OTCMKTS:NSRGY, OTCMKTS:TCEHY">✅</span></td>
      <td><span title="All probes passed. Attributes: isin. Samples: OTCMKTS:RYCEY, OTCMKTS:NSRGY, OTCMKTS:TCEHY">✅</span></td>
    </tr>
    <tr>
      <td><code>PSE</code><br /><sub>Philippine Stock Exchange</sub></td>
      <td><span title="PSE:AP, PSE:CNVRG, PSE:DDPR (DoubleDragon Pref), PSE:ACPAR (Ayala Pref A)">ⓘ</span></td>
      <td><span title="All probes passed. Attributes: name. Samples: PSE:AP, PSE:CNVRG, PSE:DDPR (DoubleDragon Pref), PSE:ACPAR (Ayala Pref A)">✅</span></td>
      <td><span title="All probes passed. Attributes: name. Samples: AP.PS, CNVRG.PS, DDPR.PS (DoubleDragon Pref), ACPAR.PS (Ayala Pref A)">✅</span></td>
      <td><span title="All probes passed. Attributes: name. Samples: PHY0005M1090 (AP), PHY2105Y1166 (DDPR), PH0000056814 (ACPAR)">✅</span></td>
      <td><span title="All probes passed. Attributes: price, name, currency. Samples: PSE:AP, PSE:CNVRG, PSE:DDPR (DoubleDragon Pref), PSE:ACPAR (Ayala Pref A)">✅</span></td>
      <td><span title="All probes passed. Attributes: high, low, close. Samples: PSE:AP, PSE:CNVRG, PSE:DDPR (DoubleDragon Pref), PSE:ACPAR (Ayala Pref A)">✅</span></td>
      <td><span title="All probes passed. Attributes: volume, tradetime, datadelay. Samples: PSE:AP, PSE:CNVRG, PSE:DDPR (DoubleDragon Pref), PSE:ACPAR (Ayala Pref A)">✅</span></td>
      <td><span title="All probes passed. Attributes: change, changepct. Samples: PSE:AP, PSE:CNVRG, PSE:DDPR (DoubleDragon Pref), PSE:ACPAR (Ayala Pref A)">✅</span></td>
      <td><span title="All probes passed. Attributes: isin. Samples: PSE:AP, PSE:CNVRG, PSE:DDPR (DoubleDragon Pref), PSE:ACPAR (Ayala Pref A)">✅</span></td>
    </tr>
    <tr>
      <td><code>SGX</code><br /><sub>Singapore Exchange</sub></td>
      <td><span title="SGX:D05, SGX:U11, SGX:O39">ⓘ</span></td>
      <td><span title="All probes passed. Attributes: name. Samples: SGX:D05, SGX:U11, SGX:O39">✅</span></td>
      <td><span title="All probes passed. Attributes: name. Samples: D05.SI, U11.SI, O39.SI">✅</span></td>
      <td><span title="All probes passed. Attributes: name. Samples: SG1L01001701 (SGX:D05)">✅</span></td>
      <td><span title="All probes passed. Attributes: price, name, currency. Samples: SGX:D05, SGX:U11, SGX:O39">✅</span></td>
      <td><span title="All probes passed. Attributes: high, low, close. Samples: SGX:D05, SGX:U11, SGX:O39">✅</span></td>
      <td><span title="All probes passed. Attributes: volume, tradetime, datadelay. Samples: SGX:D05, SGX:U11, SGX:O39">✅</span></td>
      <td><span title="All probes passed. Attributes: change, changepct. Samples: SGX:D05, SGX:U11, SGX:O39">✅</span></td>
      <td><span title="All probes passed. Attributes: isin. Samples: SGX:D05, SGX:U11, SGX:O39">✅</span></td>
    </tr>
    <tr>
      <td><code>TLV</code><br /><sub>Tel Aviv Stock Exchange</sub></td>
      <td><span title="TASE.TA, POLI.TA, NICE.TA">ⓘ</span></td>
      <td><span title="All probes passed. Attributes: name. Samples: TLV:POLI, TLV:NICE, TLV:TEVA">✅</span></td>
      <td><span title="All probes passed. Attributes: name. Samples: POLI.TA, NICE.TA, TEVA.TA">✅</span></td>
      <td><span title="All probes passed. Attributes: name. Samples: IL0006625771 (POLI), IL0011465700 (KSM.F59 ETF)">✅</span></td>
      <td><span title="All probes passed. Attributes: price, name, currency. Samples: TASE.TA, POLI.TA, NICE.TA">✅</span></td>
      <td><span title="All probes passed. Attributes: high, low, close. Samples: TASE.TA, POLI.TA, NICE.TA">✅</span></td>
      <td><span title="All probes passed. Attributes: volume, tradetime, datadelay. Samples: TASE.TA, POLI.TA, NICE.TA">✅</span></td>
      <td><span title="All probes passed. Attributes: change, changepct. Samples: TASE.TA, POLI.TA, NICE.TA">✅</span></td>
      <td><span title="All probes passed. Attributes: isin. Samples: TASE.TA, POLI.TA, NICE.TA">✅</span></td>
    </tr>
    <tr>
      <td><code>TYO</code><br /><sub>Tokyo Stock Exchange</sub></td>
      <td><span title="7203.T, 6758.T, 9984.T">ⓘ</span></td>
      <td><span title="All probes passed. Attributes: name. Samples: TYO:7203, TYO:6758, TYO:9984">✅</span></td>
      <td><span title="All probes passed. Attributes: name. Samples: 7203.T, 6758.T, 9984.T">✅</span></td>
      <td><span title="All probes passed. Attributes: name. Samples: JP3633400001 (7203.T / Toyota)">✅</span></td>
      <td><span title="All probes passed. Attributes: price, name, currency. Samples: 7203.T, 6758.T, 9984.T">✅</span></td>
      <td><span title="All probes passed. Attributes: high, low, close. Samples: 7203.T, 6758.T, 9984.T">✅</span></td>
      <td><span title="All probes passed. Attributes: volume, tradetime, datadelay. Samples: 7203.T, 6758.T, 9984.T">✅</span></td>
      <td><span title="All probes passed. Attributes: change, changepct. Samples: 7203.T, 6758.T, 9984.T">✅</span></td>
      <td><span title="All probes passed. Attributes: isin. Samples: 7203.T, 6758.T, 9984.T">✅</span></td>
    </tr>
    <tr>
      <td><code>ETR</code><br /><sub>Xetra</sub></td>
      <td><span title="ZPRV.DE, ZPRX.DE, 5MVL.DE">ⓘ</span></td>
      <td><span title="All probes passed. Attributes: name. Samples: ETR:ZPRV, ETR:ZPRX, ETR:5MVL">✅</span></td>
      <td><span title="All probes passed. Attributes: name. Samples: ZPRV.DE, ZPRX.DE, 5MVL.DE">✅</span></td>
      <td><span title="All probes passed. Attributes: name. Samples: IE00BSPLC298 (ZPRX)">✅</span></td>
      <td><span title="All probes passed. Attributes: price, name, currency. Samples: ZPRV.DE, ZPRX.DE, 5MVL.DE">✅</span></td>
      <td><span title="All probes passed. Attributes: high, low, close. Samples: ZPRV.DE, ZPRX.DE, 5MVL.DE">✅</span></td>
      <td><span title="All probes passed. Attributes: volume, tradetime, datadelay. Samples: ZPRV.DE, ZPRX.DE, 5MVL.DE">✅</span></td>
      <td><span title="All probes passed. Attributes: change, changepct. Samples: ZPRV.DE, ZPRX.DE, 5MVL.DE">✅</span></td>
      <td><span title="All probes passed. Attributes: isin. Samples: ZPRV.DE, ZPRX.DE, 5MVL.DE">✅</span></td>
    </tr>
  </tbody>
</table>

Legend: `✅` all probes passed, `⚠️` mixed results, `❌` no probes passed or no implementation is configured.
