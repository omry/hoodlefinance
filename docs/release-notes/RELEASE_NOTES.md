# Release Notes

## v1.0.1 - 2026-04-25

### Fixed

- Fixed FX rate lookups failing when Google Finance serves a page with no rate data by falling back to Yahoo Finance.

## v1.0.0 - 2026-04-02

### Fixed

- PSE quotes now use the symbol-native Frames provider first and automatically fall back to the Edge provider when needed, improving reliability for preferred shares and suspended symbols.
- Fixed lowercase ticker lookups such as `vstm` so they no longer fail on an internal cache-key validation error before quote resolution starts.
- TradingView ISIN errors now report the original input symbol instead of the normalized exchange-prefixed symbol.
- Preferred REIT symbol lookups now work correctly for whitelisted tickers.
- The Demo page now show a conflict warning if the Google Sheet add-on is enabled there.

### Documentation

- Added a stable `/demo` website link for the public demo sheet and wired the docs site to use it consistently.
- Updated the docs to present the Google Sheets™ Marketplace add-on as the supported install path for users.
- Removed the script-copy install path from the public website docs and kept it in contributor-only repo docs.

## v0.9.7 - 2026-03-29

### Changed

- Removed the decorative bottom bar-chart accents from the shared website and Marketplace banner and hero artwork.
- Standardized the website and Marketplace branding assets around shared light and dark SVG sources, and refreshed the website to use the chart-based icon set.

### Fixed

- Fixed PSE ISIN identifier lookups for alternate securities such as `PSE:DDPR` and `PSE:ACPAR`, and updated local smoke checks to use the checked-out PSE ISIN map.
- Fixed PSE lookups for symbols such as `PSE:DDPR` by falling back to the PSE security page when the main directory search misses the exact ticker.

### Documentation

- Grouped the website legal pages under a dedicated source directory while preserving the existing public URLs for the Individual CLA, Privacy Policy, and Terms of Service.
- Added alternate PSE securities such as `PSE:DDPR` and `PSE:ACPAR` to the live support-matrix samples.

## v0.9.6 - 2026-03-25

### Changed

- Validate GitHub Actions production deployment pipeline

## v0.9.5 - 2026-03-25

### Changed

- Refreshed the HoodleFinance marketplace and website branding assets, including updated banner and icon artwork plus light/dark website variants.

### Documentation

- Clarified the Currency & FX docs with same-currency examples for `ILS` and `ILA`, using dotted notation to make mixed-unit conversions easier to read.
- Simplified the website footer so the homepage now links directly to Support, Privacy Policy, and Terms of Service instead of listing doc subpages there.

## v0.9.3 - 2026-03-22

### Added

- Introduced hoodlefinance.com as the public project website, including the initial API reference and live support matrix.

### Changed

- Improved several formula errors so they use user-facing language instead of internal routing or implementation terms, especially around `isin` lookups and identifier-side `@SOURCE` usage.
- Added `price@<currency>` so one `HOODLEFINANCE` formula can return the current price in the output currency or unit you want.
- Improved route introspection in Sheets so `IDENTIFIER@?` now shows the planned lookup path more clearly, and `HOODLEFINANCE_ROUTES()` exposes the routing table directly in Sheets.
- Simplified the public demo sheet by folding the array example into `Start Here`, combining foreign ETF and PSE coverage examples into one coverage tab, renaming the comparison tab to `Advantages over GOOGLEFINANCE`, reorganizing `Start Here` into identifier, price-conversion, and coverage example sections, and adding clearer explanatory notes to the FX comparison examples.
- Refreshed the public demo sheet styling with clearer text, formula, input, and result highlighting across the example tabs.
- Currency-pair lookups now reject unsupported `high`, `low`, and `volume` attributes with a direct error instead of a missing-value fallback.
- HoodleFinance is now licensed under the Mozilla Public License 2.0 (`MPL-2.0`), and the public docs now reflect that change.

### Fixed

