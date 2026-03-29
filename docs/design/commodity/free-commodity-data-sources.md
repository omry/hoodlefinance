# Free Commodity Data Sources

This note surveys free or publicly accessible commodity data sources that are realistic candidates for `HOODLEFINANCE`.

The focus here is:

- daily or better resolution when available
- public web or API access without paid exchange licenses
- practical support for user-facing `price` lookups

This is an implementation and research note, not a user-facing support statement.

It should be read alongside [`commodity-interface-design.md`](./commodity-interface-design.md), which defines the canonical public interface and terminology for commodity support.

## Summary

The cleanest free-source split today is:

- energy benchmarks: `EIA` and `FRED`
- broad delayed futures coverage: `CME Group`
- iron ore futures proxy: `SGX`
- agricultural cash and report data: `USDA AMS Market News`
- selected metals and commodity API coverage: `Alpha Vantage`

In general, commodity source quotes come with native units and currencies that should be treated as first-class metadata. Public `HOODLEFINANCE` output may still normalize those quotes into canonical units and canonical currencies, with explicit output conversion only within the allowed unit family for that commodity.

## Availability Matrix

| Family | Source | Coverage | Resolution | Native unit behavior | Practical notes |
| --- | --- | --- | --- | --- | --- |
| Energy | [EIA Daily Prices](https://www.eia.gov/todayinenergy/prices.php) | WTI, Brent, gasoline, heating oil, diesel, propane, retail fuel snapshots | Daily weekdays | Fixed by series, for example `$/barrel` and `$/gallon` | Very strong free benchmark source for energy. Best fit for spot-style energy coverage. |
| Energy | [FRED energy series](https://fred.stlouisfed.org/series/DCOILBRENTEU/) | Benchmark series such as Brent and WTI via FRED-hosted feeds | Daily for some series | Fixed by series, for example Brent is `Dollars per Barrel` | Good if we want stable series ids and simple CSV/JSON-style access patterns. |
| Energy | [CME delayed commodity quotes](https://www.cmegroup.com/market-data/delayed-quotes/commodities.html) | Crude oil, natural gas, refined products, coal, electricity, more | Intraday delayed, at least 10 minutes | Fixed by contract and exchange conventions | Best free route for tradable futures-style energy quotes rather than benchmark spot series. |
| Precious metals | [Alpha Vantage commodities docs](https://www.alphavantage.co/documentation/) | Gold and silver live spot plus daily historical endpoints | Spot for selected endpoints, daily historical for some endpoints | Fixed by endpoint and symbol | Useful API-friendly source for gold and silver without scraping exchange pages. |
| Precious metals | [CME delayed commodity quotes](https://www.cmegroup.com/market-data/delayed-quotes/commodities.html) | Gold, silver, platinum, and other metals futures | Intraday delayed, at least 10 minutes | Fixed by contract | Strong if futures are acceptable. Better breadth than spot-style public APIs. |
| Industrial metals | [CME delayed commodity quotes](https://www.cmegroup.com/market-data/delayed-quotes/commodities.html) | Copper and other base/ferrous metals futures | Intraday delayed, at least 10 minutes | Fixed by contract | Best free broad source for industrial metals futures. |
| Industrial materials | [SGX delayed iron ore futures](https://www.sgx.com/derivatives/delayed-prices-futures?category=iron-ore&cc=FEF) | Iron ore futures and related ferrous contracts | Intraday delayed | Fixed by contract | Best free daily-or-better iron ore candidate found so far. Useful as a proxy when monthly benchmark data is not enough. |
| Agricultural cash/physical | [USDA AMS Market News](https://www.ams.usda.gov/market-news) | Grain, hay, livestock, poultry, dairy, cotton, tobacco, specialty crops, organic, local/regional | Often daily or near-daily report cadence, depending on market | Fixed by report and commodity convention | Strong public source for agricultural market reports, but data shape is report-oriented rather than simple quote API output. |
| Agricultural futures | [CME delayed commodity quotes](https://www.cmegroup.com/market-data/delayed-quotes/commodities.html) | Grains, oilseeds, livestock, dairy, lumber, softs | Intraday delayed, at least 10 minutes | Fixed by contract | Best free path if we want consistent futures quotes across agricultural categories. |
| Mixed commodity API | [Alpha Vantage commodities docs](https://www.alphavantage.co/documentation/) | Docs currently describe endpoints spanning gold, silver, crude oil, natural gas, copper, wheat, and other major commodities | Daily or better for selected endpoints | Fixed by endpoint | Promising as a single API surface, but commodity-by-commodity validation is still needed before relying on it broadly. |

## Recommended Starting Point

If we add commodity support incrementally, the lowest-risk rollout would be:

1. Energy benchmarks from `EIA` / `FRED`
2. Precious metals from `Alpha Vantage` or `CME` depending on whether we prefer spot or futures semantics
3. Industrial metals from `CME`, with `SGX` specifically for iron ore
4. Agricultural futures from `CME`
5. Agricultural cash-report coverage from `USDA AMS` only if we are ready to normalize report-style data

## Registry Implications

The interface design now assumes a canonical commodity registry rather than a purely source-native public surface.

This means source evaluation should feed these registry decisions for each commodity we actually support:

- canonical code
- display name
- canonical unit
- canonical currency
- unit family, initially `mass` or `volume`
- supported unit conversions within that family
- default provider priority
- default instrument type
- accepted source-native aliases

This note is therefore not just a list of sources. It is also input to per-commodity registry design.

Concrete examples of the decisions this note should help drive:

- whether canonical `COMMODITY:BRENT` should default to an `EIA` or `FRED` benchmark route
- whether canonical `COMMODITY:GOLD` should default to a spot-style or futures-style source
- which source-native symbols should be accepted as aliases and normalized internally
- which native units need canonical normalization and which unit-family conversions are practical

The likely implementation path is to define registry entries one supported commodity at a time rather than trying to model all commodities up front.
That means the first rollout should probably cover a small explicit set such as:

- `COMMODITY:WTI`
- `COMMODITY:BRENT`
- `COMMODITY:GOLD`
- `COMMODITY:SILVER`
- `COMMODITY:COPPER`
- `COMMODITY:COAL`
- optionally `COMMODITY:IRON_ORE`

Additional commodities can then be added deliberately as their source, canonical unit/currency, and normalization behavior are validated.

## Unit Guidance

Commodity native units and native currencies should be modeled as explicit source metadata, not inferred later.

Examples from the currently reviewed sources:

- Brent on FRED is `Dollars per Barrel`
- EIA daily prices mix `$/barrel` and `$/gallon`
- CME and SGX futures use contract-native exchange units
- USDA AMS reports use commodity- and report-specific market units

For `HOODLEFINANCE`, the safer split is:

- canonical output metadata:
  - `price`
  - `currency`
  - `unit`
- native/source metadata:
  - `native:price`
  - `native:currency`
  - `native:unit`
- `source`
- `instrument_type` such as `benchmark`, `spot`, `futures`, or `report`
- optional contract metadata for futures

The canonical interface design also assumes:

- canonical output is the default public behavior
- native/source-backed values remain inspectable explicitly
- unit conversion should stay within a commodity's declared unit family
- the initial unit-family surface should stay small and start with `mass` and `volume`

## Notable Gaps

- Free broad commodity data is much better for futures than for clean spot benchmarks outside energy.
- Iron ore is the clearest example where easy free benchmark data tends to be monthly, while daily-or-better free data is more realistically available through delayed futures.
- USDA AMS is valuable, but it is not a simple one-symbol-one-quote feed. It is a report system and would need normalization work.
- Alpha Vantage looks promising as a unified API surface, but each commodity family should still be validated individually before depending on it in production.
- This note still surveys source families rather than defining the per-commodity registry entries that will be needed for implementation.
- The first implementation should avoid trying to cover the full commodity universe and instead ship a small registry of explicitly supported commodities.

## Sources

- EIA Daily Prices: <https://www.eia.gov/todayinenergy/prices.php>
- FRED Brent daily series: <https://fred.stlouisfed.org/series/DCOILBRENTEU/>
- CME delayed commodity quotes: <https://www.cmegroup.com/market-data/delayed-quotes/commodities.html>
- CME delayed quote disclaimer/details: <https://www.cmegroup.com/trading/about-all-delayed-quotes.html>
- SGX delayed iron ore futures page: <https://www.sgx.com/derivatives/delayed-prices-futures?category=iron-ore&cc=FEF>
- USDA AMS Market News: <https://www.ams.usda.gov/market-news>
- Alpha Vantage API documentation: <https://www.alphavantage.co/documentation/>
