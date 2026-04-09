const PSE_ISIN_MAP_URL =
  "https://raw.githubusercontent.com/omry/hoodlefinance/main/data/pse-isin-map.properties";
const CURRENCY_CODES_URL =
  "https://raw.githubusercontent.com/omry/hoodlefinance/main/data/currency-codes.json";

const TEST_PSE_ISIN_MAP_TEXT = "PHY077751022=PSE:BDO\n";
const TEST_CURRENCY_CODES_TEXT =
  '{"aliases":{},"canonicalCodes":["USD","EUR"],"cryptoCodes":[]}';

function createStaticResourceHttpFetch(overrides = {}) {
  const resourceTextByUrl = {
    [PSE_ISIN_MAP_URL]: TEST_PSE_ISIN_MAP_TEXT,
    [CURRENCY_CODES_URL]: TEST_CURRENCY_CODES_TEXT,
    ...overrides,
  };

  return function httpFetch(url) {
    return resourceTextByUrl[String(url)] || "";
  };
}

module.exports = {
  CURRENCY_CODES_URL,
  PSE_ISIN_MAP_URL,
  TEST_CURRENCY_CODES_TEXT,
  TEST_PSE_ISIN_MAP_TEXT,
  createStaticResourceHttpFetch,
};
