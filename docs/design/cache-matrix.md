# Cache Matrix

This matrix is manually maintained. It is meant to show where `CacheService` is already used, what is cached, and which network-heavy paths still look like good cache candidates.

Use it as a design reference when deciding whether a new fetch path should reuse an existing cache pattern, add a targeted cache, or stay uncached on purpose.

## Current Caches

| Area | Artifact | TTL | Neg | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| Update checks | GitHub latest version | 6h | `🚫` | `✅` | Auto checks use cache; manual checks bypass it. |
| Yahoo quotes | Yahoo chart `meta` | 60s | `🚫` | `✅` | Shared by scalar and range paths. |
| PSE quotes | Parsed PSE quote | 5m | `🚫` | `✅` | Final quote only, not listing metadata. |
| Yahoo ISIN | ISIN -> Yahoo symbol | 6h | `🚫` | `✅` | Used by scalar and range ISIN paths. |
| ARIVA ISIN | ETR code -> ISIN | 6h | `🚫` | `✅` | Positive-result cache only. |
| LON ISIN | LON code -> ISIN | 6h | `🚫` | `✅` | Positive-result cache only. |
| TradingView ISIN | TV symbol -> ISIN | 6h | `🚫` | `✅` | Positive-result cache only. |
| IBKR ISIN | Symbol/exchange -> final ISIN | 6h | `🚫` | `⚠️` | Final result only; search/detail fetches are uncached. |

Legend:

- `✅` implemented and likely in a reasonable place
- `⚠️` implemented, but still leaves meaningful repeated upstream work
- `❌` not cached
- `🚫` no negative cache
- `🤔` maybe, depending on design
- `✅` negative cache is part of the candidate

## Candidate Additions

| Area | Candidate | TTL | Neg | Impact | Risk | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| PSE listing | Symbol -> listing ids/meta | 6h-24h | `🤔` | Med | Low | `❌` | Safest next cache; helps after quote cache expiry. |
| IBKR search | Parsed search entries | 1h-6h | `🤔` | Med-High | Med | `❌` | Prefer parsed entries over raw HTML. |
| IBKR details | Detail URL -> ISIN | ~6h | `🤔` | Med | Med | `❌` | Avoids repeated detail-page fetches. |
| Stable failures | Short-lived error markers | 5m-30m | `✅` | Med-High | High | `❌` | Only for narrow cases like not-found or captcha-blocked. |

## Explicit Non-Goals

| Area | Why It Stays Uncached |
| --- | --- |
| Generic `hoodlefinanceFetchText_()` cache | Different callers need different TTLs, key shapes, and error semantics. A blanket text cache would be too blunt and easy to misuse. |
| Whole-formula array result cache | Current design intentionally caches reusable upstream artifacts, not full formula outputs. This keeps cache entries reusable across scalar and range calls. |

## Notes

- Positive-result caches are the default pattern used in the service today.
- Most missing cache work is now in resolver-specific intermediate steps, not in quote fetching.
- If a new upstream source is added, prefer a targeted cache row here instead of introducing a generic fetch cache.
