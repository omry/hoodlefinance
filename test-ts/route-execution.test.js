const assert = require("node:assert/strict");
const test = require("node:test");

const {
  createRouteJob,
  executeRouteJobs,
  getRouteExecutor,
} = require("../dist/ts/core/index.js");

function makeNode(name, resultsByCall) {
  let callIndex = 0;

  return {
    executeBatch(jobs) {
      const results =
        resultsByCall[Math.min(callIndex, resultsByCall.length - 1)];
      callIndex += 1;
      return jobs.map((_job, index) => results[index] || null);
    },
    name,
  };
}

test("getRouteExecutor returns the batch adapter for executable route nodes", () => {
  const node = makeNode("YAHOO", [[{ status: "success", value: 1 }]]);
  const adapter = getRouteExecutor(node);

  assert.equal(adapter.executorId, "YAHOO");
  assert.deepEqual(adapter.executeBatch([{}]), [
    { status: "success", value: 1 },
  ]);
  assert.throws(
    () => getRouteExecutor({ name: "BROKEN" }),
    /has no batch executor/,
  );
});

test("executeRouteJobs batches by executor and walks lookup failures forward", () => {
  const yahoo = makeNode("YAHOO", [
    [{ error: "Yahoo temporarily unavailable", status: "lookup_failure" }],
  ]);
  const ibkr = makeNode("IBKR", [
    [{ status: "success", value: { price: 10 } }],
  ]);

  const job = createRouteJob({
    routeNodes: [yahoo, ibkr],
    routeState: {},
    tickerInput: "GOOG",
  });

  executeRouteJobs([job], (error) => String(error));

  assert.deepEqual(job.value, { price: 10 });
  assert.equal(job.valueResolved, true);
  assert.equal(job.error, null);
  assert.equal(job.routeRuntimeTrace.length, 2);
  assert.equal(job.routeRuntimeTrace[0].label, "YAHOO");
  assert.equal(job.routeRuntimeTrace[1].label, "IBKR");
});

test("executeRouteJobs formats the final failure when all nodes are exhausted", () => {
  const yahoo = makeNode("YAHOO", [
    [{ error: "Bad response", status: "lookup_failure" }],
  ]);
  const ibkr = makeNode("IBKR", [
    [{ error: "Still bad", status: "lookup_failure" }],
  ]);
  const job = createRouteJob({
    routeNodes: [yahoo, ibkr],
    routeState: {},
    tickerInput: "GOOG",
  });

  executeRouteJobs([job], (error) => String(error));

  assert.match(job.error, /Failed nodes: YAHOO, IBKR\./);
});

test("executeRouteJobs leaves already resolved jobs untouched", () => {
  const node = makeNode("YAHOO", [[{ status: "success", value: 1 }]]);
  const job = createRouteJob({
    routeNodes: [node],
    value: 5,
    valueResolved: true,
  });

  executeRouteJobs([job], (error) => String(error));
  assert.equal(job.value, 5);
  assert.equal(job.routeRuntimeTrace.length, 0);
});
