const assert = require("node:assert/strict");
const test = require("node:test");

const {
  createRouteJob,
  executeRouteJobs,
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

test("executeRouteJobs walks lookup failures forward to the next node", () => {
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
