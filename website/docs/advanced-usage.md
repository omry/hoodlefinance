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