- Fixed `isin` lookups for Amsterdam, Australian Securities Exchange, BME Madrid, Borsa Italiana, Borsa Istanbul, Borsa Mexicana, Bombay Stock Exchange, Bovespa, Brussels, Copenhagen, Frankfurt, Helsinki, Johannesburg, Korea Exchange, London, National Stock Exchange of India, New Zealand Exchange, Oslo, Paris, Shanghai, Shenzhen, SIX Swiss Exchange, Singapore Exchange, Stockholm, Swiss Exchange aliases, Taiwan Stock Exchange, Tel Aviv Stock Exchange aliases, Tokyo Stock Exchange, Toronto Stock Exchange aliases, and Warsaw by routing those markets through the existing TradingView-backed ISIN resolver.
- Fixed direct ISIN lookups to prefer a mappable market listing when Yahoo search returns multiple exchanges for the same instrument, improving `symbol` and `exchange` results for inputs such as `IE000I8KRLL9`.
- Fixed default `isin` lookups for `NYSE:` tickers such as `NYSE:IBM`, and refreshed the support matrix to reflect current Tokyo ISIN coverage.
- Fixed Yahoo-style Philippine stock symbols such as `AP.PS` and `GTCAP.PS` so they route through the dedicated PSE lookup path instead of failing with a Yahoo 404.

## v0.9.2 - 2026-03-17

### Added

- Added support for bare FX pair inputs such as `EURUSD` and `USDPHP`, alongside the existing `CURRENCY:EURUSD` form.
- Added `symbol` and `exchange` attributes, with `:yahoo` and `:google` variants, so resolved identifiers can be returned directly for symbols, ISIN inputs, PSE instruments, and FX pairs.
- Expanded practical currency-pair coverage so direct conversion now works for many less-common cross pairs as well, including examples such as `ILSPHP`. Major 3-character crypto codes such as `BTC`, `ETH`, `SOL`, and `XRP` are also supported in the same pair syntax and can be combined with fiat currencies or with other supported 3-character crypto codes, for example `BTCUSD`, `CURRENCY:ETHUSD`, and `BTCETH`.
- Currency pairs now support 4-character crypto or unit codes alongside the existing 3-character form. Unambiguous pairs such as `DOGEUSD`, `USDUSDT`, and `USDCUSDT` work directly, and dotted prefixed syntax such as `CURRENCY:BTC.USDT` is available for explicit 4-character-leg pairs while ambiguous compact `CURRENCY:` inputs now fail with a direct disambiguation error.

### Changed

- Updated the public demo sheet so the Ticker Forms tab now shows resolved `symbol` and `exchange` outputs for Google-style, Yahoo-style, and direct ISIN inputs.
- Default currency-pair lookups now use Google Finance™ quote pages, improving coverage for pairs that Yahoo often misses such as `PHPILS`. Some FX-specific fields such as `high`, `low`, and `volume` may be unavailable when Google does not publish them for the requested pair.
- Added debug-oriented identifier suffixes for source inspection and forcing specific lookup sources without fallback, and moved source-specific `isin` forcing to identifier-side `@SOURCE` forms such as `@PSE`, `@LON`, and `@TRADINGVIEW`.
- The update dialog now includes a separate full-history changelog link alongside the per-version release notes link.

### Fixed

- Improved PSE outage messaging so temporary exchange-site failures now report a clearer upstream-availability error instead of looking like a missing ticker.
- `isin` now fails with a direct user-facing error for currency pairs instead of exposing exchange-deduction or source-override guidance that only applies to securities.
- Unsupported-attribute errors now list the public `HOODLEFINANCE` attributes without exposing source-specific internal lookup attributes.

## v0.9.1 - 2026-03-15

### Fixed

- Improved release automation reliability so reviewed release PRs can publish and sync the public demo more consistently.

## v0.9.0 - 2026-03-15

### Added

- Added the initial `HOODLEFINANCE` release with practical quote and identifier lookups for stocks, ETFs, currencies, and direct ISIN input across many markets that `GOOGLEFINANCE` does not support well.

- Added versioned release notes and clearer in-sheet update guidance, so update prompts now link directly to the relevant release notes before you replace the Apps Script™ code.

### Changed

- Improved Philippine Stock Exchange lookups by caching resolved listing metadata, which reduces extra network work on repeated PSE queries after the first lookup.
