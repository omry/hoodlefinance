const test = require("node:test");

// Historical GAP breadcrumbs retained as TODOs after RouteJob-era execution removal.
test.todo("GAP: executeRouteJobs groups by executor name");

test.todo(
  "GAP: batching deduplication (two identical requests should be one batch item)",
);

test.todo("GAP: dynamic batchKey usage for grouping");

test.todo("GAP: synchronous/serial execution of independent batches");
