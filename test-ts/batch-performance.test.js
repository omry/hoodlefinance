const assert = require("node:assert/strict");
const test = require("node:test");
const {
  executeRouteJobs,
  createResolverRouteJob,
  RouteExecutionResolver,
  RequestInput,
  normalizeAttribute,
  parseAttributeRequest,
  parseTickerRequest,
  parseFxTicker,
  prepareRouteJob,
} = require("../dist/ts/core/index.js");

RequestInput.configureRuntime({
  looksLikeIsin: (v) => /^[A-Z]{2}[0-9A-Z]{9}[0-9]$/i.test(v),
  normalizeAttribute,
  parseAttributeRequest,
  parseTickerRequest: (ticker) => parseTickerRequest(ticker, () => false),
  parseFxTicker: () => null, // Mocking FX as not needed for these tests
});

function initJob(job, resolver) {
  const plan = { nodes: [resolver], routePath: "TEST", routeState: {} };
  prepareRouteJob(job, plan);
}

class MockBatchResolver extends RouteExecutionResolver {
  constructor(name, batchKeyPrefix = "key") {
    super(name, { routingDescription: "mock" });
    this.batchKeyPrefix = batchKeyPrefix;
    this.calls = 0;
    this.batchedJobCounts = [];
  }

  batchKey(job) {
    return `${this.batchKeyPrefix}:${job.request.ticker}`;
  }

  executeBatch(jobs) {
    this.calls += 1;
    this.batchedJobCounts.push(jobs.length);
    return jobs.map(() => ({ status: "success", quote: { price: 100 } }));
  }
}

test("executeRouteJobs groups by executor name (Existing behavior - PASS)", () => {
  const resolver = new MockBatchResolver("TEST-RESOLVER");
  const jobs = [
    createResolverRouteJob(new RequestInput("AAPL", "price")),
    createResolverRouteJob(new RequestInput("MSFT", "price")),
  ];

  jobs.forEach(j => initJob(j, resolver));

  executeRouteJobs(jobs, (e) => String(e));

  assert.equal(resolver.calls, 1);
  assert.equal(resolver.batchedJobCounts[0], 2);
});

// --- RECORDED GAPS (EXPECTED TO FAIL) ---

test("GAP: batching deduplication (two identical requests should be one batch item)", () => {
  const resolver = new MockBatchResolver("DEDUPE-RESOLVER");
  const jobs = [
    createResolverRouteJob(new RequestInput("GOOG", "price")),
    createResolverRouteJob(new RequestInput("GOOG", "price")),
  ];

  jobs.forEach(j => initJob(j, resolver));

  executeRouteJobs(jobs, (e) => String(e));

  // Current TS implementation passes BOTH to the resolver.
  // Legacy often deduplicated these to save network/processing.
  assert.equal(resolver.batchedJobCounts[0], 1, "Should have deduplicated the identical requests in the batch");
});

test("GAP: dynamic batchKey usage for grouping", () => {
  const resolver = new MockBatchResolver("KEY-RESOLVER");
  const jobs = [
    createResolverRouteJob(new RequestInput("AAPL", "price")),
    createResolverRouteJob(new RequestInput("MSFT", "price")),
  ];

  // If batchKey returned different keys, they should be in DIFFERENT batches
  // But current TS groups by node.name (executorId).
  resolver.batchKey = (job) => job.request.ticker; 

  jobs.forEach(j => initJob(j, resolver));

  executeRouteJobs(jobs, (e) => String(e));

  // If it honors batchKey, it should have 2 calls (one per ticker).
  // Current implementation has 1 call with 2 items.
  assert.equal(resolver.calls, 2, "Should have separated batches based on batchKey()");
});

test("GAP: synchronous/serial execution of independent batches", () => {
  let executionLog = [];
  
  const res1 = new MockBatchResolver("RES-1");
  res1.executeBatch = (jobs) => {
    executionLog.push("start-1");
    // Simulate some work or just record order
    executionLog.push("end-1");
    return jobs.map(() => ({ status: "success", quote: {} }));
  };

  const res2 = new MockBatchResolver("RES-2");
  res2.executeBatch = (jobs) => {
    executionLog.push("start-2");
    executionLog.push("end-2");
    return jobs.map(() => ({ status: "success", quote: {} }));
  };

  const jobs = [
    createResolverRouteJob(new RequestInput("AAPL", "price")),
    createResolverRouteJob(new RequestInput("GOOG", "price")),
  ];
  initJob(jobs[0], res1);
  initJob(jobs[1], res2);

  executeRouteJobs(jobs, (e) => String(e));

  // Current TS is serial. 
  // Recording this as a characteristic. If parallel execution is desired for perf parity, this would be a gap.
  assert.equal(executionLog.join(","), "start-1,end-1,start-2,end-2");
});
