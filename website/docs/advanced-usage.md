---
sidebar_position: 6
---

# Advanced Usage

## Debug Source Suffixes

For troubleshooting and coverage checks, identifiers also support:

- `IDENTIFIER@SOURCE`: force a specific source and disable fallback
- `IDENTIFIER@?`: return the planned quote route
- `IDENTIFIER@` or `IDENTIFIER@anything-unknown`: return the supported source list

Examples:

```gs
=HOODLEFINANCE("BTCUSD@YAHOO", "price")
=HOODLEFINANCE("EURUSD@GOOGLE", "price")
=HOODLEFINANCE("BTCUSD@?")
=HOODLEFINANCE("GOOG@?")
```

## Debug Route Introspection

`HOODLEFINANCE_ROUTES()` is mainly a debugging and troubleshooting aid rather than part of normal sheet usage.

```gs
=HOODLEFINANCE_ROUTES([identifier])
```

`HOODLEFINANCE_ROUTES()` returns a spilled routing table with the current quote classifications and planned routes.

`HOODLEFINANCE_ROUTES(identifier)` returns the planned quote route for one identifier, using the same static route introspection as `IDENTIFIER@?`.

## Version Helper

`HOODLEFINANCE_VERSION()` returns the version string embedded in the installed script.

```gs
=HOODLEFINANCE_VERSION()
```

## Array Usage

`HOODLEFINANCE` accepts ticker ranges directly and spills a result grid with the same shape.

Examples:

```gs
={"Price"; HOODLEFINANCE(A3:A, "price")}
```

```gs
={"Currency"; HOODLEFINANCE(A3:A, "currency")}
```

```gs
={"Name"; HOODLEFINANCE(A3:A, "name")}
```

```gs
={"ISIN"; HOODLEFINANCE(A3:A, "isin")}
```

Range behavior:

- blank ticker cells stay blank in the spilled output
- if any populated lookup fails, Sheets surfaces a single error for the whole spill range

## Limitations

- current-data attributes only; historical series are not implemented
- `marketcap` is currently unsupported
- quote freshness depends on upstream sources and may be delayed by an unspecified amount of time
- `isin` only works for exchanges with an implemented resolver; quote support is broader than ISIN support
- `isin` is not available for currency pairs
- some routes depend on public websites or unofficial endpoints and may break if those sites change
- some attributes may be unavailable for a specific listing even when the exchange is generally supported
