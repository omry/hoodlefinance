const assert = require("node:assert/strict");
const test = require("node:test");

const {
  buildTypedRequestFromParsedInput,
  buildTypedRequestFromResolvedTicker,
  classifyRequestInput,
  createRequestInput,
  extractIsinFromRequestInput,
  RequestInput,
} = require("../dist/ts/core/index.js");

function createDeps() {
  return {
    extractTickerExchange(ticker) {
      const parts = String(ticker).split(":");
      return parts.length > 1 ? parts[0].trim().toUpperCase() : "";
    },
    extractYahooExchangeFromSymbol(symbol) {
      return String(symbol).endsWith(".PS") ? "PSE" : "";
    },
    isPseTicker(ticker) {
      return String(ticker).startsWith("PSE:");
    },
    isPseYahooSymbol(ticker) {
      return /^[A-Z]+\.PS$/i.test(String(ticker));
    },
    looksLikeIsraeliFundYahooSymbol(symbol) {
      return String(symbol).startsWith("KSM.");
    },
    looksLikeIsin(value) {
      return /^[A-Z]{2}[A-Z0-9]{10}$/i.test(String(value));
    },
    normalizeAttribute(attribute) {
      return String(attribute == null ? "price" : attribute).trim() || "price";
    },
    normalizeTickerWithoutIsin(ticker) {
      return String(ticker).trim().toUpperCase();
    },
    parseAttributeRequest(attribute) {
      return {
        baseAttribute: String(attribute).split("@")[0].toLowerCase(),
        outputCode: "",
        rawAttribute: String(attribute),
        wantsOutputCurrency: false,
      };
    },
    parseFxTicker(ticker) {
      const value = String(ticker).trim().toUpperCase();
      if (value !== "EURUSD") {
        return null;
      }

      return {
        baseCanonicalCode: "EUR",
        quoteCanonicalCode: "USD",
        yahooChartSymbol: "EURUSD=X",
      };
    },
    parsePseSymbol(ticker) {
      return String(ticker).split(":").pop().trim().toUpperCase();
    },
    parsePseYahooSymbol(ticker) {
      return String(ticker).replace(/\.PS$/i, "").trim().toUpperCase();
    },
    parseTickerRequest(ticker) {
      const value = String(ticker).trim();
      const atIndex = value.lastIndexOf("@");
      const candidateTicker = atIndex > 0 ? value.slice(0, atIndex).trim() : "";
      const candidateSource =
        atIndex > 0
          ? value
              .slice(atIndex + 1)
              .trim()
              .toUpperCase()
          : "";

      if (candidateTicker && candidateSource === "?") {
        return {
          infoMode: "source-name",
          sourceOverride: "",
          ticker: candidateTicker,
        };
      }

      if (candidateTicker && candidateSource === "YAHOO") {
        return {
          infoMode: "",
          sourceOverride: "YAHOO",
          ticker: candidateTicker,
        };
      }

      if (candidateTicker) {
        return {
          infoMode: "source-list",
          sourceOverride: "",
          ticker: candidateTicker,
        };
      }

      return { infoMode: "", sourceOverride: "", ticker: value };
    },
  };
}

test("createRequestInput classifies equity, fx, and isin inputs", () => {
  const deps = createDeps();

  assert.equal(
    createRequestInput("GOOG", "price", deps).classification,
    "equity",
  );
  assert.equal(
    createRequestInput("EURUSD", "price", deps).classification,
    "fx",
  );
  assert.equal(
    createRequestInput("US02079K1079", "price", deps).classification,
    "isin",
  );
});

test("RequestInput can derive the same request shape through its runtime-style constructor", () => {
  const deps = createDeps();
  const input = new RequestInput("GOOG@YAHOO", "price", {
    looksLikeIsin: deps.looksLikeIsin,
    normalizeAttribute: deps.normalizeAttribute,
    parseAttributeRequest: deps.parseAttributeRequest,
    parseFxTicker: deps.parseFxTicker,
    parseTickerRequest: deps.parseTickerRequest,
  });

  assert.equal(input.attribute, "price");
  assert.equal(input.sourceOverride, "YAHOO");
  assert.equal(input.ticker, "GOOG");
  assert.equal(input.classification, "equity");
});

test("RequestInput can use configured runtime dependencies with the original constructor shape", () => {
  const deps = createDeps();

  RequestInput.configureRuntime({
    looksLikeIsin: deps.looksLikeIsin,
    normalizeAttribute: deps.normalizeAttribute,
    parseAttributeRequest: deps.parseAttributeRequest,
    parseFxTicker: deps.parseFxTicker,
    parseTickerRequest: deps.parseTickerRequest,
  });

  try {
    const input = new RequestInput("EURUSD", "price");
    assert.equal(input.classification, "fx");
    assert.equal(input.fxPair.baseCanonicalCode, "EUR");
  } finally {
    RequestInput._resetForTests();
  }
});

test("isin extraction and classification stay simple and explicit", () => {
  const deps = createDeps();
  const isinInput = createRequestInput("ISIN:US02079K1079", "price", deps);

  assert.equal(
    extractIsinFromRequestInput(isinInput, deps.looksLikeIsin),
    "US02079K1079",
  );
  assert.equal(classifyRequestInput(isinInput, deps.looksLikeIsin), "isin");
});

test("buildTypedRequestFromParsedInput returns the expected typed request variants", () => {
  const deps = createDeps();
  const originalInput = createRequestInput("PSE:BDO", "price", deps);

  const pseRequest = buildTypedRequestFromParsedInput(
    originalInput,
    createRequestInput("PSE:BDO", "price", deps),
    12,
    deps,
  );
  assert.equal(pseRequest.requestType, "equity");
  assert.equal(pseRequest.exchange, "PSE");
  assert.equal(pseRequest.symbol, "BDO");

  const fxRequest = buildTypedRequestFromParsedInput(
    createRequestInput("EURUSD", "price", deps),
    createRequestInput("EURUSD", "price", deps),
    3,
    deps,
  );
  assert.equal(fxRequest.requestType, "fx");
  assert.equal(fxRequest.baseCurrency, "EUR");
  assert.equal(fxRequest.quoteCurrency, "USD");

  const equityRequest = buildTypedRequestFromParsedInput(
    createRequestInput("TLV:KSMF59", "price", deps),
    createRequestInput("KSM.F59.TA", "price", deps),
    7,
    deps,
  );
  assert.equal(equityRequest.requestType, "equity");
  assert.equal(equityRequest.yahooSymbol, "KSM.F59.TA");
  assert.equal(equityRequest.allowTradingviewFallback, true);
});

test("buildTypedRequestFromResolvedTicker reuses RequestInput creation", () => {
  const deps = createDeps();
  const originalInput = createRequestInput("US02079K1079", "price", deps);
  const resolved = buildTypedRequestFromResolvedTicker(
    originalInput,
    "GOOG",
    5,
    deps,
  );

  assert.equal(resolved.requestType, "equity");
  assert.equal(resolved.yahooSymbol, "GOOG");
  assert.equal(resolved.identifierResolutionMs, 5);
});
